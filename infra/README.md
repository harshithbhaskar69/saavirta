# Cloudflare infrastructure

Terraform owns the D1 market database in EU jurisdiction, weather KV and the Access application, email identity provider and reusable policies. `infra/state` bootstraps the private R2 remote-state bucket. State uses locking over R2's S3-compatible protocol; no AWS service is involved. Wrangler publishes the tested Worker artifact, bindings, Durable Object migrations, rate limiter and Cron configuration. The protected Worker is `www` under the account's existing workers.dev subdomain.

## Credentials and resources

Production deployment reads credentials from Infisical `prod`, path `/`. Scope the Cloudflare token to this account's Workers, Durable Objects, D1, KV, R2 and Access resources. Configure `ACCESS_ALLOWED_EMAILS` and `ACCESS_SERVICE_TOKEN_ID` there; the deployment looks up the existing Worker's immutable ID. The verification client ID/secret stay in the deployment process, outside Terraform state. GitHub uses repository/environment/ref-bound OIDC; local deployment uses the authenticated CLI. Provider keys are injected directly as Worker secrets. [Credential setup](../docs/markets/secrets.md).

`node scripts/infra.mjs plan` reviews infrastructure, `node scripts/infra.mjs apply` applies it, and `node scripts/infra.mjs outputs` prints only non-secret Worker binding identifiers. Set `TERRAFORM_BIN` if needed. Backend configuration is in `backend.hcl`; protect private state and saved plans. KV and D1 have `prevent_destroy`.

For a new installation, first create/import the private R2 bucket using `infra/state` with Infisical credentials in process environment, then configure `backend.hcl` for that account. Activate Zero Trust, create the initial `www` Worker, and save the invitation list and release-verification service credential in Infisical. Apply the main configuration, build and test the Worker, and run `node scripts/deploy.mjs`. Access protects the entire Worker, including previews. Database schema files are additive. Production deployment applies them before publishing the tested artifact. Provider collection starts on the Cron watchdog; a new database warms asynchronously.

## Operation

D1 stores 30 days of market periods and observed forecast snapshots. One SQLite Durable Object, named `fi`, coordinates the provider key and persists scheduling/quota state. KV only caches weather. Keep collectors disabled in other environments that share the production Fingrid key.

D1 Time Travel provides platform-managed recovery; portable exports support isolated restore drills. [Operations and recovery](../docs/markets/operations.md). Terraform state is not the forecast archive.

The deployment uses Workers Paid. Requests, CPU, D1 rows/storage and Durable Object usage are metered; billing alerts and provider quotas remain necessary. See [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). Do not treat the base subscription as a guaranteed total bill.
