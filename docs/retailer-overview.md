# Retailer review

13 October 2026. Reviewed as an electricity retailer would use the product, then against the installed design skills: design-taste-frontend (its transferable rules; it scopes itself to marketing pages, not dashboards), apple-design (HIG references opened and cited below) and Impeccable (Operate mode, craft floor, distill, and its deterministic detector). This review replaced the earlier six-card overview and hourly dialog. Before and after captures: `.impeccable/review/retailer-before-7d-desktop.png`, `retailer-before-mobile.png`, `live-7d-desktop.png`, `live-mobile.png`.

## What a retailer needs from this screen

A retailer buys energy ahead of delivery to cover its customers' load. Weather moves that load (heating and cooling) and the behind-the-meter solar that reduces it. The questions, in order: what does each local day look like, especially tomorrow; which days are cold or sunny; when within the day does solar ramp; is the forecast fresh. Trading decisions are made per delivery day and per hour, so calendar days, degree days and hourly timing are the working units.

## Findings

| # | Finding | Evidence | Change |
| --- | --- | --- | --- |
| 1 | The first screen did not answer "what about tomorrow?" | The overview reported one range and one degree-day total across a rolling window. Seven days showed "35.9 °C·d" for the week with no day breakdown; a weekend cold spell was invisible. | A daily summary table: one row per local day with low/high range bar, HDD, CDD, solar energy, peak hour, cloud, wind and rain. Today and Tomorrow are named; partial days say so. |
| 2 | The analysis lived behind a dialog; the visible charts were unreadable | Mini charts had no value axis and only start/end times; every value required opening a modal. `charts.md › Best practices`: "don't require interaction to reveal critical information." Impeccable craft floor refuses "a modal for a task that needs neither interruption nor protected focus". | Inline hourly plots with value axes, a readout above them and a scrubber below. The dialog, its duplicate horizon control and its shared-layout animation are removed. |
| 3 | Time axes were hard to read | Ticks fell every 12 hours from whatever hour the window started ("Tue 13 Oct 17:00, Wed 14 Oct 05:00"). `charts.md › Axes`: "Prefer familiar sequences of values". | Ticks at local 00/06/12/18, day labels and a day line at each local midnight; midnights only for seven days. |
| 4 | Irradiance bars were drawn half an hour late | Each bar was centered on its timestamp, but Open-Meteo's value is the mean of the preceding hour. | Bars span the hour they describe; the selected interval is tinted; the cursor sits at its end. |
| 5 | Hierarchy put "now" first | A 28px modelled current temperature and an animated condition icon were the second-largest element; the brief asks for decision-relevant outlook first. `layout.md › Visual hierarchy`: "place the most important items near the top". | One quiet line: static icon, 16px temperature, "Modelled at HH:MM". The two-second wobble animation is removed. |
| 6 | Generic card dashboard | Six same-size cards, each with icon, title, big number, sparkline and a hedging sentence. Impeccable craft floor refuses "same-size cards of icon plus heading plus text" and "sparklines standing in for content"; taste: cards only when elevation carries hierarchy. | No cards. Hairline table and section structure; icons only where they carry meaning. |
| 7 | Copy hedged on every card | "Wet-weather context for customer operations", "Surface wind context; turbine output needs hub-height data" and four similar lines. Taste copy audit: plain functional sentences over thoughtful-sounding ones. | Limits moved into two contextual "How … calculated/chosen" disclosures. Welcome headline is now the task ("The outlook for"). |
| 8 | No type or shape system | 23 font sizes and 10 radii in CSS; Impeccable's detector reported 33 off-ramp sizes. `typography.md`: a clear hierarchy from few sizes and weights. | Nine sizes (11 to 40px) and six documented radius roles. Detector: 0 findings. |
| 9 | Coverage chip unstyled | `.metric-coverage` read `--warning-ink`/`--warning-bg`; the tokens are `--warn-*`. | Removed with the cards; missing values now read "n/a" (screen readers: "Unavailable") in the table. |
| 10 | Hours to watch below the fold | On desktop it sat under the cards beside the map; on mobile, at the very end. | Beside the plots (below them on narrow screens); selecting one moves the shared cursor and scrolls the plots into view. |

## Daily summary semantics

