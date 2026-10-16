# Operations and recovery

Säävirta runs as one Cloudflare Worker with D1, KV and Durable Objects. Terraform owns persistent infrastructure; Wrangler owns the versioned Worker configuration. Work directly on `main`. A push runs secret scanning, lint/types/unit tests, workerd persistence tests, dependency checks, Terraform validation and desktop/mobile E2E against the built Worker. The production job deploys the tested artifact only after every required job passes.

## Releases

Set repository variable `DEPLOY_ENABLED=true` and protect the `production` environment to the main branch. OIDC permissions are restricted to that repository, environment, workflow and ref. `scripts/deploy.mjs` reads Infisical in memory, applies Terraform and additive D1 migrations, synchronizes only the runtime secret allowlist, publishes the Worker and checks hosted health/market responses. Build without secrets. Do not rebuild the artifact in the deployment job.

Local release commands are `npm run build` then `node scripts/deploy.mjs`, after all checks pass. Use `TERRAFORM_BIN` if Terraform is outside PATH. Review changes first with `node scripts/infra.mjs plan`. Keep deployments serialized. For rollback, select a previously verified Worker version with Wrangler; do not automatically reverse database schema changes. Durable Object migration tags are append-only.

## Collection and health

Cloudflare Access protects the Worker and its assets across production and preview URLs. Invited users sign in with an email code for an eight-hour session. To invite or remove someone, edit the JSON array `ACCESS_ALLOWED_EMAILS` in Infisical prod and run the reviewed Terraform plan/apply. For immediate removal, also revoke that user's active Access sessions in Zero Trust. Do not add an Everyone or Bypass policy. The account's Access team and administrators remain platform-managed.

Release probes use a dedicated service token from Infisical, including for `/api/health`. Deployment checks both anonymous denial and authenticated responses. Rotate the verification credential before its one-year expiry; replace its ID in Infisical and apply Terraform before revoking the previous token. There is no public health exception. An unauthenticated API client receives an Access challenge or denial rather than market data.

The singleton collector's schedule and quotas survive Worker deployments. Development collection is disabled by default. Never enable two collectors with the same Fingrid key. API requests cannot cause market refreshes. A cold database returns unavailable/partial sections while scheduled collection warms.

Inspect structured Worker logs for `market-collection`, `market-collection-failed`, `market-collector-unavailable` and `market-request-failed`. Logs include dataset, duration or a safe issue code, never coordinates, tokens or raw provider errors. Check dashboard `lastSuccessfulCheck`, coverage and freshness when diagnosing a source outage. Provider downtime does not disable weather. `/api/health` checks process availability; it is not evidence that every provider is healthy.

Monitor persistent source failures, no new snapshots for 30 minutes, D1 storage/query growth, CPU time, API 429 rates and billing alerts. A shared API budget intentionally sheds load; distributed clients can exhaust it even when individual clients stay below their limits.

## Recovery

D1 Time Travel is always enabled. On Workers Paid it retains 30 days of recovery history, including accidental writes/deletions; this is separate from the application's 30-day row retention. Use [Cloudflare's Time Travel procedure](https://developers.cloudflare.com/d1/reference/time-travel/) to inspect bookmarks and restore. Pause collection first, record the current bookmark, select the intended recovery point and verify snapshot identifiers, original collection times, period values and dashboard output before resuming. A restore replaces current data; retain the undo bookmark.

For portable recovery, use `wrangler d1 export` against the production configuration, storing the SQL only in a private location outside the repository. Restore into a separate local or disposable D1 database with collection disabled and compare table counts and ordered payload checksums. [Import/export instructions](https://developers.cloudflare.com/d1/best-practices/import-export-data/). Inject `CLOUDFLARE_API_TOKEN` from Infisical into the Wrangler process; never put it in arguments or credential files.

The private R2 bucket stores Terraform state and locks. It is not a market-data cache. Keep state access restricted and never commit state or saved plans. D1 and KV have Terraform destruction protection. Removing a resource requires an explicit maintenance decision.

Provider API keys rotate in Infisical, then reach the Worker through the next deployment. Cloud administration tokens never become Worker bindings. [Secrets](secrets.md) describes the allowlist and local workflow.
