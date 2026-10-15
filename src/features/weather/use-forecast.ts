"use client";
import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiErrorBody, Forecast, Horizon, Place } from "./types";

export function useForecast(place: Place | null, horizon: Horizon) {
  const client = useQueryClient();
  // Polls read the shared cache; only an explicit refresh asks the server to bypass it.
  const force = useRef(false);
  const key = [
    "weather-v2",
    place?.latitude,
    place?.longitude,
    !!place?.private,
    horizon,
  ];
  const query = useQuery({
    queryKey: key,
    enabled: !!place,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async ({ signal }) => {
      const refresh = force.current;
      force.current = false;
      const query = new URLSearchParams({
        lat: String(place!.latitude),
        lon: String(place!.longitude),
        horizon,
      });
      if (refresh) query.set("refresh", "1");
      const response = await fetch(
        place!.private ? "/api/weather" : `/api/weather?${query}`,
        place!.private
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: place!.latitude,
                longitude: place!.longitude,
                horizon,
                refresh,
              }),
              signal,
            }
          : { signal },
      );
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(
          body.error?.message ?? "The forecast is unavailable. Please retry.",
        );
      }
      const incoming = (await response.json()) as Forecast,
        previous = client.getQueryData<Forecast>(key);
      // KV propagation may return an older snapshot; never replace newer same-point data.
      return previous &&
        previous.source.retrievedAt > incoming.source.retrievedAt
        ? previous
        : incoming;
    },
    // A new horizon for the same point keeps the previous window on screen while
    // it loads (isPlaceholderData), so controls keep focus; a new point starts empty.
    placeholderData: (previous, previousQuery) =>
      previousQuery &&
      key.slice(0, 4).every((part, i) => part === previousQuery.queryKey[i])
        ? previous
        : undefined,
  });
  const { refetch } = query;
  const refresh = useCallback(() => {
    force.current = true;
    return refetch();
  }, [refetch]);
  return { query, refresh };
}
