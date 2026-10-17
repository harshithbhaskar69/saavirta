import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

export const account = "8e2cf20009daa5e8f59cf38d3ddce77f";
export const project = "8a91d7ba-bb84-4713-9b61-ecb597e25b45";
const identity = "e0755450-dff1-4ff0-bb4b-14505ed56f56";

export async function request(url, token, method = "GET", body) {
  if (typeof token !== "string" || !token || /[\r\n]/.test(token))
    throw new Error("Invalid authentication configuration");
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
  } catch {
    throw new Error(
      "Cloud API connection failed; sensitive details suppressed",
    );
  }
  if (!response.ok)
    throw new Error(`Cloud API request failed (HTTP ${response.status})`);
  return response.status === 204 ? null : response.json();
}

export async function productionSecrets() {
  let secrets;
  if (process.env.GITHUB_ACTIONS === "true") {
    const oidcUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
    if (
      oidcUrl.protocol !== "https:" ||
      !oidcUrl.hostname.endsWith(".actions.githubusercontent.com")
    )
      throw new Error("Unexpected GitHub OIDC endpoint");
    oidcUrl.searchParams.set("audience", "https://app.infisical.com");
    const { value: jwt } = await request(
      oidcUrl,
      process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    );
    const response = await fetch(
      "https://app.infisical.com/api/v1/auth/oidc-auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityId: identity, jwt }),
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      },
    );
    if (!response.ok)
      throw new Error(
        `Infisical OIDC authentication failed (HTTP ${response.status})`,
      );
    const { accessToken } = await response.json();
    const result = await request(
      `https://app.infisical.com/api/v3/secrets/raw?workspaceId=${project}&environment=prod&secretPath=/`,
      accessToken,
    );
    secrets = Object.fromEntries(
      result.secrets.map((secret) => [secret.secretKey, secret.secretValue]),
    );
    for (const value of Object.values(secrets)) {
      if (value)
        console.log(
          `::add-mask::${value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}`,
        );
    }
  } else {
    let output;
    try {
      output = execFileSync(
        "infisical",
        ["export", "--env", "prod", "--format=json", "--silent"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      throw new Error("Infisical access failed; run infisical login");
    }
    try {
      secrets = Object.fromEntries(
        JSON.parse(output).map(({ key, value }) => [key, value]),
      );
    } catch {
      throw new Error(
        "Invalid Infisical response; sensitive details suppressed",
      );
    }
  }
  for (const key of ["CLOUDFLARE_API_TOKEN", "FINGRID_API_KEY"]) {
    if (!secrets[key] || /[\r\n]/.test(secrets[key]))
      throw new Error(`Missing or invalid ${key} in Infisical prod`);
  }
  return secrets;
}

export function cloudflare(secrets, path, method, body) {
  return request(
    `https://api.cloudflare.com/client/v4/${path}`,
    secrets.CLOUDFLARE_API_TOKEN,
    method,
    body,
  );
}
export async function terraformEnvironment(secrets) {
  const { result } = await cloudflare(
    secrets,
    `accounts/${account}/tokens/verify`,
  );
  if (result.status !== "active" || !result.id)
    throw new Error("Cloudflare account token is not active");
  const { result: domain } = await cloudflare(
    secrets,
    `accounts/${account}/workers/subdomain`,
  );
  const { result: workers } = await cloudflare(
    secrets,
    `accounts/${account}/workers/workers`,
  );
  const worker = workers.find((item) => item.name === "www");
  if (
    !worker?.id ||
    !secrets.ACCESS_ALLOWED_EMAILS ||
    !secrets.ACCESS_SERVICE_TOKEN_ID
  )
    throw new Error(
      "Configure the existing Worker and Access settings in Infisical prod first",
    );
  const environment = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: secrets.CLOUDFLARE_API_TOKEN,
    AWS_ACCESS_KEY_ID: result.id,
    AWS_SECRET_ACCESS_KEY: createHash("sha256")
      .update(secrets.CLOUDFLARE_API_TOKEN)
      .digest("hex"),
    AWS_REGION: "auto",
    TF_VAR_cloudflare_account_id: account,
    TF_VAR_workers_subdomain: domain.subdomain,
    TF_VAR_access_worker_id: worker.id,
    TF_VAR_access_allowed_emails: secrets.ACCESS_ALLOWED_EMAILS,
    TF_VAR_access_service_token_id: secrets.ACCESS_SERVICE_TOKEN_ID,
    TF_IN_AUTOMATION: "1",
    TF_INPUT: "0",
  };
  delete environment.TF_LOG;
  delete environment.TF_LOG_PATH;
  if (process.env.GITHUB_ACTIONS === "true")
    console.log(`::add-mask::${environment.AWS_SECRET_ACCESS_KEY}`);
  return environment;
}

export function run(
  command,
  args,
  { env = process.env, input, capture = false } = {},
) {
  const result = spawnSync(command, args, {
    env,
    input,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: [
      input === undefined ? "ignore" : "pipe",
      capture ? "pipe" : "inherit",
      capture ? "pipe" : "inherit",
    ],
  });
  if (result.status !== 0)
    throw new Error(
      `${command} failed; captured output withheld when it may contain credentials`,
    );
  return result.stdout;
}

export function runtimeSecrets(secrets) {
  return Object.fromEntries(
    ["FINGRID_API_KEY", "ENTSOE_API_TOKEN", "OPEN_METEO_API_KEY"]
      .filter(
        (name) => typeof secrets[name] === "string" && secrets[name].length > 0,
      )
      .map((name) => [name, secrets[name]]),
  );
}
