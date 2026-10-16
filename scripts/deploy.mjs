import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import {
  productionSecrets,
  terraformEnvironment,
  run,
  cloudflare,
  runtimeSecrets,
  account,
} from "./cloud-auth.mjs";
import { productionConfig } from "./prepare-worker-deploy.mjs";
import { accessHeaders } from "./access-headers.mjs";

try {
  const secrets = await productionSecrets(),
    environment = await terraformEnvironment(secrets);
  const headers = accessHeaders(secrets);
  const terraform = process.env.TERRAFORM_BIN ?? "terraform";
  const tf = (args, capture = false) =>
    run(terraform, ["-chdir=infra", ...args], { env: environment, capture });
  tf(["init", "-input=false", "-reconfigure", "-backend-config=backend.hcl"]);
  tf(["apply", "-auto-approve", "-input=false"]);
  const inputs = JSON.parse(tf(["output", "-json"], true)).worker_config.value;
  const config = productionConfig(
    JSON.parse(readFileSync("dist/server/wrangler.json", "utf8")),
    inputs,
    secrets,
  );
  const runtime = runtimeSecrets(secrets);
  config.secrets.required = Object.keys(runtime);
  writeFileSync(
    "dist/server/wrangler.production.json",
    JSON.stringify(config, null, 2) + "\n",
  );
  const wrangler = ["--config", "dist/server/wrangler.production.json"];
  run(
    "npx",
    [
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "MARKET_DB",
      "--remote",
      ...wrangler,
    ],
    { env: environment },
  );
  // Only provider credentials reach the Worker; account tokens stay in the deployer.
  for (const [name, value] of Object.entries(runtime))
    await cloudflare(
      secrets,
      `accounts/${account}/workers/scripts/${inputs.name}/secrets`,
      "PUT",
      { name, text: value, type: "secret_text" },
    );
  run("npx", ["wrangler", "deploy", ...wrangler], {
    env: { ...environment, ...runtime },
  });
  let healthy = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await fetch(`${inputs.workers_dev_url}/api/health`, {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (
        response.ok &&
        response.headers.get("x-content-type-options") === "nosniff"
      ) {
        healthy = true;
        break;
      }
    } catch {
      /* Allow edge propagation without exposing network details. */
    }
    await setTimeout(5000);
  }
  if (!healthy)
    throw new Error(
      "Worker deployed but authenticated health verification failed",
    );
  run("node", ["scripts/smoke-markets.mjs"], {
    env: {
      ...process.env,
      SMOKE_BASE_URL: inputs.workers_dev_url,
      ACCESS_CLIENT_ID: secrets.ACCESS_CLIENT_ID,
      ACCESS_CLIENT_SECRET: secrets.ACCESS_CLIENT_SECRET,
    },
  });
  console.log(`Live: ${inputs.workers_dev_url}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
