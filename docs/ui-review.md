# Web interface review

Reviewed `src/app/` and `src/components/` against the [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md), the approved Forecast Desk system, and Apple's accessibility/motion foundations adapted to web conventions.

Resolved during implementation:

- `src/components/providers.tsx:21` — decorative icons are hidden from assistive technology; shared defaults retain a bounded icon size.
- `src/components/forecast-charts.tsx:212` — shared range control has a label and descriptive values; the hourly table gives a non-visual data path. Both axes use matching numeric time domains.
- `src/app/globals.css:480` — axis text uses the theme's muted color, including dark mode.
- `src/components/location-dialog.tsx:272` — coordinate errors remain inline and focus the invalid coordinate field.
- `src/components/location-dialog.tsx` and `src/components/forecast-desk.tsx` — search focuses its field on desktop; device and coarse-pointer entry focus the dialog. Closing restores the invoking button, with the workspace as fallback when selection removes it. Playwright verifies each path on desktop and mobile.
- `src/components/conditions.tsx:71` — weather motion is bounded to four seconds, disabled for reduced motion, and static for unavailable or older conditions.
- `src/components/flag.tsx:8` — flags have known country codes, descriptive alt text, and explicit dimensions.
- `src/components/forecast-desk.tsx` — view and horizon reflect in URLs; device coordinates require explicit sharing; retrieval/coverage/error states are visible; important-hour changes announce the selected readings.

Native buttons, links, labelled inputs and disclosures supply keyboard interaction. Dialogs provide focus containment and Escape handling. Browser evidence includes both theme contrast scans, responsive overflow checks and reduced-motion checks. The loaded forecast passed axe in both viewport classes and themes.

The independent finish reviewer requested the explicit dialog focus lifecycle and removal of the welcome-page eyebrow. It scored both fixes resolved, with disposition `ship` for that fix list. Its findings and final scoring are recorded in `.impeccable/review/production-verdict.md`.

The product's approved sentence case takes precedence over the guideline's generic title-case suggestion. No native iOS or macOS navigation conventions were copied into the web app.

The subsequent [design refinement](design-refinement.md) removes the visible concept label, improves geographic meaning, and extends the existing Motion Primitives. Its current evidence is 31 unit/service tests, 18 browser cases, seven live checks and refreshed captures. The earlier independent verdict above applies only to its original fix list.

The later [retailer overview refinement](retailer-overview.md) implemented the user-requested compact metrics and expandable analysis, primary-hover fix, map expansion, baseline alignment and current-temperature emphasis.

The subsequent [retailer review](retailer-overview.md) superseded that composition: a daily summary table by local day, inline hourly analysis instead of the dialog, Hours to watch beside the plots, a demoted modelled-now line, a nine-step type ramp and six radius roles. Evidence: 38 unit tests, 22 browser cases with axe scans in both themes, seven live-provider checks, Impeccable's detector at 0 findings and a repeat Lighthouse audit.

The [second review](retailer-overview.md#second-review-comparisons-scrubbing-and-refresh) separated the summary into Temperature and Solar boxes, replaced the range input with chart-integrated scrubbing, made refresh bypass the cache, and added normals, revisions, day focus, definitions popovers, spreadsheet copy and shortcuts. It was checked against the Web Interface Guidelines (no new findings; two pre-existing `outline: none` cases are justified) and review-animations (approved after keyboard-initiated fills were made to snap and popover exits shortened). Evidence: 51 unit tests, 24 browser cases with axe scans, ten live-provider checks, 0 detector findings and a repeat Lighthouse audit. [Verification](verification.md) records the build, results and limitations.
