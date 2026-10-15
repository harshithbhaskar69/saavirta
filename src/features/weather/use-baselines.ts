"use client";
import { useQuery } from "@tanstack/react-query";
import type { ApiErrorBody, Baselines, Place } from "./types";

// Normals change daily and ECMWF runs every six hours: a slow, horizon-independent query.
export function useBaselines(place: Place | null) {
  return useQuery({
    queryKey: [
      "baselines-v1",
      place?.latitude,
      place?.longitude,
      !!place?.private,
    ],
    enabled: !!place,
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        place!.private
          ? "/api/baselines"
          : `/api/baselines?${new URLSearchParams({
              lat: String(place!.latitude),
              lon: String(place!.longitude),
            })}`,
        place!.private
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: place!.latitude,
                longitude: place!.longitude,
              }),
              signal,
            }
          : { signal },
      );
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(body.error?.message ?? "Comparisons are unavailable.");
      }
      return (await response.json()) as Baselines;
    },
  });
}
