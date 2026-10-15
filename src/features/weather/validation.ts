import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { Horizon, Point } from "./types";

export const pointSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export const horizonSchema = z.enum(["24h", "48h", "7d"]);
export function canonicalPoint(point: Point): Point {
  const latitude = Number(point.latitude.toFixed(4)),
    longitude = Number(
      (point.longitude === 180 ? -180 : point.longitude).toFixed(4),
    );
  return { latitude: latitude || 0, longitude: longitude || 0 };
}
export function parseWeatherInput(
  input: unknown,
): Point & { horizon: Horizon } {
  const result = pointSchema
    .extend({ horizon: horizonSchema })
    .safeParse(input);
  if (!result.success)
    throw new AppError(
      "INVALID_LOCATION",
      "Choose valid coordinates and a 24h, 48h, or 7d forecast.",
      400,
    );
  return { ...canonicalPoint(result.data), horizon: result.data.horizon };
}
export function parsePointInput(input: unknown): Point {
  const result = pointSchema.safeParse(input);
  if (!result.success)
    throw new AppError("INVALID_LOCATION", "Choose valid coordinates.", 400);
  return canonicalPoint(result.data);
}
function singleDecimalParams(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const values = params.getAll(key);
    if (values.length !== 1 || !values[0].trim() || values[0].length > 32)
      throw new AppError(
        "INVALID_REQUEST",
        `Provide one ${keys.length > 2 ? "latitude, longitude, and forecast horizon" : "latitude and longitude"}.`,
        400,
      );
  }
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!decimal.test(params.get("lat")!) || !decimal.test(params.get("lon")!))
    throw new AppError(
      "INVALID_LOCATION",
      "Coordinates must be decimal numbers.",
      400,
    );
}
export function parsePointQuery(params: URLSearchParams) {
  singleDecimalParams(params, ["lat", "lon"]);
  return parsePointInput({
    latitude: Number(params.get("lat")),
    longitude: Number(params.get("lon")),
  });
}
export function parseWeatherQuery(params: URLSearchParams) {
  singleDecimalParams(params, ["lat", "lon", "horizon"]);
  return parseWeatherInput({
    latitude: Number(params.get("lat")),
    longitude: Number(params.get("lon")),
    horizon: params.get("horizon"),
  });
}
