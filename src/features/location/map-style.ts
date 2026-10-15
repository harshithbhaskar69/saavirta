import type { StyleSpecification } from "maplibre-gl";
import type { Cities } from "./map-selection";

export function mapStyle(
  theme: "light" | "dark",
  cities: Cities,
): StyleSpecification {
  const dark = theme === "dark";
  const ink = dark ? "#d5dadd" : "#4d5960";
  const land = dark ? "#282b2d" : "#edece7";
  const border = dark ? "#626a70" : "#a0a8aa";
  return {
    version: 8,
    "font-faces": { Plex: "/fonts/plex-sans.woff2" },
    sources: {
      countries: {
        type: "geojson",
        data: "/maps/countries.geojson",
        attribution:
          '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
      },
      regions: { type: "geojson", data: "/maps/regions.geojson" },
      rivers: { type: "geojson", data: "/maps/rivers.geojson" },
      "country-labels": {
        type: "geojson",
        data: "/maps/country-labels.geojson",
      },
      cities: { type: "geojson", data: cities },
    },
    layers: [
      {
        id: "water",
        type: "background",
        paint: { "background-color": dark ? "#1b2024" : "#dce4e7" },
      },
      {
        id: "land",
        type: "fill",
        source: "countries",
        paint: { "fill-color": land },
      },
      {
        id: "rivers",
        type: "line",
        source: "rivers",
        minzoom: 3,
        paint: { "line-color": dark ? "#3e555f" : "#b4c7cf", "line-width": 1 },
      },
      {
        id: "regions",
        type: "line",
        source: "regions",
        minzoom: 3,
        paint: {
          "line-color": border,
          "line-opacity": 0.65,
          "line-width": 0.7,
          "line-dasharray": [3, 3],
        },
      },
      {
        id: "borders",
        type: "line",
        source: "countries",
        paint: { "line-color": border, "line-width": 1 },
      },
      {
        id: "country-labels",
        type: "symbol",
        source: "country-labels",
        maxzoom: 5.5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Plex"],
          "text-size": 12,
          "text-letter-spacing": 0.08,
          "symbol-sort-key": ["get", "rank"],
          "text-max-width": 10,
        },
        paint: {
          "text-color": ink,
          "text-halo-color": land,
          "text-halo-width": 1.5,
        },
      },
      {
        id: "city-dots",
        type: "circle",
        source: "cities",
        minzoom: 3,
        filter: ["<=", ["get", "minZoom"], ["zoom"]],
        paint: {
          "circle-radius": 2.5,
          "circle-color": ink,
          "circle-stroke-color": land,
          "circle-stroke-width": 1,
        },
      },
      {
        id: "city-labels",
        type: "symbol",
        source: "cities",
        minzoom: 3,
        filter: ["<=", ["get", "minZoom"], ["zoom"]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Plex"],
          "text-size": 12,
          "text-anchor": "top",
          "text-offset": [0, 0.6],
          "text-padding": 8,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: {
          "text-color": ink,
          "text-halo-color": land,
          "text-halo-width": 1.5,
        },
      },
    ],
  };
}
