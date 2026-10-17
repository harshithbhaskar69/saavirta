# Secret management

All real secrets belong in the Säävirta Infisical project referenced by `.infisical.yaml`. Use the CLI login backed by the operating-system keyring. Never create `.env`, `.dev.vars`, credential exports, secret Terraform inputs or secret command arguments.

Development selects `dev`, path `/`; production is explicitly `prod`, path `/`. Builds and ordinary tests need no credentials. `npm run dev:secrets` and `npm run preview:secrets` inject development secrets into processes. Collection remains disabled unless deliberately configured with a separate provider subscription.

| Secret | Destination |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Deployment process only; account-scoped Workers, Durable Objects, D1, KV, private R2 and Access management |
| `ACCESS_CLIENT_ID`, `ACCESS_CLIENT_SECRET` | Deployment checks only; a dedicated Cloudflare Access service token, never a Worker binding or Terraform input |
| `FINGRID_API_KEY` | Worker secret used only by the market collector |
| `ENTSOE_API_TOKEN` | Worker secret used only by the market collector; required when price collection/display is enabled |
| `OPEN_METEO_API_KEY` | Optional Worker secret for an entitled weather plan |
| `NLS_API_KEY` | Offline authoritative-boundary acquisition only |

The production runtime allowlist is in `scripts/cloud-auth.mjs`. Extra Infisical values are never automatically sent to the Worker. Secret names may be declared in Wrangler; their values are absent from source and build artifacts. Automatic request traces are disabled because upstream query strings can contain provider credentials.

ENTSO-E REST authentication and the FI day-ahead response contract were verified on 17 October 2026. Following the operator's confirmation of reuse permission, Infisical prod holds `PRICE_REDISPLAY_ALLOWED=true` and `PRICE_EXPORT_ALLOWED=true`. These are non-secret deployment settings; they enable scheduled collection/display and CSV price export respectively. Both default to `false` when absent. New deployments must obtain their own permission before setting them. Deployment rejects invalid switches, display without a token, and export without display permission. See [price verification and permission scope](entsoe.md).

Infisical prod also holds Access configuration: `ACCESS_ALLOWED_EMAILS` is a JSON array of invited addresses, and `ACCESS_SERVICE_TOKEN_ID` is the UUID of the verification service token. These are Terraform inputs; the client secret is not. Create the named token in Cloudflare Zero Trust, then save its ID, client ID and client secret directly in Infisical. Rotate it before expiry, apply the new token ID, verify deployment checks, then revoke the old token. The current token has a one-year lifetime.

The current weather use is non-commercial evaluation. Before business use, obtain the appropriate Open-Meteo plan and set `WEATHER_PROVIDER_MODE=customer` with `OPEN_METEO_API_KEY` in prod. Deployment validates the selected mode and requires a key for customer mode. Historical and model-run entitlements still need separate verification against the purchased plan.

GitHub Actions exchanges an OIDC identity for short-lived Infisical access. The identity is bound to the immutable repository identity, `production` environment, `refs/heads/main`, and `.github/workflows/release.yml`. Do not grant this identity to pull-request jobs. Secrets are masked in Actions output; deployment errors suppress raw credential-bearing responses. Local commands capture the authenticated CLI response in memory.

Terraform provider credentials come from process environment, outside Terraform variables and outputs. R2 uses the S3 protocol and corresponding `AWS_*` environment variable names; no AWS service is involved. Private state and lock files remain access-controlled.
