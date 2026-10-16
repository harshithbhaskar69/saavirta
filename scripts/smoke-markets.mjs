import assert from "node:assert/strict";
import { accessHeaders } from "./access-headers.mjs";
import {
  contextSchema,
  dashboardSchema,
} from "../src/features/markets/contracts.ts";

const base = process.env.SMOKE_BASE_URL;
assert.ok(base?.startsWith("https://"), "Set the deployed HTTPS site");
const headers = accessHeaders(process.env);
for (const path of [
  "/",
  "/api/health",
  "/api/weather?lat=60.17&lon=24.94",
  "/api/v1/market-context",
]) {
  const response = await fetch(`${base}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  assert.ok(
    [302, 401, 403].includes(response.status),
    `Access must protect ${path}`,
  );
  if (response.status === 302) {
    const login = new URL(response.headers.get("location"));
    assert.equal(login.protocol, "https:");
    assert.ok(login.hostname.endsWith(".cloudflareaccess.com"));
  }
  await response.body?.cancel();
}
const html = await fetch(base, {
  headers,
  redirect: "error",
  signal: AbortSignal.timeout(20000),
});
assert.equal(html.status, 200);
// The edge may change other directives; no-store must remain enforced.
assert.match(
  html.headers.get("cache-control") ?? "",
  /(?:^|,)\s*no-store\s*(?:,|$)/i,
);
assert.match(
  html.headers.get("content-security-policy") ?? "",
  /script-src 'self' 'nonce-[a-zA-Z0-9]+' 'strict-dynamic'/,
);
await html.body?.cancel();
const point = { latitude: 60.1699, longitude: 24.9384 };
async function post(path, input) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    redirect: "error",
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, `Hosted ${path} must be usable`);
  assert.match(
    response.headers.get("cache-control") ?? "",
    /(?:^|,)\s*no-store\s*(?:,|$)/i,
  );
  return response.json();
}
const context = contextSchema.parse(
  await post("/api/v1/market-context", point),
);
assert.equal(context.marketContext.relationship, "local_market");
assert.equal(context.marketContext.demonstration, false);
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Helsinki",
}).format(new Date());
const dashboard = dashboardSchema.parse(
  await post("/api/v1/markets/fi/dashboard", {
    ...point,
    date,
    days: 1,
    resolution: "PT15M",
  }),
);
assert.equal(dashboard.marketContext.demonstration, false);
assert.ok(
  dashboard.series.some(
    (series) =>
      series.provider === "Fingrid" &&
      series.intervals.some((period) => period.value !== null),
  ),
  "Authenticated fundamentals must be available",
);
console.log(
  "Hosted smoke: Access gate, CSP, private HTML, authoritative FI context, real fundamentals and schema passed.",
);
