import { z } from "zod";
import {
  canonicalPoint,
  horizonSchema,
  parseWeatherQuery,
  pointSchema,
} from "@/features/weather/validation";
import type { Horizon, Place } from "@/features/weather/types";

export const SAVED_POINT = "saasignal:point";
const placeSchema = pointSchema.extend({
  name: z.string().min(1).max(100),
  country: z.string().max(100).optional(),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  region: z.string().max(100).optional(),
});
export function readSaved(
  value: string | null,
): { place: Place; horizon: Horizon } | null {
  if (!value) return null;
  const parsed = z
    .object({
      version: z.literal(1),
      place: placeSchema,
      horizon: horizonSchema,
    })
    .parse(JSON.parse(value));
  return {
    place: { ...parsed.place, ...canonicalPoint(parsed.place) },
    horizon: parsed.horizon,
  };
}
export function readLocation(search: string): {
  place: Place | null;
  horizon: Horizon;
  view: "forecast" | "map";
  day: string | null;
} {
  const params = new URLSearchParams(search),
    view = params.get("view") === "map" ? "map" : "forecast";
  const horizon = horizonSchema.parse(params.get("horizon") ?? "48h");
  // A focused local day; ignored later if it is outside the forecast window.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get("day") ?? "")
    ? params.get("day")
    : null;
  if (!params.has("lat") && !params.has("lon"))
    return { place: null, horizon, view, day: null };
  if (!params.has("horizon")) params.set("horizon", horizon);
  const point = parseWeatherQuery(params);
  const optional = (key: string) => params.get(key)?.slice(0, 100) || undefined;
  const code = params.get("countryCode");
  return {
    place: {
      latitude: point.latitude,
      longitude: point.longitude,
      name: optional("name") ?? "Selected point",
      region: optional("region"),
      country: optional("country"),
      countryCode: code && /^[A-Z]{2}$/.test(code) ? code : undefined,
    },
    horizon,
    view,
    day,
  };
}
export function locationHref(
  place: Place | null,
  horizon: Horizon,
  sharePrivate = false,
  day: string | null = null,
) {
  const params = new URLSearchParams();
  if (place && (!place.private || sharePrivate)) {
    params.set("lat", String(place.latitude));
    params.set("lon", String(place.longitude));
    params.set("name", place.name);
    if (place.region) params.set("region", place.region);
    if (place.country) params.set("country", place.country);
    if (place.countryCode) params.set("countryCode", place.countryCode);
  }
  if (place || horizon !== "48h") params.set("horizon", horizon);
  if (place && day) params.set("day", day);
  return params.size ? `/?${params}` : "/";
}
