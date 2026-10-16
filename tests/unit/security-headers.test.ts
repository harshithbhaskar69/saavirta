import { expect, it } from "vitest";
import {
  contentSecurityPolicy,
  secureResponse,
} from "../../src/lib/security-headers";

it("requires a nonce for production scripts and blocks embedding", () => {
  const policy = contentSecurityPolicy("unique-nonce");
  expect(policy).toContain(
    "script-src 'self' 'nonce-unique-nonce' 'strict-dynamic'",
  );
  expect(
    policy.split(";").find((part) => part.trim().startsWith("script-src")),
  ).not.toContain("unsafe");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(contentSecurityPolicy("dev", true)).toContain("'unsafe-eval'");
});

it("prevents HTML and streamed RSC caching without discarding asset caching", () => {
  for (const type of ["text/html; charset=utf-8", "text/x-component"]) {
    const response = secureResponse(
      new Response("content", {
        headers: { "Content-Type": type, "Cache-Control": "s-maxage=31536000" },
      }),
      "policy",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "no-store",
    );
  }
  const response = secureResponse(
    new Response("asset", {
      headers: {
        "Content-Type": "text/javascript",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }),
    "policy",
  );
  expect(response.headers.get("cache-control")).toContain("immutable");
});

it("preserves error status, retry instructions and privacy while adding headers", () => {
  const response = secureResponse(
    Response.json(
      {},
      {
        status: 429,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      },
    ),
    "policy",
  );
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-security-policy")).toBe("policy");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
