# Verification — 16 October 2026

The application uses deterministic unit/browser fixtures and separate authenticated provider evidence. Fixture success does not establish live provider coverage or price rights.

| Check | Evidence |
| --- | --- |
| Domain and API | Strict TypeScript, lint and 108 unit checks cover Helsinki DST (92/100 quarters), power/energy units, missing data, cutoff-safe metrics, expiry, privacy and independent source failures |
| Geography | Pinned NLS checksum, Finnish/Åland/foreign points, real-border offsets, holes and disconnected geometry pass |
| Provider decoding | Captured authenticated Fingrid pagination and all eight datasets pass; synthetic XML covers A01/A03, gaps, negative prices, units, contract filters and acknowledgements |
| Persistence and runtime | Workerd tests pass native provider transport, D1 transactional rollback, immutable vintage selection, persistence across restart and logical restore; collector schedule and provider budgets persist |
| Browser | All 60 desktop/mobile E2E cases pass; hosted real-data checks pass both themes, keyboard inspection, workspace navigation and axe |
| Hosted API | A deployed Worker reads real D1 periods, validates the shared response schema, verifies residual-load arithmetic, labels Åland SE3 and rejects outside geography |
| Scheduled collection | All eight Fingrid datasets refreshed successfully on Cloudflare at 22:41 UTC on 15 October; four new immutable forecast snapshots were stored in D1 |
| Portable recovery | A hosted D1 export of 136 snapshots, 3,357 periods and eight check records restored into an isolated database; ordered record checksums matched |
| Infrastructure | Terraform formatting/validation and all three plan tests pass; the hosted Cloudflare resource plan reports no changes |
| Secret isolation | Exact-value scanning of 847 source/build files found no production credentials; the Worker contains the Fingrid provider secret only |
| Dependencies | Fresh npm audit reports only the documented build-tool advisory; runtime bundle exclusion passes |

Authenticated Fingrid captures were acquired on 15 October 2026 around 12:34–12:37 UTC and are attributed in [provider fixtures](../../tests/fixtures/markets/providers/README.md). Observed future coverage was 71h45m for the captured forecasts; this is a sample, not a horizon guarantee. Genuine archive collection began at 12:44 UTC that day. Collection time is never presented as official forecast issuance.

ENTSO-E authentication and redistribution/export permission remain unverified, so production prices stay unavailable. Browser checks use Chrome desktop/mobile emulation, not physical iOS/Safari. These checks are not a penetration test or a sustained load test.
