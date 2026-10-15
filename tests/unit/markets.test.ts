import { describe, expect, it } from "vitest";
import { dashboardSchema } from "../../src/features/markets/contracts";
import {
  helsinkiDate,
  marketHref,
  readMarketSettings,
} from "../../src/features/markets/state";
import {
  deliveryLabel,
  intervalAt,
  marketCsv,
  weatherAt,
  visibleDashboard,
  deliveryAxis,
} from "../../src/features/markets/presentation";
import fixture from "../fixtures/markets/dashboard.json";
import { forecast } from "../fixtures/weather";

describe("market contract and semantics", () => {
  it("shares Helsinki calendar ticks across multi-day and DST delivery windows", () => {
    const multi = deliveryAxis([
      Date.parse("2026-10-24T21:00Z"),
      Date.parse("2026-10-27T22:00Z"),
    ]);
    expect(multi.ticks.map(multi.label)).toEqual([
      "25 Oct",
      "26 Oct",
      "27 Oct",
      "28 Oct",
    ]);
    expect(multi.ticks[1] - multi.ticks[0]).toBe(25 * 3_600_000);
    const spring = deliveryAxis([
      Date.parse("2026-03-28T22:00Z"),
      Date.parse("2026-03-29T21:00Z"),
    ]);
    expect(spring.ticks.map(spring.label)).toEqual([
      "29 Mar",
      "06:00",
      "12:00",
      "18:00",
      "30 Mar",
    ]);
    const repeated = deliveryAxis([
      Date.parse("2026-10-25T00:00Z"),
      Date.parse("2026-10-25T03:00Z"),
    ]);
    expect(repeated.ticks.map(repeated.label)).toEqual([
      "03:00 GMT+3",
      "03:00 GMT+2",
      "04:00",
      "05:00",
    ]);
  });
  it("honors server expiry during outages while retaining published prices and historical errors", () => {
    const data = dashboardSchema.parse(fixture);
    data.marketContext.demonstration = false;
    const later = Date.parse(data.generatedAt) + 3 * 3_600_000;
    const visible = visibleDashboard(data, later);
    expect(
      visible.series
        .find((s) => s.id === "consumption-forecast")!
        .intervals.every((p) => p.value === null),
    ).toBe(true);
    expect(
      visible.metrics.find((s) => s.id === "residual-load")!.quality.coverage,
    ).toBe(0);
    expect(visible.series.at(-1)!.intervals[0].value).toBe(-30);
    expect(visible.series.at(-1)!.quality.freshness).toBe("stale");
    expect(
      visible.metrics.find((s) => s.id === "consumption-error")!.quality
        .usableUntil,
    ).toBeNull();
    expect(data.series[3].intervals[0].value).not.toBeNull();
  });
  it("accepts the documented serialization, preserving missing and negative values", () => {
    const data = dashboardSchema.parse(fixture);
    expect(
      data.series.find((s) => s.id === "production-forecast")!.quality
        .availability,
    ).toBe("unavailable");
    expect(data.series.at(-1)!.intervals[0].value).toBe(-30);
    expect(data.metrics[1].quality.issues).toContain("history-collecting");
  });
  it("resolves half-open intervals and weather's distinct native semantics", () => {
    const data = dashboardSchema.parse(fixture),
      prices = data.series.at(-1)!.intervals;
    expect(intervalAt(prices, Date.parse(prices[0].end))).toEqual(prices[1]);
    const hours = forecast().hourly.slice(0, 3),
      t = hours[0].time + 15 * 60_000;
    expect(weatherAt(hours, t)).toEqual({
      instant: hours[0],
      irradiance: hours[1],
    });
  });
  it("distinguishes repeated Helsinki times", () => {
    expect(deliveryLabel("2026-10-25T00:15:00Z")).toContain("GMT+3");
    expect(deliveryLabel("2026-10-25T01:15:00Z")).toContain("GMT+2");
    expect(helsinkiDate(Date.parse("2026-10-14T22:00:00Z"))).toBe("2026-10-15");
  });
  it("keeps market state separate and never adds private coordinates", () => {
    const now = Date.parse(fixture.generatedAt),
      settings = readMarketSettings(
        "?delivery=2026-02-30&resolution=PT60M&marketDays=2",
        now,
      );
    expect(settings).toEqual({
      date: "2026-10-15",
      days: 2,
      resolution: "PT60M",
    });
    const href = marketHref("/?horizon=7d", "markets", settings);
    expect(href).toContain("horizon=7d");
    expect(href).toContain("workspace=markets");
    expect(href).not.toContain("lat");
  });
  it("excludes prices when export entitlement is disabled", () => {
    const data = dashboardSchema.parse(fixture);
    data.priceExportAllowed = false;
    const csv = marketCsv(data);
    expect(csv).not.toContain('"day-ahead-price"');
    expect(csv).toContain('"consumption-forecast"');
    expect(csv).toContain("synthetic-");
  });
});
