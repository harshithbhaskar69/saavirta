# Boundary provenance and acceptance

Live Finland/Åland eligibility uses the **verified National Land Survey 2026 Division into administrative areas, 1:10,000** artifact. It was acquired on 15 October 2026 using `NLS_API_KEY` injected from Infisical. The source was updated on 9 June 2026, including the Norway-border revision. No NLS credential or runtime NLS call is needed by the embedded checker.

The dataset includes administrative waters; it is not a shoreline map and does not include the wider EEZ. Natural Earth is only the browser basemap. Eligibility always checks the requested coordinates, independent of country labels and weather grid adjustments. Åland returns `SE3` with `national_comparison`; a persistent notice distinguishes Finland's national data from local prices.

## Pinned source and conversion

[The embedded manifest](../../src/server/markets/data/manifest.json) records source ZIP/GeoPackage and output SHA-256 checksums, delivery/update dates, transformation, GDAL container digest and acceptance results. The source GeoPackage has `Valtakunta` (one state), `Maakunta` (19 regions) and `Kunta` (308 municipalities), in EPSG:3067. Åland is `Maakunta` with `natcode = '21'` and `namefin = 'Ahvenanmaa'`.

The authenticated [NLS download API](https://www.maanmittauslaitos.fi/paikkatiedon-tiedostopalvelu) uses HTTP Basic authentication with the key as username. Credentials stay in process memory; do not put them in URLs or shell arguments. The 2026 delivery was requested from process `hallinnolliset_aluejaot_vektori_koko_suomi` with this JSON body, then retrieved through the returned job/result links:

```json
{"id":"hallinnolliset_aluejaot_vektori_koko_suomi","inputs":{"fileFormatInput":"GPKG","dataSetInput":"kuntajako_10k","yearInput":2026}}
```

After extracting the GeoPackage to `.local/nls/source.gpkg`, reproduce the conversion from the repository root. The output below goes to an ignored directory so a verification run does not overwrite the accepted manifest:

```sh
docker run --rm -v "$PWD:/work" -w /work \
  ghcr.io/osgeo/gdal@sha256:64250faf833c06d4b21afce4c27190039ba7ab58d70f0eebc87cf77d929c0b40 \
  python3 scripts/prepare-market-boundary.py .local/nls/source.gpkg \
  --state-layer Valtakunta --region-layer Maakunta \
  --aland-filter "natcode = '21'" --delivered 2026-10-15 \
  --output .local/nls/reproduced
shasum -a 256 .local/nls/reproduced/boundaries.json src/server/markets/data/boundaries.json
```

GDAL 3.13.3 / PROJ transforms EPSG:3067 to EPSG:4326 with RFC 7946 ordering, without simplification, buffering or shoreline clipping. The script requires GDAL's Python bindings and CLI; it rejects empty or over-64-MiB output. A new conversion always leaves `verified=false` pending acceptance. For future deliveries, inspect actual layer names, regional identifiers and membership rather than copying the 2026 acceptance blindly.

## Acceptance completed on 15 October 2026

- The source state polygon exactly matches the union of all 308 municipal polygons; Åland exactly matches its 16 municipal parts. Both symmetric differences are **0 m²**. This checks the regional layer's completeness against ungeneralized municipal parts instead of assuming it from catalog wording.
- State, Åland, their municipal unions and transformed output are topologically valid. GDAL reports internal self-intersections in 18 source municipal inputs, recorded by code in the manifest. Those individual municipal geometries are not embedded or repaired; the accepted state/Åland geometries and unions are valid.
- Both output geometries preserve their source rings and vertices: Finland one ring / 30,729 vertices, Åland one ring / 280 vertices. The maximum measured projection round-trip error is 0.006082 metres. The artifact is **737,579 bytes**, embedded in the Worker, never sent to browsers.
- `tests/unit/markets/domain.test.ts` checks Helsinki, Oulu, Nuorgam, Utö, Hailuoto, Finnish administrative waters and Tornio; Mariehamn and Kökar; Stockholm, Tallinn, Haparanda, Karasjok, Kostomuksha and waters beyond the Finnish administrative border. It also checks a real boundary segment, points 10 metres on both sides (uncertain), and points 100 metres on both sides (inside/outside).
- Existing synthetic geometry tests separately exercise holes and disconnected parts. These prove checker behavior; the real artifact test establishes source-specific acceptance.

```sh
npx vitest run tests/unit/markets/domain.test.ts
```

The 25-metre uncertainty band is a conservative product policy, not a claim about source accuracy. CI verifies the pinned checksum. Runtime validation checks the manifest and complete polygon structure. Invalid or unverified geometry disables market eligibility while global weather remains available. Demonstration mode uses the same authoritative geometry with explicitly synthetic market values and is forbidden in production.

Attribution in the Sources drawer and third-party notices: “Contains National Land Survey of Finland Division into administrative areas data, delivered 15 October 2026, CC BY 4.0.” See the [dataset specification](https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/product-descriptions/division-administrative-areas-vector) and [licence](https://www.maanmittauslaitos.fi/en/opendata-licence-cc40).
