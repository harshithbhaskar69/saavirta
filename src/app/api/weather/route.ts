import { env } from "cloudflare:workers";
import { api, readSmallJson } from "@/lib/api";
import {
  parseWeatherInput,
  parseWeatherQuery,
} from "@/features/weather/validation";
import { weatherService } from "@/features/weather/server";

export async function GET(request: Request) {
  return api(request, async () => {
    const params = new URL(request.url).searchParams;
    const input = parseWeatherQuery(params);
    return weatherService(
      input,
      input.horizon,
      env.WEATHER_PROVIDER_MODE,
      false,
      params.get("refresh") === "1",
    );
  });
}
export async function POST(request: Request) {
  return api(request, async () => {
    const raw = await readSmallJson(request);
    const input = parseWeatherInput(raw);
    return weatherService(
      input,
      input.horizon,
      env.WEATHER_PROVIDER_MODE,
      true,
      (raw as { refresh?: unknown }).refresh === true,
    );
  });
}
