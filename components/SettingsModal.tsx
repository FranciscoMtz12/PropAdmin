"use client";

/*
  SettingsModal — panel de ajustes del usuario.

  Secciones:
  - APARIENCIA: toggle modo oscuro, toggle mostrar descripciones
  - CUENTA: email y rol del usuario (solo lectura)

  Lee/escribe en la tabla user_preferences con UPSERT inmediato.
  Requiere columnas: user_id, dark_mode, show_descriptions.
*/

import { useEffect, useState } from "react";
import { FileText, Moon, Settings, Sun, User } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import Modal from "@/components/Modal";

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

  /* ── Cargar preferencias al abrir ───────────────────────────────── */
  useEffect(() => {
    if (!open || !user?.id) return;
    void loadPreferences();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

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
    user?.role === "admin"
      ? user.is_superadmin
        ? "SUPERADMIN"
        : "ADMIN"
      : "TENANT";

  return (
    <Modal open={open} onClose={onClose} title="Ajustes" maxWidth="480px">
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
    </Modal>
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
        borderRadius: 12,
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
            borderRadius: 8,
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
          borderRadius: 12,
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
        borderRadius: 12,
        background: "var(--bg-page)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
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
