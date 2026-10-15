# Finnish Energy Markets

The Delivery desk aligns Finnish demand, generation plans, wind and solar forecasts, published prices and selected-point weather by delivery period. Live fundamentals come from Fingrid. ENTSO-E prices are independently gated by access and redistribution permission.

## Ownership

- `src/server/markets`: provider adapters, UTC delivery intervals, analytics, geography, D1 storage and the scheduled collector.
- `src/features/markets`: Zod contracts, separately loaded market workspace, charts, accessible tables and display logic.
- `src/lib`: existing point-weather normalization, caching, normals and model-run comparisons.
- `migrations`: additive D1 schema changes.

Market requests read national data already in D1. They cannot invoke collection. Coordinates are validated on every request, never persisted, and remain in bounded POST bodies for device selections. All market responses are `no-store`; weather retains its separate KV cache.

## Time and data meaning

Delivery periods are UTC half-open intervals `[start,end)`. Calendar dates use `Europe/Helsinki`; the 2026 spring and autumn transitions contain 92 and 100 quarter-hours. Repeated local times show offsets. Power is duration-weighted: four quarters at 1,000 MW integrate to 1,000 MWh. Fingrid MWh/h is power, equivalent to MW. Missing values remain null, and incomplete bins withhold averages.

Datasets 193 and 192 provide current three-minute consumption/production readings. Dataset 124 provides consumption interval averages; 74 provides production averages. Forecast datasets are consumption 166, production plans 241, wind 245 and solar 248. Native start/end boundaries are retained. Catalogue metadata describes each source's units; sanitized authenticated examples are in [provider fixtures](../../tests/fixtures/markets/providers/README.md).

Price decoding validates FI domains, EUR/MWh and the day-ahead contract. It supports hourly and quarter-hour periods, A01 points and A03 blocks. Blocks never cross missing publication periods. Prices preserve native intervals in the default view; hourly summaries are explicitly time-weighted. A daily average requires complete coverage, otherwise it is a published-period average. No-data acknowledgements never become zero prices.

The UTC cursor coordinates point weather without inventing quarter-hour weather observations. Temperature and wind retain sample times; irradiance retains its preceding-hour mean. Local wind is neither national turbine-height wind nor national renewable production.

## Derived metrics

| Metric | Calculation and baseline | Interpretation |
| --- | --- | --- |
| Forecast residual load | Consumption 166 minus wind 245 minus solar 248, using aligned non-missing forecasts | Demand remaining after forecast wind and solar; excludes other generation, storage, interconnectors and portfolio positions |
| Consumption error | Actual 124 minus the latest 166 snapshot collected at or before delivery start minus 24 hours, within a 30-minute tolerance | Error against a previously observed forecast; completed actual periods only, never a later forecast |
| Observed forecast revision | Latest consumption, wind or solar forecast minus the latest snapshot at or before one hour earlier, within a 30-minute tolerance | Change between collected snapshots; not necessarily a named provider model run |

Percentage error divides by the archived forecast; a zero denominator is unavailable. Calculations run at quarter-hour resolution before hourly aggregation. Missing inputs withhold results. Without an eligible snapshot the result says **history collecting**. Each interval identifies its input snapshots and collection times.

Collection time is an observed vintage, not an official issuance time. Unknown publication times remain null. Fingrid's wind forecast incorporates day-ahead price effects, so a wind/price relationship cannot establish independent causation. These indicators do not estimate retailer imbalance, procurement quantities or prices.

## Collection and reliability

One `MarketCollector` Durable Object, named `fi`, owns the provider key. Persisted jobs and alarms schedule refreshes; a five-minute Cron trigger restores an absent alarm. A watchdog and idempotent snapshot writes handle interrupted executions. No browser route exposes collector methods.

Telemetry refreshes every three minutes; interval actuals and forecasts every 15 minutes. Price checks accelerate to five minutes from 13:50–16:00 Helsinki while the next day is incomplete; complete next-day publications are rechecked hourly. The preceding seven days reconcile daily. D1 stores periods, per-series provenance/issues, and immutable snapshots with 30-day retention.

Fingrid requests wait 2.5 seconds after the preceding response. Persisted rolling budgets cap requests at 9,000/day, below the provider's 10,000 allowance. Requests time out after eight seconds, with at most one transient retry. Authentication failures pause that provider for an hour; throttling respects `Retry-After`. Fixed hosts, bounded payloads and pagination prevent arbitrary requests. Malformed/empty responses leave valid stored data intact.

Freshness and availability are independent. Telemetry is delayed after six minutes and unavailable after 15. Forecasts are stale after 20 minutes and expire after two hours; historic actuals and published prices remain available with provenance. Server-supplied deadlines also age an already-open browser during outages. Independent failures yield partial dashboards; no usable sections yields HTTP 503.

## Verification and examples

[OpenAPI](openapi.json) is generated from the same Zod schemas used by the UI. Unit tests cover DST, arithmetic, cutoff selection, geography and provider decoding. Workerd tests exercise real D1 transactions, restart persistence, logical recovery and collector scheduling. Browser tests use explicitly synthetic deterministic fixtures. `npm run markets:demo` also uses mathematical synthetic values with no real-data input and cannot run in production.

[Geography](geography.md) · [Operations](operations.md) · [Release gates](release-gates.md) · [Verification](verification.md)
