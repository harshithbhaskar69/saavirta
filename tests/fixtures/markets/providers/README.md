# Provider fixtures

## Authenticated Fingrid captures, 15 October 2026

These are **real provider responses**, not synthetic data. The eight
`fingrid-*.json` files were collected at approximately 12:34 UTC with the
authenticated API adapter. Current telemetry covers the preceding 15 minutes;
actuals query seven days; forecasts query the next 72 hours. Snapshot collection
time is not an official forecast issue time.

`pagination-124-1.json` and `pagination-124-2.json` were collected at approximately
12:37 UTC for 14 October 00:00–24:00 UTC, requesting 50 rows/page. Page two omits
`total`, `lastPage`, `nextPage`, and `prevPage`. Tests must preserve this real
contract and reject a truncated second page. There are 96 contiguous quarters.

Only reviewed JSON bodies are stored: dataset IDs, interval boundaries, values
and pagination. No request headers, URLs or credentials. Authenticated catalog
metadata confirmed active status, MW for 193/192/166/241 and MWh/h for
124/74/245/248. MWh/h normalizes dimensionally to MW; it is not period energy.

Historical three-minute telemetry can contain overlapping periods. The adapter
rejects those batches; historical demand uses dataset 124 instead. Missing
telemetry stays unavailable. The observed 241 horizon in this capture is
71h45m of complete future quarters; that is not a provider horizon guarantee.

Source: [Fingrid Open Data](https://data.fingrid.fi/en/datasets), retrieved
2026-10-15. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## ENTSO-E response structure, 17 October 2026

The three `entsoe-*.xml` files preserve authenticated response structure,
timestamps, resolutions and A03 positions. **All price amounts are synthetic
replacements**, and document/participant identifiers are sanitized. These files
are contract fixtures, not historical market-price evidence. Tokens, headers,
request URLs and original price amounts are not retained.

Captured at 10:45 UTC using A44, Finland `10YFI-1--------U` in both domains and
`contract_MarketAgreement.type=A01`:

| Fixture | Requested UTC interval | Observed response |
| --- | --- | --- |
| `entsoe-quarter-hour.xml` | 2026-10-16 21:00 through 2026-10-19 21:00 | 192 expanded quarter-hours, from 15 October 22:00 through 17 October 22:00 |
| `entsoe-hourly.xml` | 2025-07-31 21:00 through 2025-08-01 21:00 | 48 hourly periods, from 30 July 22:00 through 1 August 22:00 |
| `entsoe-unpublished.xml` | 2026-10-19 21:00 through 2026-10-20 21:00 | HTTP 200, acknowledgement 999, no matching data |

Both price responses declare EUR/MWh and the day-ahead A01 contract. Their
publication-day boundaries differ from Helsinki midnight; tests select the
requested Helsinki day using UTC intervals. Retrieval time is not publication
time, and absent future prices remain gaps.

Source: [ENTSO-E Transparency Platform REST API](https://transparencyplatform.zendesk.com/hc/en-us/articles/15692855254548-Sitemap-for-Restful-API-Integration).
Redisplay and exports remain gated independently of successful authentication.
