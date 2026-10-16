import type { Dashboard, Interval } from "./contracts";
import type { Hour } from "@/features/weather/types";
import { HOUR, localClock, localTime, offset } from "@/lib/time";

export function deliveryAxis(domain: [number, number]) {
  const zone = "Europe/Helsinki",
    clock = localClock(zone);
  const ticks: number[] = [],
    dayStarts: number[] = [];
  const daysOnly = domain[1] - domain[0] > 25 * HOUR;
  const step = domain[1] - domain[0] <= 8 * HOUR ? 1 : 6;
  for (let t = domain[0]; t <= domain[1]; t += HOUR) {
    const { hour } = clock(t);
    if (hour === 0) dayStarts.push(t);
    if (hour === 0 || (!daysOnly && hour % step === 0)) ticks.push(t);
  }
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    day: "numeric",
    month: "short",
  });
  const key = (t: number) => `${clock(t).day}/${localTime(t, zone)}`;
  const counts = new Map<string, number>();
  for (const t of ticks) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1);
  return {
    ticks,
    dayStarts,
    label: (t: number) =>
      clock(t).hour === 0
        ? date.format(t)
        : `${localTime(t, zone)}${(counts.get(key(t)) ?? 0) > 1 ? ` ${offset(t, zone)}` : ""}`,
  };
}

// Only age the display; the server supplies deadlines and all market calculations.
export function visibleDashboard(data: Dashboard, now: number): Dashboard {
  if (data.marketContext.demonstration) return data;
  function age<
    T extends {
      quality: Dashboard["series"][number]["quality"];
      intervals: Interval[];
    },
  >(s: T): T {
    const expired =
      s.quality.usableUntil !== null && now > Date.parse(s.quality.usableUntil);
    const stale =
      s.quality.freshUntil !== null && now > Date.parse(s.quality.freshUntil);
    if (!expired && !stale) return s;
    return {
      ...s,
      quality: {
        ...s.quality,
        freshness: "stale",
        ...(expired
          ? {
              availability: "unavailable",
              coverage: 0,
              issues: [...s.quality.issues, "expired"],
            }
          : {}),
      },
      intervals: expired
        ? s.intervals.map((p) => ({
            ...p,
            value: null,
            coverage: 0,
            missingReason: "expired",
          }))
        : s.intervals,
    };
  }
  return {
    ...data,
    series: data.series.map(age),
    metrics: data.metrics.map(age),
  };
}

export function deliveryLabel(value: string | number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Helsinki",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  }).format(new Date(value));
}
export function intervalAt(intervals: Interval[], time: number) {
  return intervals.find(
    (p) => Date.parse(p.start) <= time && time < Date.parse(p.end),
  );
}
export function weatherAt(hours: Hour[], time: number) {
  // Irradiance is the preceding hour's mean; instantaneous fields keep their sample time.
  return {
    instant: hours.find((h) => h.time <= time && time < h.time + 3_600_000),
    irradiance: hours.find((h) => h.time - 3_600_000 <= time && time < h.time),
  };
}
export function marketCsv(data: Dashboard) {
  const fields = [
    "series",
    "start_utc",
    "end_utc",
    "start_helsinki",
    "value",
    "unit",
    "coverage",
    "provisional",
    "missing_reason",
    "freshness",
    "collected_inputs",
    "demonstration",
  ];
  const rows: unknown[][] = [fields];
  for (const series of [...data.series, ...data.metrics]) {
    if (series.unit === "EUR/MWh" && !data.priceExportAllowed) continue;
    for (const p of series.intervals)
      rows.push([
        series.id,
        p.start,
        p.end,
        deliveryLabel(p.start),
        p.value ?? "",
        series.unit,
        p.coverage,
        p.provisional,
        p.missingReason ?? "",
        series.quality.freshness,
        p.inputs
          .map((i) => `${i.seriesId}:${i.snapshotId}@${i.collectedAt}`)
          .join(";"),
        data.marketContext.demonstration,
      ]);
  }
  return rows
    .map((row) =>
      row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}
