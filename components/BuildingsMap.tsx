"use client";

/*
  Componente cliente con mapa Leaflet para mostrar edificios con coordenadas.

  - Se importa dinámicamente desde la página (ssr: false) porque Leaflet
    necesita acceso al DOM (`window`).
  - El fix del ícono default viene de que Leaflet resuelve las URLs de
    íconos con require() relativo, algo que no funciona con el bundler
    de Next. Apuntamos a los PNGs del CDN oficial.
*/

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Pencil, Check } from "lucide-react";
import Link from "next/link";

/* Fix del ícono default de Leaflet en Next.js */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/* Estilos de tile disponibles. Todos son gratuitos para uso personal/bajo
   tráfico (OSM + CartoDB). El `{r}` carga tiles @2x en pantallas retina. */
const MAP_STYLES = [
  {
    id: "positron",
    label: "Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB",
  },
  {
    id: "esri_satellite",
    label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
  },
] as const;

export type BuildingMapPoint = {
  id:        string;
  name:      string;
  address:   string | null;
  latitude:  number;
  longitude: number;
};

type BuildingsMapProps = {
  buildings: BuildingMapPoint[];
  /* Callback opcional para persistir la nueva posición cuando el usuario
     suelta un marcador en modo edición. Si no se pasa, el botón de
     edición se esconde. */
  onUpdateLocation?: (
    id: string,
    latitude: number,
    longitude: number,
  ) => Promise<void> | void;
};

/* Monterrey como fallback cuando no hay edificios con coordenadas. */
const MONTERREY_CENTER: [number, number] = [25.6866, -100.3161];
const DEFAULT_ZOOM = 15;

/* Calcula el centro del mapa como promedio de las coordenadas. */
function computeCenter(points: BuildingMapPoint[]): [number, number] {
  if (points.length === 0) return MONTERREY_CENTER;
  const lat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
  return [lat, lng];
}

export default function BuildingsMap({ buildings, onUpdateLocation }: BuildingsMapProps) {
  const center = computeCenter(buildings);

  const [styleId, setStyleId] = useState<string>("positron");
  const currentStyle = MAP_STYLES.find((s) => s.id === styleId) ?? MAP_STYLES[0];

  const [editMode, setEditMode] = useState(false);

  return (
    <div>
      {/* Toolbar: selector de estilo + botón de modo edición */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        {MAP_STYLES.map((style) => {
          const isActive = style.id === styleId;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => setStyleId(style.id)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--border-radius-md)",
                border: isActive
                  ? "1px solid #8B2252"
                  : "1px solid var(--border-default)",
                background: isActive ? "#8B2252" : "transparent",
                color: isActive ? "#FFFFFF" : "var(--text-primary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {style.label}
            </button>
          );
        })}

        {/* Botón de modo edición — sólo si el padre pasó onUpdateLocation */}
        {onUpdateLocation ? (
          <button
            type="button"
            onClick={() => setEditMode((prev) => !prev)}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: "var(--border-radius-md)",
              border: editMode
                ? "1px solid #10B981"
                : "1px solid var(--border-default)",
              background: editMode ? "#10B981" : "transparent",
              color: editMode ? "#FFFFFF" : "var(--text-primary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {editMode ? <Check size={14} /> : <Pencil size={14} />}
            {editMode ? "Terminar edición" : "Editar ubicaciones"}
          </button>
        ) : null}
      </div>

      {/* Banner visible sólo en modo edición */}
      {editMode ? (
        <div
          style={{
            marginBottom: 10,
            padding: "10px 14px",
            borderRadius: "var(--border-radius-md)",
            background: "var(--metric-bg-amber, #FEF3C7)",
            border: "1px solid #FDE68A",
            color: "var(--badge-text-amber, #92400E)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Modo edición activo — arrastra los marcadores para ajustar la
          ubicación de cada edificio.
        </div>
      ) : null}

      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        minZoom={12}
        maxZoom={18}
        style={{ height: 600, width: "100%", borderRadius: "var(--border-radius-lg)" }}
        scrollWheelZoom
      >
        <TileLayer
          key={styleId}
          url={currentStyle.url}
          attribution={currentStyle.attribution}
          maxZoom={18}
          maxNativeZoom={18}
        />

        {buildings.map((b) => (
        <Marker
          key={b.id}
          position={[b.latitude, b.longitude]}
          draggable={editMode}
          eventHandlers={{
            dragend: (event) => {
              const latLng = event.target.getLatLng();
              if (onUpdateLocation) {
                void onUpdateLocation(b.id, latLng.lat, latLng.lng);
              }
            },
          }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {b.name}
              </div>
              {b.address ? (
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                  {b.address}
                </div>
              ) : null}
              <Link
                href={`/buildings/${b.id}`}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#4338CA",
                  textDecoration: "none",
                }}
              >
                Ver edificio →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
      </MapContainer>
    </div>
  );
}
