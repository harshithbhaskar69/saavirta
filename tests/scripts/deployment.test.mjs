import assert from "node:assert/strict";
import { test } from "node:test";
import { productionConfig } from "../../scripts/prepare-worker-deploy.mjs";
import { accessHeaders } from "../../scripts/access-headers.mjs";

const built = {
  main: "index.js",
  assets: { directory: "../client" },
  vars: {
    NLS_API_KEY: "must-not-survive",
    COLLECTOR_ENABLED: "false",
  },
  secrets: { required: ["FINGRID_API_KEY", "NLS_API_KEY"] },
  routes: ["old.example/*"],
  env: { production: {} },
};
const inputs = {
  account_id: "a".repeat(32),
  weather_cache_id: "b".repeat(32),
  name: "www",
  market_database_id: "11111111-1111-4111-8111-111111111111",
};
test("deployment preserves built paths, binds Terraform resources, and excludes local secrets", () => {
  const result = productionConfig(built, inputs);
  assert.equal(result.main, "index.js");
  assert.equal(result.assets.directory, "../client");
  assert.equal(result.vars.NLS_API_KEY, undefined);
  assert.equal(result.kv_namespaces[0].id, inputs.weather_cache_id);
  assert.equal(result.vars.COLLECTOR_ENABLED, "true");
  assert.equal(result.d1_databases[0].database_id, inputs.market_database_id);
  assert.deepEqual(result.secrets, { required: ["FINGRID_API_KEY"] });
  assert.equal(result.routes, undefined);
  assert.equal(result.env, undefined);
  assert.equal(result.workers_dev, true);
  assert.equal(result.observability.traces.enabled, false);
  assert.equal(built.vars.NLS_API_KEY, "must-not-survive");
});
test("deployment refuses unprovisioned resource identifiers", () => {
  for (const market_database_id of ["", "placeholder", "https://example.org"])
    assert.throws(() =>
      productionConfig(built, { ...inputs, market_database_id }),
    );
});
test("commercial weather configuration requires a customer key and never writes it into vars", () => {
  assert.equal(
    productionConfig(built, inputs).vars.WEATHER_PROVIDER_MODE,
    "public",
  );
  assert.throws(() =>
    productionConfig(built, inputs, { WEATHER_PROVIDER_MODE: "invalid" }),
  );
  assert.throws(() =>
    productionConfig(built, inputs, { WEATHER_PROVIDER_MODE: "customer" }),
  );
  const settings = {
    WEATHER_PROVIDER_MODE: "customer",
    OPEN_METEO_API_KEY: "test-only-key",
  };
  const config = productionConfig(built, inputs, settings);
  assert.equal(config.vars.WEATHER_PROVIDER_MODE, "customer");
  assert.equal(config.vars.OPEN_METEO_API_KEY, undefined);
});
test("deployment probes require both credentials and reject header injection", () => {
  assert.throws(() => accessHeaders({}));
  assert.throws(() =>
    accessHeaders({
      ACCESS_CLIENT_ID: "test",
      ACCESS_CLIENT_SECRET: "bad\nvalue",
    }),
  );
  assert.deepEqual(
    accessHeaders({
      ACCESS_CLIENT_ID: "test",
      ACCESS_CLIENT_SECRET: "test-secret",
    }),
    {
      "CF-Access-Client-Id": "test",
      "CF-Access-Client-Secret": "test-secret",
    },
  );
});

test("ENTSO-E access does not grant price display or export permission", () => {
  const settings = { ENTSOE_API_TOKEN: "test-entsoe" };
  const defaults = productionConfig(built, inputs, settings);
  assert.equal(defaults.vars.ENTSOE_CONTRACT_VERIFIED, "true");
  assert.equal(defaults.vars.PRICE_REDISPLAY_ALLOWED, "false");
  assert.equal(defaults.vars.PRICE_EXPORT_ALLOWED, "false");
  assert.equal(defaults.vars.ENTSOE_API_TOKEN, undefined);
  const display = productionConfig(built, inputs, {
    ...settings,
    PRICE_REDISPLAY_ALLOWED: "true",
  });
  assert.equal(display.vars.PRICE_REDISPLAY_ALLOWED, "true");
  assert.equal(display.vars.PRICE_EXPORT_ALLOWED, "false");
  for (const invalid of [
    { PRICE_REDISPLAY_ALLOWED: "true" },
    { ...settings, PRICE_REDISPLAY_ALLOWED: "yes" },
    { ...settings, PRICE_EXPORT_ALLOWED: "true" },
    { ...settings, PRICE_EXPORT_ALLOWED: true },
  ])
    assert.throws(() => productionConfig(built, inputs, invalid));
  const exported = productionConfig(built, inputs, {
    ...settings,
    PRICE_REDISPLAY_ALLOWED: "true",
    PRICE_EXPORT_ALLOWED: "true",
  });
  assert.equal(exported.vars.PRICE_EXPORT_ALLOWED, "true");
});
