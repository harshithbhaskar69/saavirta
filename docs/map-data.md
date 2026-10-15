# Bundled map provenance

Natural Earth public-domain vector data, retrieved 13 October 2026 from revision [`ca96624a56bd078437bca8184e78163e5039ad19`](https://github.com/nvkelso/natural-earth-vector/tree/ca96624a56bd078437bca8184e78163e5039ad19/geojson).

| Local asset | Upstream file | Processing |
| --- | --- | --- |
| `public/maps/countries.geojson` | `ne_50m_admin_0_countries.geojson` | Retained geometry, English name and ISO code; coordinates rounded to four decimals |
| `public/maps/country-labels.geojson` | Same country file | Natural Earth's label coordinates, rank and English name |
| `public/maps/cities.geojson` | `ne_10m_populated_places_simple.geojson` | Retained names, region, country, ISO code, label rank/zoom and population; assigned stable feature IDs and rounded coordinates |
| `public/maps/regions.geojson` | `ne_10m_admin_1_states_provinces_lines.geojson` | Omitted one null geometry; removed attributes, rounded coordinates and simplified lines with Douglas-Peucker tolerance 0.015 degrees |
| `public/maps/rivers.geojson` | `ne_50m_rivers_lake_centerlines.geojson` | Geometry only, rounded coordinates |

The 242 country features and 7,342 city points provide regional context. This is a selected gazetteer, not every settlement or a street/address database. Some labels and boundaries reflect the source's conventions and age.

Clicking a city label or its accessible button selects the published city point and supplies its regional identity. A free map click or “Use map center” preserves the requested coordinates and, within 25 km of a bundled city, uses “Near [city]”. It does not infer a country flag or an address from proximity. No reverse-geocoding service receives map clicks. The map stops at zoom 8 because additional zoom would exceed this dataset's useful detail. Forecast coordinates remain independent of map resolution.

Labels use the existing local Plex font through MapLibre's installed `font-faces` support. All geometry, labels, and fonts are bundled. Optional MapTiler styles remain a separate configured path.
