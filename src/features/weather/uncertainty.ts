import { z } from "zod";
import { HOUR, localClock } from "@/lib/time";
import { AppError } from "@/lib/errors";
import { COOLING_BASE_C, HEATING_BASE_C, localDays } from "./overview";
import { HORIZONS, type Horizon } from "./types";

export const ENSEMBLE_MODEL = "ecmwf_ifs025";
export const ENSEMBLE_MEMBERS = 51;
export const ENSEMBLE_HOURS = 193;
export const ENSEMBLE_FRESH_MS = HOUR;
export const ENSEMBLE_MAX_AGE_MS = 6 * HOUR;

const sample = z.number().finite().nullable();
const samples = z.array(sample).min(1).max(ENSEMBLE_HOURS);
const timezone = z.string().refine((zone) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
});
export const ensembleSnapshotSchema = z
  .object({
    version: z.literal(1),
    timezone,
    retrievedAt: z.number().int().nonnegative(),
    time: z.array(z.number().int()).min(1).max(ENSEMBLE_HOURS),
    members: z
      .array(z.object({ temperatureC: samples, solarIrradianceWm2: samples }))
      .length(ENSEMBLE_MEMBERS),
  })
  .refine(
    (data) =>
      data.time.every(
        (time, i) => i === 0 || time - data.time[i - 1] === HOUR,
      ) &&
      data.members.every(
        (m) =>
          m.temperatureC.length === data.time.length &&
          m.solarIrradianceWm2.length === data.time.length,
      ),
  );
export type EnsembleSnapshot = z.infer<typeof ensembleSnapshotSchema>;

const rangeSchema = z
  .object({
    p10: z.number().finite(),
    p50: z.number().finite(),
    p90: z.number().finite(),
  })
  .refine((range) => range.p10 <= range.p50 && range.p50 <= range.p90);
export type ForecastRange = z.infer<typeof rangeSchema>;
export const uncertaintySchema = z.object({
  version: z.literal(1),
  model: z.literal("ECMWF IFS 0.25° ensemble"),
  memberCount: z.literal(51),
  timezone,
  start: z.number().int(),
  horizon: z.enum(["24h", "48h", "7d"]),
  source: z.object({
    provider: z.literal("Open-Meteo"),
    retrievedAt: z.number().int(),
    runTime: z.null(),
    stale: z.boolean(),
    refreshFailed: z.boolean(),
    calibrated: z.literal(false),
  }),
  hourly: z
    .array(
      z.object({
        time: z.number().int(),
        temperatureC: rangeSchema.nullable(),
        solarIrradianceWm2: rangeSchema.nullable(),
      }),
    )
    .max(168),
  daily: z
    .array(
      z.object({
        key: z.string(),
        partial: z.boolean(),
        heatingDegreeDays: rangeSchema.nullable(),
        coolingDegreeDays: rangeSchema.nullable(),
        solarEnergyKwhM2: rangeSchema.nullable(),
      }),
    )
    .max(9),
});
export type Uncertainty = z.infer<typeof uncertaintySchema>;

const invalidProvider = () =>
  new AppError(
    "INVALID_PROVIDER_DATA",
    "The ensemble provider returned incomplete data.",
    502,
    true,
  );
const providerSchema = z.object({
  timezone,
  hourly_units: z.record(z.string(), z.string()),
  hourly: z
    .object({
      time: z.array(z.number().int()).min(1).max(ENSEMBLE_HOURS),
    })
    .catchall(samples),
});

export function parseEnsemble(
  raw: unknown,
  retrievedAt: number,
): EnsembleSnapshot {
  const parsed = providerSchema.safeParse(raw);
  if (!parsed.success) throw invalidProvider();
  const data = parsed.data;
  if (data.hourly_units.time !== "unixtime") throw invalidProvider();
  const members = Array.from({ length: ENSEMBLE_MEMBERS }, (_, i) => {
    const suffix = i === 0 ? "" : `_member${String(i).padStart(2, "0")}`;
    const temperature = `temperature_2m${suffix}`,
      solar = `shortwave_radiation${suffix}`;
    if (
      data.hourly_units[temperature] !== "°C" ||
      data.hourly_units[solar] !== "W/m²" ||
      !data.hourly[temperature] ||
      !data.hourly[solar]
    )
      throw invalidProvider();
    return {
      temperatureC: data.hourly[temperature],
      solarIrradianceWm2: data.hourly[solar].map((v) =>
        v !== null && v < 0 ? null : v,
      ),
    };
  });
  const result = ensembleSnapshotSchema.safeParse({
    version: 1,
    timezone: data.timezone,
    retrievedAt,
    time: data.hourly.time.map((t) => t * 1000),
    members,
  });
  if (!result.success) throw invalidProvider();
  return result.data;
}

