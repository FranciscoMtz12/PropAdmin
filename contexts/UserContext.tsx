"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
  company_id: string;
  is_superadmin: boolean;
} | null;

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

    const { data, error } = await supabase
      .from("app_users")
      .select("id, email, full_name, company_id, is_superadmin")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setUser(null);
      setLoading(false);
      return;
    }

    setUser({
      id: data.id,
      email: data.email || session.user.email || "",
      full_name: data.full_name || "",
      company_id: data.company_id || "",
      is_superadmin: data.is_superadmin || false,
    });

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