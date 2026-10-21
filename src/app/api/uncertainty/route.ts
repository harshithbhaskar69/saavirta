import { api, readSmallJson } from "@/lib/api";
import {
  parseWeatherInput,
  parseWeatherQuery,
} from "@/features/weather/validation";
import { uncertaintyStart } from "@/features/weather/uncertainty";
import { uncertaintyService } from "@/features/weather/server";

export async function GET(request: Request) {
  return api(request, async () => {
    const params = new URL(request.url).searchParams;
    const point = parseWeatherQuery(params);
    const start = uncertaintyStart(
      params.getAll("start").length === 1 ? Number(params.get("start")) : null,
      Date.now(),
    );
    return uncertaintyService(point, start, point.horizon);
  });
}

export async function POST(request: Request) {
  return api(request, async () => {
    const body = await readSmallJson(request);
    const point = parseWeatherInput(body);
    const start = uncertaintyStart(
      typeof body === "object" && body !== null
        ? Reflect.get(body, "start")
        : null,
      Date.now(),
    );
    return uncertaintyService(point, start, point.horizon, true);
  });
}
