# Repository workflow

Work directly on `main` in this checkout, as requested by the user. Do not create
feature branches or worktrees unless the user explicitly changes that preference.
Leave changes uncommitted unless a commit is requested. The user has authorized
the initial public repository, meaningful history rewrite and live deployment.

Production runs entirely on Cloudflare: Workers, D1, KV, Durable Objects and
Cron. Terraform owns persistent resources; Wrangler deploys tested Worker
artifacts and bindings. Keep provider credentials out of source, Terraform inputs
and logs. Demonstration mode is synthetic; live mode uses authenticated Fingrid data.

All real secrets belong in the Säävirta Infisical project linked by
`.infisical.yaml`. Inject them into processes with `infisical run`; never write
`.env`, `.dev.vars`, credential exports or secret values in command arguments.
Development uses `dev`, including on `main`; production is selected explicitly.