/** Linear sample quantiles; with 51 members P10/P50/P90 are ranks 6/26/46. */
export function ensembleRange(values: (number | null)[]): ForecastRange | null {
  // Require every member: dropping missing extremes can make spread look too narrow.
  if (values.length !== ENSEMBLE_MEMBERS || values.some((v) => v === null))
    return null;
  const sorted = (values as number[]).slice().sort((a, b) => a - b);
  return { p10: sorted[5], p50: sorted[25], p90: sorted[45] };
}

export function uncertaintyStart(value: unknown, now: number): number {
  const parsed = z
    .number()
    .int()
    .multipleOf(60_000)
    .min(now - 2 * HOUR)
    .max(now + HOUR)
    .safeParse(value);
  if (!parsed.success)
    throw new AppError(
      "INVALID_REQUEST",
      "Refresh the point forecast before requesting its range.",
      400,
    );
  return parsed.data;
}

export function summarizeEnsemble(
  snapshot: EnsembleSnapshot,
  start: number,
  horizon: Horizon,
  now: number,
  refreshFailed = false,
): Uncertainty {
  const at = new Map(snapshot.time.map((time, i) => [time, i]));
  const hours = Array.from({ length: HORIZONS[horizon] }, (_, i) => ({
    time: start + i * HOUR,
  }));
  const value = (
    member: EnsembleSnapshot["members"][number],
    key: keyof typeof member,
    time: number,
  ) => {
    const index = at.get(time);
    return index === undefined ? null : member[key][index];
  };
  const sum = (
    values: (number | null)[],
    transform: (value: number) => number,
  ) =>
    values.length && values.every((v) => v !== null)
      ? values.reduce<number>((total, v) => total + transform(v!), 0)
      : null;
  const clock = localClock(snapshot.timezone);
  return {
    version: 1,
    model: "ECMWF IFS 0.25° ensemble",
    memberCount: 51,
    timezone: snapshot.timezone,
    start,
    horizon,
    source: {
      provider: "Open-Meteo",
      retrievedAt: snapshot.retrievedAt,
      // The latest-ensemble response does not identify an official model run.
      runTime: null,
      stale: now - snapshot.retrievedAt >= ENSEMBLE_FRESH_MS,
      refreshFailed,
      calibrated: false,
    },
    hourly: hours.map(({ time }) => ({
      time,
      temperatureC: ensembleRange(
        snapshot.members.map((m) => value(m, "temperatureC", time)),
      ),
      solarIrradianceWm2: ensembleRange(
        snapshot.members.map((m) => value(m, "solarIrradianceWm2", time)),
      ),
    })),
    daily: localDays(hours, snapshot.timezone).map(
      ({ key, instants, intervals }) => ({
        key,
        partial:
          clock(instants[0].time - HOUR).day === key ||
          clock(instants.at(-1)!.time + HOUR).day === key ||
          intervals.length < instants.length,
        heatingDegreeDays: ensembleRange(
          snapshot.members.map((m) =>
            sum(
              instants.map((h) => value(m, "temperatureC", h.time)),
              (t) => Math.max(HEATING_BASE_C - t, 0) / 24,
            ),
          ),
        ),
        coolingDegreeDays: ensembleRange(
          snapshot.members.map((m) =>
            sum(
              instants.map((h) => value(m, "temperatureC", h.time)),
              (t) => Math.max(t - COOLING_BASE_C, 0) / 24,
            ),
          ),
        ),
        solarEnergyKwhM2: ensembleRange(
          snapshot.members.map((m) =>
            sum(
              intervals.map((h) => value(m, "solarIrradianceWm2", h.time)),
              (solar) => solar / 1000,
            ),
          ),
        ),
      }),
    ),
  };
}
