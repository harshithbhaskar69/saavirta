import handler from "vinext/server/fetch-handler";
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
    if (
      new URL(request.url).pathname.startsWith("/api/") &&
      new URL(request.url).pathname !== "/api/health"
    ) {
      try {
        if (
          !(await env.PROVIDER_BUDGET?.getByName("public-api").reserve("api"))
        ) {
          return Response.json(
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
          );
        }
      } catch {
        return Response.json(
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
        );
      }
    }
    const response = await handler.fetch(request, env, ctx);
    const result = new Response(response.body, response);
    result.headers.set("X-Content-Type-Options", "nosniff");
    result.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    result.headers.set("X-Frame-Options", "DENY");
    result.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), payment=(), geolocation=(self)",
    );
    result.headers.set("Strict-Transport-Security", "max-age=31536000");
    return result;
  },
};
