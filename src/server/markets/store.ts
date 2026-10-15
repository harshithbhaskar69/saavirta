import { z } from "zod";
import { intervalSchema, seriesSchema } from "@/features/markets/contracts";
import { batchSchema, definitionFor, emptyProvenance } from "./model";
import type { Batch, Window } from "./model";
import type { BaselineRequest, MarketReader, StoredSeries } from "./service";
import { day, iso, minute, sortValidate } from "./time";

const rowSchema = z.object({ payload: z.string() });
const checkSchema = z.object({
  provenance: z.string(),
  issue: z.string().nullable(),
});
const selectedSchema = z.object({
  id: z.string(),
  collected: z.number(),
  payload: z.string().nullable(),
});
export class MarketStore implements MarketReader {
  constructor(private readonly db: D1Database) {}

  async read(dataset: string, window: Window): Promise<StoredSeries> {
    const results = await this.db.batch([
      this.db
        .prepare(
          "SELECT payload FROM intervals WHERE dataset=? AND start<? AND end>? ORDER BY start",
        )
        .bind(dataset, Date.parse(window.end), Date.parse(window.start)),
      this.db
        .prepare("SELECT provenance, issue FROM checks WHERE dataset=?")
        .bind(dataset),
    ]);
    const intervals = z
      .array(rowSchema)
      .parse(results[0]?.results ?? [])
      .map((row) => intervalSchema.parse(JSON.parse(row.payload)));
    const check = checkSchema.optional().parse(results[1]?.results[0]);
    return {
      intervals,
      provenance: check
        ? seriesSchema.shape.provenance.parse(JSON.parse(check.provenance))
        : emptyProvenance(),
      issue: check?.issue ?? null,
    };
  }

  async save(input: Batch): Promise<void> {
    const batch = batchSchema.parse(input),
      definition = definitionFor(batch.dataset);
    if (!batch.intervals.length) throw new Error("empty-provider-batch");
    const refs = [
      {
        seriesId: definition.id,
        snapshotId: batch.snapshotId,
        collectedAt: batch.collectedAt,
      },
    ];
    batch.intervals = sortValidate(
      batch.intervals.map((p) => ({
        ...p,
        start: iso(Date.parse(p.start)),
        end: iso(Date.parse(p.end)),
        inputs: refs,
      })),
    );
    const first = batch.intervals[0],
      last = batch.intervals.at(-1);
    if (!first || !last) throw new Error("empty-provider-batch");
    const start = Date.parse(first.start),
      end = Date.parse(last.end);
    const existing = await this.read(batch.dataset, {
      start: first.start,
      end: last.end,
    });
    // Keep older published periods inside response gaps; only returned intervals replace them.
    const retained = existing.intervals.filter(
      (old) =>
        !batch.intervals.some(
          (p) =>
            Date.parse(old.start) < Date.parse(p.end) &&
            Date.parse(old.end) > Date.parse(p.start),
        ),
    );
    const merged = sortValidate([...retained, ...batch.intervals]);
    const rows = JSON.stringify(
      merged.map((p) => ({
        start: Date.parse(p.start),
        end: Date.parse(p.end),
        payload: JSON.stringify(p),
      })),
    );
    const provenance = {
      publishedAt: batch.publishedAt,
      retrievedAt: batch.collectedAt,
      lastSuccessfulCheck: batch.collectedAt,
      snapshotId: batch.snapshotId,
      revision: batch.revision,
    };
    const writes = [
      this.db
        .prepare("DELETE FROM intervals WHERE dataset=? AND start<? AND end>?")
        .bind(batch.dataset, end, start),
      this.db
        .prepare(
          "INSERT INTO intervals(dataset,start,end,payload) SELECT ?,json_extract(value,'$.start'),json_extract(value,'$.end'),json_extract(value,'$.payload') FROM json_each(?)",
        )
        .bind(batch.dataset, rows),
      this.db
        .prepare(
          "INSERT INTO checks(dataset,provenance,issue,checked) VALUES(?,?,NULL,?) ON CONFLICT(dataset) DO UPDATE SET provenance=excluded.provenance, issue=NULL, checked=excluded.checked",
        )
        .bind(
          batch.dataset,
          JSON.stringify(provenance),
          Date.parse(batch.collectedAt),
        ),
    ];
    if (definition.classification === "forecast")
      writes.push(
        this.db
          .prepare(
            "INSERT INTO snapshots(id,dataset,collected,payload) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",
          )
          .bind(
            batch.snapshotId,
            batch.dataset,
            Date.parse(batch.collectedAt),
            JSON.stringify(batch),
          ),
      );
    await this.db.batch(writes);
  }

  async recordIssue(
    dataset: string,
    issue: string,
    now: number,
  ): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO checks(dataset,provenance,issue,checked) VALUES(?,?,?,?) ON CONFLICT(dataset) DO UPDATE SET issue=excluded.issue,checked=excluded.checked",
      )
      .bind(dataset, JSON.stringify(emptyProvenance()), issue, now)
      .run();
  }

  async baselines(
    dataset: string,
    requests: BaselineRequest[],
  ): Promise<Batch[]> {
    if (!requests.length) return [];
    if (
      requests.length > 400 ||
      requests.some(
        (r) =>
          !Number.isFinite(r.cutoff) ||
          !Number.isFinite(r.start) ||
          !Number.isFinite(r.end) ||
          r.end <= r.start,
      )
    )
      throw new Error("invalid-baseline-window");
    // Select only eligible vintages and overlapping periods inside D1, bounding Worker memory.
    const rows = await this.db
      .prepare(
        `WITH requested AS (
      SELECT json_extract(value,'$.cutoff') cutoff,json_extract(value,'$.start') start,json_extract(value,'$.end') end FROM json_each(?)
    ) SELECT DISTINCT s.id,s.collected,p.value payload FROM requested r
      JOIN snapshots s ON s.id=(SELECT id FROM snapshots WHERE dataset=? AND collected<=r.cutoff AND collected>=r.cutoff-? ORDER BY collected DESC LIMIT 1)
      LEFT JOIN json_each(s.payload,'$.intervals') p
      ON unixepoch(json_extract(p.value,'$.start'))*1000<r.end AND unixepoch(json_extract(p.value,'$.end'))*1000>r.start
      ORDER BY s.collected`,
      )
      .bind(JSON.stringify(requests), dataset, 30 * minute)
      .all();
    const selected = new Map<string, Batch>();
    for (const row of z.array(selectedSchema).parse(rows.results)) {
      let batch = selected.get(row.id);
      if (!batch) {
        batch = {
          dataset,
          snapshotId: row.id,
          collectedAt: iso(row.collected),
          publishedAt: null,
          revision: null,
          intervals: [],
        };
        selected.set(row.id, batch);
      }
      if (row.payload !== null)
        batch.intervals.push(intervalSchema.parse(JSON.parse(row.payload)));
    }
    for (const batch of selected.values()) sortValidate(batch.intervals);
    return [...selected.values()];
  }

  async prune(now: number): Promise<void> {
    await this.db.batch([
      this.db
        .prepare("DELETE FROM snapshots WHERE collected<?")
        .bind(now - 30 * day),
      this.db.prepare("DELETE FROM intervals WHERE end<?").bind(now - 30 * day),
    ]);
  }
}
