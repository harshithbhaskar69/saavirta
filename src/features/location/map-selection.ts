import type { FeatureCollection, Point as GeoPoint } from "geojson";
import type { Place, Point } from "@/features/weather/types";
import { canonicalPoint } from "@/features/weather/validation";

export type CityProperties = Pick<
  Place,
  "name" | "country" | "countryCode" | "region"
> & {
  rank: number;
  minZoom: number;
  population: number;
};
export type Cities = FeatureCollection<GeoPoint, CityProperties>;
export type City = Cities["features"][number];

export function cityPlace(city: City): Place {
  return {
    ...canonicalPoint({
      latitude: city.geometry.coordinates[1],
      longitude: city.geometry.coordinates[0],
    }),
    name: city.properties.name,
    country: city.properties.country,
    countryCode: /^[A-Z]{2}$/.test(city.properties.countryCode ?? "")
      ? city.properties.countryCode
      : undefined,
    region: city.properties.region,
  };
}

export function distanceKm(point: Point, city: City): number {
  const radians = Math.PI / 180;
  const [longitude, latitude] = city.geometry.coordinates;
  const a =
    Math.sin(((latitude - point.latitude) * radians) / 2) ** 2 +
    Math.cos(point.latitude * radians) *
      Math.cos(latitude * radians) *
      Math.sin(((longitude - point.longitude) * radians) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function pointPlace(point: Point, cities: Cities): Place {
  const exact = canonicalPoint(point);
  let nearby: City | undefined;
  let distance = 25;
  for (const city of cities.features) {
    const candidate = distanceKm(exact, city);
    if (candidate < distance) {
      nearby = city;
      distance = candidate;
    }
  }
  return {
    ...exact,
    name: nearby ? `Near ${nearby.properties.name}` : "Selected point",
  };
}
