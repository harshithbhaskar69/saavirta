import { z } from "zod";
import { intervalSchema } from "@/features/markets/contracts";
import type {
  Dashboard,
  Interval,
  MarketSeries,
} from "@/features/markets/contracts";

export type Window = Dashboard["requestedInterval"];
export type Metric = Dashboard["metrics"][number];
export type Quality = MarketSeries["quality"];
export type Provenance = MarketSeries["provenance"];
export type InputRef = Interval["inputs"][number];
export function priceEnabled(
  env: Pick<
    Cloudflare.Env,
    "ENTSOE_CONTRACT_VERIFIED" | "PRICE_REDISPLAY_ALLOWED"
  >,
): boolean {
  return (
    env.ENTSOE_CONTRACT_VERIFIED === "true" &&
    env.PRICE_REDISPLAY_ALLOWED === "true"
  );
}
export const batchSchema = z.object({
  dataset: z.string(),
  snapshotId: z.string().min(1),
  collectedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  revision: z.string().nullable(),
  intervals: z.array(intervalSchema).max(100_000),
});
export type Batch = z.infer<typeof batchSchema>;
export interface Definition {
  dataset: string;
  id: string;
  label: string;
  unit: MarketSeries["unit"];
  classification: MarketSeries["classification"];
}
export const definitions: readonly Definition[] = [
  {
    dataset: "193",
    id: "consumption-now",
    label: "Consumption now",
    unit: "MW",
    classification: "actual",
  },
  {
    dataset: "192",
    id: "production-now",
    label: "Production now",
    unit: "MW",
    classification: "actual",
  },
  {
    dataset: "124",
    id: "consumption-actual",
    label: "Consumption actual",
    unit: "MW",
    classification: "actual",
  },
  {
    dataset: "166",
    id: "consumption-forecast",
    label: "Consumption forecast",
    unit: "MW",
    classification: "forecast",
  },
  {
    dataset: "74",
    id: "production-actual",
    label: "Production actual",
    unit: "MW",
    classification: "actual",
  },
  {
    dataset: "241",
    id: "production-forecast",
    label: "Production planned",
    unit: "MW",
    classification: "forecast",
  },
  {
    dataset: "245",
    id: "wind-forecast",
    label: "Wind forecast",
    unit: "MW",
    classification: "forecast",
  },
  {
    dataset: "248",
    id: "solar-forecast",
    label: "Solar forecast",
    unit: "MW",
    classification: "forecast",
  },
  {
    dataset: "price",
    id: "day-ahead-price",
    label: "Day-ahead price",
    unit: "EUR/MWh",
    classification: "published-price",
  },
];
export function definitionFor(dataset: string): Definition {
  const definition = definitions.find((item) => item.dataset === dataset);
  if (!definition) throw new Error("unknown-dataset");
  return definition;
}
export function emptyProvenance(): Provenance {
  return {
    publishedAt: null,
    retrievedAt: null,
    lastSuccessfulCheck: null,
    snapshotId: null,
    revision: null,
  };
}
export function missingInterval(
  start: string,
  end: string,
  reason = "missing",
): Interval {
  return {
    start,
    end,
    value: null,
    coverage: 0,
    provisional: false,
    missingReason: reason,
    inputs: [],
  };
}
