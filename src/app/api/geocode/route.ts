import { env } from "cloudflare:workers";
import { z } from "zod";
import { api } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { fetchJson } from "@/lib/upstream";
import { protectedFetch } from "@/lib/protected-fetch";
import type { Place } from "@/features/weather/types";

const resultSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        country: z.string().optional(),
        country_code: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .optional(),
        admin1: z.string().optional(),
      }),
    )
    .max(10)
    .optional(),
});
export async function GET(request: Request) {
  return api(request, async () => {
    const params = new URL(request.url).searchParams,
      q = params.get("q")?.trim();
    if (params.getAll("q").length !== 1 || !q || q.length > 100)
      throw new AppError(
        "INVALID_SEARCH",
        "Enter a place name of up to 100 characters.",
        400,
      );
    if (q.length < 2) return { places: [] };
    const key = `geocode:v1:${env.WEATHER_PROVIDER_MODE}:${q.toLowerCase()}`;
    try {
      const cached = await env.WEATHER_CACHE.get<Place[]>(key, "json");
      if (cached) return { places: cached };
    } catch {
      /* Search still works without a cache. */
    }
    const customer = env.WEATHER_PROVIDER_MODE === "customer",
      secret = Reflect.get(env, "OPEN_METEO_API_KEY");
    if (customer && typeof secret !== "string")
      throw new AppError(
        "CONFIGURATION",
        "Location search is not configured. Enter coordinates instead.",
        503,
      );
    const url = new URL(
      customer
        ? "https://customer-geocoding-api.open-meteo.com/v1/search"
        : "https://geocoding-api.open-meteo.com/v1/search",
    );
    url.search = new URLSearchParams({
      name: q,
      count: "6",
      language: "en",
      ...(customer ? { apikey: String(secret) } : {}),
    }).toString();
    const parsed = resultSchema.safeParse(await fetchJson(url, protectedFetch));
    if (!parsed.success)
      throw new AppError(
        "INVALID_PROVIDER_DATA",
        "Search is temporarily unavailable. Use the map or coordinates.",
        502,
        true,
      );
    const places: Place[] = (parsed.data.results ?? []).map((p) => ({
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      country: p.country,
      countryCode: p.country_code,
      region: p.admin1,
    }));
    try {
      await env.WEATHER_CACHE.put(key, JSON.stringify(places), {
        expirationTtl: 3600,
      });
    } catch {
      /* Cache is disposable. */
    }
    return { places };
  });
}
