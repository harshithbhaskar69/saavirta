---
name: Säävirta — Forecast Desk
description: A retailer weather desk that answers by local day first, then by hour.
colors:
  mineral-bg: "#f7f6f3"
  mineral-surface: "#fdfcf9"
  mineral-soft: "#eeefed"
  forest-ink: "#192025"
  forest-muted: "#5e666c"
  mineral-border: "#d7dadb"
  forest-accent: "#192025"
  mineral-grid: "#e3e5e4"
  map-sea: "#dce4e7"
  map-land: "#edece7"
  map-boundary: "#a0a8aa"
  solar-ink: "#936014"
  solar-fill: "#a47120"
  focus: "#146baf"
  warning-bg: "#f4ead7"
  warning-ink: "#725012"
  dark-mineral-bg: "#121212"
  dark-mineral-surface: "#1c1e20"
  dark-mineral-soft: "#282c2f"
  dark-forest-ink: "#e5e7e9"
  dark-forest-muted: "#abb2b7"
  dark-mineral-border: "#3e4448"
  dark-forest-accent: "#d7e0e5"
  dark-mineral-grid: "#30363a"
  dark-map-sea: "#1b2024"
  dark-map-land: "#282b2d"
  dark-map-boundary: "#626a70"
  dark-solar-ink: "#e0b576"
  dark-solar-fill: "#b98b48"
  dark-focus: "#a9d6f5"
  dark-warning-bg: "#49371f"
  dark-warning-ink: "#f6d59b"
  dialog-backdrop: "#19202566"
  sky-light-ink: "#192025"
  sky-light-muted: "#28343c"
  sky-light-focus: "#0b4f86"
  sky-dark-ink: "#f3f6f7"
  sky-dark-muted: "#d9e2e7"
  sky-dark-focus: "#a9d6f5"
typography:
  display:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "clamp(40px, 5vw, 72px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  welcome-metric:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "clamp(32px, 3.2vw, 48px)"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.03em"
  welcome-intro-mobile:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  welcome-city-mobile:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.6
  place:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  value:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
  section:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  body:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  control:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Plex, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  caption:
    fontFamily: "Plex, sans-serif"
    fontSize: "11px"
    fontWeight: 400
rounded:
  bar: "1px"
  flag: "2px"
  inner: "4px"
  control: "6px"
  dialog: "12px"
  point: "50%"
spacing:
  small: "8px"
  medium: "12px"
  control: "14px"
  gutter-mobile: "18px"
  section: "24px"
  outlook: "28px"
  gutter-compact: "34px"
  analysis-gap: "48px"
  gutter-wide: "56px"
components:
  button-primary:
    backgroundColor: "{colors.forest-accent}"
    textColor: "{colors.mineral-surface}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-secondary:
    backgroundColor: "{colors.mineral-surface}"
    textColor: "{colors.forest-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-text:
    textColor: "{colors.forest-accent}"
    typography: "{typography.label}"
    padding: "8px 0"
  button-icon:
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.control}"
    width: "44px"
    height: "44px"
  logo:
    textColor: "{colors.forest-ink}"
    height: "36px"
  horizon-selected:
    backgroundColor: "{colors.forest-accent}"
    textColor: "{colors.mineral-surface}"
    rounded: "{rounded.inner}"
    padding: "7px 17px"
  search-field:
    backgroundColor: "{colors.mineral-bg}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  map-frame:
    backgroundColor: "{colors.map-sea}"
    rounded: "{rounded.control}"
  daily-row:
    textColor: "{colors.forest-ink}"
    typography: "{typography.control}"
    padding: "10px 12px"
  tile:
    backgroundColor: "{colors.mineral-surface}"
    rounded: "{rounded.control}"
    padding: "6px 16px 12px"
  sky-band:
    textColor: "{colors.sky-light-ink}"
    padding: "26px 56px 10px"
  range-bar:
    backgroundColor: "{colors.forest-accent}"
    rounded: "{rounded.inner}"
    height: "6px"
  energy-bar:
    backgroundColor: "{colors.solar-fill}"
    rounded: "{rounded.bar}"
    height: "6px"
  hour-to-watch:
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.control}"
    padding: "9px 10px"
  country-flag:
    rounded: "{rounded.flag}"
    width: "27px"
    height: "18px"
---

# Design System: Säävirta — Forecast Desk

