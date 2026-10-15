import { api, readSmallJson } from "@/lib/api";
import {
  parsePointInput,
  parsePointQuery,
} from "@/features/weather/validation";
import { baselineService } from "@/features/weather/server";

// Climate normals and run-to-run revision for a point. Each part fails independently.
export async function GET(request: Request) {
  return api(request, async () =>
    baselineService(parsePointQuery(new URL(request.url).searchParams)),
  );
}
export async function POST(request: Request) {
  return api(request, async () =>
    baselineService(parsePointInput(await readSmallJson(request)), true),
  );
}
