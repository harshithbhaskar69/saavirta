# Säävirta

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Implemented: vinext App Router, React, strict TypeScript, Tailwind, accessible Radix dialog primitives, Recharts, TanStack Query, Motion Primitives, and MapLibre. The Cloudflare Vite plugin runs the app in workerd. Wrangler manages local preview and production deployment. Workers KV caches weather. TypeScript server modules own market ingestion, normalization and analytics, with D1 forecast history and a Durable Object collector.

The current deliverable is the running local full-stack application, based on the approved browser design, PLAN.md and the subsequent Finnish Energy Markets expansion. Live development uses authenticated Fingrid data and verified NLS Finland/Åland boundaries, with runtime secrets supplied by Infisical. The separate demonstration is explicitly synthetic. ENTSO-E access, price permissions, forecast archive warm-up and hosted verification remain release gates. The isolated HTML/CSS/JavaScript review prototype remains reference material. Nothing has been deployed.

## Users

Electricity retailer analysts inspecting hourly weather globally and comparing Finland's electricity fundamentals and published day-ahead prices by delivery period.

## Product Purpose

Help an analyst understand what weather and electricity forecasts show, when important changes occur, where the data applies, and how fresh and complete it is.

## Positioning

A daily summary by local day answers first, in two boxes. Temperature: range, degree days, difference from normal and revision since the previous model run. Solar: energy, peak hour, difference from normal, revision and cloud. Inline hourly temperature and irradiance plots share one cursor with explainable hours to watch. Geographic point selection stays deliberate. Trading execution, calibrated load and price prediction remain outside the current product.

The Energy Markets Delivery desk adds synchronized demand, generation, wind/solar forecast and price charts with a delivery-period inspector. Point weather remains clearly labelled context. Three transparent metrics describe residual load, consumption error against an earlier collected forecast, and observed forecast revisions; they do not imply portfolio costs or trading recommendations.

## Operating Context

Desktop is the main analysis surface. Mobile must support the same location selection and inspection tasks. Weather follows the point's local calendar day; markets use Helsinki delivery dates and UTC intervals, including daylight-saving transitions. Analysis stays visible rather than behind a dialog. Geography must be checked against the selected coordinates, not inferred from a device label.

## Capabilities and Constraints

- Default 48-hour forecast, with 24-hour and seven-day horizons.
- Global city search, point selection on a map, and optional user-initiated geolocation.
- First visit offers search, map, and geolocation without requesting permission on load.
- Precise and approximate location semantics must be honest. Device coordinates are not silently persisted or shared. Device labels use the nearest bundled city within 25 km ("Near Helsinki"), without changing the forecast point or claiming an address/country match. The lookup runs locally; coordinates are the fallback if there is no nearby city or the bundled asset is unavailable.
- Temperature in degrees Celsius and global horizontal shortwave irradiance in watts per square metre. Irradiance represents the preceding hour's mean.
- Supporting wind, cloud and precipitation use real provider data. Daily degree-day and solar-energy figures expose their assumptions; missing hours withhold totals, and days cut by the rolling window are labelled. Hourly CSV export includes UTC and local time; the daily summary copies as tab-separated values.
- Normals are the 2016-2025 mean of the same local hour, ±3 days, from ERA5 and ERA5-Land reanalysis. Revisions compare two ECMWF IFS runs 24 hours apart through Open-Meteo's Single Runs API. Both compare exactly the hours of each row and show n/a where coverage stops; neither is a forecast skill or price signal.
- Refresh is explicit: it bypasses the 15-minute server cache once a snapshot is a minute old. Retrieval time is still not a model issue time.
- UTC instants internally; display in the selected point's IANA timezone with DST-aware formatting. Daily rows follow the point's local midnight.
- No fabricated live data, trading advice, application-generated demand or price predictions, portfolio estimates, or accounts. Official national consumption and generation forecasts belong to the market workspace; point weather is not converted into national demand or PV production.
- Energy Markets appears after Finland eligibility is established. Åland remains a Finland national comparison with a persistent SE3 local-market notice. Live eligibility requires the pinned NLS administrative polygons; the bundled Natural Earth basemap cannot establish it. Uncertain or outside selections keep global weather available.
- Market controls select one to three Helsinki delivery days at 15-minute or hourly resolution. Actuals, forecasts and published prices preserve their units, native intervals, coverage, freshness and collection provenance. Missing data remains missing; unavailable forecast history is labelled as collecting.
- Forecast snapshots and normalized market history have 30-day retention. No selected coordinates are stored in D1. Private-coordinate requests use bounded POST bodies and remain outside shared caches and URLs.
- The user chose the bundled Natural Earth regional basemap for this phase. MapTiler remains an optional hosted provider; restricted-key live tile verification is deferred.
- A country flag appears beside a known city's name. Modelled current weather appears on one line ("Now", temperature, condition, model time) over a sky band that pictures it: day or night from Open-Meteo's flag, the sun at its computed position, cloud from the nearest hourly cover, and rain, snow, fog or lightning from the WMO code. The sky is a modelled picture, never an observation; it keeps header text at 4.5:1, animates by default without a pause control, and is still under reduced motion.
- Production uses Cloudflare Workers at `www.saavirta.workers.dev`, D1, KV, Durable Objects and Cron. Terraform manages infrastructure; GitHub Actions tests and deploys immutable artifacts. Infisical owns credentials. No AWS service is required.
- Deployment requires passing checks and the user's explicit approval.