## Overview

**Creative North Star: "Forecast Desk"**

A calm, precise analysis surface that answers in the order an electricity retailer asks: what each local day looks like, then which hours matter, then where the point is. Logo-derived charcoal and off-white neutrals, measured typography and hairline structure leave room for continuous weather data. On first visit, rotating metric names explain coverage and a moving city strip opens real forecasts. Inside the workspace, the sky above the place pictures its modelled weather. There is no card grid.

This document records the application deployed at https://www.saavirta.workers.dev. The Forecast Desk direction was selected on 2026-10-13. The 13 October retailer review replaced the six-card overview and the hourly dialog with a daily summary table and inline hourly analysis; the 14 October review added the sky band, analysis tiles and the horizon beside the summary. [retailer-overview.md](docs/retailer-overview.md) records why. Values come from [globals.css](src/app/globals.css) and [components](src/components/).

**Key Characteristics:**

- The place header sits on a sky band: a WebGL picture of the modelled current weather (day or night, sun position, cloud, rain, snow, fog, lightning), bounded so the text keeps 4.5:1.
- A daily summary leads, in two boxes: Temperature (a range bar on one shared scale, the signature element) and Solar (a proportional energy bar). Each compares the day with its normal and with the previous model run. The horizon control sits beside its heading.
- Inline, synchronized hourly temperature and irradiance plots that are themselves the scrubber, with a dashed normal line and a day strip that zooms to one local day. Hourly forecast, Hours to watch and Monitoring point are tiles; a highlight follows the pointer between them.
- Off-white light surfaces and charcoal dark surfaces, neutral temperature, ochre solar.
- IBM Plex Sans on a nine-step scale, tabular figures, explicit units.
- Flat controls, hairline dividers, functional geography.

## Colors

The palette follows the supplied Nordic Waves logo: cool charcoal ink around #192025 and off-white paper #fdfcf9. Dark appearance uses #121212 for the page and #1c1e20 for raised surfaces. Historical token identifiers remain stable; their values now describe this neutral palette. Frontmatter values are normative; each `dark-` token replaces its light token in dark appearance.

The 14 October palette review applies `dark-mode.md › Dark Mode colors`: “Aim for sufficient color contrast in all appearances.” The existing web controls, type, layout and weather sky stay consistent; shared tokens carry the brand update through the logo, tables, charts, maps, dialogs and hover states. Browser theme metadata follows the active appearance, including a saved manual preference.

| Text on its standard surface | Light | Dark |
| --- | --- | --- |
| Main text / logo | 16.06:1 | 13.49:1 |
| Muted text | 5.70:1 | 7.79:1 |
| Primary action | 16.06:1 | 12.49:1 |
| Solar reading | 5.22:1 | 8.79:1 |
| Map labels / land | 6.09:1 | 10.11:1 |

### Primary

Charcoal accent identifies temperature marks, selected horizons, primary actions, active navigation and the map point. The shared hue is deliberate continuity between a selected control and the temperature it reveals; text, shape and position always accompany it.

### Secondary

Solar fill draws irradiance bars and solar-energy bars; solar ink colours the irradiance readout and sun or storm symbols. Warning background and ink support stale, offline and partial-data notices. Focus is a distinct blue ring in both themes; the search field focuses with the neutral accent.

### Neutral

Mineral background holds the sheet; surface supports the header, buttons, dialog and map control strip. Soft identifies hover, loading placeholders and the selected hour's tint. Charcoal ink and muted distinguish data from annotation. Border divides sections and marks local midnight in the plots; grid stays beneath the series and draws the range scale. Partial days mix their bar colour 45% into the background.

**The Signal Identity Rule.** Temperature stays neutral and solar stays ochre across the table, plots, readout and both themes; text, units and mark shape also distinguish them.

### Sky

The sky band is the only place outside the mineral palette: sky blues, night navies, storm slates and a warm horizon at golden hour, drawn in linear light by the shader from palettes in `src/features/weather/sky.ts`. Its text takes one of two tones, independent of the page appearance. Light skies (day, except thunderstorms) carry `sky-light-ink` and `sky-light-muted`, and every sky pixel stays at relative luminance 0.34 or above. Dark skies (night and thunderstorms) carry `sky-dark-ink` and `sky-dark-muted`, and every pixel stays at 0.115 or below. Muted 12px text therefore keeps at least 4.5:1 anywhere on the band (the updated light-sky muted token measures 4.74:1 at the luminance floor; both tones are covered by the sky tests). Focus rings switch to `sky-light-focus` or `sky-dark-focus` there. Change location keeps the page's own button colours. Dark appearance dims daylight skies slightly rather than turning day into dusk.

