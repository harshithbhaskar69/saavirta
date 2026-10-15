import { describe, expect, it, vi } from "vitest";
import {
  alignRuns,
  computeNormals,
  createBaselineService,
  MINIMUM_YEARS,
  NORMAL_YEARS,
  parseSeries,
  revisionRuns,
  shiftDate,
  type Series,
} from "../../src/features/weather/baselines";
import { HOUR, point } from "../fixtures/weather";

const series = (
  start: number,
  count: number,
  temperature: (time: number) => number | null,
  irradiance: (time: number) => number | null = () => 100,
): Series => {
  const time = Array.from({ length: count }, (_, i) => start / 1000 + i * 3600);
  return {
    timezone: "Europe/Amsterdam",
    hourly_units: {
      time: "unixtime",
      temperature_2m: "°C",
      shortwave_radiation: "W/m²",
    },
    hourly: {
      time,
      temperature_2m: time.map((t) => temperature(t * 1000)),
      shortwave_radiation: time.map((t) => irradiance(t * 1000)),
    },
  };
};
const now = Date.parse("2026-10-13T12:00:00Z");
// Local day of month in Amsterdam, so the smoothing window is visible in the result.
const dayOfMonth = (time: number) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      day: "numeric",
    }).format(time),
  );
const pastYears = (years = NORMAL_YEARS) =>
  Array.from({ length: years }, (_, i) =>
    series(
      Date.parse(`${shiftDate("2026-10-13", -(i + 1), -5)}T00:00:00Z`),
      18 * 24,
      dayOfMonth,
    ),
  );

describe("climate normals", () => {
  it("average the same local hour over past years with a ±3 day window", () => {
    const days = computeNormals(pastYears(), "Europe/Amsterdam", now);
    expect(Object.keys(days)).toEqual(
      Array.from({ length: 10 }, (_, i) => shiftDate("2026-10-12", 0, i)),
    );
    // Days 11 to 17 average to 14 for 14 October; constant irradiance stays 100.
    expect(new Set(days["2026-10-14"].temperatureC)).toEqual(new Set([14]));
    expect(new Set(days["2026-10-14"].solarIrradianceWm2)).toEqual(
      new Set([100]),
    );
  });
  it("withhold an hour that has fewer than half of the possible samples", () => {
    const days = computeNormals(pastYears(3), "Europe/Amsterdam", now);
    expect(days["2026-10-14"].temperatureC.every((t) => t === null)).toBe(true);
  });
  it("roll 29 February to 1 March in years without it", () => {
    expect(shiftDate("2028-02-29", -1)).toBe("2027-03-01");
    expect(shiftDate("2026-12-30", -1, 3)).toBe("2026-01-02");
  });
});

describe("run-to-run revision", () => {
  const meta = {
    last_run_initialisation_time: Date.parse("2026-10-13T06:00:00Z") / 1000,
    last_run_availability_time: Date.parse("2026-10-13T12:19:00Z") / 1000,
  };
  it("uses the newest run only after it has settled, against the same cycle a day earlier", () => {
    expect(revisionRuns(meta, Date.parse("2026-10-13T12:25:00Z"))).toEqual({
      latest: Date.parse("2026-10-13T00:00:00Z"),
      previous: Date.parse("2026-10-12T00:00:00Z"),
    });
    expect(revisionRuns(meta, Date.parse("2026-10-13T12:30:00Z"))).toEqual({
      latest: Date.parse("2026-10-13T06:00:00Z"),
      previous: Date.parse("2026-10-12T06:00:00Z"),
    });
  });
  it("pairs valid hours and keeps hours beyond the older run's range missing", () => {
    const start = Date.parse("2026-10-13T06:00:00Z");
    const hours = alignRuns(
      series(
        start,
        4,
        () => 10,
        (t) => (t === start ? -2 : 300),
      ),
      series(start - 24 * HOUR, 26, () => 9),
    );
    expect(hours.map((h) => h.previousC)).toEqual([9, 9, null, null]);
    expect(hours[0]).toMatchObject({ latestC: 10, latestWm2: null });
  });
  it("rejects misaligned or wrongly unitized responses", () => {
    const good = series(now, 3, () => 1);
    expect(() =>
      parseSeries({ ...good, hourly: { ...good.hourly, temperature_2m: [1] } }),
    ).toThrow();
    expect(() =>
      parseSeries({
        ...good,
        hourly_units: { ...good.hourly_units, temperature_2m: "°F" },
      }),
    ).toThrow();
    expect(parseSeries(good)).toEqual(good);
  });
});

