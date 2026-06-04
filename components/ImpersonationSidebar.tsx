"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Eye, RotateCcw, Shield, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useImpersonation, type ImpersonationParams, type GroupCompany } from "@/contexts/ImpersonationContext";
import { initials } from "@/contexts/ThemeContext";

const SAPROA_COLOR = "var(--accent)";
const UNGROUPED_ID = "__ungrouped__";

const ROLE_LABEL: Record<string, string> = {
  titular: "Titular",
  administracion: "Administración",
  directivo: "Directivo",
  compras: "Compras",
  mantenimiento: "Mantenimiento",
  field: "Campo",
};

type Group   = { id: string; name: string; short_name: string | null; brand_color: string | null };
type Company = { id: string; name: string; short_name: string | null; brand_color: string | null; logo_url: string | null; group_id: string | null };
type AppUser = { id: string; full_name: string; email: string; role: string };

/* ─── UserRow ─────────────────────────────────────────────────────── */
function UserRow({
  appUser, selected, onImpersonate,
}: { appUser: AppUser; selected: boolean; onImpersonate: () => void }) {
  const avatarText = initials(appUser.full_name || appUser.email);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 8px 6px 40px",
        borderRadius: "var(--border-radius-md)",
        borderLeft: selected ? `3px solid ${SAPROA_COLOR}` : "3px solid transparent",
        background: selected ? "rgba(255,255,255,0.08)" : "transparent",
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: selected ? SAPROA_COLOR : "rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.625rem", fontWeight: 700, color: "#fff", flexShrink: 0,
      }}>
        {avatarText}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "0.75rem", fontWeight: selected ? 700 : 500, color: "#fff",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {appUser.full_name || appUser.email}
        </div>
        <div style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.45)", marginTop: 1 }}>
          {ROLE_LABEL[appUser.role] ?? appUser.role}
        </div>
      </div>
      <button
        onClick={onImpersonate}
        title={`Impersonar a ${appUser.full_name || appUser.email}`}
        style={{
          padding: "3px 8px",
          borderRadius: "var(--border-radius-sm)",
          border: selected
            ? `1px solid ${SAPROA_COLOR}`
            : "1px solid rgba(255,255,255,0.18)",
          background: selected ? SAPROA_COLOR : "transparent",
          color: selected ? "#fff" : "rgba(255,255,255,0.60)",
          fontSize: "0.625rem", fontWeight: 700,
          cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 3,
        }}
      >
        <Eye size={9} />
        Ver
      </button>
    </div>
  );
}