## Typography

IBM Plex Sans is the only family, self-hosted at `public/fonts/plex-sans.woff2` under the CSS alias `Plex`. Sentence case throughout. The ramp has nine steps and nothing else: 40, 32, 24, 20, 16, 14, 13, 12 and 11 pixels, matching the frontmatter roles.

- **Display 40–72** is the first-visit headline, fluid with viewport width (36–48 on phones). The metric line is 32–48; introduction 20, or 18 on phones. Analyst workspace type remains on the existing scale.
- **Place 32** is the selected location (24 on phones); the country beside it is 16.
- **Heading 24** titles the location picker and error state.
- **Value 20** is the modelled current temperature and the inspected temperature and irradiance.
- **Section 20** heads every section at 600 weight: Daily summary, Hourly forecast, Hours to watch, Monitoring point.
- **Title 16** is the country beside the place name.
- **Body 14**, **control 13** (buttons, table cells, the condition label), **label 12** (meta, units, helper, “Now”) and **caption 11** (axis ticks, unit sub-labels, attribution).

Tabular numerals align table cells, readouts, axes and hour descriptions.

**The Readable Measurement Rule.** Keep units, local time, timezone and UTC offset, and the irradiance interval attached to the values they explain.

## Layout

A centered sheet, max 1560px. The header is 68px; header, content and footer share the 56px gutter. Directly under the header, the sky band bleeds to the sheet's edges and holds the place, meta and Change location, then one line for modelled current conditions and retrieval age with the refresh control.

Then, in reading order:

1. **Daily summary**: the heading, the 24h/48h/7d horizon beside it and Copy table at the far end; then two boxes in an auto-fit grid (`minmax(min(100%, 560px), 1fr)`, 20px gap), side by side from about 1,250px. Temperature: day, low to high (34%), vs normal, revision, HDD, CDD. Solar: day, energy (30%), vs normal, revision, peak, cloud. A sources line and a method disclosure follow.
2. **Analysis row**: the Hourly forecast tile (`minmax(0, 1fr)`) beside a 360px aside of two tiles, Hours to watch and Monitoring point, all 20px apart. The hourly tile holds the day strip, readout, plots and hint; the map tile spans its 220px locator map edge to edge.
3. Monitoring-point preferences, then the footer.

```text
░░░░░░░░░░░░░░░░░░░ sky: modelled weather, drifting ░░░░░░░░░░░░░░░░░░░░░░░░░░
░ Rotterdam  Netherlands ▾                                  [Change location] ░
░ Europe/Amsterdam (GMT+2)   Point forecast                                   ░
░ Now 18.6 °C ☁ Overcast  Modelled at 17:15          Retrieved 4 min ago ↻ ⏸ ░
Daily summary [24h|48h|7d]                                         Copy table
┌ — Temperature                        ⓘ ┐ ┌ ▪ Solar                         ⓘ ┐
│ Day      Low to high   Normal Rev  HDD │ │ Day      Energy    Normal Rev  Peak │
│ Tomorrow 13.0 ▬▬▬ 17.9  +2.6  0.0  2.4 │ │ Tomorrow 2.74 ▬▬▬▬  +53% +0.13  431 │
└────────────────────────────────────────┘ └──────────────────────────────────────┘
Normal: 2016-2025 … Revision: ECMWF IFS run 06:00 UTC … minus 06:00 UTC …
┌ Hourly forecast           Export CSV ┐ ┌ Hours to watch                   ┐
│ [All | Today | Tomorrow | Thu 15]    │ │ Coldest hour            12.9 °C  │
│ Tue 13 Oct 20:00  17.3 °C  0 W/m² …  │ │ Solar peak             442 W/m²  │
│ Temperature ── forecast  - - normal  │ └──────────────────────────────────┘
│ Solar irradiance ▂▅▇▇▅▂ ──────── 600 │ ┌ Monitoring point                 ┐
│ Hover or drag across the charts …    │ │ [locator map, edge to edge]      │
└──────────────────────────────────────┘ └──────────────────────────────────┘
```

