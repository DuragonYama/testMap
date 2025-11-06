import { useState, useEffect, useRef } from "react";
import "./App.css";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

// Fetch route using OpenRouteService
async function fetchRoute(
  start: [number, number],
  end: [number, number]
): Promise<GeoJSON.Feature<GeoJSON.LineString>> {
  const apiKey =
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY3ZTFlYWU3ODA1NTRjZDk5ODVjODIyMzI1N2FlYzI3IiwiaCI6Im11cm11cjY0In0=";

  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;

  const resp = await fetch(url);
  const data = await resp.json();

  const geometry = data.features[0].geometry as GeoJSON.LineString;

  return {
    type: "Feature",
    geometry,
    properties: {},
  };
}

function App() {
  const markers = useRef<maplibregl.Marker[]>([]);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const [startLng, setStartLng] = useState<number>(5.2089);
  const [startLat, setStartLat] = useState<number>(52.3613);
  const [endLng, setEndLng] = useState<number>(6.0881);
  const [endLat, setEndLat] = useState<number>(52.5077);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [5.3, 52.1],
      zoom: 8,
    });

    map.current.on("mousemove", (e) => {
      const lng = e.lngLat.lng.toFixed(5);
      const lat = e.lngLat.lat.toFixed(5);
  
      const coordBox = document.getElementById("coords");
      if (coordBox) {
        coordBox.innerHTML = `Longitude: <b>${lng}</b><br>Latitude: <b>${lat}</b>`;
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  async function drawRoute() {
    if (!map.current) return;
  
    const start: [number, number] = [startLng, startLat];
    const end: [number, number] = [endLng, endLat];
  
    const routeFeature = await fetchRoute(start, end);

    markers.current.forEach(m => m.remove());
    markers.current = [];
  
    if (map.current.getSource("route")) {
      (map.current.getSource("route") as maplibregl.GeoJSONSource).setData(
        routeFeature
      );
    } else {
      map.current.addSource("route", { type: "geojson", data: routeFeature });
      map.current.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#0074D9", "line-width": 4 },
      });
    }

    const startMarker = new maplibregl.Marker({ color: "green" })
      .setLngLat(start)
      .addTo(map.current);
  
    const endMarker = new maplibregl.Marker({ color: "red" })
      .setLngLat(end)
      .addTo(map.current);
  
    markers.current.push(startMarker, endMarker);

    const coords = routeFeature.geometry.coordinates;
    const bounds = new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]);

    for (const coord of coords) {
      bounds.extend(coord as [number, number]);
    }

map.current.fitBounds(bounds, { padding: 50 });

  }
  

  useEffect(() => {
    if (!map.current) return;
    map.current.on("load", drawRoute);
  }, [map.current]);

  return (
    <>
      <div className="container">
        <div style={{ padding: "10px", background: "#f0f0f0" }}>
          <label>Start (lng, lat): </label>
          <br />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={startLng}
            onChange={(e) => setStartLng(parseFloat(e.target.value))}
          />
          <br />
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={startLat}
            onChange={(e) => setStartLat(parseFloat(e.target.value))}
          />
          <br />
          <label>End (lng, lat): </label>
          <br />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={endLng}
            onChange={(e) => setEndLng(parseFloat(e.target.value))}
          />
          <br />
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={endLat}
            onChange={(e) => setEndLat(parseFloat(e.target.value))}
          />
          <br /> <br />
          <button onClick={drawRoute}>Draw Route</button>
          <br /> <br />
          <div id="coords" style={{ padding: "8px", background: "#fff", fontSize: "14px" }}>
            Beweeg over de kaart...
          </div>

        </div>

        <div
          ref={mapContainer}
          style={{ width: "80vw", height: "100vh" }}
        />
      </div>
    </>
  );
}

export default App;
