import { MarketStore } from "../../src/server/markets/store";
import { batchSchema } from "../../src/server/markets/model";
import { MarketCollector } from "../../src/server/markets/collector";
import { ProviderClient } from "../../src/server/markets/provider";
import type { ProviderState } from "../../src/server/markets/provider";
import { z } from "zod";
export class TestCollector extends MarketCollector {
  async step(): Promise<unknown> {
    await this.alarm();
    return this.inspect();
  }
  async inspect(): Promise<unknown> {
    return {
      jobs: await this.ctx.storage.get("jobs"),
      alarm: await this.ctx.storage.getAlarm(),
    };
  }
}
export default {
  async fetch(
    request: Request,
    env: Cloudflare.Env & { COLLECTOR: DurableObjectNamespace<TestCollector> },
  ): Promise<Response> {
    const store = new MarketStore(env.MARKET_DB),
      url = new URL(request.url);
    if (url.pathname === "/provider") {
      let state: ProviderState = { next: 0, cooldown: 0, requests: [] };
      const client = new ProviderClient("fingrid", {
        read: async () => state,
        write: async (value) => {
          state = value;
        },
      });
      return new Response(
        await client.get(
          new URL("https://data.fingrid.fi/api/datasets/193/data"),
          {},
          AbortSignal.timeout(1000),
        ),
      );
    }
    if (url.pathname === "/save") {
      await store.save(batchSchema.parse(await request.json()));
      return Response.json({ ok: true });
    }
    if (url.pathname === "/baselines")
      return Response.json(
        await store.baselines(
          "166",
          z
            .array(
              z.object({
                cutoff: z.number(),
                start: z.number(),
                end: z.number(),
              }),
            )
            .parse(await request.json()),
        ),
      );
    if (url.pathname === "/collector")
      return Response.json(await env.COLLECTOR.getByName("fi").step());
    if (url.pathname === "/state")
      return Response.json(await env.COLLECTOR.getByName("fi").inspect());
    return Response.json(
      await store.read("166", {
        start: "2026-10-15T00:00:00.000Z",
        end: "2026-10-16T00:00:00.000Z",
      }),
    );
  },
};
