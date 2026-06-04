"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Download, Eye, Shield } from "lucide-react";

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
  const [downloadingAudit,      setDownloadingAudit]      = useState(false);
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
    router.push("/home");
  }

  function impersonateUser(user: AppUser, company: Company) {
    startImpersonation({ companyId: company.id, companyName: company.short_name || company.name, userId: user.id, userEmail: user.email, userFullName: user.full_name, role: user.role });
    router.push("/home");
  }

  function toggleGroup(group: Group) {
    /* Solo expande/colapsa — NO impersona */
    setOpenGroupIds(prev => {
      const next = new Set(prev);
      next.has(group.id) ? next.delete(group.id) : next.add(group.id);
      return next;
    });
  }

  function impersonateGroupDirect(group: Group) {
    /* Impersonación explícita de grupo — solo desde el botón "Grupo" */
    if (group.id === UNGROUPED_ID) {
      const first = companies.find(c => !c.group_id);
      if (first) impersonateCompany(first);
      return;
    }
    const groupComps = companies.filter(c => c.group_id === group.id);
    if (groupComps.length === 0) return;
    const gc: GroupCompany[] = groupComps.map(c => ({
      id: c.id, name: c.name, short_name: c.short_name,
      brand_color: c.brand_color, logo_url: c.logo_url,
    }));
    startGroupImpersonation({ groupId: group.id, groupName: group.short_name || group.name, companies: gc });
    router.push("/home");
  }

  function toggleCompany(company: Company) {
    /* Solo expande/colapsa — NO impersona */
    if (openCompanyId === company.id) {
      setOpenCompanyId(null);
    } else {
      setOpenCompanyId(company.id);
      if (!usersByCompany[company.id] && !loadingUsersByCompany[company.id]) {
        void loadUsersForCompany(company.id);
      }
    }
  }

  const ungrouped = companies.filter(c => !c.group_id);
  const virtualUngrouped: Group = { id: UNGROUPED_ID, name: "Sin grupo", short_name: null, brand_color: "#6b7280" };

  async function handleDownloadAudit() {
    setDownloadingAudit(true);
    try {
      // Fetch all sessions, most recent first
      const { data: sessions } = await supabase
        .from('impersonation_sessions')
        .select('id, actor_email, mode, target_company_name, target_user_email, target_group_name, started_at, ended_at')
        .order('started_at', { ascending: false })
        .limit(500);

      const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
      const lines: string[] = [
        '# Historial de auditoría de impersonación',
        '',
        'Generado: ' + now,
        '',
      ];

      if (!sessions || sessions.length === 0) {
        lines.push('(Sin sesiones registradas)');
      } else {
        for (const s of sessions) {
          const inicio = new Date(s.started_at).toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
          const fin = s.ended_at
            ? new Date(s.ended_at).toLocaleString('es-MX', { timeZone: 'America/Monterrey' })
            : 'Sesión aún abierta';
          const durMin = s.ended_at
            ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
            : null;

          lines.push('## Sesión — ' + inicio + ' → ' + fin + (durMin !== null ? ' (' + durMin + ' min)' : ''));
          lines.push('Actor: ' + s.actor_email);

          if (s.mode === 'company') {
            lines.push('Empresa: ' + (s.target_company_name ?? '—') + ' (modo: empresa completa)');
          } else if (s.mode === 'user') {
            lines.push('Empresa: ' + (s.target_company_name ?? '—') + ' / Usuario: ' + (s.target_user_email ?? '—') + ' (modo: usuario)');
          } else if (s.mode === 'group') {
            lines.push('Grupo: ' + (s.target_group_name ?? '—') + ' (modo: grupo)');
          }

          // Fetch actions for this session
          const { data: actions } = await supabase
            .from('impersonation_action_log')
            .select('action, table_name, record_id, label, created_at')
            .eq('session_id', s.id)
            .order('created_at', { ascending: true });

          if (!actions || actions.length === 0) {
            lines.push('Acciones registradas: (ninguna en Fase 1)');
          } else {
            lines.push('Acciones registradas:');
            for (const a of actions) {
              const ts = new Date(a.created_at).toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
              const desc = a.label ? a.label : (a.record_id ? a.record_id : '—');
              lines.push('  - [' + ts + '] ' + a.action + ' en ' + a.table_name + ': ' + desc);
            }
          }
          lines.push('');
        }
      }

      const content = lines.join(String.fromCharCode(10));
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'auditoria-impersonacion-' + new Date().toISOString().slice(0, 10) + '.md';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingAudit(false);
    }
  }


  return (
    <PageContainer>
      <PageHeader title="Impersonar empresa" subtitle="Simula la vista de cualquier empresa o usuario" titleIcon={<Eye size={18} />} />

      <div className="saproa-impersonar-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, alignItems: "start" }}>
        {/* Left: tree */}
        <div className="saproa-impersonar-tree" style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={14} color={SAPROA_ACCENT} />
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>Grupo → Empresa → Usuario</span>
          </div>

          <div style={{ padding: "8px", maxHeight: 520, overflowY: "auto" }}>
            {loading ? (
              <p style={{ padding: "8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>Cargando...</p>
            ) : (
              <motion.div variants={staggerContainer} initial="hidden" animate="show">
                {groups.map(group => {
                  const gc = companies.filter(c => c.group_id === group.id);
                  const isOpen = openGroupIds.has(group.id);
                  const dot = group.brand_color || "#6b7280";
                  return (
                    <motion.div key={group.id} variants={staggerItem}>
                      {/* Fila de grupo: chevron+nombre expande · botón "Grupo" impersona */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div
                          onClick={() => toggleGroup(group)}
                          style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 8px 10px", borderRadius: "var(--border-radius-md)", cursor: "pointer", minWidth: 0 }}
                          className="hover-subtle"
                        >
                          <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ flexShrink: 0 }}>
                            <ChevronRight size={11} color="var(--text-muted)" />
                          </motion.div>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                          <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", textTransform: "uppercase", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {group.short_name || group.name}
                          </span>
                          <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", flexShrink: 0 }}>{gc.length}</span>
                        </div>
                        <button
                          onClick={() => impersonateGroupDirect(group)}
                          title="Activar vista de grupo"
                          style={{ padding: "3px 8px", borderRadius: "var(--border-radius-sm)", border: `1px solid ${dot}44`, background: "transparent", color: dot, fontSize: "0.625rem", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
                        >
                          Grupo
                        </button>
                      </div>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                            {gc.map(company => {
                              const isCoOpen = openCompanyId === company.id;
                              const cdot = company.brand_color || "#6b7280";
                              return (
                                <div key={company.id}>
                                  {/* Fila de empresa: chevron+nombre expande · botón "Ver" impersona */}
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <div
                                      onClick={() => toggleCompany(company)}
                                      style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, padding: "7px 6px 7px 22px", borderRadius: "var(--border-radius-md)", cursor: "pointer", borderLeft: isCoOpen ? `2px solid ${cdot}` : "2px solid transparent", minWidth: 0 }}
                                      className="hover-subtle"
                                    >
                                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cdot, flexShrink: 0 }} />
                                      <span style={{ fontSize: "0.75rem", fontWeight: isCoOpen ? 700 : 400, color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {company.short_name || company.name}
                                      </span>
                                      <motion.div animate={{ rotate: isCoOpen ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ flexShrink: 0 }}>
                                        <ChevronRight size={10} color="var(--text-muted)" />
                                      </motion.div>
                                    </div>
                                    <button
                                      onClick={() => impersonateCompany(company)}
                                      title={`Impersonar ${company.short_name || company.name}`}
                                      style={{ padding: "3px 8px", borderRadius: "var(--border-radius-sm)", border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: "0.625rem", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}
                                    >
                                      <Eye size={10} />
                                      Ver
                                    </button>
                                  </div>

                                  <AnimatePresence>
                                    {isCoOpen && (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                                        {loadingUsersByCompany[company.id] ? (
                                          <div style={{ padding: "6px 8px 6px 40px", fontSize: "0.6875rem", color: "var(--text-muted)" }}>Cargando...</div>
                                        ) : (usersByCompany[company.id] ?? []).length === 0 ? (
                                          <div style={{ padding: "6px 8px 6px 40px", fontSize: "0.6875rem", color: "var(--text-muted)" }}>Sin usuarios</div>
                                        ) : (
                                          (usersByCompany[company.id] ?? []).map(u => {
                                            const isSelected = impersonatedUserId === u.id;
                                            return (
                                              <div
                                                key={u.id}
                                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 38px", borderRadius: "var(--border-radius-md)", borderLeft: isSelected ? `2px solid ${SAPROA_ACCENT}` : "2px solid transparent" }}
                                              >
                                                <div style={{ width: 22, height: 22, borderRadius: "50%", background: isSelected ? SAPROA_ACCENT : "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5625rem", fontWeight: 700, color: isSelected ? "#fff" : "var(--text-muted)", flexShrink: 0 }}>
                                                  {initials(u.full_name || u.email)}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                  <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name || u.email}</div>
                                                  <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>{ROLE_LABEL[u.role] ?? u.role}</div>
                                                </div>
                                                <button
                                                  onClick={() => impersonateUser(u, company)}
                                                  title={`Ver como ${u.full_name || u.email}`}
                                                  style={{ padding: "3px 8px", borderRadius: "var(--border-radius-sm)", border: isSelected ? `1px solid ${SAPROA_ACCENT}` : "1px solid var(--border-default)", background: isSelected ? SAPROA_ACCENT : "transparent", color: isSelected ? "#fff" : "var(--text-secondary)", fontSize: "0.625rem", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}
                                                >
                                                  <Eye size={10} />
                                                  Ver
                                                </button>
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
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-muted)", textTransform: "uppercase", flex: 1 }}>
                        Sin grupo
                      </span>
                      <span style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>{ungrouped.length}</span>
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
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Vista simulada activa</span>
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                <strong>Empresa:</strong> {impersonatedCompanyName ?? "—"}
              </div>
              {impersonationMode === "user" && impersonatedUserEmail && (
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                  <strong>Usuario:</strong> {impersonatedUserEmail}
                </div>
              )}
              {impersonationMode === "company" && (
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 8 }}>
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
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>¿Qué es la vista simulada?</span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                La vista simulada te permite ver la plataforma exactamente como la ve una empresa o un usuario específico,
                sin cambiar tu cuenta ni los datos reales.
              </p>
              <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                <li>Expande un <strong>grupo</strong> con el chevron para ver sus empresas. Usa el botón <strong>"Grupo"</strong> para activar la vista consolidada multi-empresa.</li>
                <li>Expande una <strong>empresa</strong> para ver sus usuarios. Usa el botón <strong>"Ver"</strong> para ver su dashboard completo.</li>
                <li>Usa el botón <strong>"Ver"</strong> junto a un usuario para ver la plataforma con su rol específico.</li>
              </ul>
              <p style={{ marginTop: 12, fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                El banner "Vista simulada" aparecerá en la parte superior para recordarte que estás en modo de simulación.
                Haz click en "Salir de vista simulada" para volver al Control Center.
              </p>
            </div>
          )}
        </div>
      </div>
    {/* ── Botón de descarga de historial de auditoría ── */}
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type='button'
          onClick={() => void handleDownloadAudit()}
          disabled={downloadingAudit}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border-default)', background: 'var(--bg-card)',
            color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500,
            cursor: downloadingAudit ? 'wait' : 'pointer',
            opacity: downloadingAudit ? 0.6 : 1,
          }}
        >
          <Download size={13} />
          {downloadingAudit ? 'Generando...' : 'Descargar historial de auditoría'}
        </button>
      </div>

    </PageContainer>
  );
}