Days follow local midnight in the point's IANA zone, so 23- and 25-hour days, half-hour offsets and missing local midnights are handled by calendar date rather than hour arithmetic. Instantaneous samples (temperature, cloud, wind) belong to the day of their timestamp. Preceding-hour values (irradiance, rain) belong to the day their hour starts, so 23:00-24:00 counts toward the day it began.

| Column | Calculation | Limit |
| --- | --- | --- |
| Low to high | Lowest and highest hourly sample | Uses the samples available |
| vs normal (temperature) | Forecast mean minus the normal mean over the same local hours | Withheld if any hour lacks either value; reanalysis can differ from the forecast model at a point |
| Revision (temperature) | ECMWF latest-run mean minus the 24-hour-older run's mean over the same hours | Withheld beyond the older run's 144-hour range |
| HDD | Sum of `max(18 − T, 0)` over the day's hours ÷ 24 | Illustrative base, not a calibrated load model; withheld if any hour is missing |
| CDD | Sum of `max(T − 22, 0)` ÷ 24 | As above |
| Energy | Sum of hourly mean W/m² × 1 h ÷ 1000, kWh/m² | Horizontal surface; PV output also needs capacity, orientation and losses |
| vs normal (solar) | Forecast energy against normal energy over the same intervals, percent | Withheld below 50 Wh/m² of normal sunshine (dusk-only partial days, polar night) |
| Revision (solar) | ECMWF latest-run energy minus the older run's, kWh/m² | As for temperature |
| Peak | Highest hourly mean and its hour | Earliest hour wins ties |
| Cloud | Mean cloud cover | Uses the samples available; wind and rain remain in the readout, hourly table and CSV |

Bold marks a product heuristic, not a trading threshold: at least 2 °C from normal, a 1 °C revision, 25% of normal sunshine, or a 0.5 kWh/m² solar revision.

A day cut by the rolling window starts late or ends early; its row says "from HH:MM" or "until HH:MM", uses muted text and lighter bars, and its totals cover only those hours. Tests cover a rolling 48-hour window, the midnight interval, the 25-hour October day in Amsterdam, Kolkata's half-hour offset and missing samples (`tests/unit/overview.test.ts`).

## Kept

Honest data semantics, permission-led location, global search, the functional map, URL and history state, CSV export, the mineral palette and Plex, forest temperature and ochre solar, keyboard inspection and the accessible hourly table.

## Trade-offs

- The previous request for "expandable" charts is superseded: the charts are full-size inline, so there is nothing to expand. The map keeps its expand control.
- On phones each summary box shows day, range or energy and the comparison first; the remaining columns scroll inside the box behind a sticky day column.
- Forest marks both temperature and interactive selection (`color.md` prefers one meaning per colour). It is kept as brand continuity because text, shape and position always accompany it.

## Second review: comparisons, scrubbing and refresh

Later on 13 October the user asked for the suggested next steps plus three fixes: visually separate temperature from solar in the daily summary, improve or explain the hour slider, and make refresh actually refresh. Skills applied: Impeccable, apple-design, design-taste-frontend, emil-design-eng with animate and review-animations, the Vercel Web Interface Guidelines, and Motion Primitives.

| Request | Root cause or finding | Change |
| --- | --- | --- |
| Refresh kept saying "Retrieved 11 min ago" | The button refetched `/api/weather`, which served its 15-minute cache snapshot. | A manual refresh sends `refresh=1` and bypasses the cache once the snapshot is a minute old; the floor, failure backoff and shared provider budget protect the provider. Polls stay silent. A Motion Primitives TextShimmer and a spinning icon show the request, and the status region announces "Retrieved just now". Verified on the production build: a normal read after 65 s returns the cached retrieval; a refresh returns age 0. |
| Temperature and solar ran together in one table | One row of nine columns had no grouping. | Two boxes, Temperature and Solar, each with its series mark, a definitions popover and its own day column. Side by side from about 1,150 px, stacked below. |
| Why a slider? | It was the keyboard and screen-reader path for inspecting hours (`charts.md` › Best practices) but looked like a detached form control. | The plots are the scrubber: an overlay with `role="slider"` spans both charts. Hover, press, touch drag, arrow keys, Page Up/Down (a day) and Home/End all select an hour. Headings stay outside the slider for assistive technology, and a one-line hint explains the interaction. |
| Next step: what changed since the last run | None before | Revision columns: ECMWF IFS 9 km, the latest settled run minus the same cycle 24 hours earlier, over exactly the hours of each row. |
| Next step: compare with normal | None before | The vs normal columns and a dashed normal line on the temperature chart: the 2016-2025 mean of the same local hour, ±3 days, from ERA5 and ERA5-Land. |

