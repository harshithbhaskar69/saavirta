import { expect, test, vi } from "vitest";
import { HOUR } from "../../src/lib/time";
import { ensembleSnapshot, ensembleProvider } from "../fixtures/ensemble";
import {
  ENSEMBLE_MAX_AGE_MS,
  ensembleRange,
  parseEnsemble,
  summarizeEnsemble,
  uncertaintySchema,
  uncertaintyStart,
} from "../../src/features/weather/uncertainty";
import { createUncertaintyService } from "../../src/features/weather/uncertainty-service";
import { forecastCsv } from "../../src/features/weather/overview";
import { forecast } from "../fixtures/weather";

const start = Date.parse("2026-10-24T21:00:00Z");
const point = { latitude: 60.1695, longitude: 24.9354 };

test("decodes all 51 members, preserves nulls and rejects wrong units, times or missing members", () => {
  const input = ensembleProvider(ensembleSnapshot(start));
  input.hourly.temperature_2m[0] = null;
  input.hourly.shortwave_radiation_member01[0] = -2;
  const result = parseEnsemble(input, start);
  expect(result.members).toHaveLength(51);
  expect(result.members[0].temperatureC[0]).toBeNull();
  expect(result.members[1].solarIrradianceWm2[0]).toBeNull();
  for (const corrupt of [
    (data: typeof input) => {
      data.hourly_units.temperature_2m_member50 = "°F";
    },
    (data: typeof input) => {
      data.hourly.time[1] = data.hourly.time[0];
    },
    (data: typeof input) => {
      delete data.hourly.temperature_2m_member02;
    },
  ]) {
    const bad = structuredClone(input);
    corrupt(bad);
    expect(() => parseEnsemble(bad, start)).toThrow("incomplete data");
  }
});

test("daily metrics aggregate each whole member trajectory before ranking", () => {
  const data = ensembleSnapshot(start);
  data.members.forEach((member, m) => {
    member.temperatureC.fill(18);
    member.solarIrradianceWm2.fill(0);
    // Disjoint tail members: hourly medians are zero but most members have daily HDD > 0.
    member.temperatureC[0] = m < 30 ? 0 : 36;
    member.temperatureC[1] = m >= 21 ? 0 : 36;
    member.solarIrradianceWm2[1] = m < 30 ? 100 : 0;
    member.solarIrradianceWm2[2] = m >= 21 ? 100 : 0;
  });
  const result = summarizeEnsemble(data, start, "48h", start);
  expect(result.daily[0].heatingDegreeDays).toEqual({
    p10: 0.75,
    p50: 0.75,
    p90: 1.5,
  });
  expect(result.daily[0].solarEnergyKwhM2).toEqual({
    p10: 0.1,
    p50: 0.1,
    p90: 0.2,
  });
  expect(result.daily[0].partial).toBe(false);
  expect(result.source).toMatchObject({ calibrated: false, runTime: null });
  expect(uncertaintySchema.safeParse(result).success).toBe(true);
});

test.each([
  ["2026-03-28T22:00:00Z", 23],
  ["2026-10-24T21:00:00Z", 25],
])(
  "local day %s counts %i hours and assigns midnight irradiance to the preceding day",
  (iso, count) => {
    const time = Date.parse(iso);
    const data = ensembleSnapshot(time);
    data.members.forEach((m) => {
      m.temperatureC.fill(6);
      m.solarIrradianceWm2.fill(100);
    });
    const result = summarizeEnsemble(data, time, "48h", time);
    expect(result.daily[0].heatingDegreeDays?.p50).toBeCloseTo(
      (count * 12) / 24,
    );
    expect(result.daily[0].solarEnergyKwhM2?.p50).toBeCloseTo(count / 10);
    expect(result.daily[0].partial).toBe(false);
    expect(result.daily.at(-1)?.partial).toBe(true);
  },
);

