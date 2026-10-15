import { env } from "cloudflare:workers";
import { AppError } from "./errors";

const hosts = new Set(
  ["api", "geocoding-api", "archive-api", "single-runs-api"].flatMap((name) => [
    `${name}.open-meteo.com`,
    `customer-${name}.open-meteo.com`,
  ]),
);

// Charge every attempt, including retries; cache hits never reach this transport.
export const protectedFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (
    url.protocol !== "https:" ||
    !hosts.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw new AppError(
      "CONFIGURATION",
      "The weather provider is not configured.",
      503,
    );
  const params = url.searchParams;
  const variables = ["hourly", "daily", "current"].reduce(
    (count, key) => count + (params.get(key)?.split(",").length ?? 0),
    0,
  );
  const span =
    params.has("start_date") && params.has("end_date")
      ? (Date.parse(params.get("end_date")!) -
          Date.parse(params.get("start_date")!)) /
          86400000 +
        1
      : Number(params.get("forecast_hours") ?? 24) / 24;
  const cost =
    Math.max(1, Math.ceil(variables / 10)) * Math.max(1, Math.ceil(span / 14));
  let allowed = false;
  try {
    allowed =
      (await env.PROVIDER_BUDGET?.getByName("open-meteo").reserve(
        "weather",
        cost,
      )) ?? false;
  } catch {
    /* Fail closed if quota storage is unavailable. */
  }
  if (!allowed)
    throw new AppError(
      "PROVIDER_BUDGET",
      "Weather updates are temporarily limited. Cached forecasts remain available; try again later.",
      503,
      false,
      60000,
    );
  const response = await fetch(input, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new AppError("UPSTREAM", "The weather provider is unavailable.", 502);
  }
  return response;
};
