# Release gates

| Area | Status | Constraint |
| --- | --- | --- |
| Fingrid | Authenticated samples for 193, 192, 124, 74, 166, 241, 245 and 248 are verified and retained as sanitized fixtures | The measured 241 horizon is not a provider guarantee; never fill missing periods |
| Finland/Åland | Pinned NLS 1:10,000 artifact, checksum, source topology and geographic acceptance verified | Boundaries include administrative waters; the 25m uncertainty band is application policy |
| Prices | Adapter and deterministic A01/A03/no-data tests are present; live prices are disabled | Enable only after REST access, authenticated FI day-ahead contract checks and redistribution/export permission |
| Forecast archive | D1 retains original observed snapshot IDs, collection times and normalized periods | Errors need a qualifying forecast approximately 24 hours earlier; missing history stays unavailable |
| Cloudflare runtime | Worker APIs, D1 transactions and Durable Object scheduling have local and hosted verification | Keep one collector per provider key and monitor quotas, storage and CPU |
| Recovery | Hosted D1 export restored into an isolated database with ordered record checksums | Time Travel and portable export are different recovery paths; verify both when changing storage |
| Dependencies | The vulnerable build-time glob chain is removed; the audit accepts no advisory exceptions | A new advisory or failed audit blocks release; verify the scoped adapter on plugin updates |
| Access | Cloudflare Access protects the Worker with invited-email login and a separate release-verification service credential | Invitations and token rotation are managed through Infisical and Terraform |
| Weather | Current public endpoint is configured for non-commercial use | Commercial operation and historical/model-run access require appropriate entitlements |

[Verification](verification.md) records completed checks; [operations](operations.md) describes ongoing responsibilities. Synthetic browser/demo data is explicitly labelled and never a live-provider fallback.
