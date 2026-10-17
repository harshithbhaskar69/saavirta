import { z } from "zod";
import { HOUR, localClock } from "@/lib/time";
import { AppError } from "@/lib/errors";
import { fetchJson } from "@/lib/upstream";
import type {
  Baselines,
  HourlyNormal,
  Normals,
  Point,
  Revision,
  RunHour,
} from "./types";

const DAY = 24 * HOUR;
export const NORMAL_YEARS = 10,
  // Fewer usable years than this and the normal is withheld.
  MINIMUM_YEARS = 7,
  SMOOTHING_DAYS = 3,
  // Local days covered: a seven-day rolling window plus a partial day at each end.
  DAYS_BEFORE = 1,
  DAYS_AFTER = 8,
  // Open-Meteo asks clients to allow 10 minutes after availability before using a run.
  RUN_SETTLE_MS = 10 * 60_000,
  ECMWF_CYCLE_MS = 6 * HOUR,
  // Comparisons are background enrichment: give up sooner than the forecast does.
  TIMEOUT_MS = 5000;

const value = z.number().finite().nullable();
const seriesSchema = z.object({
  timezone: z.string(),
  hourly_units: z.object({
    time: z.literal("unixtime"),
    temperature_2m: z.literal("°C"),
    shortwave_radiation: z.literal("W/m²"),
  }),
  hourly: z.object({
    time: z.array(z.number().int()).min(1).max(1000),
    temperature_2m: z.array(value),
    shortwave_radiation: z.array(value),
  }),
});
export type Series = z.infer<typeof seriesSchema>;
const metaSchema = z.object({
  last_run_initialisation_time: z.number().int().positive(),
  last_run_availability_time: z.number().int().positive(),
});

export function parseSeries(raw: unknown): Series {
  const parsed = seriesSchema.safeParse(raw);
  const hourly = parsed.success ? parsed.data.hourly : null;
  if (
    !parsed.success ||
    !hourly ||
    hourly.temperature_2m.length !== hourly.time.length ||
    hourly.shortwave_radiation.length !== hourly.time.length ||
    hourly.time.some((t, i) => i > 0 && t - hourly.time[i - 1] !== 3600)
  )
    throw new AppError(
      "INVALID_PROVIDER_DATA",
      "The provider returned incomplete comparison data.",
      502,
      true,
    );
  return parsed.data;
}

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);
/** Calendar arithmetic on a YYYY-MM-DD key; 29 February rolls to 1 March in other years. */
export const shiftDate = (key: string, years: number, days = 0) => {
  const [y, m, d] = key.split("-").map(Number);
  return isoDate(Date.UTC(y + years, m - 1, d + days));
};
const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;
const round = (value: number, digits: number) =>
  Math.round(value * 10 ** digits) / 10 ** digits;
const irradiance = (value: number | null) =>
  value !== null && value < 0 ? null : value;

/**
 * Hourly normals for the point's local days around `now`: the mean of the same
 * local hour on the same date, ±SMOOTHING_DAYS, over NORMAL_YEARS past years.
 */
