// Live integration check against the running Worker. Does not mock the provider.
import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3001";
async function get(path, options) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    signal: AbortSignal.timeout(20_000),
  });
  return { response, body: await response.json() };
}
const health = await get("/api/health");
assert.equal(health.response.status, 200);
assert.equal(health.body.runtime, "workerd");
const invalid = await get("/api/weather?lat=95&lon=0&horizon=24h");
assert.equal(invalid.response.status, 400);
assert.ok(invalid.body.error.requestId);
const query = "/api/weather?lat=51.9225&lon=4.4792&horizon=";
const first = await get(`${query}48h`);
assert.equal(first.response.status, 200, JSON.stringify(first.body));
assert.equal(first.response.headers.get("cache-control"), "no-store");
assert.equal(first.body.hourly.length, 48);
assert.equal(first.body.location.timezone, "Europe/Amsterdam");
assert.ok(first.body.coverage.temperature > 0);
assert.ok(first.body.coverage.solar > 0);
assert.equal(first.body.units.wind, "m/s");
assert.equal(first.body.units.precipitation, "mm");
for (const field of [
  "windSpeedMs",
  "windGustMs",
  "cloudCoverPct",
  "humidityPct",
  "precipitationMm",
  "precipitationProbabilityPct",
]) {
  assert.ok(
    first.body.hourly.some((hour) => Number.isFinite(hour[field])),
    field,
  );
  assert.ok(
    first.body.hourly.every(
      (hour) => hour[field] === null || Number.isFinite(hour[field]),
    ),
    field,
  );
}
assert.equal(first.body.hourly[1].time - first.body.hourly[0].time, 3_600_000);
const second = await get(`${query}7d`);
assert.equal(second.response.status, 200);
assert.equal(second.body.hourly.length, 168);
assert.equal(
  second.body.source.retrievedAt,
  first.body.source.retrievedAt,
  "changing horizon should reuse the normalized snapshot",
);
const search = await get("/api/geocode?q=Rotterdam");
assert.equal(search.response.status, 200);
assert.ok(search.body.places.some((place) => place.countryCode === "NL"));
const privatePoint = await get("/api/weather", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    latitude: 60.1695,
    longitude: 24.9354,
    horizon: "24h",
  }),
});
assert.equal(privatePoint.response.status, 200);
assert.equal(privatePoint.body.hourly.length, 24);
const oversized = await get("/api/weather", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ value: "x".repeat(513) }),
});
assert.equal(oversized.response.status, 400);
// A manual refresh of a snapshot younger than a minute keeps that retrieval.
const refreshed = await get(`${query}48h&refresh=1`);
assert.equal(refreshed.response.status, 200);
assert.ok(refreshed.body.source.retrievedAt >= first.body.source.retrievedAt);
// Normals (ERA5) and run-to-run revision (ECMWF IFS) for the same point.
const baselines = await get("/api/baselines?lat=51.9225&lon=4.4792");
assert.equal(baselines.response.status, 200, JSON.stringify(baselines.body));
assert.equal(baselines.body.timezone, "Europe/Amsterdam");
const normalDays = Object.values(baselines.body.normals.days);
assert.equal(normalDays.length, 10);
assert.ok(
  normalDays.every(
    (day) =>
      day.temperatureC.length === 24 &&
      day.temperatureC.every((t) => Number.isFinite(t) && t > -60 && t < 60),
  ),
);
assert.ok(normalDays.some((day) => day.solarIrradianceWm2.some((w) => w > 0)));
const revision = baselines.body.revision;
assert.equal(revision.previousRun, revision.latestRun - 86_400_000);
assert.ok(revision.hours.filter((h) => h.previousC !== null).length >= 96);
const privateBaselines = await get("/api/baselines", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ latitude: 60.1695, longitude: 24.9354 }),
});
assert.equal(privateBaselines.response.status, 200);
assert.equal(privateBaselines.body.timezone, "Europe/Helsinki");
assert.equal(privateBaselines.body.normals.yearCount, 10);
assert.ok(privateBaselines.body.revision);
console.log(
  JSON.stringify({
    base,
    runtime: "workerd",
    checks: 10,
    horizons: [24, 48, 168],
    provider: first.body.source.provider,
    retrievedAt: first.body.source.retrievedAt,
    cacheReuse: true,
    geocoding: true,
    privatePost: true,
    normalsYears: baselines.body.normals.years,
    revisionRuns: [revision.latestRun, revision.previousRun].map((t) =>
      new Date(t).toISOString().slice(0, 16),
    ),
  }),
);
