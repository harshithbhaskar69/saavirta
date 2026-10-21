import { HOUR, localClock } from "@/lib/time";
import type { Baselines, Hour, HourlyNormal } from "./types";
import type { Uncertainty } from "./uncertainty";

// Illustrative balance temperatures, not a calibrated load model.
export const HEATING_BASE_C = 18;
export const COOLING_BASE_C = 22;

type Values = (number | null)[];
const known = (values: Values) =>
  values.filter((value): value is number => value !== null);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
// Totals need every sample; extremes and means use the samples available.
const total = (values: Values) =>
  values.length && values.every((v) => v !== null)
    ? sum(values as number[])
    : null;
const mean = (values: Values) => {
  const k = known(values);
  return k.length ? sum(k) / k.length : null;
};
const extreme = (values: Values, pick: (...v: number[]) => number) => {
  const k = known(values);
  return k.length ? pick(...k) : null;
};
const degreeDays = (temperatures: Values, excess: (c: number) => number) =>
  temperatures.length && temperatures.every((c) => c !== null)
    ? sum(temperatures.map((c) => Math.max(excess(c!), 0))) / 24
    : null;

export type DaySummary = {
  key: string;
  start: number;
  end: number;
  /** The forecast window cuts this local day: it starts after midnight or ends before the next. */
  startsLate: boolean;
  endsEarly: boolean;
  low: number | null;
  high: number | null;
  heatingDegreeDays: number | null;
  coolingDegreeDays: number | null;
  solarEnergyKwhM2: number | null;
  solarPeakWm2: number | null;
  /** End of the peak preceding-hour interval; null unless the peak is positive. */
  solarPeakTime: number | null;
  humidityMeanPct: number | null;
  humidityLowPct: number | null;
  humidityHighPct: number | null;
  cloudMeanPct: number | null;
  cloudMaxPct: number | null;
  windMeanMs: number | null;
  windMaxMs: number | null;
  windGustMaxMs: number | null;
  precipitationMm: number | null;
  precipitationProbabilityMaxPct: number | null;
};

type LocalDay<T> = { key: string; instants: T[]; intervals: T[] };
/**
 * Groups contiguous hours into the point's local calendar days. Instantaneous
 * samples (temperature, humidity, wind, cloud) belong to the day of their timestamp;
 * preceding-hour values (irradiance, gusts, precipitation and its probability)
 * belong to the day their interval starts.
 */
export function localDays<T extends { time: number }>(
  hours: T[],
  timezone: string,
): LocalDay<T>[] {
  const clock = localClock(timezone);
  const days = new Map<string, LocalDay<T>>();
  for (const hour of hours) {
    const key = clock(hour.time).day;
    if (!days.has(key)) days.set(key, { key, instants: [], intervals: [] });
    days.get(key)!.instants.push(hour);
  }
  for (const hour of hours)
    days.get(clock(hour.time - HOUR).day)?.intervals.push(hour);
  return [...days.values()];
}

export interface WindHighlight {
  label: string;
  time: number;
  value: number;
  precedingHour: boolean;
}

/** Extremes of available forecast hours; ties use the first occurrence. */
export function windHighlights(
  instants: Hour[],
  intervals: Hour[],
): WindHighlight[] {
  const highlights: WindHighlight[] = [];
  for (const [label, hours, field, lowest] of [
    ["Strongest wind", instants, "windSpeedMs", false],
    ["Lowest wind", instants, "windSpeedMs", true],
    ["Peak gust", intervals, "windGustMs", false],
  ] as const) {
    let best: WindHighlight | null = null;
    for (const hour of hours) {
      const value = hour[field];
      if (
        value !== null &&
        (best === null || (lowest ? value < best.value : value > best.value))
      )
        best = {
          label,
          value,
          time: hour.time,
          precedingHour: field === "windGustMs",
        };
    }
    if (best) highlights.push(best);
  }
  return highlights;
}

/** "Today" and "Tomorrow" by the point's calendar, null for later days. */
export function relativeDays(
  keys: string[],
  firstTime: number,
  timezone: string,
) {
  // The first forecast hour is within the next hour, so one hour earlier is always today.
  const today = localClock(timezone)(firstTime - HOUR).day;
  return keys.map((key, i) =>
    key === today
      ? "Today"
      : i === 0 || keys[i - 1] === today
        ? "Tomorrow"
        : null,
  );
}

