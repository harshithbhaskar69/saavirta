import { HOUR } from "@/lib/time";
import { AppError } from "@/lib/errors";
import { fetchJson } from "@/lib/upstream";
import type { Horizon, Point } from "./types";
import {
  ENSEMBLE_MODEL,
  ENSEMBLE_HOURS,
  ENSEMBLE_FRESH_MS,
  ENSEMBLE_MAX_AGE_MS,
  ensembleSnapshotSchema,
  parseEnsemble,
  summarizeEnsemble,
  type EnsembleSnapshot,
  type Uncertainty,
} from "./uncertainty";

type Cache = {
  get(key: string): Promise<unknown>;
  put(key: string, value: EnsembleSnapshot, ttlSeconds: number): Promise<void>;
};

export function createUncertaintyService(
  cache: Cache,
  mode: string,
  apiKey: string | undefined,
  clock: () => number = Date.now,
  transport: typeof fetch = fetch,
  log: (event: string) => void = () => {},
) {
  return async (
    point: Point,
    start: number,
    horizon: Horizon,
    privatePoint = false,
  ): Promise<Uncertainty> => {
    if (
      (mode !== "public" && mode !== "customer") ||
      (mode === "customer" && !apiKey)
    )
      throw new AppError(
        "CONFIGURATION",
        "The ensemble provider is not configured.",
        503,
      );
    const key = `ensemble:v1:${mode}:${ENSEMBLE_MODEL}:${point.latitude}:${point.longitude}`;
    let cached: EnsembleSnapshot | null = null;
    if (!privatePoint) {
      try {
        const result = ensembleSnapshotSchema.safeParse(await cache.get(key));
        if (
          result.success &&
          result.data.retrievedAt <= clock() &&
          clock() - result.data.retrievedAt <= ENSEMBLE_MAX_AGE_MS
        )
          cached = result.data;
      } catch {
        log("ensemble_cache_read_failed");
      }
    }
    const covers = (data: EnsembleSnapshot) =>
      data.time[0] <= start && data.time.at(-1)! >= start + 167 * HOUR;
    if (
      cached &&
      covers(cached) &&
      clock() - cached.retrievedAt < ENSEMBLE_FRESH_MS
    )
      return summarizeEnsemble(cached, start, horizon, clock());
    const url = new URL(
      `https://${mode === "customer" ? "customer-" : ""}ensemble-api.open-meteo.com/v1/ensemble`,
    );
    url.search = new URLSearchParams({
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      models: ENSEMBLE_MODEL,
      hourly: "temperature_2m,shortwave_radiation",
      forecast_hours: String(ENSEMBLE_HOURS),
      timezone: "auto",
      timeformat: "unixtime",
      ...(mode === "customer" && apiKey ? { apikey: apiKey } : {}),
    }).toString();
    try {
      const fresh = parseEnsemble(await fetchJson(url, transport), clock());
      if (!privatePoint) {
        try {
          await cache.put(key, fresh, ENSEMBLE_MAX_AGE_MS / 1000);
        } catch {
          log("ensemble_cache_write_failed");
        }
      }
      return summarizeEnsemble(fresh, start, horizon, clock());
    } catch (error) {
      if (cached)
        return summarizeEnsemble(cached, start, horizon, clock(), true);
      throw error;
    }
  };
}
