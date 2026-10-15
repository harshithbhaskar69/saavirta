"use client";
import { useQuery } from "@tanstack/react-query";
import type { Place } from "@/features/weather/types";
import {
  contextSchema,
  dashboardSchema,
  problemSchema,
  type MarketSettings,
} from "./contracts";

async function request(path: string, body: unknown, signal: AbortSignal) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const problem = problemSchema.safeParse(value);
    throw new Error(
      problem.success
        ? problem.data.title
        : "Energy Markets is temporarily unavailable.",
    );
  }
  return value;
}
export function useMarketContext(place: Place | null) {
  return useQuery({
    queryKey: [
      "market-context",
      place?.latitude,
      place?.longitude,
      !!place?.private,
    ],
    enabled: !!place,
    staleTime: 300_000,
    retry: false,
    queryFn: async ({ signal }) =>
      contextSchema.parse(
        await request(
          "/api/v1/market-context",
          { latitude: place!.latitude, longitude: place!.longitude },
          signal,
        ),
      ).marketContext,
  });
}
export function useMarkets(place: Place, settings: MarketSettings) {
  return useQuery({
    queryKey: [
      "markets-v1",
      place.latitude,
      place.longitude,
      !!place.private,
      settings,
    ],
    refetchInterval: 60_000,
    retry: false,
    queryFn: async ({ signal }) =>
      dashboardSchema.parse(
        await request(
          "/api/v1/markets/fi/dashboard",
          { latitude: place.latitude, longitude: place.longitude, ...settings },
          signal,
        ),
      ),
  });
}
