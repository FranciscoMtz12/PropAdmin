"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  company_id: string;
  is_superadmin: boolean;
  role: "admin";
};

type TenantUser = {
  id: string;
  email: string;
  full_name: string;
  company_id: string;
  is_superadmin: false;
  role: "tenant";
  tenant_id: string;
};

type CurrentUser = AdminUser | TenantUser | null;

type UserContextType = {
  user: CurrentUser;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setUser(null);
      setLoading(false);
      return;
    }

    const authUserId = session.user.id;
    const authEmail = session.user.email || "";

    // 1) Intentar resolver como admin
    const { data: adminData, error: adminError } = await supabase
      .from("app_users")
      .select("id, email, full_name, company_id, is_superadmin")
      .eq("id", authUserId)
      .maybeSingle();

    if (!adminError && adminData) {
      setUser({
        id: adminData.id,
        email: adminData.email || authEmail,
        full_name: adminData.full_name || "",
        company_id: adminData.company_id || "",
        is_superadmin: Boolean(adminData.is_superadmin),
        role: "admin",
      });
      setLoading(false);
      return;
    }

    // 2) Si no es admin, intentar resolver como tenant
    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("id, email, full_name, company_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!tenantError && tenantData) {
      setUser({
        id: authUserId,
        tenant_id: tenantData.id,
        email: tenantData.email || authEmail,
        full_name: tenantData.full_name || "",
        company_id: tenantData.company_id || "",
        is_superadmin: false,
        role: "tenant",
      });
      setLoading(false);
      return;
    }

    // 3) Si no encontró perfil de negocio, dejar sesión vacía
    setUser(null);
    setLoading(false);
  }

  useEffect(() => {
    refreshUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(UserContext);
}