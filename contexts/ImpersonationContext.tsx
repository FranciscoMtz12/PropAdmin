"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabaseClient";

/* ─── Tipos públicos ─────────────────────────────────────────────── */

export type ImpersonationParams = {
  companyId: string;
  companyName: string;
  userId: string | null;
  userEmail: string | null;
  userFullName: string | null;
  role: string;
};

export type GroupCompany = {
  id: string;
  name: string;
  short_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
};

export type GroupImpersonationParams = {
  groupId: string;
  groupName: string;
  companies: GroupCompany[];
};

/* ─── Tipo del contexto ──────────────────────────────────────────── */

type ImpersonationContextType = {
  isRealSuperAdmin: boolean;
  isImpersonating: boolean;
  impersonationMode: 'user' | 'company' | 'group';
  /* company / user mode */
  impersonatedCompanyId: string | null;
  impersonatedCompanyName: string | null;
  impersonatedUserId: string | null;
  impersonatedUserEmail: string | null;
  impersonatedUserFullName: string | null;
  impersonatedRole: string | null;
  /* group mode */
  impersonatedGroupId: string | null;
  impersonatedGroupName: string | null;
  groupCompanies: GroupCompany[];
  groupCompanyIds: string[];           // subconjunto activo (toggle)
  /* acciones */
  startImpersonation: (params: ImpersonationParams) => void;
  startGroupImpersonation: (params: GroupImpersonationParams) => void;
  toggleGroupCompany: (companyId: string) => void;
  stopImpersonation: () => void;
};

/* ─── Default ────────────────────────────────────────────────────── */

const ImpersonationContext = createContext<ImpersonationContextType>({
  isRealSuperAdmin: false,
  isImpersonating: false,
  impersonationMode: 'company',
  impersonatedCompanyId: null,
  impersonatedCompanyName: null,
  impersonatedUserId: null,
  impersonatedUserEmail: null,
  impersonatedUserFullName: null,
  impersonatedRole: null,
  impersonatedGroupId: null,
  impersonatedGroupName: null,
  groupCompanies: [],
  groupCompanyIds: [],
  startImpersonation: () => {},
  startGroupImpersonation: () => {},
  toggleGroupCompany: () => {},
  stopImpersonation: () => {},
});

/* ─── Provider ────────────────────────────────────────────────────── */


