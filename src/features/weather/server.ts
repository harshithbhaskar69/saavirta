import { env } from "cloudflare:workers";
import { createWeatherService } from "./service";
import { createBaselineService } from "./baselines";
import { loadWeather } from "./provider";
import type { Snapshot } from "./types";
import { protectedFetch } from "@/lib/protected-fetch";

const apiKey = () =>
  typeof Reflect.get(env, "OPEN_METEO_API_KEY") === "string"
    ? (Reflect.get(env, "OPEN_METEO_API_KEY") as string)
    : undefined;

export const weatherService = createWeatherService(
  {
    async get(key) {
      const value = await env.WEATHER_CACHE.get<Snapshot>(key, "json");
      return value?.version === 2 &&
        Array.isArray(value.hourly) &&
        Number.isFinite(value.retrievedAt)
        ? value
        : null;
    },
    async put(key, snapshot) {
      await env.WEATHER_CACHE.put(key, JSON.stringify(snapshot), {
        expirationTtl: 7200,
      });
    },
  },
  (point) =>
    loadWeather(
      point,
      env.WEATHER_PROVIDER_MODE,
      apiKey(),
      Date.now,
      protectedFetch,
    ),
  Date.now,
  (event) => console.warn(JSON.stringify({ event })),
);

export const baselineService = createBaselineService(
  {
    get: (key) => env.WEATHER_CACHE.get(key, "json"),
    put: (key, value, ttlSeconds) =>
      env.WEATHER_CACHE.put(key, JSON.stringify(value), {
        expirationTtl: ttlSeconds,
      }),
  },
  env.WEATHER_PROVIDER_MODE,
  apiKey(),
  Date.now,
  protectedFetch,
  (event) => console.warn(JSON.stringify({ event })),
);
