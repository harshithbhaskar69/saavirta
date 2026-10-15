export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 502,
    public retryable = false,
    public retryAfterMs = 30_000,
  ) {
    super(message);
  }
}
export function failure(error: unknown, requestId: string) {
  const known =
    error instanceof AppError
      ? error
      : new AppError(
          "UNAVAILABLE",
          "Weather is temporarily unavailable. Try again shortly.",
          503,
          true,
        );
  return Response.json(
    {
      error: {
        code: known.code,
        message: known.message,
        retryable: known.retryable,
        requestId,
      },
    },
    {
      status: known.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
        "X-Content-Type-Options": "nosniff",
        ...(known.retryable
          ? { "Retry-After": String(Math.ceil(known.retryAfterMs / 1000)) }
          : {}),
      },
    },
  );
}