export function dailySummary(hours: Hour[], timezone: string): DaySummary[] {
  const clock = localClock(timezone);
  return localDays(hours, timezone).map(({ key, instants, intervals }) => {
    const first = instants[0],
      last = instants.at(-1)!;
    const contiguous = instants.every(
      (h, i) => i === 0 || h.time - instants[i - 1].time === HOUR,
    );
    const temperatures = instants.map((h) => h.temperatureC);
    const solar = total(intervals.map((h) => h.solarIrradianceWm2));
    const peak = intervals.reduce<Hour | null>(
      (best, h) =>
        h.solarIrradianceWm2 !== null &&
        (best === null || h.solarIrradianceWm2 > best.solarIrradianceWm2!)
          ? h
          : best,
      null,
    );
    return {
      key,
      start: first.time,
      end: last.time,
      startsLate: !contiguous || clock(first.time - HOUR).day === key,
      endsEarly:
        !contiguous ||
        clock(last.time + HOUR).day === key ||
        intervals.length < instants.length,
      low: extreme(temperatures, Math.min),
      high: extreme(temperatures, Math.max),
      heatingDegreeDays: degreeDays(temperatures, (c) => HEATING_BASE_C - c),
      coolingDegreeDays: degreeDays(temperatures, (c) => c - COOLING_BASE_C),
      solarEnergyKwhM2: solar === null ? null : solar / 1000,
      solarPeakWm2: peak?.solarIrradianceWm2 ?? null,
      solarPeakTime: peak && peak.solarIrradianceWm2! > 0 ? peak.time : null,
      humidityMeanPct: mean(instants.map((h) => h.humidityPct)),
      humidityLowPct: extreme(
        instants.map((h) => h.humidityPct),
        Math.min,
      ),
      humidityHighPct: extreme(
        instants.map((h) => h.humidityPct),
        Math.max,
      ),
      cloudMeanPct: mean(instants.map((h) => h.cloudCoverPct)),
      cloudMaxPct: extreme(
        instants.map((h) => h.cloudCoverPct),
        Math.max,
      ),
      windMeanMs: mean(instants.map((h) => h.windSpeedMs)),
      windMaxMs: extreme(
        instants.map((h) => h.windSpeedMs),
        Math.max,
      ),
      windGustMaxMs: extreme(
        intervals.map((h) => h.windGustMs),
        Math.max,
      ),
      precipitationMm: total(intervals.map((h) => h.precipitationMm)),
      precipitationProbabilityMaxPct: extreme(
        intervals.map((h) => h.precipitationProbabilityPct),
        Math.max,
      ),
    };
  });
}

export type DayComparison = {
  /** Forecast minus normal mean temperature over the same local hours, °C. */
  anomalyC: number | null;
  /** Forecast solar energy against normal over the same intervals, percent. */
  solarAnomalyPct: number | null;
  /** Latest minus previous ECMWF run: mean temperature over the same hours, °C. */
  revisionC: number | null;
  /** Latest minus previous ECMWF run: solar energy over the same intervals, kWh/m². */
  revisionKwhM2: number | null;
};
type Pairs = [number, number][];
// Every hour of the row must have both values, so partial coverage never skews a day.
const pairs = (
  list: Hour[],
  a: (h: Hour) => number | null | undefined,
  b: (h: Hour) => number | null | undefined,
): Pairs | null => {
  const values = list.map((h) => [a(h) ?? null, b(h) ?? null]);
  return values.length && values.every(([x, y]) => x !== null && y !== null)
    ? (values as Pairs)
    : null;
};
const sumDifference = (p: Pairs) => p.reduce((sum, [x, y]) => sum + x - y, 0);
const meanDifference = (p: Pairs) => sumDifference(p) / p.length;
// Below 50 Wh/m² of normal sunshine (dusk-only partial days, polar night) a percentage is noise.
export const SOLAR_NORMAL_FLOOR_WH = 50;

