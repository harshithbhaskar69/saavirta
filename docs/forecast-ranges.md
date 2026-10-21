# Weather forecast ranges

**Forecast range** is opt-in on the Weather desk. It adds hourly temperature and irradiance bands, median readouts, and daily HDD, CDD and horizontal solar-energy ranges. The existing point forecast remains a separate series. It may come from a different model and need not lie inside the ensemble band.

## Meaning and calculation

The source is Open-Meteo's [Ensemble API](https://open-meteo.com/en/docs/ensemble-api), pinned to `ecmwf_ifs025`: 51 ECMWF IFS members including the control. P10, P50 and P90 are sample quantiles (ranks 6, 26 and 46 for 51 values). The shaded band is the central 80% of this model distribution. **It is not a verified 80% prediction interval for real outcomes.** A revision inside the band is not a significance test.

- Temperature is an instantaneous sample. Irradiance is the preceding hour's mean in W/m². The provider interpolates the native three-hour output to hourly steps; this does not create independent hourly predictions.
- For each member, HDD = Σ max(18 − temperature, 0) / 24; CDD = Σ max(temperature − 22, 0) / 24. Solar energy = Σ irradiance / 1000, in kWh/m². Take percentiles only after calculating each member's total.
- Days use the selected point's IANA timezone and the same forecast window as the point forecast. Partial days remain partial. Helsinki DST days contain 23 or 25 hours. A midnight irradiance value belongs to the preceding day.
- Every range requires all 51 members. A missing hourly member withholds that hour's range and the affected daily total; zero solar at night is valid. Hourly tables and exports retain missing values.
- These are point estimates, not national weather aggregates, turbine-height wind, PV output or portfolio demand. Consumption uncertainty is not included.

## API and operations

`GET /api/uncertainty?lat=…&lon=…&start=…&horizon=48h` uses the displayed forecast's first UTC timestamp in milliseconds and `24h`, `48h` or `7d`. Start must be within two hours before to one hour after the current time. Private/device coordinates use `POST /api/uncertainty` with `{latitude, longitude, start, horizon}` in a bounded JSON body; these requests never enter shared caches or coordinate URLs. Responses use `Cache-Control: no-store` and the existing Access, API rate and provider-budget protections.

The Worker fetches two variables and 193 hourly timestamps. Validated member trajectories share the existing weather KV binding across horizons for one point; they are fresh for one hour, with a six-hour maximum fallback during failure. The UI identifies older retrievals and continues to show the point forecast if the ensemble is unavailable. No ensemble call happens until the user enables the control.

The latest-ensemble response does not identify the model run. Cache keys therefore identify the model, provider mode and point, and data is labelled **retrieved at**, not issued at or a named run. A processing duration is not an issue time. Concurrent cold requests can each call upstream; the persistent budget charges every attempt, including retries, rather than sharing request-owned I/O promises between Worker invocations.

Two variables × 51 members cost 10.2 equivalent API calls under the provider's [member-based accounting](https://open-meteo.com/en/pricing); the guard reserves 11 per attempt. All weather calls share the existing conservative quota, so increased ensemble use can limit other weather refreshes; cached responses remain usable. Commercial use needs an ensemble-capable plan (currently Professional or higher), `WEATHER_PROVIDER_MODE=customer` and an Infisical-managed API key. The public endpoint is for non-commercial evaluation.

## Verification limits

A live public Helsinki response was checked for 51 members, units, timestamps and coverage. Automated tests use explicitly synthetic member trajectories, including missing values and DST. Actual-outcome coverage, bias and reliability have not been measured. Calibrating the bands requires archived ensembles and matched observations across enough locations, seasons and forecast leads; neither that archive nor a calibration claim is part of this feature.

Local verification on 21 October 2026: lint, TypeScript, 125 unit tests, 14 runtime/script tests, a production Worker build and all 78 desktop/mobile browser cases passed. The browser cases cover keyboard inspection, table/CSV output, both themes with axe, private POSTs, failure/partial/stale ranges, request validation and existing weather/market behavior. A live request through the local Worker returned 51-member Helsinki ranges and reused the same retrieval across 48h and 24h horizons. This verifies the local build and public provider path, not a deployed release or a paid customer subscription.
