export async function load3DStyle(signal) {
  const response = await fetch("https://tiles.openfreemap.org/styles/bright", {
    signal,
  });
  if (!response.ok) throw new Error("지도 스타일을 불러오지 못했습니다.");
  const style = await response.json();
  for (const layer of style.layers) {
    if (
      layer.type === "symbol" &&
      layer.layout?.["text-field"] &&
      JSON.stringify(layer.layout["text-field"]).includes("name")
    ) {
      layer.layout["text-field"] = [
        "coalesce",
        ["get", "name:ko"],
        ["get", "name"],
        ["get", "name:en"],
      ];
    }
  }
  const before = style.layers.findIndex(
    (layer) => layer.type === "symbol" && layer.layout?.["text-field"],
  );
  style.layers.splice(before < 0 ? style.layers.length : before, 0, {
    id: "drive-buildings-3d",
    type: "fill-extrusion",
    source: "openmaptiles",
    "source-layer": "building",
    minzoom: 14,
    filter: ["!=", ["get", "hide_3d"], true],
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], 0],
        0,
        "#cedbd8",
        80,
        "#94b5b0",
        200,
        "#638e8b",
      ],
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.94,
    },
  });
  return style;
}
export function routeFeature(points = []) {
  const coordinates = points
    .filter(
      (point) =>
        Number.isFinite(point.longitude) && Number.isFinite(point.latitude),
    )
    .map((point) => [point.longitude, point.latitude]);
  return {
    type: "FeatureCollection",
    features:
      coordinates.length > 1
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates },
            },
          ]
        : [],
  };
}