## Brand Commitments

Name: Säävirta. Calm, precise, modern energy intelligence. Exceptional hierarchy, readable charts, refined typography, motion only to acknowledge a choice. Group metrics by purpose; avoid card grids, decorative maps, gradients, glass, and fabricated live badges.

The user requested continuous motion on 14 October 2026: a sky band pictures the selected point's modelled weather, while the first-visit screen uses Motion Primitives Text Roll within Text Loop for lowercase weather metrics and their icons. One horizontal Infinite Slider of city shortcuts sits below the introduction and slows on hover. The fixed phrase and rotating metric share one large desktop headline, wrapping on smaller screens. “Choose on map” opens the existing picker. City links remain usable with touch, mouse and keyboard; reduced motion presents static content. A full-screen illustrative sky now follows the welcome metric with a 900ms blend: sunshine then snowfall during temperature, followed by sunlight, mist, wind trails, clouds or rain. Temperature keeps its label for two 3.2-second beats; the other metrics each take one beat. It shares the text loop’s state and is not weather data. The forecast sky remains driven only by provider data. Both keep bounded text contrast; reduced motion uses a still sky. Analysis panels retain a Motion Primitives hover highlight: an edge and soft shadow in light appearance, a subtle surface tint in dark appearance.

Original visual direction: **Forecast Desk**, the second browser prototype and Impeccable's pick, selected by the user on 2026-10-13. IBM Plex Sans typography and geographic context remain. On 14 October the user requested that the supplied Nordic Waves logo define both themes: charcoal on off-white in light appearance, and a #121212 background with raised charcoal surfaces in dark appearance. The 13 October retailer review replaced the card overview and hourly dialog with a daily summary table and inline hourly analysis; [the retailer review](docs/retailer-overview.md) records the findings and rationale.

## Implementation references

The approved Forecast Desk and Delivery desk preserve a chart-first workspace with a functional location map. [The market guide](docs/markets/README.md), [verification](docs/markets/verification.md) and [release gates](docs/markets/release-gates.md) describe behavior and current constraints. TypeScript server modules own ingestion, delivery alignment and analytics; React owns presentation. Development stays on `main`.

## Product Principles

- One forecast flow: the map is a location picker, available inline or expanded. Selecting a point opens its forecast immediately; there are no Forecast/Map tabs.
- Weather and Energy Markets share the selected point and theme. Switching workspaces preserves weather state; leaving supported market geography returns to Weather.
- Explain the time, units, origin, and limitations of every signal.
- Keep selection and inspection predictable across charts and maps.
- Preserve agency through global manual selection and optional permissions.
- Add infrastructure only when it solves a demonstrated requirement.

## Accessibility & Inclusion

Keyboard-operable location, horizon and delivery-period controls, clear focus, accessible chart summaries and interval tables, sufficient contrast, touch targets, responsive layout, and reduced motion. Apply Apple's foundations to the web; retain web conventions.
