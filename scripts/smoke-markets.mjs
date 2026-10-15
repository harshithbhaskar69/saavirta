import assert from "node:assert/strict";
import {
  contextSchema,
  dashboardSchema,
} from "../src/features/markets/contracts.ts";

const base = process.env.SMOKE_BASE_URL;
assert.ok(base?.startsWith("https://"), "Set the deployed HTTPS site");
const point = { latitude: 60.1699, longitude: 24.9384 };
async function post(path, input) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, `Hosted ${path} must be usable`);
  assert.equal(response.headers.get("cache-control"), "no-store");
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
  "Hosted market smoke: authoritative FI context, real fundamentals, schema and privacy headers passed.",
);
