"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  CrosshairIcon,
  ArrowsOutSimpleIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Place } from "@/features/weather/types";
import { coordinates } from "@/lib/time";
import {
  cityPlace,
  distanceKm,
  pointPlace,
  type Cities,
  type City,
} from "@/features/location/map-selection";
import { mapStyle } from "@/features/location/map-style";
import { CountryFlag } from "./flag";

export default function GeoMap({
  place,
  theme,
  expanded = false,
  mapKey,
  onSelect,
  onExpand,
}: {
  place: Place | null;
  theme: "light" | "dark";
  expanded?: boolean;
  mapKey: string;
  onSelect: (place: Place) => void;
  onExpand?: (opener: HTMLButtonElement) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<MapLibreMap | null>(null),
    marker = useRef<Marker | null>(null),
    cities = useRef<Cities>({ type: "FeatureCollection", features: [] }),
    latestTheme = useRef(theme),
    mapTheme = useRef(theme);
  const select = useRef(onSelect),
    latestPlace = useRef(place),
    reduce = useReducedMotion(),
    [visible, setVisible] = useState(false),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [nearby, setNearby] = useState<City[]>([]);
  select.current = onSelect;
  latestPlace.current = place;
  latestTheme.current = theme;
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px" },
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    setReady(false);
    setFailed(false);
    const controller = new AbortController();
    Promise.all([
      import("maplibre-gl"),
      fetch("/maps/cities.geojson", { signal: controller.signal }).then(
        async (response) => {
          if (!response.ok) throw new Error("City map unavailable");
          return (await response.json()) as Cities;
        },
      ),
    ])
      .then(([lib, cityData]) => {
        if (disposed || !container.current) return;
        lib.setWorkerUrl(workerUrl);
        cities.current = cityData;
        mapTheme.current = latestTheme.current;
        const dark = latestTheme.current === "dark";
        const point = latestPlace.current;
        const instance = new lib.Map({
          container: container.current,
          style: mapKey
            ? `https://api.maptiler.com/maps/${dark ? "dataviz-dark" : "dataviz-light"}/style.json?key=${encodeURIComponent(mapKey)}`
            : mapStyle(latestTheme.current, cityData),
          center: point
            ? [point.longitude, Math.max(-85, Math.min(85, point.latitude))]
            : [12, 20],
          zoom: point ? 6 : 0.8,
          maxZoom: mapKey ? 18 : 8,
          cooperativeGestures: true,
          attributionControl: { compact: true },
        });
        map.current = instance;
        instance.addControl(
          new lib.NavigationControl({ showCompass: false }),
          "top-right",
        );
        instance.addControl(
          new lib.ScaleControl({ maxWidth: 90, unit: "metric" }),
          "bottom-left",
        );
        instance
          .getCanvas()
          .setAttribute(
            "aria-label",
            "Interactive map. Arrow keys pan. Use map center selects the point.",
          );
        const updateNearby = () => {
          if (disposed) return;
          const center = instance.getCenter();
          const point = { latitude: center.lat, longitude: center.lng };
          const bounds = instance.getBounds();
          setNearby(
            cityData.features
              .filter((city) =>
                bounds.contains(city.geometry.coordinates as [number, number]),
              )
              .sort((a, b) => distanceKm(point, a) - distanceKm(point, b))
              .slice(0, 6),
          );
        };
        instance.on("moveend", updateNearby);
        instance.on("load", () => {
          if (!disposed) {
            setReady(true);
            instance.resize();
            updateNearby();
          }
        });
        instance.on("error", () => {
          if (!disposed) setFailed(true);
        });
        instance.on("click", (event) => {
          const longitude =
            ((((event.lngLat.lng + 180) % 360) + 360) % 360) - 180;
          const layers = ["city-labels", "city-dots"].filter((layer) =>
            instance.getLayer(layer),
          );
          const city = layers.length
            ? instance.queryRenderedFeatures(event.point, { layers })[0]
            : undefined;
          const selectedCity =
            city?.id == null
              ? undefined
              : cityData.features.find((feature) => feature.id === city.id);
          select.current(
            selectedCity
              ? cityPlace(selectedCity)
              : pointPlace({ latitude: event.lngLat.lat, longitude }, cityData),
          );
        });
        instance.on("mousemove", (event) => {
          const layers = ["city-labels", "city-dots"].filter((layer) =>
            instance.getLayer(layer),
          );
          instance.getCanvas().style.cursor =
            layers.length &&
            instance.queryRenderedFeatures(event.point, { layers }).length
              ? "pointer"
              : "";
        });
        const element = document.createElement("div");
        element.className = "map-pin";
        element.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = "map-pin-label";
        label.textContent = point?.name ?? "";
        element.appendChild(label);
        marker.current = new lib.Marker({ element });
        if (point)
          marker.current
            .setLngLat([
              point.longitude,
              Math.max(-85, Math.min(85, point.latitude)),
            ])
            .addTo(instance);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      controller.abort();
      marker.current?.remove();
      map.current?.remove();
      marker.current = null;
      map.current = null;
    };
  }, [mapKey, visible]);
  useEffect(() => {
    if (!map.current || !ready || mapTheme.current === theme) return;
    mapTheme.current = theme;
    map.current.setStyle(
      mapKey
        ? `https://api.maptiler.com/maps/${theme === "dark" ? "dataviz-dark" : "dataviz-light"}/style.json?key=${encodeURIComponent(mapKey)}`
        : mapStyle(theme, cities.current),
    );
  }, [theme, mapKey, ready]);
  useEffect(() => {
    if (!map.current || !ready || !place) return;
    const point: [number, number] = [
      place.longitude,
      Math.max(-85, Math.min(85, place.latitude)),
    ];
    marker.current?.setLngLat(point).addTo(map.current);
    const label = marker.current?.getElement().querySelector(".map-pin-label");
    if (label) label.textContent = place.name;
    map.current.easeTo({
      center: point,
      zoom: Math.max(5.8, map.current.getZoom()),
      duration: reduce ? 0 : 320,
    });
  }, [place, ready, reduce]);
  return (
    <section
      className={`geo-map ${expanded ? "expanded" : ""}`}
      aria-label="Monitoring point map"
    >
      {!expanded && (
        <div className="section-heading">
          <h2>Monitoring point</h2>
          {place?.region && <span>{place.region}</span>}
        </div>
      )}
      <div className="map-frame">
        <div className="map-surface" ref={container} data-ready={ready} />
        {onExpand && (
          <button
            className="map-expand icon-button"
            aria-label="Expand map"
            title="Expand map"
            onClick={(event) => onExpand(event.currentTarget)}
          >
            <ArrowsOutSimpleIcon aria-hidden="true" />
          </button>
        )}
        {!ready && !failed && (
          <div className="map-loading">
            <MapPinIcon aria-hidden="true" />
            <span>Loading map…</span>
          </div>
        )}
        {failed && (
          <p className="map-failure" role="status">
            Map unavailable. Search or enter coordinates to keep exploring.
          </p>
        )}
        <div className="map-controls">
          <span>
            {place
              ? coordinates(place.latitude, place.longitude)
              : "Choose a point anywhere"}
          </span>
          <button
            className="text-button"
            disabled={!ready || failed}
            onClick={() => {
              const center = map.current?.getCenter();
              if (center)
                select.current(
                  pointPlace(
                    {
                      latitude: center.lat,
                      longitude:
                        ((((center.lng + 180) % 360) + 360) % 360) - 180,
                    },
                    cities.current,
                  ),
                );
            }}
          >
            <CrosshairIcon aria-hidden="true" />
            Use map center
          </button>
          {place && expanded && (
            <button
              className="text-button"
              disabled={!ready || failed}
              onClick={() =>
                map.current?.easeTo({
                  center: [
                    place.longitude,
                    Math.max(-85, Math.min(85, place.latitude)),
                  ],
                  zoom: 6,
                  duration: reduce ? 0 : 320,
                })
              }
            >
              <MapPinIcon aria-hidden="true" />
              Recenter
            </button>
          )}
        </div>
      </div>
      <p className="map-caption">
        <span>
          {mapKey ? "MapTiler basemap" : "Regional map · Natural Earth"}
        </span>
        <span>
          {mapKey
            ? "Click to select a point."
            : "Cities and regions. No street detail."}
        </span>
      </p>
      {expanded && nearby.length > 0 && (
        <div className="map-places" aria-label="Places in this map view">
          <span>Places in view</span>
          <div>
            {nearby.map((city) => (
              <button
                className="map-place"
                key={city.geometry.coordinates.join(":")}
                onClick={() => select.current(cityPlace(city))}
              >
                <CountryFlag
                  code={city.properties.countryCode}
                  country={city.properties.country}
                />
                {city.properties.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {place && Math.abs(place.latitude) > 85 && (
        <p className="helper">
          The forecast uses your exact latitude. The map stops at the
          projection’s polar limit.
        </p>
      )}
    </section>
  );
}
