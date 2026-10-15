# Third-party notices

Bundled assets and adapted code retain their upstream licenses:

| Component | Source | License |
| --- | --- | --- |
| Animated Background (also in its hover mode, for the analysis tiles), Transition Panel, Text Shimmer, Text Loop, Text Roll, Infinite Slider and Disclosure (the Morphing Dialog pattern was used earlier and removed) | [Motion Primitives](https://github.com/ibelick/motion-primitives), adapted for controlled selection, keyboard-initiated snapping, panels anywhere in the tree, a CSS-driven shimmer, stable text sizing, accessible city links, native slider measurement, native disclosure buttons and reduced motion | [MIT, copyright 2024 ibelick](docs/licenses/motion-primitives.txt) |
| `hash12` in the sky shader | Dave Hoskins, [Hash without Sine](https://www.shadertoy.com/view/4djSRW) | [MIT, copyright 2014 David Hoskins](docs/licenses/hash-without-sine.txt) |
| IBM Plex Sans variable font | [IBM Plex / Fontsource](https://github.com/IBM/plex) | [SIL Open Font License](docs/licenses/ibm-plex-sans.txt) |
| Country flags | [country-flag-icons](https://github.com/catamphetamine/country-flag-icons) | [MIT](docs/licenses/country-flag-icons.txt) |
| Interface and weather icons | [Phosphor](https://github.com/phosphor-icons/react) | [MIT](docs/licenses/phosphor.txt) |
| Map rendering | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | [BSD 3-Clause](docs/licenses/maplibre.txt) |
| Countries, cities, regional boundaries and rivers | [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) | Public domain; [source revision and transformations](docs/map-data.md) |
| Weather and geocoding data | [Open-Meteo](https://open-meteo.com/en/terms) | Provider terms apply; attribution appears in the app |

Other npm dependencies retain their license files in their distributed packages.

The market XML adapter uses [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) (MIT). [Fingrid test fixtures](tests/fixtures/markets/providers/README.md) contain authenticated Open Data responses retrieved 2026-10-15, attributed to Fingrid under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). UI fixtures remain explicitly synthetic. No ENTSO-E observations are bundled.

Contains National Land Survey of Finland **Division into administrative areas, 1:10,000, 2026**, delivered 2026-10-15, under [CC BY 4.0](https://www.maanmittauslaitos.fi/en/opendata-licence-cc40). Finland and Åland geometry is transformed from EPSG:3067 to WGS84 without simplification and embedded only in the Worker. The source was updated 2026-06-09. Checksums, transformation and acceptance evidence are in [the manifest](src/server/markets/data/manifest.json) and [geographic workflow](docs/markets/geography.md).
