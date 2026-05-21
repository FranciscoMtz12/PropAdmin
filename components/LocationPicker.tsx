"use client";

/*
  LocationPicker — selector de ubicación para edificios.

  UI:
  1. Buscador de direcciones con autocompletado (Nominatim, México).
  2. Mini mapa interactivo con marcador arrastrable / click para colocar.
  3. Línea de coordenadas actuales debajo del mapa.

  Se importa dinámicamente desde la página padre (ssr: false) porque
  Leaflet requiere `window`.

  Notas:
  - Nominatim pide un User-Agent identificable y rate-limit de 1 req/seg
    en su política de uso. Con debounce de 500ms y el countrycode=mx se
    mantiene dentro del rango.
  - No requiere API key, pero en producción seria conviene hostear
    un Nominatim propio o usar MapTiler/Mapbox geocoding.
*/

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Search } from "lucide-react";

/* Fix del ícono default de Leaflet en Next.js. */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/* Monterrey como centro por defecto si no hay coordenadas. */
const MONTERREY_CENTER: [number, number] = [25.6866, -100.3161];

type NominatimResult = {
  place_id:     number;
  display_name: string;
  lat:          string;
  lon:          string;
};

type LocationPickerProps = {
  latitude?:  number | null;
  longitude?: number | null;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
};

/* Componente auxiliar: re-centra el mapa cuando cambian las coordenadas. */
function RecenterOnChange({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (latitude != null && longitude != null) {
      map.setView([latitude, longitude], map.getZoom());
    }
  }, [latitude, longitude, map]);
  return null;
}

/* Componente auxiliar: captura el click en el mapa y coloca el marcador ahí. */
function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({
  latitude,
  longitude,
  onLocationChange,
}: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Búsqueda con debounce 500ms. Cancela requests previos en vuelo. */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}` +
          `&format=json&limit=5&countrycodes=mx`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Nominatim error");
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[LocationPicker] geocoding error:", err);
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelectResult(result: NominatimResult) {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onLocationChange(lat, lng, result.display_name);
    setQuery(result.display_name);
    setShowDropdown(false);
    setResults([]);
  }

  /* Centro del mini mapa: coordenadas actuales o Monterrey. */
  const hasCoords = latitude != null && longitude != null;
  const mapCenter: [number, number] = hasCoords
    ? [latitude as number, longitude as number]
    : MONTERREY_CENTER;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Buscador con autocomplete */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "relative" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Buscar dirección..."
            style={{
              width: "100%",
              padding: "11px 12px 11px 38px",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--border-radius-md)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {showDropdown && (results.length > 0 || searching) ? (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              maxHeight: 220,
              overflowY: "auto",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--border-radius-md)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              zIndex: 1001,
            }}
          >
            {searching ? (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-muted)" }}>
                Buscando...
              </div>
            ) : (
              results.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectResult(r)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: "1px solid var(--border-default)",
                    background: "transparent",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {r.display_name}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {/* Mini mapa interactivo */}
      <div
        style={{
          height: 280,
          width: "100%",
          borderRadius: "var(--border-radius-md)",
          overflow: "hidden",
          border: "1px solid var(--border-default)",
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={hasCoords ? 16 : 13}
          minZoom={5}
          maxZoom={18}
          style={{ height: "100%", width: "100%" }}
          dragging
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution="© CartoDB"
            maxZoom={18}
            maxNativeZoom={18}
          />

          <RecenterOnChange
            latitude={hasCoords ? (latitude as number) : null}
            longitude={hasCoords ? (longitude as number) : null}
          />

          <ClickHandler onPick={(lat, lng) => onLocationChange(lat, lng)} />

          {hasCoords ? (
            <Marker
              position={[latitude as number, longitude as number]}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const ll = event.target.getLatLng();
                  onLocationChange(ll.lat, ll.lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>

      {/* Línea de coordenadas actuales */}
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {hasCoords ? (
          <>
            Lat: <strong style={{ color: "var(--text-primary)" }}>
              {(latitude as number).toFixed(4)}
            </strong>{" "}
            · Lng:{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {(longitude as number).toFixed(4)}
            </strong>
          </>
        ) : (
          "Sin ubicación seleccionada — busca una dirección o haz clic en el mapa."
        )}
      </div>
    </div>
  );
}