describe("baseline service", () => {
  const meta = {
    last_run_initialisation_time: Date.parse("2026-10-13T00:00:00Z") / 1000,
    last_run_availability_time: Date.parse("2026-10-13T06:00:00Z") / 1000,
  };
  const transport = (archiveFails = false) =>
    vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.hostname === "api.open-meteo.com") return Response.json(meta);
      if (url.hostname === "archive-api.open-meteo.com") {
        if (archiveFails) return new Response("down", { status: 500 });
        const start = Date.parse(
          `${url.searchParams.get("start_date")}T00:00:00Z`,
        );
        return Response.json(series(start, 18 * 24, dayOfMonth));
      }
      const run = Date.parse(`${url.searchParams.get("run")}:00Z`);
      return Response.json(
        series(run, 168, () =>
          run === Date.parse("2026-10-13T00:00:00Z") ? 11 : 10,
        ),
      );
    });
  const store = () => {
    const values = new Map<string, unknown>();
    return {
      values,
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(async (key: string, value: unknown) => {
        values.set(key, value);
      }),
    };
  };
  it("returns normals and revision, then serves both from the shared cache", async () => {
    const cache = store(),
      fetcher = transport();
    const service = createBaselineService(
      cache,
      "public",
      undefined,
      () => now,
      fetcher as typeof fetch,
    );
    const first = await service(point);
    expect(first.normals?.years).toEqual([2016, 2025]);
    expect(first.revision).toMatchObject({
      latestRun: Date.parse("2026-10-13T00:00:00Z"),
      previousRun: Date.parse("2026-10-12T00:00:00Z"),
    });
    expect(
      first.revision?.hours.find((h) => h.previousC !== null),
    ).toMatchObject({
      latestC: 11,
      previousC: 10,
    });
    const calls = fetcher.mock.calls.length;
    expect(calls).toBe(NORMAL_YEARS + 3);
    await service(point);
    // Only the uncounted run-time metadata is requested again.
    expect(fetcher.mock.calls.length).toBe(calls + 1);
  });
  it("tolerates a few unavailable years and stops once a normal is out of reach", async () => {
    const failing = (years: number[]) => {
      const base = transport();
      return vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        const year = Number(url.searchParams.get("start_date")?.slice(0, 4));
        return url.hostname === "archive-api.open-meteo.com" &&
          years.includes(year)
          ? new Response("bad", { status: 400 })
          : base(input);
      });
    };
    const some = createBaselineService(
      store(),
      "public",
      undefined,
      () => now,
      failing([2019, 2022]) as typeof fetch,
    );
    expect((await some(point)).normals).toMatchObject({
      years: [2016, 2025],
      yearCount: 8,
    });
    const all = failing(Array.from({ length: 10 }, (_, i) => 2016 + i));
    const none = createBaselineService(
      store(),
      "public",
      undefined,
      () => now,
      all as typeof fetch,
    );
    expect((await none(point)).normals).toBeNull();
    const archiveCalls = all.mock.calls.filter(([input]) =>
      String(input).includes("archive-api"),
    ).length;
    expect(archiveCalls).toBe(NORMAL_YEARS - MINIMUM_YEARS + 1);
  });
  it("keeps private points out of the cache and reports a failed part as missing", async () => {
    const cache = store();
    const service = createBaselineService(
      cache,
      "public",
      undefined,
      () => now,
      transport(true) as typeof fetch,
    );
    const result = await service(point, true);
    expect(result.normals).toBeNull();
    expect(result.revision?.hours.length).toBe(168);
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
});