export function computeNormals(
  years: Series[],
  timezone: string,
  now: number,
): Normals["days"] {
  const clock = localClock(timezone);
  const samples = new Map<string, { t: number[]; sw: number[] }[]>();
  for (const series of years)
    series.hourly.time.forEach((seconds, i) => {
      const { day, hour } = clock(seconds * 1000);
      let hours = samples.get(day);
      if (!hours)
        samples.set(
          day,
          (hours = Array.from({ length: 24 }, () => ({ t: [], sw: [] }))),
        );
      const t = series.hourly.temperature_2m[i],
        sw = irradiance(series.hourly.shortwave_radiation[i]);
      if (t !== null) hours[hour].t.push(t);
      if (sw !== null) hours[hour].sw.push(sw);
    });
  // At least half of the possible samples must exist before a normal is reported.
  const minimum = (NORMAL_YEARS * (2 * SMOOTHING_DAYS + 1)) / 2;
  const today = clock(now).day,
    days: Normals["days"] = {};
  for (let offset = -DAYS_BEFORE; offset <= DAYS_AFTER; offset++) {
    const target = shiftDate(today, 0, offset);
    const pool = Array.from({ length: 24 }, () => ({
      t: [] as number[],
      sw: [] as number[],
    }));
    for (let n = 1; n <= NORMAL_YEARS; n++)
      for (let k = -SMOOTHING_DAYS; k <= SMOOTHING_DAYS; k++)
        samples.get(shiftDate(target, -n, k))?.forEach((hour, h) => {
          pool[h].t.push(...hour.t);
          pool[h].sw.push(...hour.sw);
        });
    days[target] = {
      temperatureC: pool.map((h) =>
        h.t.length >= minimum ? round(mean(h.t), 2) : null,
      ),
      solarIrradianceWm2: pool.map((h) =>
        h.sw.length >= minimum ? round(mean(h.sw), 1) : null,
      ),
    } satisfies HourlyNormal;
  }
  return days;
}

/** The newest settled ECMWF run and the run of the same cycle one day earlier. */
export function revisionRuns(meta: z.infer<typeof metaSchema>, now: number) {
  let latest = meta.last_run_initialisation_time * 1000;
  if (now < meta.last_run_availability_time * 1000 + RUN_SETTLE_MS)
    latest -= ECMWF_CYCLE_MS;
  return { latest, previous: latest - DAY };
}

/** Pairs the two runs by valid time; hours the older run lacks stay null. */
export function alignRuns(latest: Series, previous: Series): RunHour[] {
  const prior = new Map(previous.hourly.time.map((t, i) => [t, i]));
  return latest.hourly.time.map((seconds, i) => {
    const j = prior.get(seconds);
    return {
      time: seconds * 1000,
      latestC: latest.hourly.temperature_2m[i],
      previousC: j === undefined ? null : previous.hourly.temperature_2m[j],
      latestWm2: irradiance(latest.hourly.shortwave_radiation[i]),
      previousWm2:
        j === undefined
          ? null
          : irradiance(previous.hourly.shortwave_radiation[j]),
    };
  });
}

type Cache = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown, ttlSeconds: number): Promise<void>;
};

