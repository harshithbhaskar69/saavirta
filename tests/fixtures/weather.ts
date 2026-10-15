import type {
  Baselines,
  Horizon,
  Point,
  Snapshot,
} from "../../src/features/weather/types";
import { forecastFromSnapshot } from "../../src/features/weather/service";
import { shiftDate } from "../../src/features/weather/baselines";
import { localClock } from "../../src/lib/time";
export const HOUR = 3_600_000;
export const point = { latitude: 51.9225, longitude: 4.4792 };
const zone = (selected: Point) =>
  selected.latitude < 0 ? "Australia/Sydney" : "Europe/Amsterdam";
export function snapshot(now = Date.now(), selected: Point = point): Snapshot {
  const start = Math.floor(now / HOUR) * HOUR;
  return {
    version: 2,
    location: {
      ...selected,
      timezone: zone(selected),
      timezoneResolved: true,
      grid: selected,
    },
    retrievedAt: now,
    current: { time: start, temperatureC: 16.2, weatherCode: 2, isDay: true },
    hourly: Array.from({ length: 192 }, (_, i) => {
      const time = start + i * HOUR,
        hour = new Date(time).getUTCHours();
      return {
        time,
        temperatureC:
          Math.round(
            (11 + Math.sin(((hour - 8) / 24) * Math.PI * 2) * 5 + i / 250) * 10,
          ) / 10,
        solarIrradianceWm2:
          hour >= 6 && hour <= 17
            ? Math.round(Math.sin(((hour - 6) / 12) * Math.PI) * 530)
            : 0,
        windSpeedMs: 3 + (i % 7),
        windGustMs: 7 + (i % 9),
        cloudCoverPct: (i * 7) % 100,
        humidityPct: 55 + (i % 30),
        precipitationMm: i % 9 === 0 ? 0.4 : 0,
        precipitationProbabilityPct: i % 9 === 0 ? 60 : 10,
      };
    }),
  };
}
export function forecast(
  horizon: Horizon = "48h",
  selected: Point = point,
  now = Date.now(),
) {
  return forecastFromSnapshot(snapshot(now, selected), horizon, now);
}
/** Illustrative normals (10 °C, a 300 W/m² daytime plateau) and a run 0.5 °C cooler. */
export function baselines(
  selected: Point = point,
  now = Date.now(),
): Baselines {
  const timezone = zone(selected),
    today = localClock(timezone)(now).day;
  const latestRun = Math.floor(now / (6 * HOUR)) * 6 * HOUR - 6 * HOUR;
  return {
    timezone,
    normals: {
      source: "ERA5 and ERA5-Land reanalysis",
      years: [2016, 2025],
      yearCount: 10,
      smoothingDays: 3,
      days: Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [
          shiftDate(today, 0, i - 1),
          {
            temperatureC: Array<number | null>(24).fill(10),
            solarIrradianceWm2: Array.from({ length: 24 }, (_, h) =>
              h >= 8 && h <= 17 ? 300 : 0,
            ),
          },
        ]),
      ),
    },
    revision: {
      model: "ECMWF IFS 9 km",
      latestRun,
      previousRun: latestRun - 24 * HOUR,
      hours: snapshot(now, selected)
        .hourly.slice(0, 120)
        .map((h) => ({
          time: h.time,
          latestC: h.temperatureC,
          previousC: h.temperatureC === null ? null : h.temperatureC + 0.5,
          latestWm2: h.solarIrradianceWm2,
          previousWm2: h.solarIrradianceWm2,
        })),
    },
  };
}
