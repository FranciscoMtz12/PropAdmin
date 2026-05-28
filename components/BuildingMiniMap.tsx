"use client";

/*
  Mini mapa de un solo edificio para la página de detalle.

  - Sólo lectura (sin dragging, sin zoom con scroll, sin controles).
  - Usa Positron de CartoDB para un look limpio y neutro.
  - Se debe importar dinámicamente (ssr: false) desde la página padre
    porque Leaflet requiere `window`.
*/

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Fix del ícono default de Leaflet en Next.js (mismo patrón que BuildingsMap). */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type BuildingMiniMapProps = {
  latitude:  number;
  longitude: number;
  name:      string;
  address?:  string | null;
};

export default function BuildingMiniMap({
  latitude,
  longitude,
  name,
  address,
}: BuildingMiniMapProps) {
  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        width: "100%",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        style={{ height: "100%", width: "100%", borderRadius: "var(--border-radius-lg)", minHeight: 200 }}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution="© CartoDB"
          maxZoom={18}
          maxNativeZoom={18}
        />
        <Marker position={[latitude, longitude]}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: 4 }}>
                {name}
              </div>
              {address ? (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{address}</div>
              ) : null}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
