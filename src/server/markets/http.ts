import {
  dashboardInputSchema,
  pointInputSchema,
} from "@/features/markets/contracts";
import { boundedText } from "@/lib/bounded-body";
import { marketContext } from "./geography";
import { dashboard } from "./service";
import type { DashboardOptions, MarketReader } from "./service";
import { addDays, deliveryWindow, localDate } from "./time";

interface Options extends Omit<DashboardOptions, "requestId"> {
  demonstration: boolean;
  production: boolean;
  rateLimit(key: string): Promise<{ success: boolean }>;
}
function problem(
  status: number,
  code: string,
  title: string,
  requestId: string,
): Response {
  return Response.json(
    { type: "about:blank", title, status, code, requestId },
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
        "X-Content-Type-Options": "nosniff",
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
export async function marketRequest(
  request: Request,
  kind: "context" | "dashboard",
  store: MarketReader,
  options: Options,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    if (
      !(
        await options.rateLimit(
          request.headers.get("CF-Connecting-IP") ?? "local",
        )
      ).success
    )
      return problem(
        429,
        "rate-limit",
        "Too many requests. Try again in a minute.",
        requestId,
      );
    if (options.demonstration && options.production)
      throw new Error("invalid-market-mode");
    if (
      request.method !== "POST" &&
      (kind === "context" || request.method !== "GET")
    )
      return problem(
        405,
        "method-not-allowed",
        "Method not allowed",
        requestId,
      );
    let raw: unknown;
    try {
      if (request.method === "POST") {
        if (
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          throw new Error("invalid-content-type");
        raw = JSON.parse(await boundedText(request.body, 512));
      } else {
        const p = new URL(request.url).searchParams;
        if (
          [...p.keys()].some(
            (key) =>
              !["latitude", "longitude", "date", "days", "resolution"].includes(
                key,
              ),
          )
        )
          throw new Error("unknown-input");
        raw = {
          latitude: p.has("latitude") ? Number(p.get("latitude")) : undefined,
          longitude: p.has("longitude")
            ? Number(p.get("longitude"))
            : undefined,
          date: p.get("date"),
          days: p.has("days") ? Number(p.get("days")) : 1,
          resolution: p.get("resolution") ?? "PT15M",
        };
      }
    } catch {
      return problem(
        400,
        "invalid-input",
        "Send a small, valid JSON request or delivery query.",
        requestId,
      );
    }
    const parsed = (
      kind === "context" ? pointInputSchema : dashboardInputSchema
    ).safeParse(raw);
    if (!parsed.success)
      return problem(
        400,
        "invalid-input",
        "Supply valid coordinates and delivery settings.",
        requestId,
      );
    const context = {
      ...marketContext(parsed.data.latitude, parsed.data.longitude),
      demonstration: options.demonstration,
    };
    let result: unknown = {
      schemaVersion: "1",
      requestId,
      marketContext: context,
    };
    if (kind === "dashboard") {
      const input = dashboardInputSchema.parse(parsed.data);
      let window;
      try {
        window = deliveryWindow(input.date, input.days);
        const today = localDate(options.now);
        if (
          input.date < addDays(today, -7) ||
          input.date > addDays(today, 2) ||
          window.end > deliveryWindow(today, 3).end
        )
          throw new Error("invalid-range");
      } catch {
        return problem(
          400,
          "invalid-input",
          "Choose up to three delivery days between seven days ago and two days ahead.",
          requestId,
        );
      }
      if (context.geographicStatus !== "inside")
        return problem(
          422,
          "unsupported-geography",
          "Energy Markets requires a confirmed point inside Finland. Weather remains available.",
          requestId,
        );
      request.signal.throwIfAborted();
      const data = await dashboard(store, window, input.resolution, context, {
        ...options,
        requestId,
      });
      if (!data.series.some((series) => series.quality.coverage > 0))
        return problem(
          503,
          "market-warming",
          "Market data is collecting or temporarily unavailable. Weather remains available.",
          requestId,
        );
      result = data;
    }
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.warn(JSON.stringify({ event: "market-request-failed", requestId }));
    return problem(
      503,
      "market-unavailable",
      "Energy Markets is temporarily unavailable. Weather remains available.",
      requestId,
    );
  }
}
