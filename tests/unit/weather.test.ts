import { describe, expect, it, vi } from "vitest";
import {
  canonicalPoint,
  parseWeatherQuery,
} from "../../src/features/weather/validation";
import { deriveSignals } from "../../src/features/weather/signals";
import {
  createWeatherService,
  forecastFromSnapshot,
  FRESH_MS,
  MAX_AGE_MS,
  REFRESH_FLOOR_MS,
} from "../../src/features/weather/service";
import { normalizeProvider } from "../../src/features/weather/provider";
import { fetchJson } from "../../src/lib/upstream";
import { AppError } from "../../src/lib/errors";
import { hourLabel, solarInterval, localTime } from "../../src/lib/time";
import {
  locationHref,
  readLocation,
  readSaved,
} from "../../src/features/location/state";
import { HOUR, point, snapshot } from "../fixtures/weather";
const now = Date.parse("2026-10-25T00:30:00Z");
const hours = (temperature: (number | null)[], solar: (number | null)[] = []) =>
  temperature.map((temperatureC, i) => ({
    time: now + i * HOUR,
    temperatureC,
    solarIrradianceWm2: solar[i] ?? null,
    windSpeedMs: null,
    windGustMs: null,
    cloudCoverPct: null,
    humidityPct: null,
    precipitationMm: null,
    precipitationProbabilityPct: null,
  }));

