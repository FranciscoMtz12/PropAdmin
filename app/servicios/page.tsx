"use client";

import { useCurrentUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Layers } from "lucide-react";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";

export default function ServiciosPage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    const allowed = ["superadmin", "administracion"];
    if (!(allowed.includes(user.role ?? "") || user.is_superadmin)) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="Servicios"
        titleIcon={<Layers size={20} />}
        subtitle="Gestión mensual de facturas y servicios contratados por edificio."
      />
      <SectionCard title="Estado del módulo">
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
          Módulo en construcción — próximamente disponible.
        </p>
      </SectionCard>
    </PageContainer>
  );
}