export function compareDays(
  hours: Hour[],
  timezone: string,
  baselines: Baselines | null | undefined,
): Map<string, DayComparison> {
  const clock = localClock(timezone);
  // Normals are keyed by local date and hour, so they must share the forecast's zone.
  const normals =
    baselines?.timezone === timezone ? baselines.normals?.days : undefined;
  const normal = (time: number, field: keyof HourlyNormal) => {
    const { day, hour } = clock(time);
    return normals?.[day]?.[field][hour];
  };
  const runs = new Map(baselines?.revision?.hours.map((h) => [h.time, h]));
  return new Map(
    localDays(hours, timezone).map(({ key, instants, intervals }) => {
      const temperature = pairs(
        instants,
        (h) => h.temperatureC,
        (h) => normal(h.time, "temperatureC"),
      );
      const solar = pairs(
        intervals,
        (h) => h.solarIrradianceWm2,
        (h) => normal(h.time, "solarIrradianceWm2"),
      );
      const runTemperature = pairs(
        instants,
        (h) => runs.get(h.time)?.latestC,
        (h) => runs.get(h.time)?.previousC,
      );
      const runSolar = pairs(
        intervals,
        (h) => runs.get(h.time)?.latestWm2,
        (h) => runs.get(h.time)?.previousWm2,
      );
      const normalWh = solar?.reduce((sum, [, y]) => sum + y, 0) ?? 0;
      return [
        key,
        {
          anomalyC: temperature && meanDifference(temperature),
          solarAnomalyPct:
            solar && normalWh >= SOLAR_NORMAL_FLOOR_WH
              ? (sumDifference(solar) / normalWh) * 100
              : null,
          revisionC: runTemperature && meanDifference(runTemperature),
          revisionKwhM2: runSolar && sumDifference(runSolar) / 1000,
        },
      ];
    }),
  );
}

/** Normal temperature for each forecast hour, for drawing beside the forecast. */
export function normalSeries(
  hours: Hour[],
  timezone: string,
  baselines: Baselines | null | undefined,
) {
  const normals =
    baselines?.timezone === timezone ? baselines.normals?.days : undefined;
  if (!normals) return null;
  const clock = localClock(timezone);
  return hours.map((h) => {
    const { day, hour } = clock(h.time);
    return normals[day]?.temperatureC[hour] ?? null;
  });
}

export function forecastCsv(
  hours: Hour[],
  timezone: string,
  uncertainty?: Uncertainty,
) {
  const ranges = new Map(uncertainty?.hourly.map((h) => [h.time, h]));
  const headings = [
    "time_utc",
    "local_time",
    "timezone",
    "temperature_C",
    "solar_preceding_hour_mean_W_m2",
    "wind_10m_m_s",
    "gust_preceding_hour_max_m_s",
    "cloud_cover_pct",
    "relative_humidity_pct",
    "precipitation_preceding_hour_mm",
    "precipitation_probability_pct",
    ...(uncertainty
      ? [
          ...[
            "ensemble_temperature_C",
            "ensemble_solar_preceding_hour_mean_W_m2",
          ].flatMap((name) => ["p10", "p50", "p90"].map((p) => `${name}_${p}`)),
          "ensemble_model",
          "ensemble_retrieved_utc",
          "ensemble_calibrated",
        ]
      : []),
  ];
  const local = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  return [
    headings.join(","),
    ...hours.map((h) =>
      [
        new Date(h.time).toISOString(),
        local.format(h.time),
        timezone,
        h.temperatureC,
        h.solarIrradianceWm2,
        h.windSpeedMs,
        h.windGustMs,
        h.cloudCoverPct,
        h.humidityPct,
        h.precipitationMm,
        h.precipitationProbabilityPct,
        ...(uncertainty
          ? [
              ...[
                ranges.get(h.time)?.temperatureC,
                ranges.get(h.time)?.solarIrradianceWm2,
              ].flatMap((r) => [
                r?.p10 ?? null,
                r?.p50 ?? null,
                r?.p90 ?? null,
              ]),
              uncertainty.model,
              new Date(uncertainty.source.retrievedAt).toISOString(),
              false,
            ]
          : []),
      ]
        .map((value) =>
          value === null ? "" : `"${String(value).replaceAll('"', '""')}"`,
        )
        .join(","),
    ),
  ].join("\r\n");
}
