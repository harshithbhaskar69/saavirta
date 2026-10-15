# Säävirta design review and refinement

## Summary

Needs work at the start of this pass. The React web application's job is to connect a geographic monitoring point to its temperature and solar forecast. Its strongest element is the shared hour across the two charts. The supplied screenshots expose a weaker geographic experience: unlabeled country geometry, an anonymous selected point, and repeated product scaffolding.

This is a targeted evolution of the approved identity. `DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 6`. The taste skill's landing-page imagery, hero and scroll storytelling prescriptions do not apply to this analyst workspace. Apple's foundations apply; native macOS navigation conventions do not.

## Improvements

- **High: anonymous map selection.** Every click becomes “Selected point”, even when selecting a city. Add a bundled gazetteer with city labels and explicit city selection. Preserve exact coordinates for free point selection; describe proximity as “Near”, without pretending to reverse-geocode an address. This is a product judgment.
- **High: map detail does not match the task.** The original 110m country geometry loses usefulness at regional zoom. Use finer country geometry, regional boundaries, rivers, and ranked city labels; retain an honest maximum zoom. `charting-data.md › Designing effective charts`: “Match the size of a chart to its functionality, topic, and level of detail.” Applying this principle to the geographic visualization is a design judgment.
- **Medium: duplicate identity and guidance.** Remove the Forecast Desk header label, repeated conditions in the map sidebar, and generic supporting prose. `branding.md › Best practices`: “Ensure branding always defers to content.”
- **Medium: flat state changes.** Extend the existing Motion Primitives selection and transition components to navigation, location names, appearance icons, and copy confirmation. Keep chart readings immediate. `motion.md › Providing feedback`: “Aim for brevity and precision in feedback animations.”
- **Medium: weak grouping.** Tighten the location/condition group, reduce oversized empty gaps, and give the selected map point an attached name. `layout.md › Visual hierarchy`: “Group related items to clearly express related information or functions.”

## Token and composition plan

Preserve Plex, the forest temperature signal, and ochre irradiance. Actual foreground/background contrast ratios computed using WCAG relative luminance:

| Role | Light value / surface | Ratio | Dark value / surface | Ratio |
| --- | --- | --- | --- | --- |
| Content | `#233a33` / `#f5f7f5` | 11.31 | `#e3ece6` / `#17251f` | 13.18 |
| Secondary | `#536b61` / `#f5f7f5` | 5.35 | `#a5b9ac` / `#17251f` | 7.67 |
| Temperature/action | `#27634f` / `#f5f7f5` | 6.54 | `#99d0b3` / `#17251f` | 9.11 |
| Solar label | `#936014` / `#f5f7f5` | 4.97 | `#e0b576` / `#17251f` | 8.36 |

One family: Plex, 32px location, 23px forecast statement, 14px body, 12-13px metadata, tabular data. Keep familiar buttons and the existing Radix dialog. No new visual framework or animation dependency.

Regular: `brand / Forecast / Map / appearance`, then `flag + place / horizon + search`, `conditions / retrieval`, and either `paired plots / shared hour` or `labeled geographic map | forecast hours`.

Compact: the same reading order in one column, with controls wrapping as groups, a bounded map, and accessible city choices beneath it.

The signature is recognizable geography connected to a shared forecast hour. This serves a weather monitoring task specifically; decorative motion, stock photography, and rolling numbers would obscure it. Remove the internal concept label. Sequence: preserve accessible controls, repair geographic meaning, refine hierarchy, then apply brief motion.

## Sources and limits

Apple references read under `apple-design/references/`: accessibility, layout, typography, color, designing-for-macos, cross-platform, dark-mode, motion, branding, and charting-data. Citations above refer to those files and headings.

Bundled geography comes from [Natural Earth](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/). It supplies regional context and selected cities, not street addresses. Motion components are adapted from the [Motion Primitives source](https://github.com/ibelick/motion-primitives/tree/main/components/core); its docs endpoint returned 403 during this pass. Reduced motion, keyboard operation, both themes, mobile layout, and browser errors are checked in the local application.

## Implementation result

The visible Forecast Desk label is removed. Named city selection, regional labels, a metric scale, a named marker, keyboard city choices, and recentering are implemented. Selecting the actual Mysuru label supplies Mysuru, Karnataka, India and its flag. Theme changes retain the map camera. Free point selection keeps its coordinates and uses proximity wording without inventing country identity.

The header, location group and outlook spacing are tighter. Temperature and irradiance receive their established colors within the forecast statement. Redundant map-sidebar identity, conditions and generic helper copy are removed. Motion Primitives now coordinate navigation, horizon, workspace, name and status-icon changes, with immediate reduced-motion behavior.

A throttled local audit exposed content shifts while loading and eager offscreen map startup. The fix reserves loading space and defers MapLibre until the map approaches the viewport. Lighthouse performance moved from 42 to 88, CLS from 0.654 to 0.0001, and total blocking time from 840 ms to 10 ms. Accessibility and best-practices scores were 100. The simulated mobile LCP remains 3.8 s; these are local lab measurements, not field Core Web Vitals. See [verification](verification.md) for evidence and testing limits.