/* ─── CompanyRow ─────────────────────────────────────────────────── */
function CompanyRow({
  company, isOpen, onToggle, onImpersonate,
  users, loadingUsers, selectedUserId, onSelectUser,
}: {
  company: Company;
  isOpen: boolean;
  onToggle: () => void;
  onImpersonate: () => void;
  users: AppUser[];
  loadingUsers: boolean;
  selectedUserId: string | null;
  onSelectUser: (u: AppUser) => void;
}) {
  const dot = company.brand_color || "#6b7280";
  return (
    <div>
      {/* Fila de empresa: chevron+nombre (expande) + botón Impersonar (separado) */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "1px 4px 1px 0" }}>
        <motion.div
          onClick={onToggle}
          whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          animate={{ backgroundColor: isOpen ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0)" }}
          transition={{ duration: 0.12 }}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "7px 6px 7px 20px",
            borderRadius: "var(--border-radius-md)",
            cursor: "pointer",
            borderLeft: isOpen ? `3px solid ${dot}` : "3px solid transparent",
            minWidth: 0,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
          <span style={{
            fontSize: "0.75rem", fontWeight: isOpen ? 700 : 400,
            color: isOpen ? "#fff" : "rgba(255,255,255,0.82)",
            flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {company.short_name || company.name}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            style={{ flexShrink: 0, display: "flex" }}
          >
            <ChevronRight size={11} color="rgba(255,255,255,0.35)" />
          </motion.div>
        </motion.div>

        {/* Botón explícito de impersonación */}
        <button
          onClick={onImpersonate}
          title={`Impersonar ${company.short_name || company.name}`}
          style={{
            padding: "4px 8px",
            borderRadius: "var(--border-radius-sm)",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            fontSize: "0.6rem", fontWeight: 700,
            cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 3,
          }}
        >
          <Eye size={10} />
          Ver
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            {loadingUsers ? (
              <div style={{ padding: "6px 8px 6px 40px", color: "rgba(255,255,255,0.38)", fontSize: "0.6875rem" }}>
                Cargando...
              </div>
            ) : users.length === 0 ? (
              <div style={{ padding: "6px 8px 6px 40px", color: "rgba(255,255,255,0.30)", fontSize: "0.6875rem" }}>
                Sin usuarios
              </div>
            ) : (
              users.map(u => (
                <UserRow
                  key={u.id}
                  appUser={u}
                  selected={selectedUserId === u.id}
                  onImpersonate={() => onSelectUser(u)}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── GroupRow ───────────────────────────────────────────────────── */
function GroupRow({
  group, isOpen, onToggle, companies,
  openCompanyId, onToggleCompany, onImpersonateCompany,
  onImpersonateGroup,
  usersByCompany, loadingUsersByCompany,
  selectedUserId, onSelectUser,
}: {
  group: Group;
  isOpen: boolean;
  onToggle: () => void;
  companies: Company[];
  openCompanyId: string | null;
  onToggleCompany: (c: Company) => void;
  onImpersonateCompany: (c: Company) => void;
  onImpersonateGroup?: () => void;
  usersByCompany: Record<string, AppUser[]>;
  loadingUsersByCompany: Record<string, boolean>;
  selectedUserId: string | null;
  onSelectUser: (u: AppUser, company: Company) => void;
}) {
  const groupColor = group.brand_color || "#6b7280";
  const isVirtual = group.id === UNGROUPED_ID;
  return (
    <div style={{ marginBottom: 2 }}>
      {/* Encabezado de grupo: nombre (expande) + botón de modo grupo (si aplica) */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <motion.div
          onClick={onToggle}
          whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          transition={{ duration: 0.12 }}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 6px 7px 10px",
            borderRadius: "var(--border-radius-md)",
            cursor: "pointer",
            minWidth: 0,
          }}
        >
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            style={{ flexShrink: 0, display: "flex" }}
          >
            <ChevronRight size={11} color={groupColor} />
          </motion.div>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: groupColor, flexShrink: 0,
          }} />
          <span style={{
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
            color: isOpen ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)",
            textTransform: "uppercase" as const,
            flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {group.short_name || group.name}
          </span>
          <span style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.30)", flexShrink: 0 }}>
            {companies.length}
          </span>
        </motion.div>

        {/* Botón "Modo grupo" — solo para grupos reales con impersonación de grupo */}
        {!isVirtual && onImpersonateGroup && (
          <button
            onClick={onImpersonateGroup}
            title="Activar modo grupo (ver todas las empresas)"
            style={{
              padding: "3px 7px",
              borderRadius: "var(--border-radius-sm)",
              border: `1px solid ${groupColor}44`,
              background: "transparent",
              color: groupColor,
              fontSize: "0.5625rem", fontWeight: 700,
              cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            Grupo
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            {companies.map(company => (
              <CompanyRow
                key={company.id}
                company={company}
                isOpen={openCompanyId === company.id}
                onToggle={() => onToggleCompany(company)}
                onImpersonate={() => onImpersonateCompany(company)}
                users={usersByCompany[company.id] ?? []}
                loadingUsers={loadingUsersByCompany[company.id] ?? false}
                selectedUserId={selectedUserId}
                onSelectUser={(u) => onSelectUser(u, company)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sidebar principal ───────────────────────────────────────────── */
export default function ImpersonationSidebar() {
  const {
    isRealSuperAdmin,
    isImpersonating,
    impersonationMode,
    impersonatedUserId,
    impersonatedCompanyName,
    impersonatedUserEmail,
    startImpersonation,
    startGroupImpersonation,
    stopImpersonation,
  } = useImpersonation();
  const router = useRouter();

  const [groups,                setGroups]                = useState<Group[]>([]);
  const [companies,             setCompanies]             = useState<Company[]>([]);
  const [loading,               setLoading]               = useState(true);
  const [openGroupIds,          setOpenGroupIds]          = useState<Set<string>>(new Set<string>());
  const [openCompanyId,         setOpenCompanyId]         = useState<string | null>(null);
  const [usersByCompany,        setUsersByCompany]        = useState<Record<string, AppUser[]>>({});
  const [loadingUsersByCompany, setLoadingUsersByCompany] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isRealSuperAdmin) return;
    void loadGroupsAndCompanies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealSuperAdmin]);

  async function loadGroupsAndCompanies() {
    setLoading(true);
    const [
      { data: groupsData, error: groupsError },
      { data: companiesData, error: companiesError },
    ] = await Promise.all([
      supabase
        .from("company_groups")
        .select("id, name, short_name, brand_color")
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("companies")
        .select("id, name, short_name, brand_color, logo_url, group_id")
        .is("deleted_at", null)
        .order("name"),
    ]);
    if (groupsError) console.error("[ImpersonationSidebar] grupos error:", groupsError);
    if (companiesError) console.error("[ImpersonationSidebar] empresas error:", companiesError);
    const comps = (companiesData as Company[]) ?? [];
    console.log("[ImpersonationSidebar] empresas cargadas:", comps.length, comps.map(c => c.name));
    setGroups((groupsData as Group[]) ?? []);
    setCompanies(comps);
    setLoading(false);
  }

  async function loadUsersForCompany(companyId: string): Promise<AppUser[]> {
    setLoadingUsersByCompany(prev => ({ ...prev, [companyId]: true }));
    const { data } = await supabase
      .from("app_users")
      .select("id, full_name, email, role")
      .eq("company_id", companyId)
      .neq("role", "superadmin")
      .order("full_name");
    const users = (data as AppUser[]) ?? [];
    setUsersByCompany(prev => ({ ...prev, [companyId]: users }));
    setLoadingUsersByCompany(prev => ({ ...prev, [companyId]: false }));
    return users;
  }

  function impersonateCompany(company: Company) {
    startImpersonation({
      companyId:    company.id,
      companyName:  company.short_name || company.name,
      userId:       null,
      userEmail:    null,
      userFullName: null,
      role:         'superadmin',
    });
    router.push('/dashboard');
  }

  function impersonateUser(user: AppUser, company: Company) {
    startImpersonation({
      companyId:    company.id,
      companyName:  company.short_name || company.name,
      userId:       user.id,
      userEmail:    user.email,
      userFullName: user.full_name,
      role:         user.role,
    });
    router.push('/dashboard');
  }

  function toggleGroup(group: Group) {
    /* Solo expande/colapsa la rama — NO impersona */
    setOpenGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(group.id)) next.delete(group.id);
      else next.add(group.id);
      return next;
    });
  }

  function impersonateGroup(group: Group) {
    /* Activar modo grupo con todas sus empresas */
    const groupComps = companies.filter(c => c.group_id === group.id);
    if (groupComps.length === 0) return;
    const gc: GroupCompany[] = groupComps.map(c => ({
      id:          c.id,
      name:        c.name,
      short_name:  c.short_name,
      brand_color: c.brand_color,
      logo_url:    c.logo_url,
    }));
    startGroupImpersonation({
      groupId:   group.id,
      groupName: group.short_name || group.name,
      companies: gc,
    });
    router.push('/dashboard');
  }

  function toggleCompany(company: Company) {
    /* Solo expande/colapsa la rama — NO impersona */
    if (openCompanyId === company.id) {
      setOpenCompanyId(null);
    } else {
      setOpenCompanyId(company.id);
      if (!usersByCompany[company.id] && !loadingUsersByCompany[company.id]) {
        void loadUsersForCompany(company.id);
      }
    }
  }

  function handleSelectUser(user: AppUser, company: Company) {
    impersonateUser(user, company);
  }

  if (!isRealSuperAdmin) return null;

  const sidebarBg = "var(--bg-sidebar)";
  const ungrouped = companies.filter(c => !c.group_id);
  const virtualUngrouped: Group = {
    id: UNGROUPED_ID, name: "Sin grupo", short_name: null, brand_color: "#6b7280",
  };

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
      <div style={{
        padding: "14px 16px 10px",
        display: "flex", alignItems: "center", gap: 9,
        flexShrink: 0,
      }}>
        <Shield size={15} color={SAPROA_COLOR} />
        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
          Ver como empresa
        </span>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

      {/* Árbol grupo → empresa → usuario */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 4px" }}>
        {loading ? (
          <div style={{ padding: "8px 8px", color: "rgba(255,255,255,0.40)", fontSize: "0.75rem" }}>
            Cargando...
          </div>
        ) : (
          <>
            {groups.map(group => (
              <GroupRow
                key={group.id}
                group={group}
                isOpen={openGroupIds.has(group.id)}
                onToggle={() => toggleGroup(group)}
                companies={companies.filter(c => c.group_id === group.id)}
                openCompanyId={openCompanyId}
                onToggleCompany={toggleCompany}
                onImpersonateCompany={impersonateCompany}
                onImpersonateGroup={() => impersonateGroup(group)}
                usersByCompany={usersByCompany}
                loadingUsersByCompany={loadingUsersByCompany}
                selectedUserId={impersonatedUserId ?? null}
                onSelectUser={handleSelectUser}
              />
            ))}

            {ungrouped.length > 0 && (
              <GroupRow
                key={UNGROUPED_ID}
                group={virtualUngrouped}
                isOpen={openGroupIds.has(UNGROUPED_ID)}
                onToggle={() => toggleGroup(virtualUngrouped)}
                companies={ungrouped}
                openCompanyId={openCompanyId}
                onToggleCompany={toggleCompany}
                onImpersonateCompany={impersonateCompany}
                usersByCompany={usersByCompany}
                loadingUsersByCompany={loadingUsersByCompany}
                selectedUserId={impersonatedUserId ?? null}
                onSelectUser={handleSelectUser}
              />
            )}
          </>
        )}
      </div>

      {/* Botón Vista SAPROA */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "10px 16px",
      }}>
        <button
          onClick={() => { stopImpersonation(); router.push("/saproa-admin/impersonar"); }}
          style={{
            width: "100%", padding: "9px 14px",
            borderRadius: "var(--border-radius-md)",
            border: "none", background: "transparent",
            color: "rgba(255,255,255,0.45)",
            fontSize: "0.75rem", fontWeight: 600,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
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
              borderTop: "1px solid var(--accent-tint-medium)",
              background: "var(--accent-tint-soft)",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Eye size={13} color={SAPROA_COLOR} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: SAPROA_COLOR }}>
                  Vista simulada
                </div>
                <div style={{
                  fontSize: "0.6875rem",
                  color: "rgba(255,255,255,0.58)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {impersonatedCompanyName}
                  {impersonatedUserEmail
                    ? ` · ${impersonatedUserEmail}`
                    : impersonationMode === 'company' ? ' · vista completa' : ''}
                </div>
              </div>
            </div>
            <button
              onClick={() => { stopImpersonation(); router.push("/saproa-admin/impersonar"); }}
              style={{
                width: "100%", padding: "7px 12px",
                borderRadius: "var(--border-radius-md)",
                border: `1px solid rgba(139,34,82,0.45)`,
                background: "transparent",
                color: SAPROA_COLOR,
                fontSize: "0.75rem", fontWeight: 700,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
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
