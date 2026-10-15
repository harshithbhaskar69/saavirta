import assert from "node:assert/strict";
import { test } from "node:test";
import { productionConfig } from "../../scripts/prepare-worker-deploy.mjs";

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
