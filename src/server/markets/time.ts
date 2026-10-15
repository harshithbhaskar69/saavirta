import type { Interval } from "@/features/markets/contracts";
import { missingInterval } from "./model";
import type { InputRef, Quality, Window } from "./model";

export const minute = 60_000;
export const hour = 60 * minute;
export const day = 24 * hour;
const helsinki = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Helsinki",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export function localDate(time: number): string {
  const parts = helsinki.formatToParts(time);
  const get = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function localMinutes(time: number): number {
  const parts = helsinki.formatToParts(time);
  return (
    Number(parts.find((part) => part.type === "hour")?.value) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value)
  );
}
export function addDays(date: string, count: number): string {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== date
  )
    throw new Error("invalid-date");
  return new Date(parsed + count * day).toISOString().slice(0, 10);
}
function midnight(date: string): number {
  const target = Date.parse(`${addDays(date, 0)}T00:00:00Z`);
  let instant = target;
  // Solve Helsinki wall time at midnight; calendar days can be 23 or 25 hours.
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = helsinki.formatToParts(instant);
    const get = (type: string): string =>
      parts.find((part) => part.type === type)?.value ?? "";
    const wall = Date.parse(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    instant += target - wall;
  }
  return instant;
}
export function deliveryWindow(date: string, days: number): Window {
  if (!Number.isInteger(days) || days < 1 || days > 3)
    throw new Error("invalid-days");
  return {
    start: iso(midnight(date)),
    end: iso(midnight(addDays(date, days))),
  };
}
export function iso(time: number): string {
  return new Date(time).toISOString();
}
export function grid(window: Window, step = 15 * minute): Interval[] {
  if (step <= 0 || Date.parse(window.end) - Date.parse(window.start) > 8 * day)
    throw new Error("invalid-grid");
  const result: Interval[] = [];
  for (
    let time = Date.parse(window.start);
    time < Date.parse(window.end);
    time += step
  )
    result.push(
      missingInterval(
        iso(time),
        iso(Math.min(time + step, Date.parse(window.end))),
      ),
    );
  return result;
}
export function validateIntervals(points: readonly Interval[]): void {
  let previousEnd = -Infinity;
  for (const point of points) {
    const start = Date.parse(point.start),
      end = Date.parse(point.end);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > day ||
      start < previousEnd ||
      (point.value !== null && !Number.isFinite(point.value))
    )
      throw new Error("invalid-or-overlapping-intervals");
    previousEnd = end;
  }
}
export function sortValidate(points: Interval[]): Interval[] {
  points.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  validateIntervals(points);
  return points;
}
export function appendRefs(...lists: readonly InputRef[][]): InputRef[] {
  const refs = new Map<string, InputRef>();
  for (const list of lists)
    for (const ref of list)
      refs.set(`${ref.seriesId}/${ref.snapshotId}/${ref.collectedAt}`, ref);
  return [...refs.values()];
}
export function resample(
  points: readonly Interval[],
  bins: readonly Interval[],
): Interval[] {
  const timed = points.map((point) => ({
    point,
    start: Date.parse(point.start),
    end: Date.parse(point.end),
  }));
  return bins.map((bin) => {
    const result = missingInterval(bin.start, bin.end);
    const start = Date.parse(bin.start),
      end = Date.parse(bin.end);
    let weighted = 0,
      covered = 0;
    for (const item of timed) {
      if (item.end <= start || item.start >= end) continue;
      if (item.point.value === null) {
        result.missingReason = item.point.missingReason ?? result.missingReason;
        continue;
      }
      const duration = Math.min(item.end, end) - Math.max(item.start, start);
      covered += duration;
      weighted += item.point.value * duration;
      result.provisional ||= item.point.provisional;
      result.inputs = appendRefs(result.inputs, item.point.inputs);
    }
    result.coverage = Math.min(1, covered / (end - start));
    if (result.coverage >= 1 - 1e-9) {
      result.value = weighted / covered;
      result.missingReason = null;
    }
    return result;
  });
}
export function pricePeriods(
  points: readonly Interval[],
  window: Window,
): Interval[] {
  const result: Interval[] = [];
  let next = Date.parse(window.start);
  for (const point of points) {
    const start = Math.max(Date.parse(point.start), Date.parse(window.start));
    const end = Math.min(Date.parse(point.end), Date.parse(window.end));
    if (end <= start) continue;
    if (start > next)
      result.push(...grid({ start: iso(next), end: iso(start) }));
    result.push({ ...point, start: iso(start), end: iso(end) });
    next = end;
  }
  if (next < Date.parse(window.end))
    result.push(...grid({ start: iso(next), end: window.end }));
  return result;
}
export function energyMWh(points: readonly Interval[]): number | null {
  if (
    !points.length ||
    points.some(
      (point) =>
        point.value === null || point.coverage < 1 || point.provisional,
    )
  )
    return null;
  return points.reduce(
    (sum, point) =>
      sum +
      ((point.value ?? 0) * (Date.parse(point.end) - Date.parse(point.start))) /
        hour,
    0,
  );
}
export function quality(
  points: readonly Interval[],
  freshness: Quality["freshness"],
  issues: string[] = [],
): Quality {
  let covered = 0,
    total = 0;
  for (const point of points) {
    const duration = Date.parse(point.end) - Date.parse(point.start);
    total += duration;
    if (point.value !== null) covered += duration;
  }
  const coverage = total ? covered / total : 0;
  return {
    freshness,
    availability:
      coverage >= 1 - 1e-9
        ? "complete"
        : coverage > 0
          ? "partial"
          : "unavailable",
    coverage,
    issues: [...issues],
    freshUntil: null,
    usableUntil: null,
  };
}
export function earlier(a: string | null, b: string | null): string | null {
  return a === null ? b : b === null || Date.parse(a) < Date.parse(b) ? a : b;
}
