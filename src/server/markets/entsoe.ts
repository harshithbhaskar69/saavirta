import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import type { Batch, Window } from "./model";
import { missingInterval } from "./model";
import { day, hour, iso, minute, sortValidate } from "./time";
import type { ProviderTransport } from "./provider";

export const finlandZone = "10YFI-1--------U";
const point = z.object({
  position: z.coerce.number().int().positive(),
  "price.amount": z.string().min(1).pipe(z.coerce.number()),
});
const series = z.object({
  "currency_Unit.name": z.literal("EUR"),
  "price_Measure_Unit.name": z.literal("MWH"),
  "in_Domain.mRID": z.literal(finlandZone),
  "out_Domain.mRID": z.literal(finlandZone),
  "contract_MarketAgreement.type": z.literal("A01").optional(),
  curveType: z.enum(["A01", "A03"]),
  Period: z
    .array(
      z.object({
        timeInterval: z.object({ start: z.string(), end: z.string() }),
        resolution: z.enum(["PT15M", "PT60M"]),
        Point: z.array(point).max(1000).default([]),
      }),
    )
    .max(100),
});
const publication = z.object({
  mRID: z.string(),
  revisionNumber: z.string(),
  type: z.literal("A44"),
  TimeSeries: z.array(series).min(1).max(100),
});
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  processEntities: false,
  isArray: (name) => ["TimeSeries", "Period", "Point", "Reason"].includes(name),
});
function timestamp(value: string): number {
  const time = Date.parse(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/.test(value) ||
    !Number.isFinite(time) ||
    iso(time).slice(0, 16) !== value.slice(0, 16)
  )
    throw new Error("entsoe-time-invalid");
  return time;
}
export function decodeEntsoe(raw: string): {
  intervals: Batch["intervals"];
  revision: string | null;
  count: number;
} {
  if (
    /<!\s*(?:DOCTYPE|ENTITY)/i.test(raw) ||
    XMLValidator.validate(raw) !== true
  )
    throw new Error("entsoe-xml-invalid");
  const root = z.record(z.string(), z.unknown()).parse(parser.parse(raw));
  if (root.Acknowledgement_MarketDocument) {
    const ack = z
      .object({
        Reason: z
          .array(z.object({ code: z.literal("999"), text: z.string() }))
          .length(1),
      })
      .parse(root.Acknowledgement_MarketDocument);
    if (!ack.Reason[0]?.text.toLowerCase().includes("no matching data found"))
      throw new Error("entsoe-acknowledgement");
    return { intervals: [], revision: null, count: 0 };
  }
  const doc = publication.parse(root.Publication_MarketDocument);
  const intervals: Batch["intervals"] = [];
  for (const s of doc.TimeSeries)
    for (const period of s.Period) {
      const step = period.resolution === "PT15M" ? 15 * minute : hour;
      const start = timestamp(period.timeInterval.start),
        end = timestamp(period.timeInterval.end);
      if (end <= start || end - start > 7 * day || (end - start) % step)
        throw new Error("entsoe-period-invalid");
      const count = (end - start) / step;
      for (let index = 0; index < period.Point.length; index++) {
        const p = period.Point[index],
          previous = period.Point[index - 1];
        if (
          !p ||
          p.position > count ||
          (previous && previous.position >= p.position)
        )
          throw new Error("entsoe-position-invalid");
        const stop =
          s.curveType === "A03"
            ? (period.Point[index + 1]?.position ?? count + 1)
            : p.position + 1;
        for (let position = p.position; position < stop; position++) {
          const time = start + (position - 1) * step;
          intervals.push({
            ...missingInterval(iso(time), iso(time + step)),
            value: p["price.amount"],
            coverage: 1,
            missingReason: null,
          });
          if (intervals.length > 100000)
            throw new Error("entsoe-response-limit");
        }
      }
    }
  const unique = [
    ...new Map(
      intervals.map((p) => [`${p.start}/${p.end}/${p.value}`, p]),
    ).values(),
  ];
  return {
    intervals: sortValidate(unique),
    revision: `${doc.mRID}/${doc.revisionNumber}`,
    count: doc.TimeSeries.length,
  };
}
export async function fetchEntsoe(
  network: ProviderTransport,
  token: string,
  window: Window,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<Batch> {
  if (!token) throw new Error("provider-not-configured");
  const batch: Batch = {
    dataset: "price",
    snapshotId: crypto.randomUUID(),
    collectedAt: iso(now()),
    publishedAt: null,
    revision: null,
    intervals: [],
  };
  const format = (value: string): string =>
    iso(Date.parse(value)).replace(/[-:T]/g, "").slice(0, 12);
  for (let offset = 0; offset < 1000; offset += 100) {
    const url = new URL("https://web-api.tp.entsoe.eu/api");
    url.search = new URLSearchParams({
      securityToken: token,
      documentType: "A44",
      in_Domain: finlandZone,
      out_Domain: finlandZone,
      "contract_MarketAgreement.type": "A01",
      periodStart: format(window.start),
      periodEnd: format(window.end),
      offset: String(offset),
    }).toString();
    const decoded = decodeEntsoe(
      await network.get(url, { Accept: "application/xml" }, signal),
    );
    batch.intervals.push(...decoded.intervals);
    if (decoded.revision) batch.revision = decoded.revision;
    if (decoded.count < 100) {
      sortValidate(batch.intervals);
      batch.collectedAt = iso(now());
      return batch;
    }
  }
  throw new Error("entsoe-pagination-limit");
}
