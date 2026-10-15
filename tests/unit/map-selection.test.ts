import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cityPlace,
  distanceKm,
  pointPlace,
  type Cities,
  type City,
} from "../../src/features/location/map-selection";
import { locationHref, readLocation } from "../../src/features/location/state";

const cities: Cities = JSON.parse(
  readFileSync(
    new URL("../../public/maps/cities.geojson", import.meta.url),
    "utf8",
  ),
);
const mysuru = cities.features.find(
  (city) => city.properties.name === "Mysuru",
)!;

describe("bundled geographic selection", () => {
  it("selects Mysuru with its real regional identity and stable asset identifiers", () => {
    expect(cityPlace(mysuru)).toEqual({
      name: "Mysuru",
      region: "Karnataka",
      country: "India",
      countryCode: "IN",
      latitude: 12.3119,
      longitude: 76.6581,
    });
    expect(new Set(cities.features.map((city) => city.id)).size).toBe(
      cities.features.length,
    );
    expect(
      cities.features.every(
        (city) =>
          Number.isFinite(city.id) &&
          city.geometry.coordinates.every(Number.isFinite),
      ),
    ).toBe(true);
  });
  it("names nearby points without changing their coordinates or claiming a city/country match", () => {
    expect(pointPlace({ latitude: 12.3, longitude: 76.66 }, cities)).toEqual({
      name: "Near Mysuru",
      latitude: 12.3,
      longitude: 76.66,
    });
    expect(pointPlace({ latitude: 0, longitude: 0 }, cities)).toEqual({
      name: "Selected point",
      latitude: 0,
      longitude: 0,
    });
  });
  it("measures proximity across the antimeridian", () => {
    const city: City = {
      ...mysuru,
      geometry: { type: "Point", coordinates: [179.95, 0] },
    };
    expect(distanceKm({ latitude: 0, longitude: -179.99 }, city)).toBeCloseTo(
      6.67,
      1,
    );
  });
  it("preserves regional context through share links and keeps private coordinates opt-in", () => {
    const place = cityPlace(mysuru);
    expect(readLocation(locationHref(place, "48h").slice(1)).place).toEqual(
      place,
    );
    expect(locationHref({ ...place, private: true }, "48h")).not.toMatch(
      /lat=|lon=|name=|region=/,
    );
  });
});
