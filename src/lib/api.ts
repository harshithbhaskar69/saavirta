import { env } from "cloudflare:workers";
import { AppError, failure } from "./errors";

/** Reads a small JSON body (private coordinates), rejecting anything over 512 bytes. */
export async function readSmallJson(request: Request): Promise<unknown> {
  if (
    Number(request.headers.get("content-length") ?? 0) > 512 ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    throw new AppError(
      "INVALID_REQUEST",
      "Send a small JSON location request.",
      400,
    );
  const reader = request.body?.getReader(),
    decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  if (!reader)
    throw new AppError("INVALID_REQUEST", "Send a JSON location request.", 400);
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 512) {
      await reader.cancel();
      throw new AppError(
        "INVALID_REQUEST",
        "The location request is too large.",
        400,
      );
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError(
      "INVALID_REQUEST",
      "The location request must be valid JSON.",
      400,
    );
  }
}

export async function api(request: Request, handler: () => Promise<unknown>) {
  const requestId = crypto.randomUUID(),
    start = Date.now();
  try {
    const key = request.headers.get("CF-Connecting-IP") ?? "local";
    if (!(await env.API_RATE_LIMIT.limit({ key })).success)
      throw new AppError(
        "RATE_LIMIT",
        "Too many requests. Wait a minute, then try again.",
        429,
        true,
      );
    const result = await handler();
    console.info(
      JSON.stringify({
        requestId,
        route: new URL(request.url).pathname,
        status: 200,
        durationMs: Date.now() - start,
      }),
    );
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        requestId,
        route: new URL(request.url).pathname,
        code: error instanceof AppError ? error.code : "UNAVAILABLE",
        durationMs: Date.now() - start,
      }),
    );
    return failure(error, requestId);
  }
}
