export function contentSecurityPolicy(
  nonce: string,
  development = false,
): string {
  return [
    "default-src 'self'",
    development
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Charts and Motion set inline styles; script execution still requires a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://api.maptiler.com",
    `connect-src 'self' https://api.maptiler.com${development ? " ws: wss:" : ""}`,
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

export function secureResponse(response: Response, policy: string): Response {
  const result = new Response(response.body, response);
  result.headers.set("Content-Security-Policy", policy);
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  result.headers.set("X-Frame-Options", "DENY");
  result.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), payment=(), geolocation=(self)",
  );
  result.headers.set("Strict-Transport-Security", "max-age=31536000");
  const type = result.headers.get("Content-Type") ?? "";
  if (type.includes("text/html") || type.includes("text/x-component")) {
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("CDN-Cache-Control", "no-store");
    result.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  }
  return result;
}
