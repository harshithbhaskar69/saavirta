"""Offline NLS conversion. Requires ogr2ogr and GDAL's Python bindings.

The input must be the complete NLS 1:10,000 administrative GeoPackage. Layer
names vary by release: inspect with ogrinfo, then pass the exact layer names.
No simplification, dissolving, buffering or shoreline clipping is performed.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile
from osgeo import ogr


def check_source(args):
    ogr.UseExceptions()
    source = ogr.Open(str(args.source))
    state_layer = source.GetLayerByName(args.state_layer)
    region_layer = source.GetLayerByName(args.region_layer)
    assert state_layer.GetSpatialRef().GetAuthorityCode(None) == "3067"
    assert region_layer.GetSpatialRef().GetAuthorityCode(None) == "3067"
    assert state_layer.GetFeatureCount() == 1
    state_feature = state_layer.GetNextFeature()
    state = state_feature.GetGeometryRef().Clone()
    region_layer.SetAttributeFilter(args.aland_filter)
    assert region_layer.GetFeatureCount() == 1
    region_feature = region_layer.GetNextFeature()
    assert region_feature.GetField("namefin") == "Ahvenanmaa"
    aland = region_feature.GetGeometryRef().Clone()
    assert state.IsValid() and aland.IsValid()

    # Confirm the regional layer loses no municipal enclaves or disconnected parts.
    aland_codes = {"035", "043", "060", "062", "065", "076", "170", "295", "318", "417", "438", "478", "736", "766", "771", "941"}
    national_parts = ogr.Geometry(ogr.wkbMultiPolygon)
    aland_parts = ogr.Geometry(ogr.wkbMultiPolygon)
    municipalities = source.GetLayerByName("Kunta")
    found = set()
    invalid_municipalities = []
    for feature in municipalities:
        geometry = feature.GetGeometryRef()
        if not geometry.IsValid():
            invalid_municipalities.append(feature.GetField("natcode"))
        parts = [geometry] if ogr.GT_Flatten(geometry.GetGeometryType()) == ogr.wkbPolygon else list(geometry)
        code = feature.GetField("natcode")
        for part in parts:
            national_parts.AddGeometry(part)
            if code in aland_codes:
                aland_parts.AddGeometry(part)
                found.add(code)
    assert found == aland_codes
    national_union = national_parts.UnionCascaded()
    aland_union = aland_parts.UnionCascaded()
    assert national_union.IsValid() and aland_union.IsValid()
    differences = {"finland": state.SymDifference(national_union).GetArea(), "aland": aland.SymDifference(aland_union).GetArea()}
    assert all(area <= .01 for area in differences.values()), "State/region differs from complete municipal parts; review source"
    return {"municipalities": municipalities.GetFeatureCount(), "alandMunicipalities": sorted(found),
            "symmetricDifferenceM2": differences, "sourceAreaM2": {"finland": state.GetArea(), "aland": aland.GetArea()},
            "topologyValid": True, "invalidMunicipalInputs": invalid_municipalities}


def validate(features):
    assert {f["properties"]["region"] for f in features} == {"finland", "aland"}, "Both complete regions are required"
    for feature in features:
        geometry = feature["geometry"]
        assert geometry["type"] in ("Polygon", "MultiPolygon"), "Polygon geometry required"
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        assert polygons, "Empty boundary"
        for polygon in polygons:
            assert polygon, "Empty polygon"
            for ring in polygon:
                assert len(ring) >= 4 and ring[0] == ring[-1], "Closed rings required"
                assert all(18 <= p[0] <= 32 and 59 <= p[1] <= 71 for p in ring), "Expected complete Finland coordinates in WGS84"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=pathlib.Path)
    parser.add_argument("--state-layer", required=True)
    parser.add_argument("--region-layer", required=True)
    parser.add_argument("--aland-filter", required=True, help="OGR attribute filter identifying the complete Aland region")
    parser.add_argument("--delivered", required=True, help="NLS delivery date YYYY-MM-DD")
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path("src/server/markets/data"))
    args = parser.parse_args()
    acceptance = check_source(args)
    features = []
    with tempfile.TemporaryDirectory() as temp:
        for region, layer, where in [("finland", args.state_layer, None), ("aland", args.region_layer, args.aland_filter)]:
            target = pathlib.Path(temp) / f"{region}.geojson"
            command = ["ogr2ogr", "-f", "GeoJSON", "-s_srs", "EPSG:3067", "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES", str(target), str(args.source), layer]
            if where:
                command += ["-where", where]
            subprocess.run(command, check=True)
            source = json.loads(target.read_text())
            assert source["features"], f"No {region} features"
            for feature in source["features"]:
                features.append({"type": "Feature", "properties": {"region": region}, "geometry": feature["geometry"]})
    validate(features)
    encoded = (json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")) + "\n").encode()
    assert len(encoded) <= 64 * 1024 * 1024, "Artifact exceeds 64 MiB; review before enabling"
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "boundaries.json").write_bytes(encoded)
    manifest = {
        "version": f"nls-administrative-10k-{args.delivered}", "verified": False,
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "sourceSha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
        "source": "National Land Survey of Finland, Division into administrative areas, 1:10000",
        "delivered": args.delivered, "license": "CC BY 4.0", "sourceCRS": "EPSG:3067", "targetCRS": "EPSG:4326",
        "transformation": "GDAL/PROJ ogr2ogr EPSG:3067 to EPSG:4326; RFC7946; no simplification",
        "gdal": subprocess.check_output(["ogr2ogr", "--version"], text=True).strip(),
        "stateLayer": args.state_layer, "regionLayer": args.region_layer, "alandFilter": args.aland_filter,
        "artifactBytes": len(encoded), "features": len(features),
        "sourceAcceptance": acceptance,
        "note": "Keep verified=false until complete-layer, topology, border, water, enclave and attribution checks pass.",
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(encoded)} bytes; live eligibility remains disabled pending geographic acceptance.")


if __name__ == "__main__":
    main()