test("missing hours or members withhold ranges rather than narrowing them or becoming zero", () => {
  const data = ensembleSnapshot(start);
  data.members.forEach((m) => m.solarIrradianceWm2.fill(0));
  data.members[50].temperatureC[2] = null;
  const result = summarizeEnsemble(data, start, "48h", start);
  expect(result.hourly[2].temperatureC).toBeNull();
  expect(result.daily[0].heatingDegreeDays).toBeNull();
  expect(result.daily[0].solarEnergyKwhM2).toEqual({ p10: 0, p50: 0, p90: 0 });
  expect(ensembleRange([1, 2])).toBeNull();
  expect(() => uncertaintyStart(start - 3 * HOUR, start)).toThrow();
  expect(() => uncertaintyStart(start + 2 * HOUR, start)).toThrow();
  expect(uncertaintyStart(start + HOUR / 2, start)).toBe(start + HOUR / 2);
});

test("shares completed snapshots across horizons, retains stale data on failure, and never caches private coordinates", async () => {
  let now = start;
  let saved: unknown = null;
  const cache = {
    get: vi.fn(async () => saved),
    put: vi.fn(async (_key, value) => {
      saved = value;
    }),
  };
  const transport = vi
    .fn<typeof fetch>()
    .mockImplementation(async () =>
      Response.json(ensembleProvider(ensembleSnapshot(start))),
    );
  const service = createUncertaintyService(
    cache,
    "public",
    undefined,
    () => now,
    transport,
  );
  await service(point, start, "24h");
  await service(point, start, "7d");
  expect(transport).toHaveBeenCalledTimes(1);
  const url = new URL(String(transport.mock.calls[0][0]));
  expect(url.hostname).toBe("ensemble-api.open-meteo.com");
  expect(url.searchParams.get("models")).toBe("ecmwf_ifs025");
  expect(url.searchParams.has("apikey")).toBe(false);
  now += 2 * HOUR;
  transport.mockResolvedValue(new Response("{}", { status: 401 }));
  expect((await service(point, start, "48h")).source).toMatchObject({
    stale: true,
    refreshFailed: true,
    retrievedAt: start,
  });
  expect(cache.put).toHaveBeenCalledTimes(1);
  now += ENSEMBLE_MAX_AGE_MS;
  await expect(service(point, start, "48h")).rejects.toThrow();
  cache.get.mockClear();
  cache.put.mockClear();
  transport.mockImplementation(async () =>
    Response.json(ensembleProvider(ensembleSnapshot(now))),
  );
  await service(point, now, "24h", true);
  expect(cache.get).not.toHaveBeenCalled();
  expect(cache.put).not.toHaveBeenCalled();
});

test("malformed fresh responses preserve cached data and missing commercial credentials fail closed", async () => {
  const data = ensembleSnapshot(start);
  const cache = { get: vi.fn(async () => data), put: vi.fn() };
  const service = createUncertaintyService(
    cache,
    "public",
    undefined,
    () => start + 2 * HOUR,
    vi.fn<typeof fetch>().mockResolvedValue(Response.json({})),
  );
  expect((await service(point, start, "24h")).source.refreshFailed).toBe(true);
  expect(cache.put).not.toHaveBeenCalled();
  await expect(
    createUncertaintyService(cache, "customer", undefined)(point, start, "24h"),
  ).rejects.toMatchObject({ code: "CONFIGURATION" });
});

test("CSV keeps ensemble quantiles separate from point data with retrieval and calibration provenance", () => {
  const pointForecast = forecast("24h", point, start);
  const data = ensembleSnapshot(start);
  data.members[0].temperatureC[1] = null;
  const result = summarizeEnsemble(
    data,
    pointForecast.hourly[0].time,
    "24h",
    start,
  );
  const rows = forecastCsv(
    pointForecast.hourly,
    pointForecast.location.timezone,
    result,
  ).split("\r\n");
  expect(rows[0]).toContain(
    "ensemble_temperature_C_p10,ensemble_temperature_C_p50,ensemble_temperature_C_p90",
  );
  expect(rows[1]).toContain(',"ECMWF IFS 0.25° ensemble",');
  expect(rows[1]).toContain(',"false"');
  expect(
    rows.every((row) => row.split(",").length === rows[0].split(",").length),
  ).toBe(true);
  expect(rows[1].split(",").slice(11, 14)).toEqual(["", "", ""]);
});
