import { HOUR } from "@/lib/time";
import { AppError } from "@/lib/errors";
import { deriveSignals } from "./signals";
import {
  HORIZONS,
  type Forecast,
  type Horizon,
  type Point,
  type Snapshot,
} from "./types";

export const FRESH_MS = 15 * 60_000,
  MAX_AGE_MS = 2 * 60 * 60_000,
  // A manual refresh bypasses the cache once a snapshot is a minute old.
  REFRESH_FLOOR_MS = 60_000;
export type WeatherCache = {
  get(key: string): Promise<Snapshot | null>;
  put(key: string, value: Snapshot): Promise<void>;
};
export function forecastFromSnapshot(
  snapshot: Snapshot,
  horizon: Horizon,
  now: number,
  refreshFailed = false,
): Forecast {
  const next = snapshot.hourly.find((h) => h.time > now)?.time;
  if (
    !next ||
    next - now > HOUR ||
    snapshot.retrievedAt > now + 60_000 ||
    now - snapshot.retrievedAt > MAX_AGE_MS
  )
    throw new AppError(
      "EXPIRED",
      "No usable forecast remains. Try refreshing.",
      503,
      true,
    );
  const byTime = new Map(snapshot.hourly.map((hour) => [hour.time, hour]));
  const hourly = Array.from(
    { length: HORIZONS[horizon] },
    (_, i) =>
      byTime.get(next + i * HOUR) ?? {
        time: next + i * HOUR,
        temperatureC: null,
        solarIrradianceWm2: null,
        windSpeedMs: null,
        windGustMs: null,
        cloudCoverPct: null,
        humidityPct: null,
        precipitationMm: null,
        precipitationProbabilityPct: null,
      },
  );
  const coverage = {
    expected: hourly.length,
    temperature: hourly.filter((h) => h.temperatureC !== null).length,
    solar: hourly.filter((h) => h.solarIrradianceWm2 !== null).length,
  };
  if (!coverage.temperature && !coverage.solar)
    throw new AppError(
      "NO_DATA",
      "No forecast measurements are available here. Choose another point or try again.",
      503,
      true,
    );
  return {
    location: snapshot.location,
    units: {
      temperature: "°C",
      solarIrradiance: "W/m²",
      time: "unix_milliseconds",
      solarInterval: "preceding_hour_mean",
      wind: "m/s",
      precipitation: "mm",
      percentage: "%",
    },
    horizon,
    hourly,
    current: snapshot.current,
    source: {
      provider: "Open-Meteo",
      retrievedAt: snapshot.retrievedAt,
      servedAt: now,
      ageSeconds: Math.max(0, Math.floor((now - snapshot.retrievedAt) / 1000)),
      stale: now - snapshot.retrievedAt >= FRESH_MS,
      refreshFailed,
    },
    coverage,
    signals: deriveSignals(hourly),
  };
}

export function createWeatherService(
  cache: WeatherCache,
  load: (point: Point) => Promise<Snapshot>,
  clock: () => number = Date.now,
  log: (event: string) => void = () => {},
) {
  // Share completed snapshots through KV; a canceled request can strand its promises.
  const failures = new Map<string, { until: number; error: unknown }>();
  return async (
    point: Point,
    horizon: Horizon,
    mode: string,
    privatePoint = false,
    refresh = false,
  ): Promise<Forecast> => {
    const key = `forecast:v2:${mode}:celsius:weather-context:${point.latitude}:${point.longitude}`;
    let cached: Snapshot | null = null;
    if (!privatePoint) {
      try {
        cached = await cache.get(key);
      } catch {
        log("cache_read_failed");
      }
    }
    const now = clock();
    const age = cached ? now - cached.retrievedAt : Infinity;
    if (
      cached &&
      age < FRESH_MS &&
      cached.retrievedAt <= now &&
      !(refresh && age >= REFRESH_FLOOR_MS)
    )
      return forecastFromSnapshot(cached, horizon, now);
    const failure = privatePoint ? undefined : failures.get(key);
    if (failure && failure.until > now) {
      if (cached && now - cached.retrievedAt <= MAX_AGE_MS)
        return forecastFromSnapshot(cached, horizon, now, true);
      throw failure.error;
    }
    try {
      const fresh = await load(point);
      if (!privatePoint) {
        try {
          await cache.put(key, fresh);
        } catch {
          log("cache_write_failed");
        }
      }
      return forecastFromSnapshot(fresh, horizon, clock());
    } catch (error) {
      if (!privatePoint) {
        if (failures.size > 200) failures.clear();
        failures.set(key, {
          until:
            clock() + (error instanceof AppError ? error.retryAfterMs : 30_000),
          error,
        });
      }
      if (cached && clock() - cached.retrievedAt <= MAX_AGE_MS)
        return forecastFromSnapshot(cached, horizon, clock(), true);
      throw error;
    }
  };
}
