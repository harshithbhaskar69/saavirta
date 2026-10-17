# Verification — 16 October 2026

The application uses deterministic unit/browser fixtures and separate authenticated provider evidence. Fixture success does not establish live provider coverage or price rights.

| Check | Evidence |
| --- | --- |
| Domain and API | Strict TypeScript, lint and 111 unit checks cover Helsinki DST (92/100 quarters), power/energy units, missing data, cutoff-safe metrics, expiry, privacy, response headers and independent source failures |
| Geography | Pinned NLS checksum, Finnish/Åland/foreign points, real-border offsets, holes and disconnected geometry pass |
| Provider decoding | Captured authenticated Fingrid pagination and all eight datasets pass; synthetic XML covers A01/A03, gaps, negative prices, units, contract filters and acknowledgements |
| Persistence and runtime | Workerd tests pass native provider transport, D1 transactional rollback, immutable vintage selection, persistence across restart and logical restore; collector schedule and provider budgets persist |
| Browser | All 62 desktop/mobile E2E cases pass against the built Worker, including unique script nonces, uncacheable HTML, CSP-compatible hydration and map loading; hosted real-data checks also cover both themes, keyboard inspection, workspace navigation and axe |
| Access | Anonymous app/API requests and forged identity headers are rejected; the dedicated verification credential succeeds. The invited owner confirmed email-code login works |
| Hosted API | A deployed Worker reads real D1 periods, validates the shared response schema, verifies residual-load arithmetic, labels Åland SE3 and rejects outside geography |
| Scheduled collection | All eight Fingrid datasets refreshed successfully on Cloudflare at 22:41 UTC on 15 October; four new immutable forecast snapshots were stored in D1 |
| Portable recovery | A hosted D1 export of 136 snapshots, 3,357 periods and eight check records restored into an isolated database; ordered record checksums matched |
| Infrastructure | Terraform formatting/validation and all five plan tests pass; the hosted Cloudflare resource plan reports no changes |
| Secret isolation | Exact-value scanning of 847 source/build files found no production credentials on 16 October; deployment restricts Worker secrets to the provider allowlist |
| Dependencies | Clean install and npm audit report no known vulnerabilities; scoped glob-adapter compatibility, fail-closed audit tests and runtime bundle exclusion pass. No advisory exception remains |

Authenticated Fingrid captures were acquired on 15 October 2026 around 12:34–12:37 UTC and are attributed in [provider fixtures](../../tests/fixtures/markets/providers/README.md). Observed future coverage was 71h45m for the captured forecasts; this is a sample, not a horizon guarantee. Genuine archive collection began at 12:44 UTC that day. Collection time is never presented as official forecast issuance.

## ENTSO-E verification — 17 October 2026

Infisical prod `ENTSOE_API_TOKEN` successfully authenticated against the production REST API. The application adapter decoded FI A44/A01 prices in EUR/MWh: 192 quarter-hour intervals for the current collector window, 48 hourly intervals for the August 2025 history request, and zero intervals for an unpublished date. Provider publication days extend beyond Helsinki request boundaries; the interval-selection tests cover this alignment. [Response fixtures](../../tests/fixtures/markets/providers/README.md) retain the captured structure with all prices replaced by synthetic values.

Caching/display and export permission remain unverified, so production price collection and display stay disabled. [Remaining gate](entsoe.md). Browser checks use Chrome desktop/mobile emulation, not physical iOS/Safari. These checks are not a penetration test or a sustained load test.
