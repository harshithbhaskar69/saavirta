import { z } from "zod";

const utc = z.iso.datetime();
const nullableTime = utc.nullable();
const context = z.object({
  geographicStatus: z.enum(["inside", "outside", "uncertain"]),
  region: z.enum(["mainland_finland", "aland"]).nullable(),
  localBiddingZone: z.enum(["FI", "SE3"]).nullable(),
  workspaceMarket: z.literal("FI"),
  relationship: z.enum(["local_market", "national_comparison", "unavailable"]),
  boundaryVersion: z.string(),
  demonstration: z.boolean(),
});
export const contextSchema = z.object({
  schemaVersion: z.literal("1"),
  requestId: z.string(),
  marketContext: context,
});
export const pointInputSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();
export const dashboardInputSchema = pointInputSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(3).default(1),
  resolution: z.enum(["PT15M", "PT60M"]).default("PT15M"),
});
const inputRef = z.object({
  seriesId: z.string(),
  snapshotId: z.string(),
  collectedAt: utc,
});
export const intervalSchema = z
  .object({
    start: utc,
    end: utc,
    value: z.number().nullable(),
    coverage: z.number().min(0).max(1),
    provisional: z.boolean(),
    missingReason: z.string().nullable(),
    inputs: z.array(inputRef),
  })
  .refine(
    (p) => Date.parse(p.end) > Date.parse(p.start),
    "Interval end must follow start",
  );
const quality = z.object({
  freshness: z.enum(["fresh", "stale", "unknown"]),
  availability: z.enum(["complete", "partial", "unavailable"]),
  coverage: z.number().min(0).max(1),
  issues: z.array(z.string()),
  freshUntil: nullableTime,
  usableUntil: nullableTime,
});
const provenance = z.object({
  publishedAt: nullableTime,
  retrievedAt: nullableTime,
  lastSuccessfulCheck: nullableTime,
  snapshotId: z.string().nullable(),
  revision: z.string().nullable(),
});
export const seriesSchema = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.enum(["MW", "EUR/MWh"]),
  scope: z.string(),
  classification: z.enum(["actual", "forecast", "published-price"]),
  provider: z.string(),
  dataset: z.string(),
  intervals: z.array(intervalSchema),
  provenance,
  quality,
});
export const dashboardSchema = z.object({
  schemaVersion: z.literal("1"),
  requestId: z.string(),
  generatedAt: utc,
  displayTimezone: z.literal("Europe/Helsinki"),
  requestedInterval: z.object({ start: utc, end: utc }),
  resolution: z.enum(["PT15M", "PT60M"]),
  marketContext: context,
  series: z.array(seriesSchema),
  metrics: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      unit: z.enum(["MW", "%"]),
      formulaVersion: z.string(),
      limitations: z.string(),
      intervals: z.array(intervalSchema),
      quality,
    }),
  ),
  priceSummaries: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      average: z.number().nullable(),
      minimum: intervalSchema.nullable(),
      maximum: intervalSchema.nullable(),
      negativeMinutes: z.number(),
      coverage: z.number().min(0).max(1),
    }),
  ),
  priceExportAllowed: z.boolean(),
});
export const problemSchema = z.object({
  type: z.literal("about:blank"),
  title: z.string(),
  status: z.number(),
  code: z.string(),
  requestId: z.string(),
});
export type MarketContext = z.infer<typeof context>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type MarketSeries = z.infer<typeof seriesSchema>;
export type Interval = z.infer<typeof intervalSchema>;
export type MarketSettings = {
  date: string;
  days: number;
  resolution: "PT15M" | "PT60M";
};