Further adoption work in the same pass: each day label focuses that day in the hourly charts (also reachable from a day strip that uses Motion Primitives AnimatedBackground; the URL keeps `day=`), the summary copies as tab-separated values for spreadsheets, notable differences are bold, and keyboard shortcuts cover search, refresh, horizons and clearing the day (`/`, `R`, `1`-`3`, `Esc`) alongside the chart keys.

### Provider decisions, with evidence

- **Not `_previous_day1`.** The Previous Runs API aligns past runs to fixed lead times. Measured for Rotterdam on 13 October: for valid hours more than a day ahead, `temperature_2m_previous_day1` equals the current run (14 October 16:00 UTC onwards), so it would report "no change" for exactly the days a trader is buying. Each hour would also come from a different run.
- **The Single Runs API instead.** It returns a whole run by its initialisation time. The uncounted metadata endpoint (`/data/ecmwf_ifs/static/meta.json`) gives the newest run, used 10 minutes after its availability time as Open-Meteo recommends. Runs carry data to 144 hours, so days beyond about four and a half days show n/a rather than a fabricated zero.
- **`era5_seamless` for normals.** `era5_land` has no irradiance at this point; the seamless option combines ERA5-Land temperature with ERA5 irradiance consistently across decades. Reanalysis can differ systematically from forecast models at a point, and the method text says so.
- **Sequential archive requests.** Ten parallel requests from one client stalled while opening connections: 4 of 10 failed after undici's 10 s connect timeout, and bounded concurrency still stalled. Sequential requests reuse one connection at about 50-250 ms each. Cold normals now load in 0.65-1.1 s (Helsinki, Tokyo, Sydney, New York), tolerate up to three missing years (and say so), and stop early once the minimum of seven is out of reach.

### Motion decisions (Emil Kowalski's rules)

- No animation on actions repeated hundreds of times a day: the cursor, readout and chart contents update instantly, and Hours to watch uses a static selection tint because scrubbing changes it constantly.
- Keyboard-initiated changes snap; pointer changes keep the existing AnimatedBackground spring.
- Popovers scale from their trigger (`scale(0.97)` with opacity, 150 ms in, 100 ms out, `cubic-bezier(0.23, 1, 0.32, 1)`), entering through `@starting-style`.
- Constant activity motion (shimmer, spinner) is linear and runs only during a manual refresh or initial load. The shimmer animates `background-position` on a small text box, an accepted paint-only exception.
- Reduced motion removes all of it, and no number animates through invented intermediate values.

## Third review: logo, current reading and table alignment

The same evening the user asked for further refinements. Each was checked against before and after crops of the header, the modelled-now line and both summary boxes, at desktop and 390px, in both themes.

