import type { Batch, Window } from "./model";
import { definitionFor } from "./model";
import type { BaselineRequest, MarketReader, StoredSeries } from "./service";
import { grid, iso, minute } from "./time";

// Explicitly synthetic, isolated from provider collection and persistent storage.
export class DemoReader implements MarketReader {
  constructor(private readonly now: number) {}
  private batch(dataset: string, window: Window, collected: number): Batch {
    const definition = definitionFor(dataset),
      snapshotId = `synthetic-${dataset}-${collected}`;
    const intervals = grid(window)
      .map((p) => {
        const hour = new Date(p.start).getUTCHours(),
          wave = Math.sin(((hour - 7) * Math.PI) / 12);
        const value =
          dataset === "price"
            ? 42 + 55 * wave
            : dataset === "245"
              ? 2500 + 1100 * Math.cos((hour * Math.PI) / 14)
              : dataset === "248"
                ? Math.max(0, 550 * Math.sin(((hour - 7) * Math.PI) / 11))
                : ["192", "74", "241"].includes(dataset)
                  ? 7500 + 600 * wave
                  : 8200 + 900 * wave;
        return {
          ...p,
          value:
            Math.round(
              (value +
                (definition.classification === "forecast"
                  ? (Math.floor(collected / (15 * minute)) % 7) * 12
                  : 0)) *
                100,
            ) / 100,
          coverage: 1,
          missingReason: null,
          inputs: [
            {
              seriesId: definition.id,
              snapshotId,
              collectedAt: iso(collected),
            },
          ],
        };
      })
      .filter(
        (p) =>
          definition.classification !== "actual" ||
          Date.parse(p.end) <= this.now,
      );
    return {
      dataset,
      snapshotId,
      collectedAt: iso(collected),
      publishedAt: null,
      revision: null,
      intervals,
    };
  }
  async read(dataset: string, window: Window): Promise<StoredSeries> {
    const batch = this.batch(dataset, window, this.now - 2 * minute);
    return {
      intervals: batch.intervals,
      issue: null,
      provenance: {
        publishedAt: null,
        retrievedAt: batch.collectedAt,
        lastSuccessfulCheck: batch.collectedAt,
        snapshotId: batch.snapshotId,
        revision: null,
      },
    };
  }
  async baselines(
    dataset: string,
    requests: BaselineRequest[],
  ): Promise<Batch[]> {
    const batches = new Map<number, Batch>();
    for (const request of requests) {
      const collected =
        Math.floor(request.cutoff / (15 * minute)) * 15 * minute;
      const batch = this.batch(
        dataset,
        { start: iso(request.start), end: iso(request.end) },
        collected,
      );
      const existing = batches.get(collected);
      if (existing) existing.intervals.push(...batch.intervals);
      else batches.set(collected, batch);
    }
    return [...batches.values()];
  }
}