Responsive changes follow viewport width:

- **1100px and below**: gutters become 34px. The hourly tile spans the width; the aside becomes a two-column row of tiles (hours, map) beneath it.
- **850px and below**: the country suffix hides; Change location becomes an icon; readout context wraps under the values.
- **620px and below**: header 64px, gutters 18px, place 24px. In the sky band, Change location stays an icon beside the place; the modelled-now reading, its model time and the retrieval age always take three lines (the first two reserve 45px while loading), so loading and loaded heights match. The horizon control takes its own full-width row under the summary heading. Tiles stack in one column with 12px padding. Plots are 180px and 130px tall. The summary boxes stack; each compacts to 6px cell padding and shorter bars, and its later columns scroll inside the box behind a sticky day column. The day strip scrolls horizontally.

## Elevation & Depth

Tonal separation and one-pixel lines. Two small shadows separate floating things from content: the selected map point (`0 1px 4px rgb(20 20 20 / .18)`) and definition popovers (`0 2px 10px rgb(15 37 28 / .12)`). The dialog backdrop dims without blur.

**The Flat Surface Rule.** No decorative cards and no card grid. Boxes and tiles exist because each groups a distinct dataset or tool: the two summary boxes, and the hourly, hours-to-watch and map tiles. Surface tone and a one-pixel border define them at rest. Light-mode panel hover adds only a soft edge shadow; the data surface stays unchanged. Never nest tiles: the map spans its tile instead of adding a second frame.

## Shapes

One rule: interactive and container shapes are 6px (buttons, inputs, segmented frames, tiles, summary boxes, the tile highlight, Hours-to-watch rows, skeletons, notices); inner fills are 4px (selected horizon, range bars); the dialog is 12px; flags 2px; energy and irradiance bars 1px; the map point is a circle. The sky band is square: it is a picture spanning the sheet.

## Components

### First visit

The heading reads “The outlook for [metric]” on one large line above 850px, with both parts at the same size: 6.3% of the available content width, capped at 96px. On narrower screens the metric sits on a second line; phone type scales from 32–48px. The introduction remains 20px (18px on phones); action targets are at least 48px high. “Choose on map” opens the location picker; no map is rendered on the welcome screen.

A full-viewport illustrative sky follows the active metric. Temperature holds its label for two 3.2-second beats: full-screen sunshine, then snowfall. Solar irradiance has a concentrated bright sun; humidity has drifting mist, wind has flowing trails, cloud cover has moving cloud banks, and precipitation has rain. The shared sky renderer blends scenes over 900ms; one clock drives both Text Loop and scene, including the temperature phase. These are decorative interpretations, not location conditions or forecasts. Light skies use stronger cloud shading and a 0.34 minimum luminance; dark skies use a brighter 0.15 ceiling. Secondary text uses #28343c / #f0f4f6 to preserve 4.5:1, and focus rings use #0b4f86 / #a9d6f5 for at least 3:1. Theme changes switch to a new canvas over a matching fallback palette. Reduced motion shows a still cloudy sky and every metric label; without WebGL the scene palette remains as a gradient. The layer ignores pointer input and is removed when a location is selected.

Motion Primitives Text Roll animates the lowercase metric names: temperature, solar irradiance, humidity, wind conditions, cloud cover and precipitation. Labels advance every 3.2 seconds, except temperature's 6.4-second sun/snow sequence. Its text and icon stay still during that weather change. A matching Phosphor outline icon is the final glyph in each roll, at 0.8em, initially edge-on. Each glyph rolls around its horizontal axis over 400ms, staggered by 35ms, with 120ms between faces and an ease-out curve. A hidden sizing layer reserves the widest metric so controls stay still. Assistive technology gets the complete static list without repeated announcements. Reduced motion displays that list with static icons; the loop stops advancing offscreen or in a hidden tab.

One horizontal Motion Primitives Infinite Slider sits below the introduction, moving at 36px/s and slowing to 12px/s under a mouse. Eight city shortcuts pair 36×24px flags with 22px names and arrows (30×20px and 18px on phones). Country names remain in link labels for assistive technology. Left and right masks soften the strip edges. Keyboard focus and reduced motion reveal stationary, wrapping links; duplicate scrolling groups are hidden from assistive technology and removed from the tab order. Settings changes take effect without reloading; hidden tabs and offscreen sliders stop animating.

