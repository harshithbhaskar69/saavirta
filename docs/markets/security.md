# Release dependency assessment — 16 October 2026

`npm audit --omit=dev` reports seven high-severity package entries from one root advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affecting braces through 3.0.3. The official advisory and npm registry still list no patched braces version. vinext 1.2.0 still depends on the same CommonJS build plugin, so updating vinext alone would not fix it. npm's suggested old vinext downgrade is not an acceptable remediation.

Installed path: `vinext → vite-plugin-commonjs → vite-plugin-dynamic-import → fast-glob → micromatch → braces`. Source inspection locates the CommonJS plugin in vinext's Vite plugin entry. Application request handlers do not consume user-supplied glob patterns. `build-safety.ts` now fails builds if these dependencies enter any generated chunk's module graph or external imports, and emits `runtime-dependency-check.json` for each built environment. The tests verify both bundled and external detection. This bounds runtime exposure for the current build; it does **not** patch the npm dependency or claim a clean audit.

Keep build machines and source/config inputs trusted, never expose a Vite dev server publicly, and ship only the generated Worker assets, not the development server or node_modules. Recheck the advisory and the bundle guard on every dependency update. A new runtime inclusion is a release failure. The remaining build-tool advisory is recorded explicitly rather than hidden in an audit ignore list.

## Runtime and release controls

The single build-tool npm exception expires on 1 November 2026. Every other advisory blocks deployment. Recheck the advisory and runtime bundle guard on each dependency update; this is a bounded exception, not a patched dependency.

The Worker enforces per-client limits and persistent global budgets: 240 public API requests/minute, 6,000/hour, 40,000/day and 600,000/month. Open-Meteo has a separate weighted budget of 120/minute, 1,000/hour, 6,000/day and 100,000/month. Counters are atomic and survive restarts. Every outgoing weather attempt reserves capacity. A failed budget service blocks requests. Distributed clients can still exhaust a shared budget and temporarily deny service.

Market APIs only read D1; users cannot trigger Fingrid/ENTSO-E calls. The collector persists rolling quotas, spacing and cooldowns. Fixed provider hosts, redirect rejection, deadlines, body limits, bounded pagination, finite-number validation and parameterized SQL protect trust boundaries. The API validates geography and date ranges server-side. XML declarations/entities are rejected. Errors expose safe codes and request IDs only.

Device coordinates remain in bounded POST bodies, outside shared caches, URLs, D1 and logs. Traces are disabled to avoid logging upstream token query strings. Responses use security headers. The Worker has no public administrative collection or database endpoint.

Infisical owns secrets. GitHub uses workflow/environment/ref-bound OIDC; only provider credentials reach Worker secrets. Builds have no provider credentials and CI scans source history. D1 is restricted to EU jurisdiction, accessed through the Worker binding or authorized Cloudflare administration. Terraform state is in a private R2 bucket. These are implementation and verification controls, not a claim of penetration testing or guaranteed provider correctness.
