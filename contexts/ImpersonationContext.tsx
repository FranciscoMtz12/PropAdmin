"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  activeSessionId: string | null;      // id de la sesion de auditoria activa
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
  activeSessionId: null,
  startImpersonation: () => {},
  startGroupImpersonation: () => {},
  toggleGroupCompany: () => {},
  stopImpersonation: () => {},
});

/* ─── sessionStorage — persiste la impersonación entre navigations duras ── */

const STORAGE_KEY = "saproa_impersonation_v1";

type StoredImpersonation = {
  mode: "user" | "company" | "group";
  companyId: string | null;
  companyName: string | null;
  userId: string | null;
  userEmail: string | null;
  userFullName: string | null;
  role: string | null;
  groupId: string | null;
  groupName: string | null;
  groupCompanies: GroupCompany[];
  groupCompanyIds: string[];
  sessionId: string | null;
};

function readStorage(): StoredImpersonation | null {
  try {
    const r = sessionStorage.getItem(STORAGE_KEY);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

function writeStorage(s: StoredImpersonation) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function clearStorage() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
}

/* ─── Provider ────────────────────────────────────────────────────── */

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const isRealSuperAdmin = Boolean(user?.is_superadmin);
  const isGroupAdmin = user?.role === 'group_admin';

  /* Ref para cierre de sesión sin causar re-renders — sincronizado con activeSessionId */
  const currentSessionIdRef = useRef<string | null>(null);

  const [impersonationMode,        setImpersonationMode]        = useState<'user' | 'company' | 'group'>('company');
  const [impersonatedCompanyId,    setImpersonatedCompanyId]    = useState<string | null>(null);
  const [impersonatedCompanyName,  setImpersonatedCompanyName]  = useState<string | null>(null);
  const [impersonatedUserId,       setImpersonatedUserId]       = useState<string | null>(null);
  const [impersonatedUserEmail,    setImpersonatedUserEmail]    = useState<string | null>(null);
  const [impersonatedUserFullName, setImpersonatedUserFullName] = useState<string | null>(null);
  const [impersonatedRole,         setImpersonatedRole]         = useState<string | null>(null);
  const [impersonatedGroupId,      setImpersonatedGroupId]      = useState<string | null>(null);
  const [impersonatedGroupName,    setImpersonatedGroupName]    = useState<string | null>(null);
  const [groupCompanies,           setGroupCompanies]           = useState<GroupCompany[]>([]);
  const [groupCompanyIds,          setGroupCompanyIds]          = useState<string[]>([]);
  const [activeSessionId,          setActiveSessionId]          = useState<string | null>(null);

  /* Restaurar desde sessionStorage en el primer mount del cliente. */
  useEffect(() => {
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
      setImpersonatedGroupId(null);
      setImpersonatedGroupName(null);
      setGroupCompanies([]);
      setGroupCompanyIds([]);
      currentSessionIdRef.current = s.sessionId ?? null;
      setActiveSessionId(s.sessionId ?? null);
    } else if (s.groupId) {
      setImpersonationMode('group');
      setImpersonatedGroupId(s.groupId);
      setImpersonatedGroupName(s.groupName);
      setGroupCompanies(s.groupCompanies ?? []);
      setGroupCompanyIds(s.groupCompanyIds ?? []);
      setImpersonatedCompanyId(null);
      setImpersonatedCompanyName(null);
      currentSessionIdRef.current = s.sessionId ?? null;
      setActiveSessionId(s.sessionId ?? null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Limpiar si el usuario confirma ser NO superadmin. */
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

  /* ─── Helpers de auditoría DB ────────────────────────────────────── */

  function closeCurrentSession() {
    const id = currentSessionIdRef.current;
    if (!id) return;
    currentSessionIdRef.current = null;
    supabase
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[AUDIT UPDATE] closeCurrentSession failed:', error);
      });
  }

  /* Cierra TODAS las sesiones abiertas del actor en DB. Se llama en stopImpersonation
     como backup para el caso en que closeCurrentSession no pudo (ref perdido por
     cierre de tab, reload en otra pestaña, etc.). NO se llama en start* para evitar
     race condition donde el orphan-cleanup llega al DB tras el INSERT y cierra la
     sesión recién creada. */
  function closeOrphanedSessions() {
    if (!user?.id) return;
    supabase
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('actor_id', user.id)
      .is('ended_at', null)
      .then(({ error }) => {
        if (error) console.error('[AUDIT UPDATE] closeOrphanedSessions failed:', error);
      });
  }

  /* ─── Acciones ─────────────────────────────────────────────────── */

  function startImpersonation(params: ImpersonationParams) {
    const mode: 'user' | 'company' = params.userId !== null ? 'user' : 'company';
    const sessionId = crypto.randomUUID();

    writeStorage({
      mode, companyId: params.companyId, companyName: params.companyName,
      userId: params.userId, userEmail: params.userEmail, userFullName: params.userFullName,
      role: params.role, groupId: null, groupName: null,
      groupCompanies: [], groupCompanyIds: [], sessionId,
    });

    closeCurrentSession();
    currentSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);

    if (isRealSuperAdmin) {
      supabase.from('impersonation_sessions').insert({
        id: sessionId,
        actor_id:              user?.id    ?? null,
        actor_email:           user?.email ?? null,
        mode,
        target_company_id:     params.companyId    || null,
        target_company_name:   params.companyName  || null,
        target_user_id:        params.userId       || null,
        target_user_email:     params.userEmail    || null,
        target_user_full_name: params.userFullName || null,
        target_user_role:      params.role         || null,
      }).then(({ error }) => {
        if (error) console.error('[AUDIT INSERT] startImpersonation failed:', error);
      });
    }

    setImpersonationMode(mode);
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
    const sessionId = crypto.randomUUID();

    writeStorage({
      mode: 'group', companyId: null, companyName: null, userId: null,
      userEmail: null, userFullName: null, role: null, groupId: params.groupId,
      groupName: params.groupName, groupCompanies: params.companies,
      groupCompanyIds: params.companies.map(c => c.id), sessionId,
    });

    closeCurrentSession();
    currentSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);

    if (isRealSuperAdmin) {
      supabase.from('impersonation_sessions').insert({
        id: sessionId,
        actor_id:         user?.id    ?? null,
        actor_email:      user?.email ?? null,
        mode:             'group',
        target_group_id:  params.groupId   || null,
        target_group_name: params.groupName || null,
      }).then(({ error }) => {
        if (error) console.error('[AUDIT INSERT] startGroupImpersonation failed:', error);
      });
    }

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
    closeCurrentSession();
    closeOrphanedSessions(); // backup: cierra cualquier sesión abierta del actor si closeCurrentSession falló o el ref fue perdido
    clearStorage();
    setActiveSessionId(null);
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
        activeSessionId,
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
