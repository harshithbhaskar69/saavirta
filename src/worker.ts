import handler from "vinext/server/fetch-handler";
import { contentSecurityPolicy, secureResponse } from "./lib/security-headers";
export * from "vinext/server/fetch-handler";
export { ProviderBudget } from "./lib/provider-budget";
export { MarketCollector } from "./server/markets/collector";

export default {
  async scheduled(
    _event: ScheduledController,
    env: Cloudflare.Env,
  ): Promise<void> {
    await env.MARKET_COLLECTOR.getByName("fi").wake();
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const policy = contentSecurityPolicy(
      crypto.randomUUID().replaceAll("-", ""),
      import.meta.env.DEV,
    );
    const headers = new Headers(request.headers);
    // Vinext propagates this server-generated nonce to its streamed scripts.
    headers.set("Content-Security-Policy", policy);
    request = new Request(request, { headers });
    if (
      new URL(request.url).pathname.startsWith("/api/") &&
      new URL(request.url).pathname !== "/api/health"
    ) {
      try {
        if (
          !(await env.PROVIDER_BUDGET?.getByName("public-api").reserve("api"))
        ) {
          return secureResponse(
            Response.json(
              {
                error: {
                  code: "RATE_LIMIT",
                  message: "Too many requests. Please try again in a minute.",
                  retryable: true,
                },
              },
              {
                status: 429,
                headers: { "Retry-After": "60", "Cache-Control": "no-store" },
              },
            ),
            policy,
          );
        }
      } catch {
        return secureResponse(
          Response.json(
            {
              error: {
                code: "UNAVAILABLE",
                message: "The service is temporarily unavailable.",
                retryable: true,
              },
            },
            {
              status: 503,
              headers: { "Retry-After": "60", "Cache-Control": "no-store" },
            },
          ),
          policy,
        );
      }
    }
    const response = await handler.fetch(request, env, ctx);
    return secureResponse(response, policy);
  },
};