export function createBaselineService(
  cache: Cache,
  mode: string,
  apiKey: string | undefined,
  clock: () => number = Date.now,
  transport: typeof fetch = fetch,
  log: (event: string) => void = () => {},
) {
  const url = (api: string, path: string, params: Record<string, string>) => {
    const customer = mode === "customer" && apiKey;
    const target = new URL(
      path,
      `https://${customer ? "customer-" : ""}${api}.open-meteo.com`,
    );
    target.search = new URLSearchParams({
      ...params,
      ...(customer ? { apikey: apiKey } : {}),
    }).toString();
    return target;
  };
  const place = (point: Point) => ({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    hourly: "temperature_2m,shortwave_radiation",
    timeformat: "unixtime",
    timezone: "auto",
  });
  // Keep pending work request-local so an ended invocation cannot block later callers.
  async function cached<T>(
    key: string | null,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    if (!key) return load();
    try {
      const hit = await cache.get(key);
      if (hit) return hit as T;
    } catch {
      log("baseline_cache_read_failed");
    }
    const result = await load();
    try {
      await cache.put(key, result, ttlSeconds);
    } catch {
      log("baseline_cache_write_failed");
    }
    return result;
  }
  const loadNormals = async (point: Point, now: number) => {
    const today = isoDate(now);
    // One extra day each side covers any UTC offset of the local calendar.
    const before = DAYS_BEFORE + SMOOTHING_DAYS + 1,
      after = DAYS_AFTER + SMOOTHING_DAYS + 1;
    // Sequential on purpose: Open-Meteo stalls bursts of new connections from one
    // client, while consecutive requests reuse one connection (about 1-2 s in total).
    const years: Series[] = [];
    for (let i = 0; i < NORMAL_YEARS; i++) {
      try {
        years.push(
          parseSeries(
            await fetchJson(
              url("archive-api", "/v1/archive", {
                ...place(point),
                models: "era5_seamless",
                start_date: shiftDate(today, -(i + 1), -before),
                end_date: shiftDate(today, -(i + 1), after),
              }),
              transport,
              TIMEOUT_MS,
            ),
          ),
        );
      } catch {
        log("normals_year_failed");
      }
      // Stop once the minimum can no longer be reached.
      if (i + 1 - years.length > NORMAL_YEARS - MINIMUM_YEARS) break;
    }
    if (years.length < MINIMUM_YEARS)
      throw new AppError(
        "PROVIDER_ERROR",
        "Too few past years were available for a normal.",
        503,
        true,
      );
    const timezone = years[0].timezone,
      year = Number(today.slice(0, 4));
    return {
      timezone,
      normals: {
        source: "ERA5 and ERA5-Land reanalysis",
        years: [year - NORMAL_YEARS, year - 1],
        yearCount: years.length,
        smoothingDays: SMOOTHING_DAYS,
        days: computeNormals(years, timezone, now),
      } satisfies Normals,
    };
  };
  const loadRevision = async (
    point: Point,
    now: number,
    privatePoint: boolean,
  ) => {
    const meta = metaSchema.safeParse(
      await fetchJson(
        new URL("https://api.open-meteo.com/data/ecmwf_ifs/static/meta.json"),
        transport,
        TIMEOUT_MS,
      ),
    );
    if (!meta.success)
      throw new AppError(
        "INVALID_PROVIDER_DATA",
        "The provider returned unreadable model run times.",
        502,
        true,
      );
    const runs = revisionRuns(meta.data, now);
    const run = (time: number) =>
      url("single-runs-api", "/v1/forecast", {
        ...place(point),
        models: "ecmwf_ifs",
        run: new Date(time).toISOString().slice(0, 16),
        forecast_days: "7",
      });
    return cached(
      privatePoint
        ? null
        : `baselines:v1:revision:${mode}:${point.latitude}:${point.longitude}:${runs.latest}`,
      12 * 3600,
      async () => {
        const latest = parseSeries(
          await fetchJson(run(runs.latest), transport, TIMEOUT_MS),
        );
        const previous = parseSeries(
          await fetchJson(run(runs.previous), transport, TIMEOUT_MS),
        );
        return {
          timezone: latest.timezone,
          revision: {
            model: "ECMWF IFS 9 km",
            latestRun: runs.latest,
            previousRun: runs.previous,
            hours: alignRuns(latest, previous),
          } satisfies Revision,
        };
      },
    );
  };
  return async (point: Point, privatePoint = false): Promise<Baselines> => {
    const now = clock();
    const [normals, revision] = await Promise.allSettled([
      cached(
        privatePoint
          ? null
          : `baselines:v1:normals:${mode}:${point.latitude}:${point.longitude}:${isoDate(now)}`,
        3 * 86_400,
        () => loadNormals(point, now),
      ),
      loadRevision(point, now, privatePoint),
    ]);
    // Error codes only: request URLs carry coordinates and stay out of logs.
    const code = (result: PromiseSettledResult<unknown>) =>
      result.status === "rejected" && result.reason instanceof AppError
        ? `:${result.reason.code}`
        : "";
    if (normals.status === "rejected") log(`normals_failed${code(normals)}`);
    if (revision.status === "rejected") log(`revision_failed${code(revision)}`);
    const n = normals.status === "fulfilled" ? normals.value : null,
      r = revision.status === "fulfilled" ? revision.value : null;
    return {
      timezone: n?.timezone ?? r?.timezone ?? "UTC",
      normals: n?.normals ?? null,
      revision: r?.revision ?? null,
    };
  };
}
