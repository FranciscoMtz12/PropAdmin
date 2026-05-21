"use client";

/*
  SettingsModal — panel de ajustes del usuario.

  Secciones:
  - APARIENCIA: toggle modo oscuro, toggle mostrar descripciones
  - CUENTA: email y rol del usuario (solo lectura)

  Lee/escribe en la tabla user_preferences con UPSERT inmediato.
  Requiere columnas: user_id, dark_mode, show_descriptions.

  Usa React Portal para renderizar directamente en document.body y
  evitar que el stacking context del sidebar lo tape.
*/

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Moon, Settings, Sun, User, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useCurrentUser();
  const { isDark, toggleDark, showDescriptions, setShowDescriptions } = useTheme();

  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingDark, setSavingDark]     = useState(false);
  const [savingDesc, setSavingDesc]     = useState(false);
  const [mounted, setMounted]           = useState(false);

  /* Necesario para que createPortal solo corra en el cliente */
  useEffect(() => { setMounted(true); }, []);

  /* ── Cargar preferencias al abrir ───────────────────────────────── */
  useEffect(() => {
    if (!open || !user?.id) return;
    void loadPreferences();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  /* Bloquear scroll del body mientras el modal está abierto */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* Cerrar con Escape */
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function loadPreferences() {
    if (!user?.id) return;
    setLoadingPrefs(true);

    const { data, error } = await supabase
      .from("user_preferences")
      .select("dark_mode, show_descriptions")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && !data) {
      /* No existe aún — crear con valores actuales */
      await supabase.from("user_preferences").upsert(
        { user_id: user.id, dark_mode: isDark, show_descriptions: showDescriptions },
        { onConflict: "user_id" }
      );
    } else if (data) {
      /* Aplicar preferencias guardadas */
      if (typeof data.show_descriptions === "boolean") {
        setShowDescriptions(data.show_descriptions);
      }
      /* dark_mode: solo aplicar si difiere para no crear un flash */
      if (typeof data.dark_mode === "boolean" && data.dark_mode !== isDark) {
        toggleDark();
      }
    }

    setLoadingPrefs(false);
  }

  /* ── Toggle modo oscuro ─────────────────────────────────────────── */
  async function handleToggleDark() {
    if (!user?.id || savingDark) return;
    setSavingDark(true);
    const newVal = !isDark;
    toggleDark();
    await supabase.from("user_preferences").upsert(
      { user_id: user.id, dark_mode: newVal, show_descriptions: showDescriptions },
      { onConflict: "user_id" }
    );
    setSavingDark(false);
  }

  /* ── Toggle mostrar descripciones ──────────────────────────────── */
  async function handleToggleDescriptions() {
    if (!user?.id || savingDesc) return;
    setSavingDesc(true);
    const newVal = !showDescriptions;
    setShowDescriptions(newVal);
    await supabase.from("user_preferences").upsert(
      { user_id: user.id, dark_mode: isDark, show_descriptions: newVal },
      { onConflict: "user_id" }
    );
    setSavingDesc(false);
  }

  const roleLabel =
    user?.role === "superadmin" || user?.is_superadmin ? "SUPERADMIN"
      : user?.role === "administracion" ? "ADMINISTRACIÓN"
      : user?.role === "directivo" ? "DIRECTIVO"
      : user?.role === "compras" ? "COMPRAS"
      : user?.role === "mantenimiento" ? "MANTENIMIENTO"
      : user?.role === "field" ? "CAMPO"
      : "INQUILINO";

  if (!mounted || !open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99998,
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Panel centrado */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 99999,
          width: "calc(100vw - 32px)",
          maxWidth: 480,
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          borderRadius: "var(--border-radius-xl)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.25))",
          padding: "24px 24px 28px",
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: "var(--text-primary)",
            }}
          >
            Ajustes
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ajustes"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "var(--border-radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-page)",
              color: "var(--text-muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido */}
        {loadingPrefs ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
            Cargando preferencias...
          </p>
        ) : (
          <div style={{ display: "grid", gap: 28 }}>

            {/* ── APARIENCIA ─────────────────────────────────────────── */}
            <section>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: 10,
                }}
              >
                Apariencia
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                <ToggleRow
                  label="Modo oscuro"
                  description="Cambiar entre tema claro y oscuro"
                  icon={isDark ? <Moon size={15} /> : <Sun size={15} />}
                  checked={isDark}
                  onChange={handleToggleDark}
                  saving={savingDark}
                />
                <ToggleRow
                  label="Mostrar descripciones"
                  description="Subtítulos grises bajo los títulos de sección"
                  icon={<FileText size={15} />}
                  checked={showDescriptions}
                  onChange={handleToggleDescriptions}
                  saving={savingDesc}
                />
              </div>
            </section>

            {/* ── CUENTA ─────────────────────────────────────────────── */}
            <section>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: 10,
                }}
              >
                Cuenta
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                <InfoRow
                  label="Correo electrónico"
                  value={user?.email || "—"}
                  icon={<User size={15} />}
                />
                <InfoRow
                  label="Rol"
                  value={roleLabel}
                  icon={<Settings size={15} />}
                />
              </div>
            </section>

          </div>
        )}
      </div>
    </>,
    document.body
  );
}

/* ─── Sub-componentes ────────────────────────────────────────────────── */

function ToggleRow({
  label,
  description,
  icon,
  checked,
  onChange,
  saving,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: () => void;
  saving?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--border-radius-lg)",
        background: "var(--bg-page)",
        border: "1px solid var(--border-default)",
      }}
    >
      {/* Ícono + textos */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--border-radius-md)",
            background: "var(--icon-bg-neutral)",
            color: "var(--icon-color-neutral)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {label}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            {description}
          </p>
        </div>
      </div>

      {/* Toggle pill */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={saving}
        style={{
          position: "relative",
          width: 44,
          height: 24,
          borderRadius: "var(--border-radius-lg)",
          border: "none",
          cursor: saving ? "wait" : "pointer",
          background: checked ? "var(--accent)" : "var(--border-strong)",
          transition: "background 0.2s",
          flexShrink: 0,
          opacity: saving ? 0.7 : 1,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? "calc(100% - 22px)" : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}
        />
      </button>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--border-radius-lg)",
        background: "var(--bg-page)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--border-radius-md)",
            background: "var(--icon-bg-neutral)",
            color: "var(--icon-color-neutral)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{label}</span>
      </div>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-primary)",
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}
