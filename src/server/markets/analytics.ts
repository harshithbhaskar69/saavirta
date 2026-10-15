import type { Dashboard, MarketSeries } from "@/features/markets/contracts";
import { missingInterval } from "./model";
import type { Batch, Metric, Window } from "./model";
import {
  addDays,
  appendRefs,
  day,
  deliveryWindow,
  hour,
  localDate,
  minute,
  quality,
  resample,
} from "./time";

export function residual(
  demand: MarketSeries,
  wind: MarketSeries,
  solar: MarketSeries,
): Metric {
  const intervals = demand.intervals.map((d, index) => {
    const p = missingInterval(d.start, d.end, "missing-input");
    const w = wind.intervals[index],
      s = solar.intervals[index];
    if (
      w &&
      s &&
      d.value !== null &&
      w.value !== null &&
      s.value !== null &&
      d.start === w.start &&
      d.start === s.start &&
      d.end === w.end &&
      d.end === s.end
    ) {
      p.value = d.value - w.value - s.value;
      p.coverage = 1;
      p.missingReason = null;
      p.inputs = appendRefs(d.inputs, w.inputs, s.inputs);
    }
    return p;
  });
  return {
    id: "residual-load",
    label: "Forecast residual load",
    unit: "MW",
    formulaVersion: "residual-load/v1",
    limitations:
      "Consumption forecast minus wind and solar forecasts. Not net imports, a system deficit, procurement volume or a price prediction.",
    intervals,
    quality: quality(
      intervals,
      [demand, wind, solar].every((s) => s.quality.freshness === "fresh")
        ? "fresh"
        : "stale",
    ),
  };
}
export function baseline(
  archive: readonly Batch[],
  cutoff: number,
): Batch | undefined {
  let selected: Batch | undefined;
  for (const batch of archive) {
    const collected = Date.parse(batch.collectedAt);
    if (collected > cutoff || collected < cutoff - 30 * minute) continue;
    if (!selected || collected > Date.parse(selected.collectedAt))
      selected = batch;
  }
  return selected;
}
export function forecastError(
  actual: MarketSeries,
  archive: readonly Batch[],
  now: number,
): Metric[] {
  const intervals = actual.intervals.map((a) => {
    const result = missingInterval(a.start, a.end, "history-collecting");
    const snapshot = baseline(archive, Date.parse(a.start) - day);
    let expected: number | null = null;
    if (
      snapshot &&
      a.value !== null &&
      !a.provisional &&
      Date.parse(a.end) <= now
    ) {
      const old = resample(snapshot.intervals, [a])[0];
      if (old && old.value !== null) {
        expected = old.value;
        result.value = a.value - expected;
        result.coverage = 1;
        result.missingReason = null;
        result.inputs = appendRefs(a.inputs, old.inputs);
      }
    }
    return { result, expected };
  });
  const base = {
    label: "Consumption error",
    formulaVersion: "consumption-error/v1",
    limitations:
      "Actual minus forecast collected approximately 24 hours earlier (30-minute tolerance). Not an official day-ahead forecast or a retailer imbalance.",
  };
  return (["MW", "%"] as const).map((unit) => {
    const points = intervals.map(({ result, expected }) => {
      if (unit === "MW" || result.value === null || expected === null)
        return result;
      return expected === 0
        ? {
            ...result,
            value: null,
            coverage: 0,
            missingReason: "zero-baseline",
          }
        : { ...result, value: (100 * result.value) / expected };
    });
    const q = quality(points, actual.quality.freshness);
    if (!q.coverage) q.issues.push("history-collecting");
    return {
      ...base,
      id: unit === "MW" ? "consumption-error" : "consumption-error-percent",
      unit,
      intervals: points,
      quality: q,
    };
  });
}
export function revision(
  latest: MarketSeries,
  archive: readonly Batch[],
): Metric {
  const intervals = latest.intervals.map((p) => {
    const result = missingInterval(p.start, p.end, "history-collecting");
    const ref = p.inputs[0];
    if (p.value !== null && p.inputs.length === 1 && ref) {
      const snapshot = baseline(archive, Date.parse(ref.collectedAt) - hour);
      const old = snapshot ? resample(snapshot.intervals, [p])[0] : undefined;
      if (old && old.value !== null) {
        result.value = p.value - old.value;
        result.coverage = 1;
        result.missingReason = null;
        result.inputs = appendRefs(p.inputs, old.inputs);
      }
    }
    return result;
  });
  const q = quality(intervals, latest.quality.freshness);
  if (!q.coverage) q.issues.push("history-collecting");
  return {
    id: `${latest.id}-revision`,
    label: `${latest.label} change over one hour`,
    unit: "MW",
    formulaVersion: "observed-revision/v1",
    limitations:
      "Latest minus an observed collection one hour earlier (30-minute tolerance). Not necessarily a provider model-run revision.",
    intervals,
    quality: q,
  };
}
export function summarizePrices(
  points: MarketSeries["intervals"],
  window: Window,
): Dashboard["priceSummaries"] {
  const result: Dashboard["priceSummaries"] = [];
  for (
    let date = localDate(Date.parse(window.start));
    date < localDate(Date.parse(window.end));
    date = addDays(date, 1)
  ) {
    const local = deliveryWindow(date, 1),
      start = Date.parse(local.start),
      end = Date.parse(local.end);
    const summary: Dashboard["priceSummaries"][number] = {
      date,
      label: "Published-period average",
      average: null,
      minimum: null,
      maximum: null,
      negativeMinutes: 0,
      coverage: 0,
    };
    let weighted = 0,
      covered = 0;
    for (const point of points) {
      const duration =
        Math.min(Date.parse(point.end), end) -
        Math.max(Date.parse(point.start), start);
      if (point.value === null || duration <= 0) continue;
      covered += duration;
      weighted += point.value * duration;
      if (point.value < 0) summary.negativeMinutes += duration / minute;
      if (
        summary.minimum === null ||
        point.value < (summary.minimum.value ?? Infinity)
      )
        summary.minimum = point;
      if (
        summary.maximum === null ||
        point.value > (summary.maximum.value ?? -Infinity)
      )
        summary.maximum = point;
    }
    summary.coverage = covered / (end - start);
    if (covered) summary.average = weighted / covered;
    if (summary.coverage >= 1 - 1e-9)
      summary.label = "Daily time-weighted average";
    result.push(summary);
  }
  return result;
}
