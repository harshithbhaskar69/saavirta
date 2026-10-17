import { DurableObject } from "cloudflare:workers";
import { definitions, priceEnabled } from "./model";
import type { Window } from "./model";
import {
  addDays,
  deliveryWindow,
  grid,
  iso,
  localDate,
  localMinutes,
  minute,
  quality,
  resample,
  hour,
} from "./time";
import { MarketStore } from "./store";
import { ProviderClient, ProviderError } from "./provider";
import type { ProviderState } from "./provider";
import { fetchFingrid } from "./fingrid";
import { fetchEntsoe } from "./entsoe";

interface Job {
  id: string;
  dataset: string;
  due: number;
  date?: string;
}
// The single coordination identity represents one provider key, never user traffic.
export class MarketCollector extends DurableObject<Cloudflare.Env> {
  async wake(): Promise<void> {
    if (
      this.env.COLLECTOR_ENABLED !== "true" ||
      this.env.MARKET_MODE !== "live"
    ) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    if ((await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(Date.now() + 1000);
  }

  async alarm(): Promise<void> {
    if (
      this.env.COLLECTOR_ENABLED !== "true" ||
      this.env.MARKET_MODE !== "live"
    )
      return;
    const now = Date.now(),
      today = localDate(now),
      store = new MarketStore(this.env.MARKET_DB);
    // A watchdog alarm survives a provider/storage failure or an interrupted execution.
    await this.ctx.storage.setAlarm(now + 5 * minute);
    try {
      const jobs: Job[] =
        (await this.ctx.storage.get<Job[]>("jobs")) ??
        definitions.map((d) => ({ id: d.dataset, dataset: d.dataset, due: 0 }));
      if ((await this.ctx.storage.get<string>("reconciled")) !== today) {
        await store.prune(now);
        for (const dataset of ["124", "74", "price"])
          for (let offset = 7; offset >= 1; offset--) {
            const date = addDays(today, -offset),
              id = `${dataset}/${date}`;
            if (!jobs.some((job) => job.id === id))
              jobs.push({ id, dataset, date, due: now + minute });
          }
        await this.ctx.storage.put({ jobs, reconciled: today });
      }
      jobs.sort((a, b) => a.due - b.due);
      const job = jobs[0];
      if (!job) return;
      if (job.due > now) {
        await this.ctx.storage.setAlarm(job.due);
        return;
      }
      let cadence =
        job.dataset === "193" || job.dataset === "192"
          ? 3 * minute
          : 15 * minute;
      let window: Window = deliveryWindow(today, 3);
      if (job.date) window = deliveryWindow(job.date, 1);
      else if (job.dataset === "193" || job.dataset === "192")
        window = { start: iso(now - 15 * minute), end: iso(now) };
      else if (job.dataset === "124" || job.dataset === "74")
        window = {
          start: deliveryWindow(addDays(today, -1), 1).start,
          end: iso(now),
        };
      else if (job.dataset === "price") {
        const minutes = localMinutes(now);
        if (minutes >= 13 * 60 + 50 && minutes <= 16 * 60) cadence = 5 * minute;
        const tomorrow = deliveryWindow(addDays(today, 1), 1),
          prices = await store.read("price", tomorrow);
        if (
          quality(resample(prices.intervals, grid(tomorrow)), "fresh")
            .coverage === 1
        )
          cadence = hour;
      }
      const enabled =
        job.dataset === "price"
          ? priceEnabled(this.env) && !!this.env.ENTSOE_API_TOKEN
          : this.env.FINGRID_CONTRACT_VERIFIED === "true" &&
            !!this.env.FINGRID_API_KEY;
      if (enabled) {
        const provider = job.dataset === "price" ? "entsoe" : "fingrid";
        const stateKey = `provider/${provider}`;
        const network = new ProviderClient(provider, {
          read: async () =>
            (await this.ctx.storage.get<ProviderState>(stateKey)) ?? {
              next: 0,
              cooldown: 0,
              requests: [],
            },
          write: async (state) => {
            await this.ctx.storage.put(stateKey, state);
          },
        });
        try {
          const signal = AbortSignal.timeout(4 * minute);
          const batch =
            job.dataset === "price"
              ? await fetchEntsoe(
                  network,
                  this.env.ENTSOE_API_TOKEN ?? "",
                  window,
                  signal,
                )
              : await fetchFingrid(
                  network,
                  this.env.FINGRID_API_KEY ?? "",
                  job.dataset,
                  window,
                  signal,
                );
          if (batch.intervals.length) await store.save(batch);
          else await store.recordIssue(job.dataset, "no-published-data", now);
          console.log(
            JSON.stringify({
              event: "market-collection",
              dataset: job.dataset,
              intervals: batch.intervals.length,
              durationMs: Date.now() - now,
            }),
          );
        } catch (error) {
          const code =
            error instanceof ProviderError
              ? error.code
              : "provider-or-storage-invalid";
          await store.recordIssue(job.dataset, code, now);
          console.warn(
            JSON.stringify({
              event: "market-collection-failed",
              dataset: job.dataset,
              code,
            }),
          );
        }
      } else
        await store.recordIssue(
          job.dataset,
          job.dataset === "price"
            ? "price-permission-required"
            : "provider-not-configured",
          now,
        );
      if (job.date) jobs.shift();
      else job.due = now + cadence;
      await this.ctx.storage.put("jobs", jobs);
      const next = Math.min(...jobs.map((item) => item.due));
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 3000, next));
    } catch {
      console.error(JSON.stringify({ event: "market-collector-unavailable" }));
    }
  }
}
