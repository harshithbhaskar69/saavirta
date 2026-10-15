import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  deliveryWindow,
  grid,
  resample,
  energyMWh,
  hour,
  minute,
  iso,
  localMinutes,
} from "../../../src/server/markets/time";
import {
  baseline,
  forecastError,
  residual,
  revision,
  summarizePrices,
} from "../../../src/server/markets/analytics";
import {
  definitionFor,
  emptyProvenance,
  missingInterval,
} from "../../../src/server/markets/model";
import type { Batch } from "../../../src/server/markets/model";
import type { MarketSeries } from "../../../src/features/markets/contracts";
import {
  marketContext,
  decodeBoundary,
} from "../../../src/server/markets/geography";
import type { Boundary } from "../../../src/server/markets/geography";
import manifest from "../../../src/server/markets/data/manifest.json";
import boundaryData from "../../../src/server/markets/data/boundaries.json";

const start = Date.parse("2026-10-15T09:00Z");
function batch(collected: number, value: number, dataset = "166"): Batch {
  const snapshotId = String(collected),
    d = definitionFor(dataset);
  return {
    dataset,
    snapshotId,
    collectedAt: iso(collected),
    publishedAt: null,
    revision: null,
    intervals: [
      {
        ...missingInterval(iso(start), iso(start + 15 * minute)),
        value,
        coverage: 1,
        missingReason: null,
        inputs: [{ seriesId: d.id, snapshotId, collectedAt: iso(collected) }],
      },
    ],
  };
}
function series(b: Batch): MarketSeries {
  const d = definitionFor(b.dataset);
  return {
    ...d,
    scope: "Finland national",
    provider: "Fingrid",
    intervals: b.intervals,
    provenance: emptyProvenance(),
    quality: {
      freshness: "fresh",
      availability: "complete",
      coverage: 1,
      issues: [],
      freshUntil: null,
      usableUntil: null,
    },
  };
}
describe("delivery periods and observed vintages", () => {
  it("uses Helsinki calendar days, including both DST transitions", () => {
    expect(grid(deliveryWindow("2026-03-29", 1))).toHaveLength(92);
    expect(grid(deliveryWindow("2026-10-25", 1))).toHaveLength(100);
    expect(grid(deliveryWindow("2026-10-15", 1))).toHaveLength(96);
    expect(localMinutes(Date.parse("2026-10-25T12:00Z"))).toBe(14 * 60);
    expect(() => deliveryWindow("2026-02-30", 1)).toThrow();
  });
  it("weights power by duration, integrates energy, and preserves missing intervals", () => {
    const w = { start: iso(start), end: iso(start + hour) };
    const points = grid(w).map((p) => ({ ...p, value: 1000, coverage: 1 }));
    expect(energyMWh(points)).toBe(1000);
    expect(resample(points, grid(w, hour))[0].value).toBe(1000);
    const incomplete = resample(points.slice(1), grid(w, hour))[0];
    expect(incomplete.value).toBeNull();
    expect(incomplete.coverage).toBe(0.75);
    expect(energyMWh([incomplete])).toBeNull();
    points[0].provisional = true;
    expect(energyMWh(points)).toBeNull();
  });
  it("never compares actuals against a forecast collected after the cutoff", () => {
    const cutoff = start - 24 * hour,
      actual = series(batch(start, 1100, "124"));
    const before = batch(cutoff - 15 * minute, 1000),
      after = batch(cutoff + minute, 1099);
    expect(baseline([before, after], cutoff)).toBe(before);
    const metrics = forecastError(actual, [before, after], start + hour);
    expect(metrics[0].intervals[0].value).toBe(100);
    expect(metrics[1].intervals[0].value).toBe(10);
    expect(
      forecastError(actual, [after], start + hour)[0].intervals[0].value,
    ).toBeNull();
    expect(
      forecastError(
        actual,
        [batch(cutoff - 31 * minute, 1000)],
        start + hour,
      )[0].intervals[0].value,
    ).toBeNull();
    actual.intervals[0].provisional = true;
    expect(
      forecastError(actual, [before], start + hour)[0].intervals[0].value,
    ).toBeNull();
  });
  it("requires aligned non-missing inputs and an eligible earlier revision", () => {
    const demand = series(batch(start, 1000)),
      wind = series(batch(start, 200, "245")),
      solar = series(batch(start, 50, "248"));
    expect(residual(demand, wind, solar).intervals[0].value).toBe(750);
    solar.intervals[0].value = null;
    expect(residual(demand, wind, solar).intervals[0].value).toBeNull();
    expect(
      revision(demand, [batch(start - hour, 900)]).intervals[0].value,
    ).toBe(100);
    expect(
      revision(demand, [batch(start - hour + minute, 900)]).quality.issues,
    ).toContain("history-collecting");
  });
  it("labels incomplete daily prices and counts negative duration", () => {
    const window = deliveryWindow("2026-10-25", 1),
      points = grid(window).map((p) => ({ ...p, value: -20, coverage: 1 }));
    const full = summarizePrices(points, window)[0];
    expect(full.label).toBe("Daily time-weighted average");
    expect(full.negativeMinutes).toBe(1500);
    const partial = summarizePrices(points.slice(1), window)[0];
    expect(partial.label).toBe("Published-period average");
    expect(partial.coverage).toBe(0.99);
  });
});
describe("authoritative Finland eligibility", () => {
  it("checks both sides of a real boundary segment in metres", () => {
    const source = decodeBoundary(boundaryData, manifest.version);
    const ring = source.finland[0][0],
      metres = 111319.49079327358;
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1],
        b = ring[i],
        lat = (a[1] + b[1]) / 2,
        lon = (a[0] + b[0]) / 2;
      const x = metres * Math.cos((lat * Math.PI) / 180),
        dx = (b[0] - a[0]) * x,
        dy = (b[1] - a[1]) * metres,
        length = Math.hypot(dx, dy);
      if (length < 1000) continue;
      const status = (offset: number) =>
        marketContext(
          lat + (offset * dx) / length / metres,
          lon - (offset * dy) / length / x,
          source,
        ).geographicStatus;
      for (const offset of [-10, 0, 10])
        expect(status(offset)).toBe("uncertain");
      expect(new Set([-100, 100].map(status))).toEqual(
        new Set(["inside", "outside"]),
      );
      return;
    }
    throw new Error("No real boundary segment checked");
  });
  it("matches the pinned artifact checksum", () => {
    expect(
      createHash("sha256")
        .update(readFileSync("src/server/markets/data/boundaries.json"))
        .digest("hex"),
    ).toBe(manifest.sha256);
  });
  it.each([
    [60.1695, 24.9354],
    [65.0121, 25.4651],
    [69.909, 27.0288],
    [59.78, 21.368],
    [65.009, 24.711],
    [60, 25],
    [65.8481, 24.1466],
  ])(
    "includes Finnish mainland, islands and administrative waters (%s,%s)",
    (lat, lon) => {
      expect(marketContext(lat, lon).relationship).toBe("local_market");
    },
  );
  it.each([
    [60.0973, 19.9348],
    [59.92, 20.908],
  ])("labels Åland as an SE3 national comparison (%s,%s)", (lat, lon) => {
    expect(marketContext(lat, lon)).toMatchObject({
      geographicStatus: "inside",
      localBiddingZone: "SE3",
      relationship: "national_comparison",
    });
  });
  it.each([
    [59.3293, 18.0686],
    [59.437, 24.7536],
    [65.8355, 24.1368],
    [69.4719, 25.5112],
    [64.5893, 30.6016],
    [59.6, 25],
  ])("excludes foreign points and the wider sea (%s,%s)", (lat, lon) => {
    expect(marketContext(lat, lon).geographicStatus).toBe("outside");
  });
  it("preserves holes, disconnected parts, a 25m uncertainty band and failure", () => {
    const boundary: Boundary = {
      version: "synthetic",
      finland: [
        [
          [
            [20, 60],
            [21, 60],
            [21, 61],
            [20, 61],
            [20, 60],
          ],
          [
            [20.4, 60.4],
            [20.6, 60.4],
            [20.6, 60.6],
            [20.4, 60.6],
            [20.4, 60.4],
          ],
        ],
        [
          [
            [22, 60],
            [23, 60],
            [23, 61],
            [22, 61],
            [22, 60],
          ],
        ],
      ],
      aland: [],
    };
    expect(marketContext(60.5, 20.5, boundary).geographicStatus).toBe(
      "outside",
    );
    expect(marketContext(60.5, 22.5, boundary).geographicStatus).toBe("inside");
    expect(marketContext(60.0001, 20.2, boundary).geographicStatus).toBe(
      "uncertain",
    );
    expect(marketContext(59.9999, 20.2, boundary).geographicStatus).toBe(
      "uncertain",
    );
    expect(marketContext(60.1695, 24.9354, null).geographicStatus).toBe(
      "uncertain",
    );
  });
});
