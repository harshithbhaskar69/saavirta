# Authenticated Fingrid captures, 15 October 2026

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
