"use client";

/*
  Portal de campo — Activos.

  Lista activos de todas las unidades.
  Filtro por edificio.
  Modal para reportar incidencia (crea un maintenance_log vinculado al activo).
*/

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AlertTriangle, Box, ChevronDown, X } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

type Asset = {
  id: string;
  name: string;
  asset_type: string | null;
  status: string | null;
  building_id: string | null;
  unit_id: string | null;
  notes: string | null;
  buildingName?: string;
  unitCode?: string;
};

type Building = { id: string; name: string };

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active:      { bg: "var(--badge-bg-green)",  text: "var(--badge-text-green)",  label: "Activo"      },
  maintenance: { bg: "var(--badge-bg-amber)",  text: "var(--badge-text-amber)",  label: "Mantenimiento" },
  retired:     { bg: "var(--badge-bg-gray)",   text: "var(--badge-text-gray)",   label: "Retirado"    },
  inactive:    { bg: "var(--badge-bg-gray)",   text: "var(--badge-text-gray)",   label: "Inactivo"    },
};

export default function CampoAssetsPage() {
  const { user, loading } = useCurrentUser();

  const [assets,     setAssets]     = useState<Asset[]>([]);
  const [buildings,  setBuildings]  = useState<Building[]>([]);
  const [filterBld,  setFilterBld]  = useState("");
  const [loadingData, setLoadingData] = useState(true);

  /* Report modal */
  const [reportAsset, setReportAsset] = useState<Asset | null>(null);
  const [rDesc,       setRDesc]       = useState("");
  const [rPriority,   setRPriority]   = useState("normal");
  const [saving,      setSaving]      = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportOk,    setReportOk]    = useState(false);

  useEffect(() => {
    if (!loading && user?.company_id) {
      void loadData(user.company_id);
    }
  }, [loading, user]);

  async function loadData(companyId: string) {
    setLoadingData(true);

    const [assetsRes, bldRes] = await Promise.all([
      supabase
        .from("assets")
        .select("id, name, asset_type, status, building_id, unit_id, notes")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("buildings")
        .select("id, name")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name"),
    ]);

    const buildingMap = new Map<string, string>(
      (bldRes.data || []).map(b => [b.id, b.name])
    );

    const unitIds = [...new Set(
      (assetsRes.data || [])
        .map(a => a.unit_id)
        .filter((id): id is string => Boolean(id))
    )];

    let unitMap = new Map<string, string>();
    if (unitIds.length > 0) {
      const { data: unitsData } = await supabase
        .from("units")
        .select("id, unit_number, display_code")
        .in("id", unitIds);
      unitMap = new Map(
        (unitsData || []).map(u => [u.id, u.display_code || u.unit_number || "Unidad"])
      );
    }

    const enriched: Asset[] = (assetsRes.data || []).map(a => ({
      ...a,
      buildingName: a.building_id ? buildingMap.get(a.building_id) : undefined,
      unitCode:     a.unit_id ? unitMap.get(a.unit_id) : undefined,
    }));

    setAssets(enriched);
    setBuildings(bldRes.data || []);
    setLoadingData(false);
  }

  const filtered = useMemo(() => {
    if (!filterBld) return assets;
    return assets.filter(a => a.building_id === filterBld);
  }, [assets, filterBld]);

  async function handleReport() {
    if (!user?.company_id || !reportAsset) return;
    if (!rDesc.trim()) { setReportError("Describe la incidencia."); return; }
    setReportError("");
    setSaving(true);

    const { error } = await supabase.from("maintenance_logs").insert({
      company_id:  user.company_id,
      building_id: reportAsset.building_id || null,
      unit_id:     reportAsset.unit_id || null,
      title:       `Incidencia en activo: ${reportAsset.name}`,
      description: rDesc.trim(),
      priority:    rPriority,
      status:      "pending",
      log_type:    "corrective",
      reported_by: user.full_name || user.email,
    });

    setSaving(false);

    if (error) { setReportError("No se pudo crear el ticket."); return; }

    setReportOk(true);
    setTimeout(() => {
      setReportAsset(null);
      setRDesc("");
      setRPriority("normal");
      setReportOk(false);
    }, 1500);
  }

  function openReport(asset: Asset) {
    setReportAsset(asset);
    setRDesc("");
    setRPriority("normal");
    setReportError("");
    setReportOk(false);
  }

  /* ── Styles ──────────────────────────────────────────────────── */
  const containerStyle: CSSProperties = {
    padding: "16px 16px 80px",
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
  };

  const cardStyle: CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--border-radius-lg)",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 14,
  };

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-end",
  };

  const sheetStyle: CSSProperties = {
    width: "100%",
    maxHeight: "85dvh",
    overflowY: "auto",
    background: "var(--bg-card)",
    borderRadius: "var(--border-radius-xl) var(--border-radius-xl) 0 0",
    padding: "24px 20px 36px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "var(--border-radius-md)",
    border: "1px solid var(--border-default)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: "0.9375rem",
    boxSizing: "border-box",
  };

  const selectStyle: CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "var(--border-radius-md)",
    border: "1px solid var(--border-default)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: "0.9375rem",
    boxSizing: "border-box",
    appearance: "none",
  };

  return (
    <div style={containerStyle}>

      {/* ── Título ───────────────────────────────────────────────── */}
      <h2 style={{ margin: "0 0 16px", fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
        Equipamiento
      </h2>

      {/* ── Filtro edificio ──────────────────────────────────────── */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <select
          value={filterBld}
          onChange={e => setFilterBld(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todos los edificios</option>
          {buildings.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <ChevronDown
          size={16}
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── Lista ───────────────────────────────────────────────── */}
      {loadingData ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Sin activos.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(asset => {
            const badge = STATUS_BADGE[asset.status || "active"] || STATUS_BADGE.active;
            return (
              <div key={asset.id} style={cardStyle}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--border-radius-lg)",
                  background: "var(--icon-bg-neutral)",
                  color: "var(--icon-color-neutral)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Box size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {asset.name}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 3 }}>
                    {asset.buildingName && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {asset.buildingName}{asset.unitCode ? ` · ${asset.unitCode}` : ""}
                      </span>
                    )}
                    {asset.asset_type && (
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        {asset.asset_type}
                      </span>
                    )}
                    <span style={{ padding: "2px 7px", borderRadius: "var(--border-radius-md)", fontSize: "0.6875rem", fontWeight: 700, background: badge.bg, color: badge.text }}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openReport(asset)}
                  aria-label="Reportar incidencia"
                  style={{
                    flexShrink: 0,
                    padding: "8px 12px",
                    borderRadius: "var(--border-radius-md)",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-page)",
                    color: "var(--badge-text-amber)",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <AlertTriangle size={13} />
                  Reportar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal reportar incidencia ────────────────────────────── */}
      {reportAsset && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setReportAsset(null); }}>
          <div style={sheetStyle}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Reportar incidencia
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  {reportAsset.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportAsset(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {reportOk ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "var(--badge-text-green)" }}>
                  Ticket creado
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Descripción de la incidencia *
                  </label>
                  <textarea
                    value={rDesc}
                    onChange={e => setRDesc(e.target.value)}
                    rows={4}
                    placeholder="Describe el problema..."
                    style={{ ...inputStyle, resize: "vertical" as const }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Prioridad
                  </label>
                  <select value={rPriority} onChange={e => setRPriority(e.target.value)} style={inputStyle}>
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                {reportError && (
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--badge-text-red)" }}>{reportError}</p>
                )}

                <button
                  type="button"
                  onClick={handleReport}
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "var(--border-radius-lg)",
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    cursor: saving ? "wait" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    marginTop: 4,
                  }}
                >
                  {saving ? "Creando ticket..." : "Crear ticket de incidencia"}
                </button>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
