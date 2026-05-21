"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import AppFormField from "@/components/AppFormField";
import { INPUT_STYLE } from "@/lib/pageStyles";

type Props = {
  open: boolean;
  buildingId: string;
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
};

const ACCESO_OPTIONS = [
  { value: "nivel",    label: "A nivel",           desc: "Acceso a ras de calle" },
  { value: "rampa",    label: "Con rampa",          desc: "Rampa de acceso vehicular" },
  { value: "dock",     label: "Andén de descarga",  desc: "Dock a altura de camión" },
  { value: "multiple", label: "Múltiple",           desc: "Combinación de accesos" },
] as const;

const errorStyle: React.CSSProperties = { color: "#EF4444", fontSize: 12, marginTop: 4 };
const amber = "#b45309";

export default function IndustrialTypologyModal({ open, buildingId, companyId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* Step 1 */
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [sqmBodega, setSqmBodega] = useState("");
  const [sqmOficina, setSqmOficina] = useState("");
  const [sqmPatio, setSqmPatio] = useState("");

  /* Step 2 */
  const [alturaLibre, setAlturaLibre] = useState("");
  const [capacidadElectrica, setCapacidadElectrica] = useState("");
  const [accesoTipo, setAccesoTipo] = useState("");

  function reset() {
    setStep(1); setSaving(false); setMsg("");
    setName(""); setNameErr("");
    setSqmBodega(""); setSqmOficina(""); setSqmPatio("");
    setAlturaLibre(""); setCapacidadElectrica(""); setAccesoTipo("");
  }

  function handleClose() { reset(); onClose(); }

  function toStep2() {
    if (!name.trim()) { setNameErr("El nombre es obligatorio"); return; }
    setNameErr("");
    setStep(2);
  }

  async function handleCreate() {
    setSaving(true);
    setMsg("");
    const { error } = await supabase.from("unit_types").insert({
      building_id: buildingId,
      company_id: companyId,
      name: name.trim(),
      bedrooms: 0,
      bathrooms: 0,
      sqm_bodega: sqmBodega ? parseInt(sqmBodega) : null,
      sqm_oficina: sqmOficina ? parseInt(sqmOficina) : null,
      sqm_patio: sqmPatio ? parseInt(sqmPatio) : null,
      altura_libre: alturaLibre ? parseFloat(alturaLibre) : null,
      capacidad_electrica: capacidadElectrica.trim() || null,
      acceso_tipo: accesoTipo || null,
    });
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    reset();
    onCreated();
  }

  const total = [sqmBodega, sqmOficina, sqmPatio]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 1 ? "Tipología industrial — Áreas" : "Tipología industrial — Especificaciones"}
    >
      {/* Progress */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
        {["Áreas", "Specs"].map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", ...(i < 1 ? { flex: 1 } : {}) }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: step > i + 1 ? "#1D9E75" : step === i + 1 ? amber : "var(--border-default)",
                color: step >= i + 1 ? "#fff" : "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
              }}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 9, color: step >= i + 1 ? amber : "var(--text-muted)", fontWeight: step === i + 1 ? 700 : 400 }}>
                {label}
              </span>
            </div>
            {i < 1 && (
              <div style={{ flex: 1, height: 2, background: step > i + 1 ? "#1D9E75" : "var(--border-default)", margin: "0 4px", marginBottom: 14 }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Nombre + Áreas */}
      {step === 1 && (
        <>
          <AppFormField label="Nombre de la tipología" required>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setNameErr(""); }}
              placeholder="Ej. Bodega estándar, Nave con oficinas, Mini-bodega"
              style={INPUT_STYLE}
              autoFocus
            />
            {nameErr && <p style={errorStyle}>{nameErr}</p>}
          </AppFormField>

          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Áreas (m²)
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <AppFormField label="Almacén / bodega">
                <input type="number" min={0} value={sqmBodega} onChange={e => setSqmBodega(e.target.value)} placeholder="0" style={INPUT_STYLE} />
              </AppFormField>
              <AppFormField label="Oficina interna">
                <input type="number" min={0} value={sqmOficina} onChange={e => setSqmOficina(e.target.value)} placeholder="0" style={INPUT_STYLE} />
              </AppFormField>
              <AppFormField label="Patio / maniobras">
                <input type="number" min={0} value={sqmPatio} onChange={e => setSqmPatio(e.target.value)} placeholder="0" style={INPUT_STYLE} />
              </AppFormField>
            </div>
            {total > 0 && (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Total: <strong>{total.toLocaleString("es-MX")} m²</strong>
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <UiButton variant="primary" onClick={toStep2}>Siguiente →</UiButton>
            <UiButton onClick={handleClose}>Cancelar</UiButton>
          </div>
        </>
      )}

      {/* Step 2: Especificaciones técnicas */}
      {step === 2 && (
        <>
          <AppFormField label="Altura libre (m)">
            <input
              type="number" min={0} step="0.1"
              value={alturaLibre}
              onChange={e => setAlturaLibre(e.target.value)}
              placeholder="Ej. 8.5"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <AppFormField label="Capacidad eléctrica">
            <input
              value={capacidadElectrica}
              onChange={e => setCapacidadElectrica(e.target.value)}
              placeholder="Ej. 100A 220V, 200A 440V trifásico"
              style={INPUT_STYLE}
            />
          </AppFormField>

          <AppFormField label="Tipo de acceso">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ACCESO_OPTIONS.map((opt) => {
                const sel = accesoTipo === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAccesoTipo(sel ? "" : opt.value)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3,
                      padding: "10px 12px", borderRadius: "var(--border-radius-md)", textAlign: "left",
                      border: sel ? `2px solid ${amber}` : "1.5px solid var(--border-default)",
                      background: sel ? `${amber}12` : "var(--bg-card)",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? amber : "var(--text-primary)" }}>{opt.label}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </AppFormField>

          {/* Resumen */}
          <div style={{ padding: 14, borderRadius: "var(--border-radius-md)", background: "var(--bg-page)", border: "1px solid var(--border-default)", marginBottom: 20, fontSize: 12, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{name}</strong>
            {total > 0 && <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>{total.toLocaleString("es-MX")} m² totales</span>}
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sqmBodega && <span style={{ fontSize: 11 }}>{sqmBodega} m² bodega</span>}
              {sqmOficina && <span style={{ fontSize: 11 }}>{sqmOficina} m² oficina</span>}
              {sqmPatio && <span style={{ fontSize: 11 }}>{sqmPatio} m² patio</span>}
              {alturaLibre && <span style={{ fontSize: 11 }}>Alt. libre: {alturaLibre} m</span>}
              {capacidadElectrica && <span style={{ fontSize: 11 }}>{capacidadElectrica}</span>}
            </div>
          </div>

          {msg && <p style={{ ...errorStyle, marginBottom: 12 }}>{msg}</p>}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <UiButton variant="primary" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Guardando..." : "Crear tipología"}
            </UiButton>
            <UiButton onClick={() => setStep(1)}>← Atrás</UiButton>
            <UiButton onClick={handleClose}>Cancelar</UiButton>
          </div>
        </>
      )}
    </Modal>
  );
}
