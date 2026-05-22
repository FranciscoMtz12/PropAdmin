"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";

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

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const isRealSuperAdmin = Boolean(user?.is_superadmin);

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

  /* Limpiar impersonación si el usuario pierde privilegios (p.ej. cierra sesión) */
  useEffect(() => {
    if (!isRealSuperAdmin) stopImpersonation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealSuperAdmin]);

  function startImpersonation(params: ImpersonationParams) {
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