### Brand

The header pairs the original sun-and-waves mark with the Säävirta wordmark in the locally served Plex typeface. The mark retains the supplied artwork's traced vector paths and uses `currentColor`; it is 36px tall (30px on phones), beside 32px wordmark text (27px on phones). The header contains only this logo and the theme toggle. Its home link is named Säävirta for assistive technology, matching the page title and exported CSV prefix. The favicon remains the mark alone. Existing local-storage keys and Cloudflare resource names retain their original identifiers to preserve saved locations, appearance preferences and deployment bindings.

### Buttons and navigation

Primary and secondary buttons share 13px control type and a 44px minimum height. Primary hover keeps the accent fill at brightness 0.94; secondary and icon hover use soft. Text actions underline on hover. Pointer activation moves enabled buttons down one pixel. The map is a location-selection tool within the forecast flow; there is no separate Map navigation destination.

Keyboard focus is a two-pixel ring with four-pixel offset. The search field rings its wrapper; the map canvas and daily-table scroller place their ring inside. Icon-only controls keep accessible names. Phosphor supplies icons, used only where they carry meaning: actions, conditions, the map controls.

### Horizon and location search

The 24h, 48h and 7d options sit in a bordered segmented frame beside the Daily summary heading, next to the content they scope (the summary, plots and hours below all follow it). The selected option uses accent fill and `aria-pressed`. The heading and control render while the first forecast loads. Switching horizon for the same point keeps the previous window on screen, dimmed to 55%, while a status reads “Loading 7 days…”; the control never unmounts, so focus stays on it. Search uses a Radix modal dialog with a full-width input and flagged results. Desktop search focuses its input; coarse-pointer and device-location entry focus the dialog without forcing a keyboard. Escape and Close restore the opener, with the forecast as fallback. Selecting a location focuses and reveals the forecast. Search, device and map modes stay in the same picker; switching modes cancels an in-flight device lookup. Search, coordinates, map and optional geolocation remain available without an automatic permission prompt.

### Location and modelled conditions

A flag appears only for a recognized country code. Free point selection and device location keep exact coordinates and may say “Near [city]” within 25 km. Device naming uses the bundled city data locally; missing coverage or a failed lookup falls back to coordinates without blocking the forecast. The modelled-now line reads “Now” (label 12, muted), the temperature at value size (20px/600, line height 1), a static 20px condition symbol beside the condition label, and “Modelled at HH:MM”, all on one baseline. On phones the model time takes its own line. The text never animates and never implies a sensor reading.

### Sky band

A WebGL fragment shader (`src/components/sky.tsx`, no dependency) draws the band from a scene built by `skyScene()` in `src/features/weather/sky.ts`:

- **Inputs:** Open-Meteo's current WMO code and day flag; cloud cover and wind from the hourly sample nearest the model time; the sun's position from a low-precision solar formula.
- **Sky:** day or night palettes, golden-hour warmth when the sun is under 10° and civil twilight at night.
- **Weather:** two layers of drifting, domain-warped clouds whose coverage tracks cloud cover, the sun's glow behind them, twinkling stars on clear nights, slanted rain in three depths, swaying snow, low fog banks, and lightning in thunderstorms. Daytime showers keep the sun, so it can rain in sunshine.
- **Movement:** wind conditions sets drift and rain slant. Direction is illustrative; the data has no wind direction.

The shader keeps every pixel inside its tone's luminance window (see Colors). Lightning raises mean luminance by under 0.04, below WCAG's 0.1 flash threshold, with strikes at least 4.5 seconds apart.

The renderer uses at most CSS-pixel resolution and caps its backing buffer at 700,000 pixels for full-screen scenes. It targets 30 fps for drifting cloud and 60 fps while rain or snow falls. It stops offscreen or in a hidden tab, compiles its shader in parallel where supported, and fades in over 700ms once drawn. A new point or appearance morphs the scene over 900ms. The text tone crossfades over 700ms through registered `--ink` and `--muted` properties.

The sky runs by default without a play/pause control, as requested on 14 October. Old saved pause preferences are ignored. Under reduced motion the band shows one still frame. Without WebGL, the band keeps a static gradient of the same palette and tone. The canvas is hidden from assistive technology; the condition label carries the meaning.

### Analysis tiles

