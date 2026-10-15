# Secret management

All real secrets belong in the Säävirta Infisical project referenced by `.infisical.yaml`. Use the CLI login backed by the operating-system keyring. Never create `.env`, `.dev.vars`, credential exports, secret Terraform inputs or secret command arguments.

Development selects `dev`, path `/`; production is explicitly `prod`, path `/`. Builds and ordinary tests need no credentials. `npm run dev:secrets` and `npm run preview:secrets` inject development secrets into processes. Collection remains disabled unless deliberately configured with a separate provider subscription.

| Secret | Destination |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Deployment process only; account-scoped Workers, Durable Objects, D1, KV and private R2 management |
| `FINGRID_API_KEY` | Worker secret used only by the market collector |
| `ENTSOE_TOKEN` | Optional Worker secret; prices still require verified contract and redistribution switches |
| `OPEN_METEO_API_KEY` | Optional Worker secret for an entitled weather plan |
| `NLS_API_KEY` | Offline authoritative-boundary acquisition only |

The production runtime allowlist is in `scripts/cloud-auth.mjs`. Extra Infisical values are never automatically sent to the Worker. Secret names may be declared in Wrangler; their values are absent from source and build artifacts. Automatic request traces are disabled because upstream query strings can contain provider credentials.

GitHub Actions exchanges an OIDC identity for short-lived Infisical access. The identity is bound to the immutable repository identity, `production` environment, `refs/heads/main`, and `.github/workflows/release.yml`. Do not grant this identity to pull-request jobs. Secrets are masked in Actions output; deployment errors suppress raw credential-bearing responses. Local commands capture the authenticated CLI response in memory.

Terraform provider credentials come from process environment, outside Terraform variables and outputs. R2 uses the S3 protocol and corresponding `AWS_*` environment variable names; no AWS service is involved. Private state and lock files remain access-controlled.