describe("global point input", () => {
  it.each([
    "lat=91&lon=0&horizon=24h",
    "lat=1&lat=2&lon=0&horizon=24h",
    "lat=&lon=0&horizon=24h",
    "lat=0x10&lon=0&horizon=24h",
    "lat=0&lon=NaN&horizon=24h",
    "lat=0&lon=0&horizon=3d",
  ])("rejects %s", (query) =>
    expect(() => parseWeatherQuery(new URLSearchParams(query))).toThrow(),
  );
  it("accepts poles, canonicalizes the antimeridian and rounds consistently", () => {
    expect(
      parseWeatherQuery(new URLSearchParams("lat=-90&lon=180&horizon=7d")),
    ).toEqual({ latitude: -90, longitude: -180, horizon: "7d" });
    expect(canonicalPoint({ latitude: -0.00001, longitude: 1.123456 })).toEqual(
      { latitude: 0, longitude: 1.1235 },
    );
  });
});
describe("weather signals", () => {
  it("breaks tied extrema at the earliest hour and preserves signed ramps", () => {
    const result = deriveSignals(
      hours([10, 10, 8, 5, 5], [0, 100, 200, 200, 0]),
    );
    expect(result.find((s) => s.kind === "cold")).toMatchObject({
      value: 5,
      time: now + 3 * HOUR,
    });
    expect(result.find((s) => s.kind === "warm")?.time).toBe(now);
    expect(result.find((s) => s.kind === "ramp")).toMatchObject({
      value: -5,
      time: now,
      endTime: now + 3 * HOUR,
    });
    expect(result.find((s) => s.kind === "solar")?.time).toBe(now + 2 * HOUR);
    expect(result.find((s) => s.kind === "window")).toMatchObject({
      value: 3,
      time: now + HOUR,
      endTime: now + 3 * HOUR,
    });
  });
  it("does not bridge missing data or label zero sunlight a peak", () => {
    const result = deriveSignals(hours([1, 2, null, 4, 5], [0, 0, 0, 0, 0]));
    expect(result.map((s) => s.kind)).toEqual(["cold", "warm"]);
    expect(deriveSignals(hours([null, null], [null, null]))).toEqual([]);
  });
  it("requires two solar intervals and null breaks the window", () => {
    expect(
      deriveSignals(hours([1, 1, 1, 1, 1], [150, null, 100, 100, 0])).find(
        (s) => s.kind === "window",
      ),
    ).toMatchObject({ time: now + 2 * HOUR, value: 2 });
    expect(
      deriveSignals(hours([1, 1, 1], [100, 99, 100])).some(
        (s) => s.kind === "window",
      ),
    ).toBe(false);
  });
});
describe("rolling forecasts and provider boundaries", () => {
  it.each([
    ["24h", 24],
    ["48h", 48],
    ["7d", 168],
  ] as const)(
    "returns exactly %s elapsed slots after now",
    (horizon, count) => {
      const result = forecastFromSnapshot(snapshot(now), horizon, now);
      expect(result.hourly).toHaveLength(count);
      expect(result.hourly[0].time).toBe(Date.parse("2026-10-25T01:00:00Z"));
      expect(result.hourly.at(-1)!.time - result.hourly[0].time).toBe(
        (count - 1) * HOUR,
      );
    },
  );
  it("keeps zero, missing values and missing trailing hours distinct", () => {
    const source = snapshot(now);
    source.hourly = source.hourly.slice(0, 12);
    source.hourly[2].solarIrradianceWm2 = null;
    const result = forecastFromSnapshot(source, "24h", now);
    expect(result.hourly).toHaveLength(24);
    expect(result.coverage.temperature).toBe(11);
    expect(result.coverage.solar).toBe(10);
    expect(result.hourly[0].solarIrradianceWm2).toBe(0);
    expect(result.hourly[1].solarIrradianceWm2).toBeNull();
    expect(result.hourly[23].temperatureC).toBeNull();
  });
  const raw = () => ({
    latitude: 52,
    longitude: 4,
    timezone: "Europe/Amsterdam",
    hourly_units: {
      time: "unixtime",
      temperature_2m: "°C",
      shortwave_radiation: "W/m²",
    },
    hourly: {
      time: [now / 1000, now / 1000 + 3600],
      temperature_2m: [1, null],
      shortwave_radiation: [0, -1],
    },
  });
  it("normalizes optional context without inventing missing values and validates its units and alignment", () => {
    const input = {
      ...raw(),
      hourly_units: {
        ...raw().hourly_units,
        wind_speed_10m: "m/s",
        cloud_cover: "%",
      },
      hourly: {
        ...raw().hourly,
        wind_speed_10m: [4, null],
        cloud_cover: [25, 100],
      },
    };
    const result = normalizeProvider(input, point, now);
    expect(result.version).toBe(2);
    expect(result.hourly[0]).toMatchObject({
      windSpeedMs: 4,
      cloudCoverPct: 25,
      precipitationMm: null,
    });
    expect(result.hourly[1].windSpeedMs).toBeNull();
    expect(() =>
      normalizeProvider(
        {
          ...input,
          hourly_units: { ...input.hourly_units, wind_speed_10m: "km/h" },
        },
        point,
        now,
      ),
    ).toThrow();
    expect(() =>
      normalizeProvider(
        { ...input, hourly_units: raw().hourly_units },
        point,
        now,
      ),
    ).toThrow();
    expect(() =>
      normalizeProvider(
        { ...input, hourly: { ...input.hourly, wind_speed_10m: [4] } },
        point,
        now,
      ),
    ).toThrow();
    expect(() =>
      normalizeProvider(
        { ...input, hourly: { ...input.hourly, cloud_cover: [25, 101] } },
        point,
        now,
      ),
    ).toThrow();
  });
  it("preserves requested point, validates units and rejects misaligned arrays", () => {
    const valid = normalizeProvider(raw(), point, now);
    expect(valid.location.latitude).toBe(point.latitude);
    expect(valid.location.grid.latitude).toBe(52);
    expect(valid.hourly[1].solarIrradianceWm2).toBeNull();
    expect(() =>
      normalizeProvider(
        {
          ...raw(),
          hourly_units: { ...raw().hourly_units, temperature_2m: "°F" },
        },
        point,
        now,
      ),
    ).toThrow();
    expect(() =>
      normalizeProvider(
        { ...raw(), hourly: { ...raw().hourly, temperature_2m: [1] } },
        point,
        now,
      ),
    ).toThrow();
    expect(() =>
      normalizeProvider(
        { ...raw(), hourly: { ...raw().hourly, time: [1, 1] } },
        point,
        now,
      ),
    ).toThrow();
  });
  it("uses an explicit UTC fallback for an unknown timezone", () =>
    expect(
      normalizeProvider({ ...raw(), timezone: "No/Such_Zone" }, point, now)
        .location,
    ).toMatchObject({ timezone: "UTC", timezoneResolved: false }));
});
describe("cache lifecycle", () => {
  it("honors provider backoff even without a cached snapshot", async () => {
    let clock = now;
    const load = vi.fn(async () => {
      throw new AppError("PROVIDER_BUSY", "Busy", 503, true, 120_000);
    });
    const service = createWeatherService(
      { get: async () => null, put: async () => {} },
      load,
      () => clock,
    );
    await expect(service(point, "24h", "public")).rejects.toThrow("Busy");
    clock += 60_000;
    await expect(service(point, "48h", "public")).rejects.toThrow("Busy");
    expect(load).toHaveBeenCalledTimes(1);
    clock += 60_001;
    await expect(service(point, "48h", "public")).rejects.toThrow("Busy");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("reuses a fresh snapshot across horizons without resetting retrieval time", async () => {
    const cached = snapshot(now - 60_000),
      cache = { get: vi.fn(async () => cached), put: vi.fn() },
      load = vi.fn();
    const service = createWeatherService(cache, load, () => now);
    const result = await service(point, "7d", "public");
    expect(result.source).toMatchObject({
      retrievedAt: now - 60_000,
      ageSeconds: 60,
      stale: false,
    });
    expect(load).not.toHaveBeenCalled();
  });
  it("lets a manual refresh bypass a fresh snapshot once it is a minute old", async () => {
    let cached = snapshot(now - 30_000);
    const cache = {
        get: vi.fn(async () => cached),
        put: vi.fn(async (_key: string, value: typeof cached) => {
          cached = value;
        }),
      },
      load = vi.fn(async () => snapshot(now));
    const service = createWeatherService(cache, load, () => now);
    // Under the floor the cached retrieval is returned, even when asked to refresh.
    await service(point, "48h", "public", false, true);
    expect(load).not.toHaveBeenCalled();
    cached = snapshot(now - REFRESH_FLOOR_MS);
    expect((await service(point, "48h", "public")).source.retrievedAt).toBe(
      now - REFRESH_FLOOR_MS,
    );
    const refreshed = await service(point, "48h", "public", false, true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(refreshed.source).toMatchObject({ retrievedAt: now, ageSeconds: 0 });
  });
  it("serves stale on failure only within two hours and briefly avoids repeat failures", async () => {
    let clock = now;
    const cached = snapshot(now - FRESH_MS),
      cache = { get: vi.fn(async () => cached), put: vi.fn() },
      load = vi.fn(async () => {
        throw new Error("offline");
      });
    const service = createWeatherService(cache, load, () => clock);
    expect((await service(point, "24h", "public")).source).toMatchObject({
      stale: true,
      refreshFailed: true,
    });
    await service(point, "48h", "public");
    expect(load).toHaveBeenCalledTimes(1);
    clock = cached.retrievedAt + MAX_AGE_MS + 1;
    await expect(service(point, "24h", "public")).rejects.toThrow();
  });
  it("returns a fresh result when cache storage fails and bypasses all caches for private points", async () => {
    const cache = {
        get: vi.fn(async () => null),
        put: vi.fn(async () => {
          throw new Error("KV down");
        }),
      },
      load = vi.fn(async () => snapshot(now));
    const service = createWeatherService(cache, load, () => now);
    expect((await service(point, "24h", "public")).source.stale).toBe(false);
    cache.get.mockClear();
    cache.put.mockClear();
    await service(point, "24h", "public", true);
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
});
describe("UTC and local time", () => {
  it("distinguishes repeated autumn hours and skips the missing spring hour", () => {
    expect(
      hourLabel(Date.parse("2026-10-25T00:00Z"), "Europe/Amsterdam"),
    ).toContain("02:00 GMT+2");
    expect(
      hourLabel(Date.parse("2026-10-25T01:00Z"), "Europe/Amsterdam"),
    ).toContain("02:00 GMT+1");
    expect(
      solarInterval(Date.parse("2026-03-29T01:00Z"), "Europe/Amsterdam"),
    ).toBe("01:00 GMT+1 - 03:00 GMT+2");
  });
  it("handles fractional offsets and preceding solar intervals", () => {
    expect(localTime(Date.parse("2026-10-13T00:00Z"), "Asia/Kathmandu")).toBe(
      "05:45",
    );
    expect(solarInterval(Date.parse("2026-10-13T12:00Z"), "UTC")).toMatch(
      /^11:00 GMT(?:\+0)? - 12:00 GMT(?:\+0)?$/,
    );
  });
});
describe("location privacy and restoration", () => {
  it("keeps device coordinates out of ordinary links until explicit sharing", () => {
    const place = { ...point, name: "Near you", private: true };
    expect(locationHref(place, "48h")).not.toContain("lat=");
    expect(locationHref(place, "48h", true)).toContain("lat=51.9225");
  });
  it("round trips manual links, rejects invalid saved data, and has no default city", () => {
    expect(readLocation("").place).toBeNull();
    const place = { ...point, name: "Rotterdam", countryCode: "NL" };
    expect(readLocation(locationHref(place, "7d").slice(1))).toMatchObject({
      place,
      horizon: "7d",
      view: "forecast",
    });
    expect(locationHref(place, "7d")).not.toContain("view=");
    expect(readLocation("?view=map").view).toBe("map");
    expect(() => readSaved("{bad")).toThrow();
    expect(() =>
      readSaved(
        JSON.stringify({
          version: 1,
          place: { ...place, latitude: 100 },
          horizon: "48h",
        }),
      ),
    ).toThrow();
  });
});
describe("bounded provider transport", () => {
  it("retries one transient failure, never a provider rate limit", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    await expect(
      fetchJson(new URL("https://example.test"), transport),
    ).resolves.toEqual({ ok: true });
    expect(transport).toHaveBeenCalledTimes(2);
    const busy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("", { status: 429, headers: { "Retry-After": "120" } }),
      );
    await expect(
      fetchJson(new URL("https://example.test"), busy),
    ).rejects.toMatchObject({ code: "PROVIDER_BUSY", retryAfterMs: 120_000 });
    expect(busy).toHaveBeenCalledTimes(1);
  });
  it("rejects unreadable and oversized provider bodies", async () => {
    await expect(
      fetchJson(
        new URL("https://example.test"),
        vi.fn<typeof fetch>().mockResolvedValue(new Response("not json")),
      ),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER_DATA" });
    await expect(
      fetchJson(
        new URL("https://example.test"),
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("x".repeat(256001))),
      ),
    ).rejects.toThrow("too large");
  });
});
