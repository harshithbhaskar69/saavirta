"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiErrorBody, Forecast, Place } from "./types";
import {
  ENSEMBLE_FRESH_MS,
  uncertaintySchema,
  type Uncertainty,
} from "./uncertainty";

export function useUncertainty(
  place: Place | null,
  forecast: Forecast | undefined,
  enabled: boolean,
) {
  const client = useQueryClient();
  const start = forecast?.hourly[0]?.time;
  const horizon = forecast?.horizon;
  const key = [
    "uncertainty-v1",
    place?.latitude,
    place?.longitude,
    !!place?.private,
    start,
    horizon,
  ];
  return useQuery({
    queryKey: key,
    enabled: enabled && !!place && !!start && !!horizon,
    staleTime: ENSEMBLE_FRESH_MS,
    refetchInterval: enabled ? ENSEMBLE_FRESH_MS : false,
    refetchIntervalInBackground: false,
    retry: false,
    queryFn: async ({ signal }) => {
      const point = {
        latitude: place!.latitude,
        longitude: place!.longitude,
        start: start!,
        horizon: horizon!,
      };
      const response = await fetch(
        place!.private
          ? "/api/uncertainty"
          : `/api/uncertainty?${new URLSearchParams({
              lat: String(point.latitude),
              lon: String(point.longitude),
              start: String(start),
              horizon: horizon!,
            })}`,
        place!.private
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(point),
              signal,
            }
          : { signal },
      );
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(
          body.error?.message ?? "Forecast ranges are unavailable.",
        );
      }
      const incoming = uncertaintySchema.parse(await response.json());
      if (
        incoming.start !== start ||
        incoming.horizon !== horizon ||
        incoming.timezone !== forecast!.location.timezone
      )
        throw new Error(
          "The forecast range does not match this point forecast.",
        );
      const previous = client.getQueryData<Uncertainty>(key);
      return previous &&
        previous.source.retrievedAt > incoming.source.retrievedAt
        ? previous
        : incoming;
    },
  });
}
