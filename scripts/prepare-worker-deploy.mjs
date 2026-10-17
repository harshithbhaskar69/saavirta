import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function productionConfig(built, inputs, settings = {}) {
  const weatherMode = settings.WEATHER_PROVIDER_MODE ?? "public";
  assert.ok(
    ["public", "customer"].includes(weatherMode),
    "Invalid WEATHER_PROVIDER_MODE",
  );
  if (weatherMode === "customer")
    assert.ok(
      typeof settings.OPEN_METEO_API_KEY === "string" &&
        settings.OPEN_METEO_API_KEY.trim().length > 0,
      "Customer weather mode requires OPEN_METEO_API_KEY",
    );
  const pricePermissions = {
    PRICE_REDISPLAY_ALLOWED: settings.PRICE_REDISPLAY_ALLOWED ?? "false",
    PRICE_EXPORT_ALLOWED: settings.PRICE_EXPORT_ALLOWED ?? "false",
  };
  for (const [name, value] of Object.entries(pricePermissions))
    assert.ok(["true", "false"].includes(value), `Invalid ${name}`);
  if (pricePermissions.PRICE_REDISPLAY_ALLOWED === "true")
    assert.ok(
      typeof settings.ENTSOE_API_TOKEN === "string" &&
        settings.ENTSOE_API_TOKEN.trim().length > 0 &&
        !/[\r\n]/.test(settings.ENTSOE_API_TOKEN),
      "Price display requires ENTSOE_API_TOKEN",
    );
  if (pricePermissions.PRICE_EXPORT_ALLOWED === "true")
    assert.equal(
      pricePermissions.PRICE_REDISPLAY_ALLOWED,
      "true",
      "Price exports require display permission",
    );
  assert.match(inputs.account_id, /^[a-f0-9]{32}$/);
  assert.match(inputs.weather_cache_id, /^[a-f0-9]{32}$/);
  assert.equal(inputs.name, "www");
  assert.match(
    inputs.market_database_id,
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
  );
  assert.ok(built.main && built.assets?.directory, "Build the Worker first");
  const config = structuredClone(built);
  delete config.env;
  delete config.routes;
  config.name = inputs.name;
  config.account_id = inputs.account_id;
  config.workers_dev = true;
  config.preview_urls = false;
  config.kv_namespaces = [
    { binding: "WEATHER_CACHE", id: inputs.weather_cache_id },
  ];
  config.d1_databases = [
    {
      binding: "MARKET_DB",
      database_name: "saavirta-markets",
      database_id: inputs.market_database_id,
      migrations_dir: "../../migrations",
    },
  ];
  config.triggers = { crons: ["*/5 * * * *"] };
  config.vars = {
    PUBLIC_MAPTILER_KEY: "",
    WEATHER_PROVIDER_MODE: weatherMode,
    APP_ENV: "production",
    MARKET_MODE: "live",
    COLLECTOR_ENABLED: "true",
    FINGRID_CONTRACT_VERIFIED: "true",
    ENTSOE_CONTRACT_VERIFIED: "true",
    ...pricePermissions,
  };
  config.secrets = { required: ["FINGRID_API_KEY"] };
  config.observability = {
    enabled: true,
    logs: { enabled: true, invocation_logs: false },
    traces: { enabled: false },
  };
  return config;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const outputs = JSON.parse(
    readFileSync(process.argv[2] ?? "infra/outputs.json", "utf8"),
  );
  const built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
  writeFileSync(
    "dist/server/wrangler.production.json",
    JSON.stringify(
      productionConfig(built, outputs.worker_config.value),
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Prepared dist/server/wrangler.production.json. No deployment or secret changes performed.",
  );
}
