import { z } from "zod";
import { HOUR } from "@/lib/time";
import { AppError } from "@/lib/errors";
import { fetchJson } from "@/lib/upstream";
import type { Point, Snapshot } from "./types";

const value = z.number().finite().nullable();
const schema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  timezone: z.string(),
  hourly_units: z.object({
    time: z.literal("unixtime"),
    temperature_2m: z.literal("°C"),
    shortwave_radiation: z.literal("W/m²"),
    wind_speed_10m: z.literal("m/s").optional(),
    wind_gusts_10m: z.literal("m/s").optional(),
    cloud_cover: z.literal("%").optional(),
    relative_humidity_2m: z.literal("%").optional(),
    precipitation: z.literal("mm").optional(),
    precipitation_probability: z.literal("%").optional(),
  }),
  hourly: z.object({
    time: z.array(z.number().int().positive()).min(1).max(400),
    temperature_2m: z.array(value),
    shortwave_radiation: z.array(value),
    wind_speed_10m: z
      .array(z.number().finite().nonnegative().nullable())
      .optional(),
    wind_gusts_10m: z
      .array(z.number().finite().nonnegative().nullable())
      .optional(),
    cloud_cover: z.array(z.number().min(0).max(100).nullable()).optional(),
    relative_humidity_2m: z
      .array(z.number().min(0).max(100).nullable())
      .optional(),
    precipitation: z
      .array(z.number().finite().nonnegative().nullable())
      .optional(),
    precipitation_probability: z
      .array(z.number().min(0).max(100).nullable())
      .optional(),
  }),
  current: z
    .object({
      time: z.number().int().positive(),
      temperature_2m: value,
      weather_code: value,
      is_day: z.union([z.literal(0), z.literal(1)]),
    })
    .optional(),
});
export function normalizeProvider(
  raw: unknown,
  point: Point,
  now: number,
): Snapshot {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "INVALID_PROVIDER_DATA",
      "The provider returned incomplete forecast data. Try again.",
      502,
      true,
    );
  const data = parsed.data,
    hourly = data.hourly;
  const contextFields = [
    "wind_speed_10m",
    "wind_gusts_10m",
    "cloud_cover",
    "relative_humidity_2m",
    "precipitation",
    "precipitation_probability",
  ] as const;
  if (
    hourly.time.length !== hourly.temperature_2m.length ||
    hourly.time.length !== hourly.shortwave_radiation.length ||
    contextFields.some(
      (field) =>
        hourly[field] !== undefined &&
        (hourly[field].length !== hourly.time.length ||
          !data.hourly_units[field]),
    ) ||
    hourly.time.some(
      (t, i) => i > 0 && (t - hourly.time[i - 1]) * 1000 !== HOUR,
    )
  )
    throw new AppError(
      "INVALID_PROVIDER_DATA",
      "The provider returned misaligned forecast hours. Try again.",
      502,
      true,
    );
  let timezone = data.timezone,
    timezoneResolved = true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(now);
  } catch {
    timezone = "UTC";
    timezoneResolved = false;
  }
  return {
    version: 2,
    location: {
      latitude: point.latitude,
      longitude: point.longitude,
      timezone,
      timezoneResolved,
      grid: { latitude: data.latitude, longitude: data.longitude },
    },
    retrievedAt: now,
    hourly: hourly.time.map((time, i) => ({
      time: time * 1000,
      temperatureC: hourly.temperature_2m[i],
      solarIrradianceWm2:
        hourly.shortwave_radiation[i] !== null &&
        hourly.shortwave_radiation[i]! < 0
          ? null
          : hourly.shortwave_radiation[i],
      windSpeedMs: hourly.wind_speed_10m?.[i] ?? null,
      windGustMs: hourly.wind_gusts_10m?.[i] ?? null,
      cloudCoverPct: hourly.cloud_cover?.[i] ?? null,
      humidityPct: hourly.relative_humidity_2m?.[i] ?? null,
      precipitationMm: hourly.precipitation?.[i] ?? null,
      precipitationProbabilityPct:
        hourly.precipitation_probability?.[i] ?? null,
    })),
    current: data.current
      ? {
          time: data.current.time * 1000,
          temperatureC: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
          isDay: data.current.is_day === 1,
        }
      : null,
  };
}
export async function loadWeather(
  point: Point,
  mode: string,
  key: string | undefined,
  now: () => number = Date.now,
  transport: typeof fetch = fetch,
) {
  if (mode !== "public" && mode !== "customer")
    throw new AppError(
      "CONFIGURATION",
      "The weather service mode is not configured correctly.",
      503,
    );
  if (mode === "customer" && !key)
    throw new AppError(
      "CONFIGURATION",
      "The weather service is not configured. Contact the operator.",
      503,
    );
  const url = new URL(
    mode === "customer"
      ? "https://customer-api.open-meteo.com/v1/forecast"
      : "https://api.open-meteo.com/v1/forecast",
  );
  url.search = new URLSearchParams({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    hourly:
      "temperature_2m,shortwave_radiation,wind_speed_10m,wind_gusts_10m,cloud_cover,relative_humidity_2m,precipitation,precipitation_probability",
    current: "temperature_2m,weather_code,is_day",
    temperature_unit: "celsius",
    wind_speed_unit: "ms",
    precipitation_unit: "mm",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_hours: "192",
    ...(mode === "customer" && key ? { apikey: key } : {}),
  }).toString();
  return normalizeProvider(await fetchJson(url, transport), point, now());
}
