import type {
  Dashboard,
  Interval,
  MarketContext,
  MarketSeries,
} from "@/features/markets/contracts";
import { definitions, emptyProvenance } from "./model";
import type { Batch, Provenance, Window } from "./model";
import {
  forecastError,
  residual,
  revision,
  summarizePrices,
} from "./analytics";
import {
  day,
  earlier,
  grid,
  hour,
  iso,
  minute,
  pricePeriods,
  quality,
  resample,
} from "./time";

export interface BaselineRequest {
  cutoff: number;
  start: number;
  end: number;
}
export interface StoredSeries {
  intervals: Interval[];
  provenance: Provenance;
  issue: string | null;
}
export interface MarketReader {
  read(dataset: string, window: Window): Promise<StoredSeries>;
  baselines(dataset: string, requests: BaselineRequest[]): Promise<Batch[]>;
}
export interface DashboardOptions {
  pricesEnabled: boolean;
  priceExportAllowed: boolean;
  now: number;
  requestId: string;
}
export async function dashboard(
  store: MarketReader,
  window: Window,
  resolution: Dashboard["resolution"],
  context: MarketContext,
  options: DashboardOptions,
): Promise<Dashboard> {
  const { now, pricesEnabled } = options,
    bins = grid(window);
  let nativePrices: Interval[] = [];
  const series = await Promise.all(
    definitions.map(async (d): Promise<MarketSeries> => {
      const telemetry = d.dataset === "193" || d.dataset === "192";
      const readWindow = telemetry
        ? { start: iso(now - 15 * minute), end: iso(now + minute) }
        : window;
      let stored: StoredSeries = {
        intervals: [],
        provenance: emptyProvenance(),
        issue: null,
      };
      try {
        if (d.dataset !== "price" || pricesEnabled)
          stored = await store.read(d.dataset, readWindow);
      } catch {
        stored.issue = "storage-unavailable";
      }
      const freshFor = telemetry
        ? 6 * minute
        : d.dataset === "price"
          ? hour
          : 20 * minute;
      let freshness: MarketSeries["quality"]["freshness"] =
        stored.provenance.lastSuccessfulCheck === null
          ? "unknown"
          : now - Date.parse(stored.provenance.lastSuccessfulCheck) > freshFor
            ? "stale"
            : "fresh";
      const points = stored.intervals.map((point) => {
        const p = { ...point };
        if (d.classification === "actual" && Date.parse(p.end) > now)
          p.provisional = true;
        if (d.classification === "forecast") {
          const age = p.inputs.length
            ? Math.max(
                ...p.inputs.map((ref) => now - Date.parse(ref.collectedAt)),
              )
            : Infinity;
          if (age > 20 * minute) freshness = "stale";
          if (age > 2 * hour) {
            p.value = null;
            p.coverage = 0;
            p.missingReason = "expired";
          }
        }
        return p;
      });
      let intervals = telemetry
        ? points.filter(
            (p) =>
              Date.parse(p.start) <= now &&
              now - Date.parse(p.start) <= 15 * minute,
          )
        : resample(points, bins);
      const issues = stored.issue ? [stored.issue] : [];
      const latest = intervals.at(-1);
      if (telemetry && latest && now - Date.parse(latest.start) > 6 * minute)
        freshness = "stale";
      if (d.dataset === "price") {
        nativePrices = points;
        intervals = pricePeriods(points, window).map((p) =>
          p.value === null
            ? {
                ...p,
                missingReason: pricesEnabled
                  ? "not-published"
                  : "price-permission-required",
              }
            : p,
        );
        if (!pricesEnabled) issues.push("price-permission-required");
      }
      return {
        id: d.id,
        label: d.label,
        unit: d.unit,
        dataset: d.dataset,
        classification: d.classification,
        scope: d.dataset === "price" ? "FI bidding zone" : "Finland national",
        provider: d.dataset === "price" ? "ENTSO-E" : "Fingrid",
        intervals,
        provenance: stored.provenance,
        quality: quality(intervals, freshness, issues),
      };
    }),
  );
  const byID = new Map(series.map((s) => [s.id, s]));
  const get = (id: string): MarketSeries => {
    const s = byID.get(id);
    if (!s) throw new Error("unknown-series");
    return s;
  };
  const metrics = [
    residual(
      get("consumption-forecast"),
      get("wind-forecast"),
      get("solar-forecast"),
    ),
  ];
  const archiveResults = await Promise.all(
    ["166", "245", "248"].map(async (dataset) => {
      const d = definitions.find((entry) => entry.dataset === dataset);
      if (!d) throw new Error("unknown-dataset");
      const latest = get(d.id);
      const requests = latest.intervals.flatMap((p): BaselineRequest[] =>
        p.inputs.length === 1 && p.inputs[0]
          ? [
              {
                cutoff: Date.parse(p.inputs[0].collectedAt) - hour,
                start: Date.parse(p.start),
                end: Date.parse(p.end),
              },
            ]
          : [],
      );
      try {
        return revision(latest, await store.baselines(dataset, requests));
      } catch {
        const m = revision(latest, []);
        m.quality.issues.push("storage-unavailable");
        return m;
      }
    }),
  );
  const actual = get("consumption-actual");
  let errors;
  try {
    errors = forecastError(
      actual,
      await store.baselines(
        "166",
        actual.intervals
          .filter(
            (p) =>
              p.value !== null && !p.provisional && Date.parse(p.end) <= now,
          )
          .map((p) => ({
            cutoff: Date.parse(p.start) - day,
            start: Date.parse(p.start),
            end: Date.parse(p.end),
          })),
      ),
      now,
    );
  } catch {
    errors = forecastError(actual, [], now);
    for (const m of errors) m.quality.issues.push("storage-unavailable");
  }
  const consumptionRevision = archiveResults[0];
  if (consumptionRevision) metrics.push(consumptionRevision);
  metrics.push(...errors, ...archiveResults.slice(1));
  if (resolution === "PT60M") {
    const hours = grid(window, hour);
    for (const s of series)
      if (s.dataset !== "193" && s.dataset !== "192") {
        s.intervals = resample(s.intervals, hours);
        s.quality = quality(s.intervals, s.quality.freshness, s.quality.issues);
      }
    for (const m of metrics) {
      m.intervals = resample(m.intervals, hours);
      m.quality = quality(m.intervals, m.quality.freshness, m.quality.issues);
    }
  }
  for (const s of series) {
    const telemetry = s.dataset === "193" || s.dataset === "192";
    const freshFor = telemetry
      ? 6 * minute
      : s.dataset === "price"
        ? hour
        : 20 * minute;
    if (s.provenance.lastSuccessfulCheck)
      s.quality.freshUntil = iso(
        Date.parse(s.provenance.lastSuccessfulCheck) + freshFor,
      );
    const latest = s.intervals.at(-1);
    if (telemetry && latest) {
      s.quality.freshUntil = earlier(
        s.quality.freshUntil,
        iso(Date.parse(latest.start) + 6 * minute),
      );
      s.quality.usableUntil = iso(Date.parse(latest.start) + 15 * minute);
    }
    if (s.classification === "forecast")
      for (const p of s.intervals)
        if (p.value !== null)
          for (const ref of p.inputs) {
            s.quality.freshUntil = earlier(
              s.quality.freshUntil,
              iso(Date.parse(ref.collectedAt) + 20 * minute),
            );
            s.quality.usableUntil = earlier(
              s.quality.usableUntil,
              iso(Date.parse(ref.collectedAt) + 2 * hour),
            );
          }
  }
  for (const m of metrics) {
    const ids =
      m.id === "residual-load"
        ? ["consumption-forecast", "wind-forecast", "solar-forecast"]
        : m.id.endsWith("-revision")
          ? [m.id.slice(0, -9)]
          : ["consumption-actual"];
    for (const id of ids) {
      const q = get(id).quality;
      m.quality.freshUntil = earlier(m.quality.freshUntil, q.freshUntil);
      m.quality.usableUntil = earlier(m.quality.usableUntil, q.usableUntil);
    }
  }
  return {
    schemaVersion: "1",
    requestId: options.requestId,
    generatedAt: iso(now),
    displayTimezone: "Europe/Helsinki",
    requestedInterval: window,
    resolution,
    marketContext: context,
    series,
    metrics,
    priceSummaries: summarizePrices(nativePrices, window),
    priceExportAllowed: pricesEnabled && options.priceExportAllowed,
  };
}
