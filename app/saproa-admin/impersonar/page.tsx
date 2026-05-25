"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Eye, Shield } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import {
  useImpersonation,
  type GroupCompany,
} from "@/contexts/ImpersonationContext";
import { initials } from "@/contexts/ThemeContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import UiButton from "@/components/UiButton";
import { staggerContainer, staggerItem } from "@/lib/animations";

const SAPROA_ACCENT = "#6366F1";
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

export default function SaproaImpersonarPage() {
  const router = useRouter();
  const {
    isImpersonating,
    impersonatedCompanyName,
    impersonatedUserEmail,
    impersonationMode,
    impersonatedUserId,
    startImpersonation,
    startGroupImpersonation,
    stopImpersonation,
  } = useImpersonation();

  const [groups,                setGroups]                = useState<Group[]>([]);
  const [companies,             setCompanies]             = useState<Company[]>([]);
  const [loading,               setLoading]               = useState(true);
  const [openGroupIds,          setOpenGroupIds]          = useState<Set<string>>(new Set<string>());
  const [openCompanyId,         setOpenCompanyId]         = useState<string | null>(null);
  const [usersByCompany,        setUsersByCompany]        = useState<Record<string, AppUser[]>>({});
  const [loadingUsersByCompany, setLoadingUsersByCompany] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadGroupsAndCompanies();
  }, []);

  async function loadGroupsAndCompanies() {
    setLoading(true);
    const [{ data: groupsData }, { data: companiesData }] = await Promise.all([
      supabase.from("company_groups").select("id, name, short_name, brand_color").is("deleted_at", null).order("name"),
      supabase.from("companies").select("id, name, short_name, brand_color, logo_url, group_id").is("deleted_at", null).order("name"),
    ]);
    setGroups((groupsData as Group[]) ?? []);
    setCompanies((companiesData as Company[]) ?? []);
    setLoading(false);
  }

  async function loadUsersForCompany(companyId: string) {
    setLoadingUsersByCompany(prev => ({ ...prev, [companyId]: true }));
    const { data } = await supabase
      .from("app_users")
      .select("id, full_name, email, role")
      .eq("company_id", companyId)
      .neq("role", "superadmin")
      .order("full_name");
    setUsersByCompany(prev => ({ ...prev, [companyId]: (data as AppUser[]) ?? [] }));
    setLoadingUsersByCompany(prev => ({ ...prev, [companyId]: false }));
  }

  function impersonateCompany(company: Company) {
    startImpersonation({ companyId: company.id, companyName: company.short_name || company.name, userId: null, userEmail: null, userFullName: null, role: "superadmin" });
    router.push("/dashboard");
  }

  function impersonateUser(user: AppUser, company: Company) {
    startImpersonation({ companyId: company.id, companyName: company.short_name || company.name, userId: user.id, userEmail: user.email, userFullName: user.full_name, role: user.role });
    router.push("/dashboard");
  }

  function toggleGroup(group: Group) {
    setOpenGroupIds(prev => {
      const next = new Set(prev);
      next.has(group.id) ? next.delete(group.id) : next.add(group.id);
      return next;
    });

    if (group.id === UNGROUPED_ID) {
      const first = companies.find(c => !c.group_id);
      if (first) impersonateCompany(first);
    } else {
      const groupComps = companies.filter(c => c.group_id === group.id);
      if (groupComps.length > 0) {
        const gc: GroupCompany[] = groupComps.map(c => ({ id: c.id, name: c.name, short_name: c.short_name, brand_color: c.brand_color, logo_url: c.logo_url }));
        startGroupImpersonation({ groupId: group.id, groupName: group.short_name || group.name, companies: gc });
        router.push("/dashboard");
      }
    }
  }

  function toggleCompany(company: Company) {
    if (openCompanyId === company.id) {
      setOpenCompanyId(null);
    } else {
      setOpenCompanyId(company.id);
      if (!usersByCompany[company.id] && !loadingUsersByCompany[company.id]) {
        void loadUsersForCompany(company.id);
      }
    }
    impersonateCompany(company);
  }

  const ungrouped = companies.filter(c => !c.group_id);
  const virtualUngrouped: Group = { id: UNGROUPED_ID, name: "Sin grupo", short_name: null, brand_color: "#6b7280" };

  return (
    <PageContainer>
      <PageHeader title="Impersonar empresa" subtitle="Simula la vista de cualquier empresa o usuario" titleIcon={<Eye size={18} />} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, alignItems: "start" }}>
        {/* Left: tree */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={14} color={SAPROA_ACCENT} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Grupo → Empresa → Usuario</span>
          </div>

          <div style={{ padding: "8px", maxHeight: 520, overflowY: "auto" }}>
            {loading ? (
              <p style={{ padding: "8px", fontSize: 12, color: "var(--text-muted)" }}>Cargando...</p>
            ) : (
              <motion.div variants={staggerContainer} initial="hidden" animate="show">
                {groups.map(group => {
                  const gc = companies.filter(c => c.group_id === group.id);
                  const isOpen = openGroupIds.has(group.id);
                  const dot = group.brand_color || "#6b7280";
                  return (
                    <motion.div key={group.id} variants={staggerItem}>
                      {/* Group row */}
                      <div
                        onClick={() => toggleGroup(group)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: "var(--border-radius-md)", cursor: "pointer" }}
                        className="hover-subtle"
                      >
                        <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ flexShrink: 0 }}>
                          <ChevronRight size={11} color="var(--text-muted)" />
                        </motion.div>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", textTransform: "uppercase", flex: 1 }}>
                          {group.short_name || group.name}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{gc.length}</span>
                      </div>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                            {gc.map(company => {
                              const isCoOpen = openCompanyId === company.id;
                              const cdot = company.brand_color || "#6b7280";
                              return (
                                <div key={company.id}>
                                  <div
                                    onClick={() => toggleCompany(company)}
                                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px 7px 22px", borderRadius: "var(--border-radius-md)", cursor: "pointer", borderLeft: isCoOpen ? `2px solid ${cdot}` : "2px solid transparent" }}
                                    className="hover-subtle"
                                  >
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: cdot, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, fontWeight: isCoOpen ? 700 : 400, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {company.short_name || company.name}
                                    </span>
                                    <motion.div animate={{ rotate: isCoOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
                                      <ChevronRight size={10} color="var(--text-muted)" />
                                    </motion.div>
                                  </div>

                                  <AnimatePresence>
                                    {isCoOpen && (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                                        {loadingUsersByCompany[company.id] ? (
                                          <div style={{ padding: "6px 8px 6px 40px", fontSize: 11, color: "var(--text-muted)" }}>Cargando...</div>
                                        ) : (usersByCompany[company.id] ?? []).length === 0 ? (
                                          <div style={{ padding: "6px 8px 6px 40px", fontSize: 11, color: "var(--text-muted)" }}>Sin usuarios</div>
                                        ) : (
                                          (usersByCompany[company.id] ?? []).map(u => {
                                            const isSelected = impersonatedUserId === u.id;
                                            return (
                                              <div
                                                key={u.id}
                                                onClick={() => impersonateUser(u, company)}
                                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 38px", borderRadius: "var(--border-radius-md)", cursor: "pointer", borderLeft: isSelected ? `2px solid ${SAPROA_ACCENT}` : "2px solid transparent" }}
                                                className="hover-subtle"
                                              >
                                                <div style={{ width: 22, height: 22, borderRadius: "50%", background: isSelected ? SAPROA_ACCENT : "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: isSelected ? "#fff" : "var(--text-muted)", flexShrink: 0 }}>
                                                  {initials(u.full_name || u.email)}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name || u.email}</div>
                                                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{ROLE_LABEL[u.role] ?? u.role}</div>
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {ungrouped.length > 0 && (
                  <motion.div key={UNGROUPED_ID} variants={staggerItem}>
                    <div
                      onClick={() => toggleGroup(virtualUngrouped)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: "var(--border-radius-md)", cursor: "pointer" }}
                      className="hover-subtle"
                    >
                      <motion.div animate={{ rotate: openGroupIds.has(UNGROUPED_ID) ? 90 : 0 }} transition={{ duration: 0.15 }}>
                        <ChevronRight size={11} color="var(--text-muted)" />
                      </motion.div>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6b7280", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-muted)", textTransform: "uppercase", flex: 1 }}>
                        Sin grupo
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{ungrouped.length}</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: state/instructions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isImpersonating ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Eye size={18} color={SAPROA_ACCENT} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Vista simulada activa</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                <strong>Empresa:</strong> {impersonatedCompanyName ?? "—"}
              </div>
              {impersonationMode === "user" && impersonatedUserEmail && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  <strong>Usuario:</strong> {impersonatedUserEmail}
                </div>
              )}
              {impersonationMode === "company" && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  <strong>Modo:</strong> Vista completa de empresa
                </div>
              )}
              <UiButton
                variant="secondary"
                onClick={() => { stopImpersonation(); router.push("/saproa-admin/overview"); }}
                style={{ marginTop: 8 }}
              >
                Salir de vista simulada
              </UiButton>
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Shield size={18} color={SAPROA_ACCENT} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>¿Qué es la vista simulada?</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                La vista simulada te permite ver la plataforma exactamente como la ve una empresa o un usuario específico,
                sin cambiar tu cuenta ni los datos reales.
              </p>
              <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                <li>Haz click en un <strong>grupo</strong> para activar la vista consolidada multi-empresa.</li>
                <li>Haz click en una <strong>empresa</strong> para ver su dashboard completo.</li>
                <li>Haz click en un <strong>usuario</strong> para ver la plataforma con su rol específico.</li>
              </ul>
              <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                El banner "Vista simulada" aparecerá en la parte superior para recordarte que estás en modo de simulación.
                Haz click en "Salir de vista simulada" para volver al Control Center.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
