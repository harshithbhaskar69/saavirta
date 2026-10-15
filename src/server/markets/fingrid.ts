import { z } from "zod";
import type { Batch, Window } from "./model";
import { definitionFor, missingInterval } from "./model";
import { iso, sortValidate } from "./time";
import type { ProviderTransport } from "./provider";

const pageSchema = z.object({
  data: z.array(
    z.object({
      datasetId: z.number().int(),
      startTime: z.iso.datetime({ offset: true }),
      endTime: z.iso.datetime({ offset: true }),
      value: z.number().nullable(),
    }),
  ),
  pagination: z.object({
    currentPage: z.number().int().min(1).max(100),
    lastPage: z.number().int().min(0).max(100).optional().default(0),
    total: z.number().int().min(0).max(100000).optional().default(0),
    perPage: z.number().int().min(1).max(1000),
  }),
});
export function decodeFingrid(
  raw: string,
  dataset: string,
): {
  intervals: Batch["intervals"];
  pagination: z.infer<typeof pageSchema>["pagination"];
} {
  const page = pageSchema.parse(JSON.parse(raw));
  const p = page.pagination;
  if (
    page.data.length > p.perPage ||
    (p.currentPage === 1 && p.lastPage < 1) ||
    (p.lastPage !== 0 && p.lastPage < p.currentPage)
  )
    throw new Error("fingrid-pagination-invalid");
  const intervals = page.data.map((row) => {
    if (String(row.datasetId) !== dataset)
      throw new Error("fingrid-dataset-mismatch");
    return {
      ...missingInterval(
        iso(Date.parse(row.startTime)),
        iso(Date.parse(row.endTime)),
        "provider-missing",
      ),
      value: row.value,
      coverage: row.value === null ? 0 : 1,
      missingReason: row.value === null ? "provider-missing" : null,
    };
  });
  return { intervals: sortValidate(intervals), pagination: p };
}
export async function fetchFingrid(
  network: ProviderTransport,
  key: string,
  dataset: string,
  window: Window,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<Batch> {
  if (!key || definitionFor(dataset).dataset === "price")
    throw new Error("provider-not-configured");
  const batch: Batch = {
    dataset,
    snapshotId: crypto.randomUUID(),
    collectedAt: iso(now()),
    publishedAt: null,
    revision: null,
    intervals: [],
  };
  let total = 0,
    perPage = 0,
    last = 1;
  for (let number = 1; number <= last; number++) {
    const url = new URL(`https://data.fingrid.fi/api/datasets/${dataset}/data`);
    url.search = new URLSearchParams({
      startTime: window.start,
      endTime: window.end,
      pageSize: "1000",
      page: String(number),
      sortBy: "startTime",
      sortOrder: "asc",
    }).toString();
    const page = decodeFingrid(
        await network.get(
          url,
          { "x-api-key": key, Accept: "application/json" },
          signal,
        ),
        dataset,
      ),
      p = page.pagination;
    if (p.currentPage !== number)
      throw new Error("fingrid-pagination-mismatch");
    if (number === 1) {
      total = p.total;
      perPage = p.perPage;
      last = p.lastPage;
      if (last !== Math.max(1, Math.ceil(total / perPage)))
        throw new Error("fingrid-pagination-invalid");
    } else if (
      (p.lastPage !== 0 && p.lastPage !== last) ||
      p.perPage !== perPage ||
      (p.total !== 0 && p.total !== total)
    )
      throw new Error("fingrid-pagination-changed");
    if (
      page.intervals.length !==
      Math.min(perPage, total - (number - 1) * perPage)
    )
      throw new Error("fingrid-pagination-incomplete");
    batch.intervals.push(...page.intervals);
  }
  if (batch.intervals.length !== total)
    throw new Error("fingrid-pagination-incomplete");
  sortValidate(batch.intervals);
  // A vintage becomes available only after all pages have been retrieved.
  batch.collectedAt = iso(now());
  return batch;
}