| Request | Finding | Change |
| --- | --- | --- |
| Use the supplied "Nordic Waves" artwork as the logo and favicon | The header showed a Phosphor waves icon beside 20px text, and the favicon was the same icon. The artwork is a 1942×809 PNG on off-white: it would not follow dark appearance or stay crisp at 28px. | Traced to one SVG path with potrace and compared with the original at 1000px, header size and favicon sizes. The header logo is filled with `currentColor`, 28px tall (24px on phones). Favicon: the mark as SVG with a dark-scheme fill, plus `favicon.ico` (16, 32) and a 180px `apple-touch-icon.png` on the artwork's off-white. |
| Make the current temperature a little bigger and clearly current | At 16px it read like the surrounding text; only "Modelled at" said when it applied. | A muted "Now" label precedes the temperature, now at the 20px value size, and the condition symbol sits beside the condition it depicts, all on one baseline. With the line about 48px wider, it wrapped on 360px phones for "Thunderstorms" or an older retrieval. So on phones the model time always takes its own line and the placeholder reserves the same 45px. Loading moved nothing at 360, 390 and 1440px. The `aria-label` on `<strong>`, a role that cannot be named, is gone; screen readers read the visible "Now 16.9 °C". |
| "Low to high", "Energy" and the units under every header were misaligned | Those two headers were left-aligned while their values sat right-aligned in a 4ch box, about 8px apart. The other headers were right-aligned, which left short units such as °C and % at the right end of longer labels. | Labels, units and values center on each column; the range and energy composites center as a whole, which also holds on phones, where their tracks are fixed. A decimal-aligned alternative was prototyped and rejected because it pushed short values (n/a, cloud %) off center. Trade-off: where magnitudes differ within a column, a centered value shifts by half a digit. |
| Lowercase "vs" | | "vs normal" in both headers, the definitions, the copied table and the browser tests. |
| Darken the temperature line up to the hovered hour, lighter after it | The line had one strength, so it did not show how far the cursor had moved through the window. | Two series meet at the cursor's sample: full forest up to it, forest mixed 70% into the background after it. Before any inspection the whole line is the lighter shade. Linear segments make the split exact, the axis keeps its range while scrubbing, and the split follows every selection path without animating. At 70% the lighter part still has 3.4:1 contrast against the page in light mode and 5.2:1 in dark. |
| The same for solar irradiance, a tad lighter after the cursor | The bars kept one shade while the line split, so the two charts disagreed about the cursor. | Each bar takes its colour from its hour: full solar fill up to and including the selected interval, 85% mixed into the background after it. Ochre starts at 3.9:1 against the light page (forest at 6.5:1), so 85% is as light as it can go while keeping 3:1 (3.1:1 light, 4.1:1 dark). |

The user also asked whether production uses `eval()`, after the development server printed React's "eval() is not supported in this environment" notice. It does not. The notice comes from React's development-only Server Components client, which tries `eval` to rebuild server call stacks while rendering in workerd, and workerd forbids `eval`. Neither the production build nor the production preview's log contains it, and the development browser console shows none. The only `eval` in production output is MapLibre's worker plugin loader, which runs only through `setRTLTextPlugin` or `importScriptInWorkers`; the app calls neither.

The supplied artwork retains its original name. The user has since renamed the product Säävirta; the header now pairs the existing mark with that wordmark, matching the page title, accessible link name and documents.

## Fourth review: tiles, horizon placement and a sky that pictures the weather

14 October. The user asked for three changes:

- Larger headings for Hourly forecast, Hours to watch and Monitoring point, each in its own tile, with a Motion Primitives highlight on hover.
- The horizon control beside Daily summary.
- An animated header, in the manner of Apple's Weather app, that shows the city's current day or night and weather (for example sun and rain together).

Skills applied: Impeccable (its context loader, then the craft floor, layout, animate and overdrive references, and the detector), apple-design (HIG pages cited below), design-taste-frontend (its rules that transfer; it scopes itself to marketing pages), and emil-design-eng with animate.

### What the skills said, and what was decided

| Request | Guidance | Decision |
| --- | --- | --- |
| Larger headings | `typography.md › Conveying hierarchy`: "Adjust font weight, size, and color as needed to emphasize important information and help people visualize hierarchy." Impeccable craft floor: "obvious scale and weight steps". | All four section headings go from 16 to 20px/600, an existing step of the nine-size ramp. That includes Daily summary, so the primary section is not outranked by the ones below it. |
| Tiles | `layout.md › Visual hierarchy`: "you might use negative space, container shapes, or separator lines to show which elements are related". `boxes.md › Best practices`: nested boxes "can make your interface feel busy and constrained". Impeccable craft floor: "nested cards are always wrong". | Three tiles, each a different tool, so not a card grid. Surface and a one-pixel border only. The map spans its tile edge to edge instead of nesting a second frame. Tiles sit 20px apart, like the summary boxes; the aside grows to 360px. |
| Hover highlight | `pointing-devices.md`: "Use hover for large elements and customize the scale, tint, and shadow attributes as needed". It also advises tint without scale or shadow where space is tight, and warns: "Avoid creating gratuitous pointer and content effects." Emil and animate: hover happens tens of times a day, so it should be "near-imperceptible only". | Tint (5% accent) and a border shift, with no scale (a scaled chart would distort its data) and no shadow. It uses Motion Primitives AnimatedBackground's hover mode, the codebase's existing motion vocabulary. The tint glides between tiles on a 250ms no-bounce spring. Mouse only; reduced motion fades in place. |
| Horizon beside Daily summary | `designing-for-iphone-duo.md › Vertical controls`, a principle that holds on any screen: "Locate controls near the content they affect." | Agreed. The horizon scopes everything below, so it sits with the first heading it scopes, and the band above keeps only the place. The heading and control render while loading. Same-point switches keep the previous window, dimmed, with "Loading 7 days…", so the control never unmounts and keeps focus. |
| Animated sky | `motion.md › Best practices`: "Don't add motion for the sake of adding motion" and "Make motion optional". `accessibility.md › Cognitive`: with Reduce Motion, reduce "automatic and repetitive animations". `image-views.md › Content`: text over images must contrast. Impeccable animate: "Any nonessential loop must stop when offscreen or hidden". Craft floor: one authored moment; "shader-driven effects remain first-class media", while sketch-style SVG scenes "read as amateur". Overdrive: pause offscreen rendering and keep a working fallback. Emil's gate: seen once per visit and changing rarely, so motion is allowed; its purpose is state indication. | The original brief avoided decorative animation; the user's explicit request supersedes it, so the sky is built as data, not decoration. Every element comes from the forecast. It keeps the text window, stops when paused, offscreen or hidden, is still under reduced motion, and falls back to a static gradient. |

