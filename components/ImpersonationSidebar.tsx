"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Eye, LogIn, RotateCcw, Shield, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useImpersonation, type ImpersonationParams } from "@/contexts/ImpersonationContext";
import { useTheme, initials } from "@/contexts/ThemeContext";

const SAPROA_COLOR = "#8B2252";

const ROLE_LABEL: Record<string, string> = {
  titular: "Titular",
  administracion: "Administración",
  directivo: "Directivo",
  compras: "Compras",
  mantenimiento: "Mantenimiento",
  field: "Campo",
};

type Company = { id: string; name: string; short_name: string | null; brand_color: string | null };
type AppUser = { id: string; full_name: string; email: string; role: string };

/* ─── Item de empresa ─────────────────────────────────────────────── */
function CompanyItem({
  company,
  selected,
  onSelect,
}: {
  company: Company;
  selected: boolean;
  onSelect: () => void;
}) {
  const dot = company.brand_color || "#6b7280";
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
      animate={{ backgroundColor: selected ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0)" }}
      transition={{ duration: 0.12 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 8px",
        borderRadius: "var(--border-radius-md, 10px)",
        cursor: "pointer",
        borderLeft: selected ? `3px solid ${dot}` : "3px solid transparent",
      }}
    >
      <div
        style={{
          width: 8, height: 8, borderRadius: "50%",
          background: dot, flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 13,
          color: selected ? "#fff" : "rgba(255,255,255,0.82)",
          fontWeight: selected ? 700 : 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          flex: 1, minWidth: 0,
        }}
      >
        {company.short_name || company.name}
      </span>
    </motion.div>
  );
}

