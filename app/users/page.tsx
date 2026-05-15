"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Trash2, Building2, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import AppTable from "@/components/AppTable";
import AppBadge from "@/components/AppBadge";
import AppGrid from "@/components/AppGrid";
import MetricCard from "@/components/MetricCard";
import AppSelect from "@/components/AppSelect";
import UiButton from "@/components/UiButton";
import Modal from "@/components/Modal";

type UserRole =
  | "superadmin"
  | "administracion"
  | "directivo"
  | "compras"
  | "mantenimiento"
  | "field"
  | "tenant";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_superadmin: boolean;
  company_id: string;
  company_name: string;
  created_at: string;
};

type CompanyRow = { id: string; name: string };

const ROLE_ORDER: UserRole[] = [
  "superadmin",
  "administracion",
  "directivo",
  "compras",
  "mantenimiento",
  "field",
];

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: "Superadmin",
  administracion: "Administración",
  directivo: "Directivo",
  compras: "Compras",
  mantenimiento: "Mantenimiento",
  field: "Campo",
  tenant: "Inquilino",
};

const ROLE_STYLE: Record<UserRole, { bg: string; fg: string }> = {
  superadmin:     { bg: "#F3E8FF", fg: "#7C3AED" },
  administracion: { bg: "var(--badge-bg-blue)",  fg: "var(--badge-text-blue)" },
  directivo:      { bg: "var(--badge-bg-gray)",  fg: "var(--badge-text-gray)" },
  compras:        { bg: "#FFEDD5", fg: "#EA580C" },
  mantenimiento:  { bg: "var(--badge-bg-green)", fg: "var(--badge-text-green)" },
  field:          { bg: "#DBEAFE", fg: "#1E40AF" },
  tenant:         { bg: "#CCFBF1", fg: "#0F766E" },
};

const createSchema = z.object({
  full_name: z.string().min(1, "Nombre obligatorio"),
  email: z.string().min(1, "Email obligatorio").email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["superadmin", "administracion", "directivo", "compras", "mantenimiento", "field"]),
  company_id: z.string().min(1, "Selecciona una empresa"),
});
type CreateValues = z.infer<typeof createSchema>;