### Why a shader

The alternatives were weighed first:

- **Weather illustrations (Lottie and similar):** cartoon icons, not the real-world sky asked for.
- **Video loops:** megabytes each, a dozen variants, licensing, and no control over contrast or over sun and cloud amounts.
- **Published sky shaders:** mostly CC BY-NC-SA, which a commercial retailer cannot ship.
- **Three.js:** hundreds of kilobytes to draw one full-screen triangle.

So one fragment shader was written for the purpose: about 150 lines and no dependency, with an MIT-licensed hash function credited in the third-party notices.

| Modelled input | Scene |
| --- | --- |
| Day flag, sun elevation | Day palette and sun, golden horizon under 10°, twilight tint down to -6°, otherwise night with stars |
| Codes 0-3 and the nearest hour's cloud cover | Cloud coverage tracks cover; full overcast keeps moving light and dark masses |
| Drizzle and rain (51-67), showers (80-82) | Slanted streaks in three depths; showers keep a broken sky, so the sun can shine through rain |
| Snow (71-77, 85-86) | Swaying flakes in three depths |
| Fog (45, 48) | Low banks drifting near the bottom |
| Thunderstorm (95-99) | Storm slate in day or night, rain, lightning every 4.5-11 seconds |
| wind conditions | Cloud drift and rain slant (direction illustrative: the data has no wind direction) |

**Contrast is guaranteed by construction, not tuned by eye.**

- **Light skies:** carry dark text, and every pixel stays at relative luminance 0.34 or above.
- **Dark skies:** carry light text, and every pixel stays at 0.115 or below. The shader enforces both bounds in linear light, after drawing.
- **Measured:** across 14 scenes in both appearances on the production build, the darkest light-sky pixel was 0.3365 and the brightest dark-sky pixel 0.1171. That keeps 12px muted text at 4.71:1 and 4.77:1 at worst.
- **Lightning:** a strike raised mean luminance from 0.046 to 0.082, below WCAG's 0.1 flash threshold.

### Trade-offs

- **The band's tone follows the weather, not the page appearance.** A night sky is dark above a light page. Taste's "sections do not invert" rule targets theme flips; this is a picture of the sky, and Change location keeps the page's button colours. Dark appearance dims daylight slightly instead of turning day into dusk.
- **Continuous GPU work while the band is visible.** It runs at CSS-pixel resolution and 30 fps for drifting cloud, and stops offscreen or in a hidden tab. Lighthouse was unchanged: performance 94, TBT 30 ms, CLS 0.
- **The condition icon now repeats what the sky shows.** It stays for the still and no-WebGL states, and as a glyph beside the label.
- **The summary boxes do not join the hover group.** The request named three tiles, and the boxes' sticky day column paints its own background.

## Next product increment

Uncertainty is the next headline improvement: an ensemble (for example ECMWF ENS through Open-Meteo's Ensemble API) gives a P10-P90 range for each day's mean temperature and solar energy, which tells a trader how far to trust a revision or an anomaly. After that, weighting several monitoring points by customer load turns point degree days into portfolio degree days. Customer load history, PV capacity and an identified market are still required before any MWh or price view.
