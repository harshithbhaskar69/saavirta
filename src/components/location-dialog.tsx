"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CrosshairIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  XIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import type { Place, ApiErrorBody } from "@/features/weather/types";
import { canonicalPoint, pointSchema } from "@/features/weather/validation";
import { pointPlace, type Cities } from "@/features/location/map-selection";
import { coordinates } from "@/lib/time";
import { CountryFlag } from "./flag";
const GeoMap = lazy(() => import("./geo-map"));

export function LocationDialog({
  open,
  mode,
  place,
  theme,
  mapKey,
  onClose,
  onRestoreFocus,
  onSelect,
}: {
  open: boolean;
  mode: "search" | "device" | "map";
  place: Place | null;
  theme: "light" | "dark";
  mapKey: string;
  onClose: () => void;
  onRestoreFocus: () => void;
  onSelect: (place: Place) => void;
}) {
  const [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState(""),
    [tab, setTab] = useState(mode),
    [error, setError] = useState(""),
    [locating, setLocating] = useState(false);
  const active = useRef(false),
    field = useRef<HTMLInputElement>(null),
    content = useRef<HTMLDivElement>(null),
    requestGeneration = useRef(0);
  const focusContent = useCallback(() => {
    const target =
      tab === "search" && !window.matchMedia("(pointer: coarse)").matches
        ? field.current
        : content.current;
    target?.focus({ preventScroll: true });
  }, [tab]);
  useEffect(() => {
    if (open) focusContent();
    requestGeneration.current++;
    setLocating(false);
    setError("");
  }, [open, focusContent]);
  useEffect(() => {
    active.current = open;
    setTab(mode);
    setError("");
    setLocating(false);
    requestGeneration.current++;
  }, [open, mode]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const search = useQuery({
    queryKey: ["places", debounced],
    enabled: open && tab === "search" && debounced.length >= 2,
    staleTime: 300_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(debounced)}`,
        { signal },
      );
      if (!response.ok) {
        const data = (await response.json()) as ApiErrorBody;
        throw new Error(data.error.message);
      }
      return ((await response.json()) as { places: Place[] }).places;
    },
  });
  const choose = (place: Place) => {
    onSelect(place);
    onClose();
  };
  const locate = () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setError(
        "Device location is unavailable. Search for a place or use the map.",
      );
      return;
    }
    setLocating(true);
    setError("");
    const generation = ++requestGeneration.current;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!active.current || generation !== requestGeneration.current) return;
        const point = canonicalPoint({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        let name = coordinates(point.latitude, point.longitude);
        try {
          // Label locally: city proximity is not an address or a boundary match.
          const response = await fetch("/maps/cities.geojson", {
            signal: AbortSignal.timeout(4000),
          });
          if (response.ok) {
            const nearby = pointPlace(point, (await response.json()) as Cities);
            if (nearby.name !== "Selected point") name = nearby.name;
          }
        } catch {
          // A missing city label must not prevent a forecast at the device point.
        }
        if (!active.current || generation !== requestGeneration.current) return;
        setLocating(false);
        choose({
          ...point,
          name,
          private: true,
        });
      },
      (result) => {
        if (!active.current || generation !== requestGeneration.current) return;
        setLocating(false);
        setError(
          result.code === 1
            ? "Location permission was not granted. Search anywhere or choose on the map."
            : "Your location could not be found. Try search or choose on the map.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          ref={content}
          tabIndex={-1}
          className={`dialog-content${tab === "map" ? " map-dialog" : ""}`}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusContent();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
        >
          <div className="dialog-heading">
            <Dialog.Title>
              {tab === "map"
                ? "Choose on map"
                : tab === "device"
                  ? "Choose how to locate"
                  : "Change location"}
            </Dialog.Title>
            <Dialog.Close
              className="icon-button"
              aria-label="Close location dialog"
            >
              <XIcon />
            </Dialog.Close>
          </div>
          <Dialog.Description className="dialog-description">
            {tab === "map"
              ? "Select a city or a point to open its forecast."
              : tab === "device"
                ? "Your physical location is a starting point, not an electricity market."
                : "Search worldwide, or enter the coordinates of a monitoring point."}
          </Dialog.Description>
          {tab === "map" ? (
            <Suspense
              fallback={
                <div className="map-placeholder skeleton" role="status">
                  Loading map…
                </div>
              }
            >
              <GeoMap
                place={place}
                theme={theme}
                mapKey={mapKey}
                expanded
                onSelect={choose}
              />
            </Suspense>
          ) : tab === "device" ? (
            <>
              <button
                className="location-choice"
                onClick={locate}
                disabled={locating}
              >
                <CrosshairIcon size={24} />
                <span>
                  <strong>
                    {locating
                      ? "Finding your location…"
                      : "Use precise location"}
                  </strong>
                  <small>
                    Your browser controls accuracy. Coordinates go to this app
                    and Open-Meteo to retrieve weather. They stay out of saved
                    links and preferences.
                  </small>
                </span>
              </button>
              <button
                className="location-choice"
                onClick={() => setTab("search")}
              >
                <MapPinIcon size={24} />
                <span>
                  <strong>Use approximate location</strong>
                  <small>
                    Choose a city or region yourself. No device permission
                    needed.
                  </small>
                </span>
              </button>
            </>
          ) : (
            <>
              <label htmlFor="place-search" className="field-label">
                City or region
              </label>
              <div className="search-field">
                <MagnifyingGlassIcon aria-hidden="true" />
                <input
                  ref={field}
                  id="place-search"
                  name="place-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Search Rotterdam, Sydney…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div
                className="search-results"
                aria-live="polite"
                aria-busy={search.isFetching}
              >
                {query.trim().length < 2 ? (
                  <p className="helper">
                    Enter at least 2 characters. Add a country to narrow the
                    results.
                  </p>
                ) : search.isFetching || query.trim() !== debounced ? (
                  <p className="helper">Searching places…</p>
                ) : search.error ? (
                  <p className="field-error">{search.error.message}</p>
                ) : search.data?.length === 0 ? (
                  <p className="helper">
                    No places found. Try another spelling or enter coordinates.
                  </p>
                ) : (
                  search.data?.map((place, i) => (
                    <button
                      key={`${place.latitude}:${place.longitude}:${i}`}
                      className="search-result"
                      onClick={() => choose(place)}
                    >
                      <CountryFlag
                        code={place.countryCode}
                        country={place.country}
                      />
                      <span>
                        <strong>{place.name}</strong>
                        <small>
                          {[place.region, place.country]
                            .filter(Boolean)
                            .join(", ")}
                        </small>
                      </span>
                      <ArrowUpRightIcon aria-hidden="true" />
                    </button>
                  ))
                )}
              </div>
              <details className="coordinate-entry">
                <summary>Enter coordinates</summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const latitude = form.get("latitude")?.toString().trim(),
                      longitude = form.get("longitude")?.toString().trim();
                    const point = pointSchema.safeParse({
                      latitude: latitude ? Number(latitude) : NaN,
                      longitude: longitude ? Number(longitude) : NaN,
                    });
                    if (!point.success) {
                      setError(
                        "Enter latitude between -90 and 90, and longitude between -180 and 180.",
                      );
                      const first = event.currentTarget.elements.namedItem(
                        !Number.isFinite(Number(latitude)) ||
                          !latitude ||
                          Math.abs(Number(latitude)) > 90
                          ? "latitude"
                          : "longitude",
                      );
                      if (first instanceof HTMLInputElement) first.focus();
                      return;
                    }
                    choose({
                      ...canonicalPoint(point.data),
                      name: "Selected point",
                    });
                  }}
                >
                  <div className="coordinate-fields">
                    <label>
                      Latitude
                      <input
                        name="latitude"
                        inputMode="decimal"
                        type="text"
                        autoComplete="off"
                        placeholder="51.9225…"
                      />
                    </label>
                    <label>
                      Longitude
                      <input
                        name="longitude"
                        inputMode="decimal"
                        type="text"
                        autoComplete="off"
                        placeholder="4.4792…"
                      />
                    </label>
                  </div>
                  <button className="button primary" type="submit">
                    Use coordinates
                  </button>
                </form>
              </details>
            </>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {tab !== "search" ? (
              <button className="text-button" onClick={() => setTab("search")}>
                Search anywhere
              </button>
            ) : (
              <button className="text-button" onClick={() => setTab("device")}>
                Use my location
              </button>
            )}
            {tab !== "map" && (
              <button className="text-button" onClick={() => setTab("map")}>
                Choose on map
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