export default function UsersPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);

  const isSuperadmin = user?.role === "superadmin" || Boolean(user?.is_superadmin);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      role: "administracion",
      company_id: "",
    },
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/"); return; }
    if (!isSuperadmin) { router.replace("/dashboard"); return; }
    void loadData();
  }, [loading, user, isSuperadmin, router]);

  async function loadData() {
    setLoadingData(true);

    const [usersRes, companiesRes] = await Promise.all([
      supabase
        .from("app_users")
        .select("id, full_name, email, role, is_superadmin, company_id, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("companies")
        .select("id, name")
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ]);

    if (usersRes.error) {
      console.error("app_users fetch failed", usersRes.error);
      toast.error("No se pudieron cargar los usuarios.");
      setLoadingData(false);
      return;
    }
    if (companiesRes.error) {
      console.error("companies fetch failed", companiesRes.error);
      toast.error("No se pudieron cargar las empresas.");
      setLoadingData(false);
      return;
    }

    const companiesList = (companiesRes.data || []) as CompanyRow[];
    setCompanies(companiesList);
    const companyMap = new Map(companiesList.map((c) => [c.id, c.name]));

    const rawUsers = (usersRes.data || []) as Omit<UserRow, "company_name">[];
    const mapped: UserRow[] = rawUsers.map((u) => ({
      ...u,
      company_name: companyMap.get(u.company_id) || "—",
    }));

    setRows(mapped);
    setLoadingData(false);
  }

  async function changeRole(row: UserRow, newRole: UserRole) {
    if (newRole === row.role) return;
    setRoleUpdatingId(row.id);
    const { error } = await supabase
      .from("app_users")
      .update({
        role: newRole,
        is_superadmin: newRole === "superadmin",
      })
      .eq("id", row.id);
    if (error) {
      console.error("role update failed", error);
      toast.error("No se pudo actualizar el rol.");
      setRoleUpdatingId(null);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, role: newRole, is_superadmin: newRole === "superadmin" }
          : r
      )
    );
    toast.success(`Rol actualizado a ${ROLE_LABEL[newRole]}.`);
    setRoleUpdatingId(null);
  }

  async function deactivateUser(_row: UserRow) {
    toast("Función no disponible aún");
  }

  const onCreateSubmit = createForm.handleSubmit(async (data) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      toast.error("Tu sesión expiró. Inicia de nuevo.");
      return;
    }

    try {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: data.full_name.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
          role: data.role,
          company_id: data.company_id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(payload?.error || "No se pudo crear el usuario.");
        return;
      }
      toast.success("Usuario creado correctamente.");
      createForm.reset();
      setShowCreate(false);
      await loadData();
    } catch (error) {
      console.error("create user request failed", error);
      toast.error("Error de red al crear el usuario.");
    }
  });

  if (loading || loadingData) {
    return (
      <PageContainer>
        <div style={{ padding: "32px 0", color: "var(--text-muted)" }}>Cargando usuarios...</div>
      </PageContainer>
    );
  }

  if (!user || !isSuperadmin) return null;

  const totalUsers = rows.length;
  const totalAdmins = rows.filter((r) =>
    ["superadmin", "administracion", "directivo", "compras", "mantenimiento"].includes(r.role)
  ).length;
  const totalField = rows.filter((r) => r.role === "field").length;
  const totalTenants = rows.filter((r) => r.role === "tenant").length;

  return (
    <PageContainer>
      <PageHeader
        title="Usuarios"
        titleIcon={<Users size={18} />}
        actions={
          <UiButton icon={<UserPlus size={15} />} onClick={() => setShowCreate(true)}>
            Nuevo usuario
          </UiButton>
        }
      />

      <AppGrid minWidth={220}>
        <MetricCard
          label="Total"
          value={String(totalUsers)}
          helper="Todos los activos"
          icon={
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--icon-bg-blue)", display: "grid", placeItems: "center" }}>
              <Users size={18} color="#2563EB" />
            </div>
          }
        />
        <MetricCard
          label="Admins"
          value={String(totalAdmins)}
          helper="Roles administrativos"
          icon={
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--icon-bg-purple)", display: "grid", placeItems: "center" }}>
              <Shield size={18} color="#7C3AED" />
            </div>
          }
        />
        <MetricCard
          label="Campo"
          value={String(totalField)}
          helper="Equipo operativo"
          icon={
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--icon-bg-green)", display: "grid", placeItems: "center" }}>
              <Building2 size={18} color="#16A34A" />
            </div>
          }
        />
        <MetricCard
          label="Inquilinos"
          value={String(totalTenants)}
          helper="Portal activo"
          icon={
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--icon-bg-amber)", display: "grid", placeItems: "center" }}>
              <Users size={18} color="#D97706" />
            </div>
          }
        />
      </AppGrid>

      <SectionCard title="Listado de usuarios" icon={<Users size={18} />} style={{ marginTop: 16 }}>
        <div className="mod-table-wrap">
        <AppTable<UserRow>
          minWidth={860}
          rows={rows}
          emptyState="No hay usuarios activos."
          columns={[
            {
              key: "name",
              header: "Nombre",
              render: (row) => (
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {row.full_name || "—"}
                </span>
              ),
            },
            {
              key: "email",
              header: "Email",
              render: (row) => <span style={{ fontSize: 13 }}>{row.email}</span>,
            },
            {
              key: "company",
              header: "Empresa",
              render: (row) => (
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {row.company_name}
                </span>
              ),
            },
            {
              key: "role",
              header: "Rol",
              render: (row) => {
                const style = ROLE_STYLE[row.role];
                return (
                  <AppBadge backgroundColor={style.bg} textColor={style.fg}>
                    {ROLE_LABEL[row.role]}
                  </AppBadge>
                );
              },
            },
            {
              key: "actions",
              header: "Acciones",
              render: (row) => (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AppSelect
                    value={row.role}
                    disabled={roleUpdatingId === row.id || row.id === user.id}
                    onChange={(e) => void changeRole(row, e.target.value as UserRole)}
                    style={{ padding: "6px 8px", fontSize: 12, minWidth: 140 }}
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                    {row.role === "tenant" && <option value="tenant">Inquilino</option>}
                  </AppSelect>

                  <button
                    type="button"
                    onClick={() => void deactivateUser(row)}
                    disabled={row.id === user.id}
                    title={row.id === user.id ? "No puedes desactivarte" : "Desactivar usuario"}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      padding: "6px 8px",
                      cursor: row.id === user.id ? "not-allowed" : "pointer",
                      color: row.id === user.id ? "var(--text-muted)" : "#DC2626",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ),
            },
          ]}
        />
        </div>
      </SectionCard>

      <Modal
        open={showCreate}
        title="Nuevo usuario"
        subtitle="Se creará la cuenta en auth y su perfil en app_users."
        onClose={() => {
          if (!createForm.formState.isSubmitting) setShowCreate(false);
        }}
        maxWidth="520px"
      >
        <form onSubmit={onCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nombre completo" error={createForm.formState.errors.full_name?.message}>
            <input {...createForm.register("full_name")} placeholder="Juan Pérez" style={inputStyle} />
          </Field>

          <Field label="Email" error={createForm.formState.errors.email?.message}>
            <input {...createForm.register("email")} type="email" placeholder="juan@empresa.com" style={inputStyle} />
          </Field>

          <Field label="Contraseña temporal" error={createForm.formState.errors.password?.message}>
            <input
              {...createForm.register("password")}
              type="text"
              placeholder="Mínimo 8 caracteres"
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>

          <Field label="Rol" error={createForm.formState.errors.role?.message}>
            <AppSelect {...createForm.register("role")}>
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </AppSelect>
          </Field>

          <Field label="Empresa" error={createForm.formState.errors.company_id?.message}>
            <AppSelect {...createForm.register("company_id")}>
              <option value="">Selecciona una empresa</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </AppSelect>
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <UiButton
              variant="secondary"
              onClick={() => {
                if (!createForm.formState.isSubmitting) {
                  createForm.reset();
                  setShowCreate(false);
                }
              }}
            >
              Cancelar
            </UiButton>
            <UiButton type="submit" disabled={createForm.formState.isSubmitting}>
              {createForm.formState.isSubmitting ? "Creando..." : "Crear usuario"}
            </UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid var(--border-default)",
  borderRadius: 10,
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>}
    </div>
  );
}
