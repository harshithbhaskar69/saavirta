import { describe, expect, it } from "vitest";
import {
  contrast,
  DARK_CEILING,
  LIGHT_FLOOR,
  linear,
  luminance,
  SKY_TEXT,
  skyScene,
  sunPosition,
} from "../../src/features/weather/sky";
import type { Hour } from "../../src/features/weather/types";

const HOUR = 3_600_000;
const NOON = Date.parse("2026-06-21T12:00:00Z");
const hours = (start: number, values: Partial<Hour> = {}) =>
  Array.from({ length: 48 }, (_, i): Hour => ({
    time: start + i * HOUR,
    temperatureC: 10,
    solarIrradianceWm2: 0,
    windSpeedMs: 4,
    windGustMs: 8,
    cloudCoverPct: 50,
    humidityPct: 70,
    precipitationMm: 0,
    precipitationProbabilityPct: 10,
    ...values,
  }));
const scene = (
  code: number | null,
  isDay: boolean,
  {
    dark = false,
    time = NOON,
    hourly = {},
  }: { dark?: boolean; time?: number; hourly?: Partial<Hour> } = {},
) =>
  skyScene({
    current: { time, temperatureC: 12, weatherCode: code, isDay },
    hourly: hours(time - 6 * HOUR, hourly),
    latitude: 51.92,
    longitude: 4.48,
    dark,
  });
const CODES = [
  null,
  0,
  1,
  2,
  3,
  45,
  48,
  51,
  53,
  55,
  56,
  57,
  61,
  63,
  65,
  66,
  67,
  71,
  73,
  75,
  77,
  80,
  81,
  82,
  85,
  86,
  95,
  96,
  99,
];

describe("sky behind the place header", () => {
  it("keeps 4.5:1 for header text against every sky the shader may draw", () => {
    for (const color of Object.values(SKY_TEXT.light))
      expect(
        contrast(luminance(linear(color)), LIGHT_FLOOR),
      ).toBeGreaterThanOrEqual(4.5);
    for (const color of Object.values(SKY_TEXT.dark))
      expect(
        contrast(luminance(linear(color)), DARK_CEILING),
      ).toBeGreaterThanOrEqual(4.5);
  });

  it("fits every palette colour into its tone's window, in both appearances", () => {
    const times = [
      Date.parse("2026-06-21T03:40:00Z"), // dawn in Rotterdam
      NOON,
      Date.parse("2026-06-21T19:50:00Z"), // dusk
      Date.parse("2026-12-21T23:00:00Z"), // winter night
    ];
    for (const code of CODES)
      for (const isDay of [true, false])
        for (const dark of [false, true])
          for (const time of times) {
            const s = scene(code, isDay, { dark, time });
            const storm = code !== null && code >= 95;
            expect(s.tone).toBe(isDay && !storm ? "light" : "dark");
            for (const color of [s.top, s.bottom, s.lit, s.shade, s.haze]) {
              const L = luminance(color);
              expect(L).toBeGreaterThanOrEqual(s.minL - 1e-9);
              expect(L).toBeLessThanOrEqual(s.maxL + 1e-9);
            }
          }
  });

  it("pictures sun and rain together for daytime showers", () => {
    const s = scene(80, true, { hourly: { cloudCoverPct: 40 } });
    expect(s).toMatchObject({ tone: "light", sun: 1, storm: 0 });
    expect(s.rain).toBeGreaterThan(0);
    expect(s.cover).toBeCloseTo(0.4);
  });

  it("darkens and covers an overcast night and hides its stars", () => {
    const s = scene(3, false, { hourly: { cloudCoverPct: 100 } });
    expect(s).toMatchObject({ tone: "dark", sun: 0, cover: 1, stars: 0 });
    expect(scene(0, false, { hourly: { cloudCoverPct: 0 } }).stars).toBe(1);
  });

  it("darkens thunderstorms by day and hides the sun", () => {
    expect(scene(95, true)).toMatchObject({ tone: "dark", storm: 1, sun: 0 });
  });

  it("maps snow, fog and drizzle", () => {
    expect(scene(73, true)).toMatchObject({ snow: 0.6, rain: 0 });
    expect(scene(45, true).fog).toBeGreaterThan(0.5);
    const drizzle = scene(53, true);
    expect(drizzle.rain).toBeGreaterThan(0);
    expect(drizzle.fog).toBeGreaterThan(0);
  });

  it("uses the nearest hour's cloud cover and wind, with fallbacks", () => {
    expect(scene(2, true, { hourly: { cloudCoverPct: 10 } }).cover).toBeCloseTo(
      0.1,
    );
    expect(scene(2, true, { hourly: { cloudCoverPct: null } }).cover).toBe(0.5);
    // Rain never thins below its own cover because the hour says clearer.
    expect(scene(63, true, { hourly: { cloudCoverPct: 20 } }).cover).toBe(0.95);
    expect(scene(0, true, { hourly: { windSpeedMs: 14 } }).wind).toBe(1);
    expect(scene(0, true, { hourly: { windSpeedMs: null } }).wind).toBe(0.2);
  });

  it("warms the horizon of a clear evening", () => {
    const evening = scene(0, true, {
      time: Date.parse("2026-06-21T19:40:00Z"),
      hourly: { cloudCoverPct: 0 },
    });
    const noon = scene(0, true, { hourly: { cloudCoverPct: 0 } });
    const warmth = (s: typeof noon) => s.bottom[0] / s.bottom[2];
    expect(warmth(evening)).toBeGreaterThan(warmth(noon) * 1.2);
    expect(evening.sunX).toBeGreaterThan(0.75);
    expect(evening.sunY).toBeGreaterThan(noon.sunY);
  });
});

describe("solar position", () => {
  it("matches known elevations", () => {
    const greenwich = sunPosition(Date.parse("2026-06-21T12:02:00Z"), 51.48, 0);
    expect(greenwich.elevation).toBeCloseTo(62, 0);
    expect(Math.abs(greenwich.hourAngle)).toBeLessThan(2);
    const equator = sunPosition(Date.parse("2026-03-20T12:07:00Z"), 0, 0);
    expect(equator.elevation).toBeGreaterThan(88.5);
    // Helsinki local midnight at the winter solstice.
    expect(
      sunPosition(Date.parse("2026-12-21T22:00:00Z"), 60.17, 24.94).elevation,
    ).toBeLessThan(-45);
  });
});
