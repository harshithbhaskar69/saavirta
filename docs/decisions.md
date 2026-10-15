# Implementation decisions

## Scope and runtime

The approved Forecast Desk design is implemented in `src/`; `.impeccable/preview/` preserves the earlier comparison prototype. Production never imports the prototype forecast fixture. The current Cloudflare vinext scaffold uses the Cloudflare Vite plugin and Wrangler; both development and built preview were tested in workerd. Dependencies are pinned by `package-lock.json`.

Workers KV stores disposable normalized provider snapshots. It is eventually consistent. An in-flight map deduplicates within one isolate only; cross-region cold misses can still call the provider twice. Cache writes are best effort, and the retrieval timestamp is preserved across horizon changes. No claim of global single-flight or historical forecasts is made. Application API responses use `Cache-Control: no-store`.

The upstream adapter requests 192 hourly records, covering 168 elapsed forecast hours plus retention headroom. A horizon starts at the first forecast instant strictly after the request. UTC epoch milliseconds are the internal timestamp unit. Missing values stay `null`, negative solar readings become missing, and real zero irradiance stays zero. Provider response sizes, alignment, units, and overall request time are checked. At most one transient retry is made; 429 is not retried immediately.

Signals are pure calculations: earliest tied minimum/maximum, largest signed three-hour temperature change with four valid consecutive samples, highest positive solar mean, and longest consecutive run of at least two solar intervals ≥100 W/m². The threshold is an exploration heuristic. Partial coverage remains explicit. All-zero and all-missing solar cases are distinct.

### Refresh and comparisons

A manual refresh (`refresh=1`, or `refresh: true` in a private POST) bypasses the 15-minute cache once a snapshot is at least a minute old. The floor, in-flight deduplication and failure backoff keep repeated clicks from multiplying provider calls; polls never bypass. Previously the button re-read the cache, so the retrieval age could not change.

`/api/baselines` is a separate endpoint so the forecast never waits for slower archive APIs; normals and revision fail independently and the UI marks only the missing part. Normals use the Historical Weather API with `era5_seamless` (ERA5-Land temperature, ERA5 irradiance; `era5_land` alone has no irradiance), 10 past years around today's date, keyed by the point's local date and hour so any row can be compared over its own hours. Requests are sequential because bursts of new connections from one client stalled; up to three missing years are tolerated and reported, and a request stops once seven years are out of reach. Revisions use the Single Runs API for ECMWF IFS 9 km: the newest run from the uncounted metadata endpoint, 10 minutes after its availability time, and the same cycle 24 hours earlier. The Previous Runs API was rejected after measurement: its `_previous_day1` repeats the current run for hours more than a day ahead. Normals are cached three days per point and UTC date; revisions per point and run. Comparison requests use a 5-second timeout and log error codes only.

## Location and privacy

Selection precedence is valid URL, opted-in local preference, then welcome. A corrupt shared link is reported instead of silently substituting a saved location. Country flags use genuine country codes returned by search or the labelled example places; arbitrary map and device coordinates do not receive a guessed country or city. Shared location labels are display hints, not verified geocoding results.

Manual locations and horizon/view choices enter browser history. Device locations are session-only unless the user explicitly saves or copies a link. Private weather and comparison POSTs bypass shared KV and isolate caches. Browser query data stays in memory and is not persisted. “Approximate” opens manual city search; the browser cannot promise an approximate permission mode.

Worker logs contain request ID, route name, duration and outcome, without coordinate queries, search text, bodies or keys. Invocation logs and traces are disabled because default request instrumentation can include precise locations. Local Wrangler/Vite access logs may still show development URLs. Before deployment, review account-level log collection and keep this privacy boundary.

## Design and motion

The mineral-green palette, forest temperature line, ochre solar bars and Plex typography are retained. After the retailer review, the forecast reads in decision order: a daily summary table by the point's local calendar day, then inline synchronized hourly plots with Hours to watch and a locator map beside them. The six-card overview and the hourly dialog were removed because they hid the hourly analysis behind a modal and reported only rolling-window totals. Real flag SVGs accompany known cities. Weather conditions use Open-Meteo's modelled current code and day/night flag, not a sensor or the first future forecast hour.

Daily rows are built from local calendar dates, not hour counts, so 23- and 25-hour days, half-hour offsets and zones without a local midnight need no special cases. Instantaneous samples join their timestamp's day; preceding-hour irradiance and rain join the day their hour starts. Irradiance bars are plotted at the midpoint of the hour they average. Value axes sit on the trailing side, matching price-chart convention and keeping one leading edge.

Motion Primitives' Animated Background and Transition Panel are copied/adapted as documented by its manual installation option. The horizon indicator shares a spring layout transition; workspace transitions use 160 ms opacity and a small translation. Forecast values, plots and the condition symbol do not animate. Reduced-motion preference disables the remaining movements and the map recenter animation. Hours-to-watch selection announces the inspected values, while hover does not flood announcements.

The additional six hourly weather variables are validated at the provider boundary. Missing optional context remains null rather than failing the primary forecast. Snapshot/cache and query keys use version 2 for the expanded contract. Daily degree-day, solar-energy and rain totals require every hour of the row. The bases and limits are explicit, and CSV preserves missing cells and UTC instants. [The retailer review](retailer-overview.md) documents findings, formulas, semantics and the next product increment.

The user chose the bundled geographic map for this phase. Natural Earth countries, regions, rivers and selected city labels are local, with visible attribution and the regional detail limit stated. City labels select named points; free selections preserve exact coordinates and use honest nearby-city wording. [Map provenance](map-data.md) records source revision, processing and limitations. MapLibre's module worker is explicitly bundled through Vite's worker URL import; relying on its default relative URL breaks optimized development bundles. Its renderer loads near the viewport to preserve initial forecast responsiveness. MapTiler is optional, not a prerequisite for this local build.

## Markets and deployment

The Delivery desk adds national market forecasts and immutable collected history in D1. A single Durable Object serializes provider collection; dashboard requests read stored data. [Market semantics](markets/README.md) and [operations](markets/operations.md) describe the API, calculations and recovery policy.

Cloudflare Workers serves the application and APIs. Terraform owns persistent resources; Wrangler publishes the tested Worker artifact. Infisical owns secrets. The current public Open-Meteo configuration is non-commercial; commercial use and historical/model-run access require appropriate entitlements. Prices remain gated by access and redistribution permission.