Hourly forecast, Hours to watch and Monitoring point each sit in a tile: surface, one-pixel border, 6px radius, 16px side padding (12px on phones), section headings at 20px. A highlight adapted from Motion Primitives AnimatedBackground's hover mode marks the tile under a mouse pointer. Light appearance keeps the content surface unchanged: only the edge gains a 22% accent mix and a soft 6% accent shadow. Dark appearance retains its 5% accent tint, with the tile border shifting 40% toward accent over 150ms. Moving straight between tiles glides the highlight through a shared `layoutId` (spring, no bounce, 250ms). A pointer that leaves and returns later gets a fade instead of a flight across the page. Touch never triggers it, and under reduced motion it fades in place. Individual controls and Hours to watch rows retain their own hover and keyboard focus feedback.

### Daily summary

Two boxes, Temperature and Solar, each a semantic table named by its heading inside a focusable horizontal scroller, with the series mark of its chart and an info button that opens a native popover of definitions (light dismiss, Escape, anchored below the button where CSS anchor positioning exists). "Copy table" puts every column on the clipboard as tab-separated values for spreadsheets. Each row is a local calendar day of the point: instantaneous samples (temperature, cloud, wind) belong to their timestamp's day; preceding-hour values (irradiance, rain) to the day their hour starts. Today and Tomorrow are named; other days show weekday and date. Days cut by the rolling window say “from HH:MM” or “until HH:MM”, use muted text and lighter bars.

Column labels, their unit sub-labels and the values center on each column; only the day column stays left. The low-to-high and energy composites center as a whole, so their labels sit over the full bar. Fixed decimals and tabular figures keep centered values in line; where magnitudes differ in one column (9.8 above 13.0) a value shifts by half a digit. A decimal-aligned box was tried and rejected because it pushed short values such as n/a and cloud % off center.

The temperature cell shows low, a bar from low to high on a hairline scale shared by every row, and high; screen readers hear “low to high”. Solar energy is kWh/m² with a bar proportional to the window's largest day and no background track. Solar peak shows W/m² and its hour interval. Missing values read “n/a” visually and “Unavailable” to screen readers. HDD and CDD abbreviations carry their bases in a title.

Comparison cells (vs normal, revision) are signed with a true minus sign and compare exactly the hours in the row. Notable differences are semibold (2 °C from normal, a 1 °C revision, 25% of normal sunshine, a 0.5 kWh/m² solar revision). While comparisons load, their cells read "…" and a shimmering status line says so; if they fail, the line offers Retry and the cells read n/a. The sources line names the normal years and the two ECMWF runs. Each day label is a toggle button that focuses that day in the hourly charts; the focused row takes a 7% accent tint. A disclosure explains day boundaries, interval assignment, degree-day bases, comparisons and partial days.

### Hourly analysis

Inline, never in a dialog. A day strip comes first: All, Today, Tomorrow and later days in a segmented control whose fill moves with Motion Primitives AnimatedBackground. Choosing a day zooms both plots to it (three-hourly ticks) and writes `day=` to the URL with `replaceState`. A readout row follows: local date and hour with timezone and offset, temperature, irradiance with its hour interval, then normal, wind, cloud and rain. Two plots share one time domain from an hour before the first sample to the last:

- Temperature: a 2px neutral line, 200px tall, with the normal as a 1.5px dashed muted line and a matching legend. The line is full neutral ink up to the cursor and the same ink mixed 70% into the background after it, so before any inspection it is all the lighter shade. The split follows every selection path and never animates.
- Solar irradiance: ochre bars drawn across the hour each mean describes, 150px tall. The selected hour's interval is tinted. Bars up to and including the selected interval are full solar fill; later bars mix 85% into the background (3.1:1 in light, 4.1:1 in dark). That is only a tad lighter than the line's shade because ochre starts with less contrast.

Ticks fall on local 00, 06, 12 and 18 hours (local midnights only for seven days); midnight ticks read “Wed 14” and draw a border-coloured day line through both plots. Value axes sit on the trailing side so the plots share the content's leading edge. One dashed cursor marks the selected instant in both plots.

The plots are the scrubber. A transparent overlay with `role="slider"` spans both, so headings stay outside it for assistive technology. Hover (mouse), press and touch drag select an hour: the nearest sample over temperature, the hour whose interval contains the pointer over solar. Focused, arrow keys step an hour, Page Up and Page Down a day, Home and End the ends; `aria-valuetext` reads the hour and both values. A one-line hint explains the interaction, in a touch variant on coarse pointers. Text selection is off and `touch-action: pan-y` keeps vertical scrolling. Plots are hidden from assistive technology; the readout, scrubber, summary tables and expandable hourly table carry the data. Export CSV sits in the section heading.

