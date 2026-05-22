"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";

export type ImpersonationParams = {
  companyId: string;
  companyName: string;
  userId: string | null;
  userEmail: string | null;
  userFullName: string | null;
  role: string;
};

type ImpersonationContextType = {
  isRealSuperAdmin: boolean;
  isImpersonating: boolean;
  impersonatedCompanyId: string | null;
  impersonatedCompanyName: string | null;
  impersonatedUserId: string | null;
  impersonatedUserEmail: string | null;
  impersonatedUserFullName: string | null;
  impersonatedRole: string | null;
  startImpersonation: (params: ImpersonationParams) => void;
  stopImpersonation: () => void;
};

const ImpersonationContext = createContext<ImpersonationContextType>({
  isRealSuperAdmin: false,
  isImpersonating: false,
  impersonatedCompanyId: null,
  impersonatedCompanyName: null,
  impersonatedUserId: null,
  impersonatedUserEmail: null,
  impersonatedUserFullName: null,
  impersonatedRole: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
});

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const isRealSuperAdmin = Boolean(user?.is_superadmin);

  const [impersonatedCompanyId,   setImpersonatedCompanyId]   = useState<string | null>(null);
  const [impersonatedCompanyName, setImpersonatedCompanyName] = useState<string | null>(null);
  const [impersonatedUserId,      setImpersonatedUserId]      = useState<string | null>(null);
  const [impersonatedUserEmail,   setImpersonatedUserEmail]   = useState<string | null>(null);
  const [impersonatedUserFullName,setImpersonatedUserFullName]= useState<string | null>(null);
  const [impersonatedRole,        setImpersonatedRole]        = useState<string | null>(null);

  /* Limpiar impersonación si el usuario pierde privilegios (p.ej. cierra sesión) */
  useEffect(() => {
    if (!isRealSuperAdmin) stopImpersonation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealSuperAdmin]);

  function startImpersonation(params: ImpersonationParams) {
    setImpersonatedCompanyId(params.companyId);
    setImpersonatedCompanyName(params.companyName);
    setImpersonatedUserId(params.userId);
    setImpersonatedUserEmail(params.userEmail);
    setImpersonatedUserFullName(params.userFullName);
    setImpersonatedRole(params.role);
  }

  function stopImpersonation() {
    setImpersonatedCompanyId(null);
    setImpersonatedCompanyName(null);
    setImpersonatedUserId(null);
    setImpersonatedUserEmail(null);
    setImpersonatedUserFullName(null);
    setImpersonatedRole(null);
  }

  return (
    <ImpersonationContext.Provider
      value={{
        isRealSuperAdmin,
        isImpersonating: impersonatedCompanyId !== null,
        impersonatedCompanyId,
        impersonatedCompanyName,
        impersonatedUserId,
        impersonatedUserEmail,
        impersonatedUserFullName,
        impersonatedRole,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  return useContext(ImpersonationContext);
}