/* ── sessionStorage — persiste la impersonación a través de navigations duras ── */
const STORAGE_KEY = "saproa_impersonation_v1";
type StoredImpersonation = {
  mode: "user" | "company" | "group";
  companyId: string | null; companyName: string | null;
  userId: string | null; userEmail: string | null; userFullName: string | null; role: string | null;
  groupId: string | null; groupName: string | null;
  groupCompanies: GroupCompany[]; groupCompanyIds: string[];
};
function readStorage(): StoredImpersonation | null {
  try { const r = sessionStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function writeStorage(s: StoredImpersonation) { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }
function clearStorage() { try { sessionStorage.removeItem(STORAGE_KEY); } catch {} }
export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const isRealSuperAdmin = Boolean(user?.is_superadmin);
  const isGroupAdmin = user?.role === 'group_admin';

  const [impersonationMode,      setImpersonationMode]      = useState<'user' | 'company' | 'group'>('company');
  const [impersonatedCompanyId,  setImpersonatedCompanyId]  = useState<string | null>(null);
  const [impersonatedCompanyName,setImpersonatedCompanyName]= useState<string | null>(null);
  const [impersonatedUserId,     setImpersonatedUserId]     = useState<string | null>(null);
  const [impersonatedUserEmail,  setImpersonatedUserEmail]  = useState<string | null>(null);
  const [impersonatedUserFullName,setImpersonatedUserFullName]= useState<string | null>(null);
  const [impersonatedRole,       setImpersonatedRole]       = useState<string | null>(null);
  const [impersonatedGroupId,    setImpersonatedGroupId]    = useState<string | null>(null);
  const [impersonatedGroupName,  setImpersonatedGroupName]  = useState<string | null>(null);
  const [groupCompanies,         setGroupCompanies]         = useState<GroupCompany[]>([]);
  const [groupCompanyIds,        setGroupCompanyIds]        = useState<string[]>([]);

  /* Restaurar desde sessionStorage cuando el superadmin se confirma.
     Resuelve el bug donde un hard-navigation (full page reload) vaciaba la impersonacion. */
  useEffect(() => {
    if (!isRealSuperAdmin) return;
    if (impersonatedCompanyId !== null || impersonatedGroupId !== null) return;
    const s = readStorage();
    if (!s) return;
    if (s.companyId) {
      setImpersonationMode(s.mode ?? 'company');
      setImpersonatedCompanyId(s.companyId);
      setImpersonatedCompanyName(s.companyName);
      setImpersonatedUserId(s.userId);
      setImpersonatedUserEmail(s.userEmail);
      setImpersonatedUserFullName(s.userFullName);
      setImpersonatedRole(s.role);
      setImpersonatedGroupId(null); setImpersonatedGroupName(null);
      setGroupCompanies([]); setGroupCompanyIds([]);
    } else if (s.groupId) {
      setImpersonationMode('group');
      setImpersonatedGroupId(s.groupId); setImpersonatedGroupName(s.groupName);
      setGroupCompanies(s.groupCompanies ?? []); setGroupCompanyIds(s.groupCompanyIds ?? []);
      setImpersonatedCompanyId(null); setImpersonatedCompanyName(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealSuperAdmin]);

  /* Limpiar cuando el usuario se confirma como NO superadmin.
     user !== null garantiza que esperamos a que el usuario cargue antes
     de borrar el sessionStorage (evita borrar durante un reload). */
  useEffect(() => {
    if (!isRealSuperAdmin && !isGroupAdmin && user !== null) stopImpersonation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealSuperAdmin, isGroupAdmin, user]);

  /* Auto-activar modo grupo cuando entra un group_admin */
  useEffect(() => {
    const groupId = user && 'group_id' in user ? user.group_id : null;
    if (!isGroupAdmin || !groupId) return;

    /* Activar modo grupo SÍNCRONAMENTE para que isGroupMode sea true de inmediato */
    setImpersonationMode('group');
    setImpersonatedGroupId(groupId);

    let cancelled = false;

    async function loadGroupData() {
      const [{ data: groupData }, { data: companiesData }] = await Promise.all([
        supabase
          .from("company_groups")
          .select("id, name, short_name, brand_color, logo_url")
          .eq("id", groupId!)
          .maybeSingle(),
        supabase
          .from("companies")
          .select("id, name, short_name, brand_color, logo_url")
          .eq("group_id", groupId!)
          .is("deleted_at", null),
      ]);

      if (cancelled) return;

      if (groupData) {
        const rawName = (groupData as any).short_name || groupData.name;
        const groupName = rawName.startsWith("Grupo") ? rawName : `Grupo ${rawName}`;
        setImpersonatedGroupName(groupName);
      }
      setGroupCompanies((companiesData as GroupCompany[]) || []);
      setGroupCompanyIds(((companiesData || []) as GroupCompany[]).map(c => c.id));
      setImpersonatedCompanyId(null);
      setImpersonatedCompanyName(null);
      setImpersonatedUserId(null);
      setImpersonatedUserEmail(null);
      setImpersonatedUserFullName(null);
      setImpersonatedRole(null);
    }

    void loadGroupData();
    return () => { cancelled = true; };
  // impersonatedGroupId se omite intencionalmente: incluirlo hace que React cancele
  // el fetch asíncrono cuando setImpersonatedGroupId() actualiza estado a mitad del vuelo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroupAdmin, user && 'group_id' in user ? user.group_id : null]);

  function startImpersonation(params: ImpersonationParams) {
    const _mode = params.userId !== null ? 'user' : 'company';
    writeStorage({ mode: _mode, companyId: params.companyId, companyName: params.companyName,
      userId: params.userId, userEmail: params.userEmail, userFullName: params.userFullName,
      role: params.role, groupId: null, groupName: null, groupCompanies: [], groupCompanyIds: [] });
    setImpersonationMode(params.userId !== null ? 'user' : 'company');
    setImpersonatedCompanyId(params.companyId);
    setImpersonatedCompanyName(params.companyName);
    setImpersonatedUserId(params.userId);
    setImpersonatedUserEmail(params.userEmail);
    setImpersonatedUserFullName(params.userFullName);
    setImpersonatedRole(params.role);
    setImpersonatedGroupId(null);
    setImpersonatedGroupName(null);
    setGroupCompanies([]);
    setGroupCompanyIds([]);
  }

  function startGroupImpersonation(params: GroupImpersonationParams) {
    writeStorage({ mode: 'group', companyId: null, companyName: null, userId: null,
      userEmail: null, userFullName: null, role: null, groupId: params.groupId,
      groupName: params.groupName, groupCompanies: params.companies,
      groupCompanyIds: params.companies.map(c => c.id) });
    setImpersonationMode('group');
    setImpersonatedGroupId(params.groupId);
    setImpersonatedGroupName(params.groupName);
    setGroupCompanies(params.companies);
    setGroupCompanyIds(params.companies.map(c => c.id));
    /* Limpiar campos de empresa/usuario */
    setImpersonatedCompanyId(null);
    setImpersonatedCompanyName(null);
    setImpersonatedUserId(null);
    setImpersonatedUserEmail(null);
    setImpersonatedUserFullName(null);
    setImpersonatedRole(null);
  }

  function toggleGroupCompany(companyId: string) {
    setGroupCompanyIds(prev => {
      if (prev.includes(companyId)) {
        if (prev.length <= 1) return prev; // al menos una empresa activa
        return prev.filter(id => id !== companyId);
      }
      return [...prev, companyId];
    });
  }

  function stopImpersonation() {
    clearStorage();
    setImpersonationMode('company');
    setImpersonatedCompanyId(null);
    setImpersonatedCompanyName(null);
    setImpersonatedUserId(null);
    setImpersonatedUserEmail(null);
    setImpersonatedUserFullName(null);
    setImpersonatedRole(null);
    setImpersonatedGroupId(null);
    setImpersonatedGroupName(null);
    setGroupCompanies([]);
    setGroupCompanyIds([]);
  }

  return (
    <ImpersonationContext.Provider
      value={{
        isRealSuperAdmin,
        isImpersonating: impersonatedCompanyId !== null || impersonatedGroupId !== null,
        impersonationMode,
        impersonatedCompanyId,
        impersonatedCompanyName,
        impersonatedUserId,
        impersonatedUserEmail,
        impersonatedUserFullName,
        impersonatedRole,
        impersonatedGroupId,
        impersonatedGroupName,
        groupCompanies,
        groupCompanyIds,
        startImpersonation,
        startGroupImpersonation,
        toggleGroupCompany,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

/* ─── Hook de acceso ─────────────────────────────────────────────── */

export function useImpersonation() {
  return useContext(ImpersonationContext);
}
