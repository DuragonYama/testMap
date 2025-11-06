import { useState, useEffect, useRef } from "react";
import "./App.css";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

// Fetch route using OpenRouteService
async function fetchRoute(
  start: [number, number],
  end: [number, number],
  profile: string
): Promise<GeoJSON.Feature<GeoJSON.LineString>> {
  const apiKey =
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY3ZTFlYWU3ODA1NTRjZDk5ODVjODIyMzI1N2FlYzI3IiwiaCI6Im11cm11cjY0In0=";

  const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${apiKey}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;

  const resp = await fetch(url);
  const data = await resp.json();

  const geometry = data.features[0].geometry as GeoJSON.LineString;

  return {
    type: "Feature",
    geometry,
    properties: {},
  };
}

// Geocode locatie naar coördinaten
async function geocodeLocation(query: string): Promise<[number, number]> {
  const apiKey =
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY3ZTFlYWU3ODA1NTRjZDk5ODVjODIyMzI1N2FlYzI3IiwiaCI6Im11cm11cjY0In0=";

  const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(
    query
  )}`;

  const resp = await fetch(url);
  const data = await resp.json();

  if (!data.features || data.features.length === 0) {
    throw new Error("Locatie niet gevonden");
  }

  const coords = data.features[0].geometry.coordinates as [number, number];
  return coords;
}

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const routeMarkers = useRef<maplibregl.Marker[]>([]);
  const userMarkers = useRef<maplibregl.Marker[]>([]);

  const [startLocation, setStartLocation] = useState("Amsterdam");
  const [endLocation, setEndLocation] = useState("Utrecht");
  const [profile, setProfile] = useState<string>("driving-car");

  const [placing, setPlacing] = useState<string | null>(null);
  const [savedMarkers, setSavedMarkers] = useState<
    { type: string; coords: [number, number] }[]
  >([]);

  const [routeDistance, setRouteDistance] = useState<number | null>(null);

  // Helper: create emoji marker
  const createEmojiMarker = (emoji: string, coords: [number, number]) => {
    const el = document.createElement("div");
    el.style.fontSize = "24px";
    el.textContent = emoji;

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(coords)
      .addTo(map.current!);

    return marker;
  };

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

    // Redraw saved markers
    savedMarkers.forEach((m) => {
      const emoji = m.type === "restaurant" ? "🍴" : "🌳";
      const marker = createEmojiMarker(emoji, m.coords);
      userMarkers.current.push(marker);
    });

    // Show coordinates on mousemove
    map.current.on("mousemove", (e) => {
      const lng = e.lngLat.lng.toFixed(5);
      const lat = e.lngLat.lat.toFixed(5);

      const coordBox = document.getElementById("coords");
      if (coordBox) {
        coordBox.innerHTML = `Longitude: <b>${lng}</b><br>Latitude: <b>${lat}</b>`;
      }
    });

    // Click map to place user marker
    map.current.on("click", (e) => {
      if (!placing) return;

      const newMarker = {
        type: placing,
        coords: [e.lngLat.lng, e.lngLat.lat] as [number, number],
      };

      setSavedMarkers((prev) => [...prev, newMarker]);

      const emoji = placing === "restaurant" ? "🍴" : "🌳";
      const marker = createEmojiMarker(emoji, newMarker.coords);
      userMarkers.current.push(marker);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [savedMarkers, placing]);

  // Draw route
  async function drawRoute() {
    if (!map.current) return;

    try {
      // Geocode locaties
      const start = await geocodeLocation(startLocation);
      const end = await geocodeLocation(endLocation);

      const routeFeature = await fetchRoute(start, end, profile);

      // Remove old route markers only
      routeMarkers.current.forEach((m) => m.remove());
      routeMarkers.current = [];

      // Add route line
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

      // Add start/end markers
      const startMarker = new maplibregl.Marker({ color: "green" })
        .setLngLat(start)
        .addTo(map.current);
      const endMarker = new maplibregl.Marker({ color: "red" })
        .setLngLat(end)
        .addTo(map.current);
      routeMarkers.current.push(startMarker, endMarker);

      // Fit bounds to route
      const coords = routeFeature.geometry.coordinates;
      const bounds = new maplibregl.LngLatBounds(
        coords[0] as [number, number],
        coords[0] as [number, number]
      );
      coords.forEach((coord) => bounds.extend(coord as [number, number]));
      map.current.fitBounds(bounds, { padding: 50 });

      // Bereken afstand (ongeveer)
      let distance = 0;
      for (let i = 1; i < coords.length; i++) {
        const [lng1, lat1] = coords[i - 1];
        const [lng2, lat2] = coords[i];
        const R = 6371; // km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lng2 - lng1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance += R * c;
      }
      setRouteDistance(Number(distance.toFixed(2)));
    } catch (error) {
      alert("Kon route niet tekenen: " + (error as Error).message);
    }
  }

  // Draw route on map load
  useEffect(() => {
    if (!map.current) return;
    map.current.on("load", drawRoute);
  }, []);

  return (
    <>
      <div ref={mapContainer} id="map" />

      <div className="control-panel">
        <h2>Route Planner</h2>

        <label>Start locatie</label>
        <input
          type="text"
          value={startLocation}
          onChange={(e) => setStartLocation(e.target.value)}
        />

        <label>Eind locatie</label>
        <input
          type="text"
          value={endLocation}
          onChange={(e) => setEndLocation(e.target.value)}
        />

        <label>Route type:</label>
        <select value={profile} onChange={(e) => setProfile(e.target.value)}>
          <option value="driving-car">Auto</option>
          <option value="cycling-regular">Fiets</option>
          <option value="foot-walking">Lopen</option>
        </select>

        <button onClick={drawRoute}>Teken Route</button>

        <div id="coords" className="coords-display">
          Beweeg over de kaart...
        </div>
      </div>

      <div className="toolbar">
        <button
          className={placing === "restaurant" ? "active" : ""}
          onClick={() => setPlacing("restaurant")}
          title="Voeg restaurant toe"
        >
          🍴
        </button>
        <button
          className={placing === "park" ? "active" : ""}
          onClick={() => setPlacing("park")}
          title="Voeg park toe"
        >
          🌳
        </button>
        <button
          className={placing === null ? "" : ""}
          onClick={() => setPlacing(null)}
          title="Stop plaatsen"
        >
          ❌
        </button>
      </div>

      {/* Nieuwe rechterzijbalk */}
      <div className="sidebar">
        <h3>Route Info</h3>
        {routeDistance !== null ? (
          <p>Afstand: {routeDistance} km</p>
        ) : (
          <p>Route niet berekend</p>
        )}
        <p>Markers geplaatst: {savedMarkers.length}</p>

        <h3>Markers</h3>
        <ul>
          {savedMarkers.map((m, i) => (
            <li key={i}>
              {m.type === "restaurant" ? "🍴" : "🌳"} (
              {m.coords[0].toFixed(3)}, {m.coords[1].toFixed(3)})
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default App;
