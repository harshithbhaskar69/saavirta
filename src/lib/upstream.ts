import { AppError } from "./errors";

export async function fetchJson(
  url: URL,
  transport: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await transport(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 429) {
            const retryAfter = response.headers.get("retry-after");
            const wait =
              retryAfter && /^\d+$/.test(retryAfter)
                ? Number(retryAfter) * 1000
                : retryAfter
                  ? Date.parse(retryAfter) - Date.now()
                  : 60_000;
            throw new AppError(
              "PROVIDER_BUSY",
              "The weather provider is busy. Try again in a minute.",
              503,
              true,
              Number.isFinite(wait)
                ? Math.max(1000, Math.min(wait, 300_000))
                : 60_000,
            );
          }
          throw new AppError(
            "PROVIDER_ERROR",
            "The provider could not return this forecast. Try again shortly.",
            response.status >= 500 ? 503 : 502,
            response.status >= 500,
          );
        }
        const reader = response.body?.getReader();
        if (!reader)
          throw new AppError(
            "INVALID_PROVIDER_DATA",
            "The weather provider returned an empty response. Try again.",
          );
        const decoder = new TextDecoder();
        let text = "",
          bytes = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 256_000) {
            await reader.cancel();
            throw new AppError(
              "INVALID_PROVIDER_DATA",
              "The provider response was too large. Try again.",
            );
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        try {
          return JSON.parse(text + decoder.decode()) as unknown;
        } catch {
          throw new AppError(
            "INVALID_PROVIDER_DATA",
            "The provider returned unreadable data. Try again.",
          );
        }
      } catch (error) {
        if (controller.signal.aborted)
          throw new AppError(
            "PROVIDER_TIMEOUT",
            "The weather provider took too long. Try again.",
            504,
            true,
          );
        if (
          attempt === 1 ||
          (error instanceof AppError &&
            (!error.retryable || error.code === "PROVIDER_BUSY"))
        )
          throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 150 + Math.random() * 150),
        );
      }
    }
    throw new AppError(
      "PROVIDER_ERROR",
      "Could not retrieve weather. Try again.",
      503,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}
