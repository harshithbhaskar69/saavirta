import { z } from "zod";
import type { MarketContext } from "@/features/markets/contracts";
import data from "./data/boundaries.json";
import manifest from "./data/manifest.json";

const coordinate = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const ring = z
  .array(coordinate)
  .min(4)
  .refine((points) => {
    const first = points[0],
      last = points.at(-1);
    return first && last && first[0] === last[0] && first[1] === last[1];
  }, "Boundary ring must close");
const polygon = z.array(ring).min(1);
const featureCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        properties: z.object({ region: z.enum(["finland", "aland"]) }),
        geometry: z.discriminatedUnion("type", [
          z.object({ type: z.literal("Polygon"), coordinates: polygon }),
          z.object({
            type: z.literal("MultiPolygon"),
            coordinates: z.array(polygon).min(1),
          }),
        ]),
      }),
    )
    .min(2),
});
type Point = z.infer<typeof coordinate>;
type Polygon = z.infer<typeof polygon>;
export interface Boundary {
  finland: Polygon[];
  aland: Polygon[];
  version: string;
}
export function decodeBoundary(raw: unknown, version: string): Boundary {
  const features = featureCollection.parse(raw).features;
  const result: Boundary = { finland: [], aland: [], version };
  for (const feature of features)
    result[feature.properties.region].push(
      ...(feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates),
    );
  if (!result.finland.length || !result.aland.length)
    throw new Error("incomplete-boundary");
  return result;
}
const boundary = (() => {
  try {
    return manifest.verified ? decodeBoundary(data, manifest.version) : null;
  } catch {
    return null;
  }
})();
function ringContains(points: Point[], p: Point): boolean {
  let inside = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (
      a &&
      b &&
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function contains(polygons: Polygon[], p: Point): boolean {
  return polygons.some(
    (rings) =>
      !!rings[0] &&
      ringContains(rings[0], p) &&
      !rings.slice(1).some((hole) => ringContains(hole, p)),
  );
}
function nearBoundary(polygons: Polygon[], p: Point): boolean {
  const metres = 111319.49079327358,
    xScale = metres * Math.cos((p[1] * Math.PI) / 180);
  for (const rings of polygons)
    for (const points of rings)
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i];
        if (
          !a ||
          !b ||
          p[1] < Math.min(a[1], b[1]) - 0.001 ||
          p[1] > Math.max(a[1], b[1]) + 0.001 ||
          p[0] < Math.min(a[0], b[0]) - 0.01 ||
          p[0] > Math.max(a[0], b[0]) + 0.01
        )
          continue;
        const ax = (a[0] - p[0]) * xScale,
          ay = (a[1] - p[1]) * metres;
        const dx = (b[0] - a[0]) * xScale,
          dy = (b[1] - a[1]) * metres;
        const squared = dx * dx + dy * dy;
        const t = squared
          ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / squared))
          : 0;
        if (Math.hypot(ax + t * dx, ay + t * dy) <= 25) return true;
      }
  return false;
}
export function marketContext(
  latitude: number,
  longitude: number,
  source: Boundary | null = boundary,
): MarketContext {
  const result: MarketContext = {
    geographicStatus: "uncertain",
    region: null,
    localBiddingZone: null,
    workspaceMarket: "FI",
    relationship: "unavailable",
    boundaryVersion: source?.version ?? "unavailable",
    demonstration: false,
  };
  if (
    !source ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return result;
  const point: Point = [longitude, latitude];
  if (nearBoundary(source.finland, point) || nearBoundary(source.aland, point))
    return result;
  result.geographicStatus = "outside";
  if (contains(source.finland, point)) {
    const aland = contains(source.aland, point);
    result.geographicStatus = "inside";
    result.region = aland ? "aland" : "mainland_finland";
    result.localBiddingZone = aland ? "SE3" : "FI";
    result.relationship = aland ? "national_comparison" : "local_market";
  }
  return result;
}
