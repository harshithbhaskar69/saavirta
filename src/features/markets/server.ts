import { env } from "cloudflare:workers";
import { marketRequest } from "@/server/markets/http";
import { MarketStore } from "@/server/markets/store";
import { DemoReader } from "@/server/markets/demo";
import { priceEnabled } from "@/server/markets/model";
export function marketRoute(
  request: Request,
  kind: "context" | "dashboard",
): Promise<Response> {
  const now = Date.now(),
    demonstration = env.MARKET_MODE === "demo";
  return marketRequest(
    request,
    kind,
    demonstration ? new DemoReader(now) : new MarketStore(env.MARKET_DB),
    {
      now,
      demonstration,
      production: env.APP_ENV === "production",
      pricesEnabled: demonstration || priceEnabled(env),
      priceExportAllowed: demonstration || env.PRICE_EXPORT_ALLOWED === "true",
      rateLimit: (key) => env.API_RATE_LIMIT.limit({ key }),
    },
  );
}