### Hours to watch

A list of buttons without icons: title and tabular value on one line, the local time or interval beneath. Hover darkens the row by 6% of the ink; the selected row uses a 10% accent tint, accent value and `aria-pressed`. Selecting a row moves the shared cursor, announces the values politely and scrolls the plots into view when they are off screen. A disclosure explains the selection rules.

### Map

A MapLibre surface with coordinates, attribution, scale and a control strip, using the bundled Natural Earth basemap ([map provenance](docs/map-data.md)). In the forecast it is a 220px locator spanning its tile, with hairlines above and below; elsewhere it keeps its own border. The expand control and welcome “Choose on map” action open the same wide map mode in the Radix location picker. Closing or pressing Escape returns to the opener without changing the URL. Selecting a point closes the picker and focuses the forecast immediately. The inline map commits directly, too. Old `view=map` links open this picker once and remove the obsolete view parameter. Clicking a city label selects that city; a free click or “Use map center” keeps exact coordinates. Pan and zoom alone never request a forecast. The renderer loads as the map approaches the viewport.

### Feedback and motion

Loading keeps the footprint with static soft placeholders sized from measured layouts. The summary heading and horizon control are real; below them the summary placeholder is 180px plus 59px per local day with the boxes side by side, 300px plus 116px stacked, and 390px plus 114px on phones. The hourly tile is 712px (746px on phones), and the aside has 430px and 374px tiles. The sky band shows a neutral soft surface until a scene exists. The meta line shows coordinates until the timezone is known, then swaps one for the other. Refresh, offline, stale, partial-coverage and error states come from real API state. Same-point refresh and horizon changes keep the plots; a new point shows its own pending state.

Refresh is explicit: the button (or R) bypasses the server cache once a snapshot is a minute old. While it runs, a Motion Primitives TextShimmer reads "Refreshing forecast…" and the icon spins (0.8s, linear); background polls stay silent. The status region then announces the new retrieval age.

The sky band and welcome loops are the authored motion moments; elsewhere motion serves state and feedback, following Emil Kowalski's rules. Pointer-driven fills move with a spring (horizon and day strip; stiffness 430, damping 38); keyboard-driven changes snap. The tile highlight glides between tiles on a no-bounce spring over 250ms. Popovers scale from `0.97` at their trigger with opacity, 150ms in and 100ms out on `cubic-bezier(0.23, 1, 0.32, 1)` (the `--ease-out` token), entering through `@starting-style`. Inline transitions take 160ms with a few pixels of travel; the place name has a 4px entry; the map recenters over 320ms; a focused summary row tints over 150ms. The cursor, readout, chart contents, Hours to watch selection and forecast values never animate. Reduced motion removes all of it and stills the sky.

Keyboard shortcuts, listed in the footer on pointer devices: `/` search, `R` refresh, `1` `2` `3` horizons, `Esc` all days. They are ignored while typing or when a dialog or popover is open.

## Do's and Don'ts

### Do:

- **Do** answer by local day first, then by hour.
- **Do** keep units, interval meaning, timezone and data limitations beside the measurements.
- **Do** synchronize every hour-selection path: plots, keys, Hours to watch, day focus.
- **Do** compare like with like: the same hours for normals and revisions, n/a where coverage stops.
- **Do** provide keyboard inspection, the hourly table, visible focus and useful mobile controls.
- **Do** keep the map functional and location choice deliberate.
- **Do** derive the forecast sky from provider data; keep welcome illustrations separate. Preserve each sky's contrast window and still it under reduced motion.

### Don't:

- **Don't** reintroduce card grids, per-card icons or per-card disclaimers, or nest a tile inside a tile.
- **Don't** put the analysis behind a dialog.
- **Don't** imply calibrated energy exposure, PV output or prices without portfolio data.
- **Don't** add decorative motion beyond the sky band and the user-requested welcome scenes and loops, add glass or fabricated live badges, or animate keyboard and high-frequency actions.
- **Don't** present modelled conditions, the sky or retrieval time as sensor evidence or model issue time.
