import { createWeatherService } from "../../src/features/weather/service";
import { createBaselineService } from "../../src/features/weather/baselines";
import { createUncertaintyService } from "../../src/features/weather/uncertainty-service";
import { ensembleProvider, ensembleSnapshot } from "../fixtures/ensemble";
import { point, snapshot } from "../fixtures/weather";

const cache = { get: async () => null, put: async () => {} };
const pause = () => new Promise((resolve) => setTimeout(resolve, 20));
const weather = createWeatherService(cache, async () => {
  await pause();
  return snapshot();
});
const ensembleStart = Math.floor(Date.now() / 3_600_000) * 3_600_000;
const uncertainty = createUncertaintyService(
  cache,
  "public",
  undefined,
  Date.now,
  async () => {
    await pause();
    return Response.json(ensembleProvider(ensembleSnapshot(ensembleStart)));
  },
);
const baselines = createBaselineService(
  cache,
  "public",
  undefined,
  Date.now,
  async (input) => {
    await pause();
    if (String(input).endsWith("meta.json")) {
      const run = Math.floor(Date.now() / 21_600_000) * 21_600;
      return Response.json({
        last_run_initialisation_time: run - 21_600,
        last_run_availability_time: run - 3600,
      });
    }
    const data = snapshot();
    return Response.json({
      timezone: data.location.timezone,
      hourly_units: {
        time: "unixtime",
        temperature_2m: "°C",
        shortwave_radiation: "W/m²",
      },
      hourly: {
        time: data.hourly.map((hour) => hour.time / 1000),
        temperature_2m: data.hourly.map((hour) => hour.temperatureC),
        shortwave_radiation: data.hourly.map((hour) => hour.solarIrradianceWm2),
      },
    });
  },
);

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const result =
      url.pathname === "/forecast"
        ? weather(point, "48h", "public")
        : url.pathname === "/uncertainty"
          ? uncertainty(point, ensembleStart, "48h")
          : baselines(point);
    // End the owner context with pending work, as a disconnected client can do.
    if (url.searchParams.has("abandon")) return new Response("Owner ended");
    return Response.json(await result);
  },
};