/* ─── Item de usuario ─────────────────────────────────────────────── */
function UserItem({
  appUser,
  selected,
  onSelect,
}: {
  appUser: AppUser;
  selected: boolean;
  onSelect: () => void;
}) {
  const avatarText = initials(appUser.full_name || appUser.email);
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
      animate={{ backgroundColor: selected ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0)" }}
      transition={{ duration: 0.12 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 8px",
        borderRadius: "var(--border-radius-md, 10px)",
        cursor: "pointer",
        borderLeft: selected ? `3px solid ${SAPROA_COLOR}` : "3px solid transparent",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28, height: 28, borderRadius: "50%",
          background: selected ? SAPROA_COLOR : "rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
          transition: "background 0.12s",
        }}
      >
        {avatarText}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: selected ? 700 : 500,
            color: "#fff",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {appUser.full_name || appUser.email}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>
          {ROLE_LABEL[appUser.role] ?? appUser.role}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── SectionTitle ────────────────────────────────────────────────── */
function SectionTitle({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10, fontWeight: 700,
        letterSpacing: "0.10em",
        color: "rgba(255,255,255,0.38)",
        textTransform: "uppercase" as const,
        padding: "12px 16px 6px",
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  );
}

/* ─── Sidebar principal ───────────────────────────────────────────── */
export default function ImpersonationSidebar() {
  const {
    isRealSuperAdmin,
    isImpersonating,
    impersonatedCompanyName,
    impersonatedUserEmail,
    startImpersonation,
    stopImpersonation,
  } = useImpersonation();
  const { isDark } = useTheme();

  const [companies,        setCompanies]        = useState<Company[]>([]);
  const [users,            setUsers]            = useState<AppUser[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingUsers,     setLoadingUsers]     = useState(false);
  const [selectedCompany,  setSelectedCompany]  = useState<Company | null>(null);
  const [selectedUser,     setSelectedUser]     = useState<AppUser | null>(null);

  /* Cargar empresas al montar */
  useEffect(() => {
    if (!isRealSuperAdmin) return;
    void loadCompanies();
  }, [isRealSuperAdmin]);

  /* Cargar usuarios al seleccionar empresa */
  useEffect(() => {
    if (!selectedCompany) { setUsers([]); setSelectedUser(null); return; }
    void loadUsers(selectedCompany.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  async function loadCompanies() {
    setLoadingCompanies(true);
    const { data } = await supabase
      .from("companies")
      .select("id, name, short_name, brand_color")
      .is("deleted_at", null)
      .order("name");
    setCompanies((data as Company[]) ?? []);
    setLoadingCompanies(false);
  }

  async function loadUsers(companyId: string) {
    setLoadingUsers(true);
    setSelectedUser(null);
    const { data } = await supabase
      .from("app_users")
      .select("id, full_name, email, role")
      .eq("company_id", companyId)
      .neq("role", "superadmin")
      .is("deleted_at", null)
      .order("full_name");
    setUsers((data as AppUser[]) ?? []);
    setLoadingUsers(false);
  }

  function handleVerComEste() {
    if (!selectedCompany || !selectedUser) return;
    const params: ImpersonationParams = {
      companyId:    selectedCompany.id,
      companyName:  selectedCompany.short_name || selectedCompany.name,
      userId:       selectedUser.id,
      userEmail:    selectedUser.email,
      userFullName: selectedUser.full_name,
      role:         selectedUser.role,
    };
    startImpersonation(params);
  }

  function handleVerEmpresa() {
    if (!selectedCompany) return;
    const preferred =
      users.find(u => u.role === "titular") ||
      users.find(u => u.role === "administracion") ||
      users[0];
    const params: ImpersonationParams = {
      companyId:    selectedCompany.id,
      companyName:  selectedCompany.short_name || selectedCompany.name,
      userId:       preferred?.id ?? null,
      userEmail:    preferred?.email ?? null,
      userFullName: preferred?.full_name ?? null,
      role:         preferred?.role ?? "titular",
    };
    startImpersonation(params);
  }

  if (!isRealSuperAdmin) return null;

  const sidebarBg = isDark ? "#0f1623" : "#1e2a3a";

  return (
    <motion.aside
      className="impersonation-sidebar-panel"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      style={{
        width: 280,
        minWidth: 280,
        height: "100vh",
        position: "fixed",
        top: 0,
        right: 0,
        zIndex: 100,
        overflowY: "hidden",
        background: sidebarBg,
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        transition: "background 0.2s",
      }}
    >
      {/* Barra de acento superior */}
      <div style={{ height: 3, background: SAPROA_COLOR, flexShrink: 0 }} />

      {/* Header */}
      <div
        style={{
          padding: "14px 16px 10px",
          display: "flex",
          alignItems: "center",
          gap: 9,
          flexShrink: 0,
        }}
      >
        <Shield size={15} color={SAPROA_COLOR} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
          Ver como empresa
        </span>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

      {/* Área scrollable de listas */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* EMPRESA */}
        <SectionTitle label="EMPRESA" />
        <div
          style={{
            flex: selectedCompany ? "0 0 38%" : "1",
            overflowY: "auto",
            padding: "0 8px 4px",
          }}
        >
          {loadingCompanies ? (
            <div style={{ padding: "8px 8px", color: "rgba(255,255,255,0.40)", fontSize: 12 }}>
              Cargando...
            </div>
          ) : (
            companies.map(c => (
              <CompanyItem
                key={c.id}
                company={c}
                selected={selectedCompany?.id === c.id}
                onSelect={() => setSelectedCompany(prev => prev?.id === c.id ? null : c)}
              />
            ))
          )}
        </div>

        {/* USUARIO — aparece cuando hay empresa seleccionada */}
        <AnimatePresence>
          {selectedCompany && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
              <SectionTitle label="USUARIO" />
              <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 4px" }}>
                {loadingUsers ? (
                  <div style={{ padding: "8px 8px", color: "rgba(255,255,255,0.40)", fontSize: 12 }}>
                    Cargando usuarios...
                  </div>
                ) : users.length === 0 ? (
                  <div style={{ padding: "8px 8px", color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                    Sin usuarios registrados
                  </div>
                ) : (
                  users.map(u => (
                    <UserItem
                      key={u.id}
                      appUser={u}
                      selected={selectedUser?.id === u.id}
                      onSelect={() => setSelectedUser(prev => prev?.id === u.id ? null : u)}
                    />
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botones de acción */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Ver como este */}
        <button
          onClick={handleVerComEste}
          disabled={!selectedUser}
          style={{
            width: "100%",
            padding: "9px 14px",
            borderRadius: "var(--border-radius-md, 10px)",
            border: "none",
            background: selectedUser ? SAPROA_COLOR : "rgba(255,255,255,0.07)",
            color: selectedUser ? "#fff" : "rgba(255,255,255,0.30)",
            fontSize: 13,
            fontWeight: 700,
            cursor: selectedUser ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            transition: "background 0.15s, color 0.15s",
          }}
        >
          <LogIn size={14} />
          Ver como este
        </button>

        {/* Ver empresa */}
        <button
          onClick={handleVerEmpresa}
          disabled={!selectedCompany}
          style={{
            width: "100%",
            padding: "9px 14px",
            borderRadius: "var(--border-radius-md, 10px)",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: selectedCompany ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.28)",
            fontSize: 13,
            fontWeight: 600,
            cursor: selectedCompany ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            transition: "color 0.15s",
          }}
        >
          <Building2 size={14} />
          Ver empresa
        </button>

        {/* Vista SAPROA */}
        <button
          onClick={stopImpersonation}
          style={{
            width: "100%",
            padding: "9px 14px",
            borderRadius: "var(--border-radius-md, 10px)",
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.45)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          <RotateCcw size={12} />
          Vista SAPROA
        </button>
      </div>

      {/* Banner de vista simulada activa */}
      <AnimatePresence>
        {isImpersonating && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            style={{
              flexShrink: 0,
              borderTop: "1px solid rgba(139,34,82,0.28)",
              background: "rgba(139,34,82,0.14)",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Eye size={13} color={SAPROA_COLOR} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: SAPROA_COLOR }}>
                  Vista simulada
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.58)",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {impersonatedCompanyName} · {impersonatedUserEmail}
                </div>
              </div>
            </div>
            <button
              onClick={stopImpersonation}
              style={{
                width: "100%",
                padding: "7px 12px",
                borderRadius: "var(--border-radius-md, 8px)",
                border: `1px solid rgba(139,34,82,0.45)`,
                background: "transparent",
                color: SAPROA_COLOR,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <X size={12} />
              Salir de vista simulada
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
