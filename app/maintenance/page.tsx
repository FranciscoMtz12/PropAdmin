"use client";

/*
  Módulo general de Mantenimiento.

  Esta página ya está pensada para ser la entrada directa al tema operativo,
  sin obligar al usuario a pasar por toda la jerarquía de edificios,
  departamentos y assets cada vez que solo quiere revisar actividad.

  En esta versión dejamos tres mejoras importantes:
  1) toda la interfaz visible queda en español.
  2) la actividad reciente ya muestra contexto real:
     edificio y departamento cuando esa información exista.
  3) agregamos filtros simples para que la revisión diaria sea más práctica.

  En fases futuras aquí conectaremos:
  - calendario
  - mantenimientos programados por edificio
  - work orders / tickets
  - vistas operativas más completas
*/

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import PageContainer from "@/components/PageContainer";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import UiButton from "@/components/UiButton";
import { ClipboardList, Plus, ShieldCheck, Wrench, CalendarClock, CircleAlert } from "lucide-react";

type MaintenanceCategory = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

type RecentLogRow = {
  id: string;
  title: string;
  log_type: string;
  performed_at: string;
  next_due_at: string | null;
  status: string;
  asset_name_snapshot: string | null;
  asset_type_snapshot: string | null;
  category_name_snapshot: string | null;
  building_id: string | null;
  unit_id: string | null;
  asset_id: string | null;
};

type BuildingOption = {
  id: string;
  name: string;
  code: string | null;
};

type UnitOption = {
  id: string;
  unit_number: string;
  display_code: string | null;
  building_id: string;
};

type EnrichedRecentLogRow = RecentLogRow & {
  building_label: string;
  unit_label: string;
};

function formatLogType(logType: string) {
  const normalized = (logType || "").toLowerCase();

  if (normalized === "preventive") return "Preventivo";
  if (normalized === "corrective") return "Correctivo";
  if (normalized === "replacement") return "Reemplazo";
  if (normalized === "inspection") return "Inspección";
  if (normalized === "note") return "Nota";

  return logType || "Sin tipo";
}

export default function MaintenancePage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [categories, setCategories] = useState<MaintenanceCategory[]>([]);
  const [recentLogs, setRecentLogs] = useState<EnrichedRecentLogRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);

  /*
    Formulario simple para crear categorías nuevas.
    Esto mantiene flexible el sistema para grupos como:
    - Baño
    - Cocina
    - Minisplits
    - Boilers
    - General
  */
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);

  /*
    Filtros simples de la vista operativa.
    selectedBuildingId = filtro por edificio.
    searchTerm = búsqueda libre por título, asset o departamento.
  */
  const [selectedBuildingId, setSelectedBuildingId] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [loadingData, setLoadingData] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.company_id) {
      loadPageData();
    }
  }, [user]);

  async function loadPageData() {
    if (!user?.company_id) return;

    setLoadingData(true);
    setMsg("");

    const { data: categoriesData, error: categoriesError } = await supabase
      .from("maintenance_categories")
      .select("id, company_id, name, description, status, created_at")
      .eq("company_id", user.company_id)
      .order("name", { ascending: true });

    if (categoriesError) {
      setMsg("No se pudieron cargar las categorías de mantenimiento.");
      setLoadingData(false);
      return;
    }

    const { data: buildingData, error: buildingError } = await supabase
      .from("buildings")
      .select("id, name, code")
      .eq("company_id", user.company_id)
      .order("name", { ascending: true });

    if (!buildingError) {
      setBuildings((buildingData as BuildingOption[]) || []);
    } else {
      setBuildings([]);
    }

    const { data: logsData, error: logsError } = await supabase
      .from("maintenance_logs")
      .select(
        "id, title, log_type, performed_at, next_due_at, status, asset_name_snapshot, asset_type_snapshot, category_name_snapshot, building_id, unit_id, asset_id"
      )
      .eq("company_id", user.company_id)
      .order("performed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (logsError) {
      setMsg("Se cargaron las categorías, pero no se pudo cargar la actividad reciente.");
      setCategories((categoriesData as MaintenanceCategory[]) || []);
      setRecentLogs([]);
      setLoadingData(false);
      return;
    }

    const parsedLogs = (logsData as RecentLogRow[]) || [];

    const buildingIds = Array.from(
      new Set(parsedLogs.map((log) => log.building_id).filter(Boolean) as string[])
    );

    const unitIds = Array.from(
      new Set(parsedLogs.map((log) => log.unit_id).filter(Boolean) as string[])
    );

    let buildingMap = new Map<string, BuildingOption>();
    let unitMap = new Map<string, UnitOption>();

    if (buildingIds.length > 0) {
      const { data: logBuildingData, error: logBuildingError } = await supabase
        .from("buildings")
        .select("id, name, code")
        .in("id", buildingIds);

      if (!logBuildingError) {
        buildingMap = new Map(
          ((logBuildingData as BuildingOption[]) || []).map((building) => [building.id, building])
        );
      }
    }

    if (unitIds.length > 0) {
      const { data: logUnitData, error: logUnitError } = await supabase
        .from("units")
        .select("id, unit_number, display_code, building_id")
        .in("id", unitIds);

      if (!logUnitError) {
        unitMap = new Map(
          ((logUnitData as UnitOption[]) || []).map((unit) => [unit.id, unit])
        );
      }
    }

    const enrichedLogs: EnrichedRecentLogRow[] = parsedLogs.map((log) => {
      const building = log.building_id ? buildingMap.get(log.building_id) : null;
      const unit = log.unit_id ? unitMap.get(log.unit_id) : null;

      const buildingLabel = building ? building.name : "Sin edificio ligado";

      const unitLabel = unit ? `Departamento ${unit.unit_number}` : "";

      return {
        ...log,
        building_label: buildingLabel,
        unit_label: unitLabel,
      };
    });

    setCategories((categoriesData as MaintenanceCategory[]) || []);
    setRecentLogs(enrichedLogs);
    setLoadingData(false);
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!user?.company_id) {
      setMsg("No se encontró la empresa del usuario.");
      return;
    }

    if (!categoryName.trim()) {
      setMsg("El nombre de la categoría es obligatorio.");
      return;
    }

    setSavingCategory(true);

    const { error } = await supabase.from("maintenance_categories").insert({
      company_id: user.company_id,
      name: categoryName.trim(),
      description: categoryDescription.trim() || null,
      status: "ACTIVE",
    });

    setSavingCategory(false);

    if (error) {
      if (error.message.toLowerCase().includes("duplicate") || error.message.toLowerCase().includes("unique")) {
        setMsg("Ya existe una categoría con ese nombre para tu empresa.");
      } else {
        setMsg(error.message);
      }
      return;
    }

    setCategoryName("");
    setCategoryDescription("");
    setMsg("Categoría guardada correctamente.");
    await loadPageData();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return recentLogs.filter((log) => {
      const matchesBuilding = selectedBuildingId === "ALL" || log.building_id === selectedBuildingId;

      if (!matchesBuilding) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        log.title,
        log.asset_name_snapshot,
        log.asset_type_snapshot,
        log.category_name_snapshot,
        log.building_label,
        log.unit_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [recentLogs, selectedBuildingId, searchTerm]);

  const totals = useMemo(() => {
    const done = recentLogs.filter((log) => log.status === "DONE").length;
    const upcoming = recentLogs.filter((log) => !!log.next_due_at).length;
    const preventive = recentLogs.filter((log) => log.log_type === "preventive").length;
    const corrective = recentLogs.filter((log) => log.log_type === "corrective").length;

    return {
      categories: categories.length,
      logs: recentLogs.length,
      done,
      upcoming,
      preventive,
      corrective,
    };
  }, [categories, recentLogs]);

  if (loading) {
    return <PageContainer>Cargando usuario...</PageContainer>;
  }

  if (!user) return null;

  if (loadingData) {
    return <PageContainer>Cargando mantenimiento...</PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mantenimiento"
        subtitle="Centro operativo para categorías y actividad reciente de mantenimiento con el mismo sistema visual del resto de PropAdmin."
        actions={
          <>
            <UiButton href="/dashboard">Ir al dashboard</UiButton>
            <UiButton onClick={() => setIsCreateCategoryModalOpen(true)} variant="primary">
              <Plus size={16} />
              Nueva categoría
            </UiButton>
          </>
        }
      />

      {msg ? (
        <p style={{ color: msg.includes("correctamente") ? "green" : "crimson", marginBottom: "16px" }}>
          {msg}
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <MetricCard label="Categorías" value={totals.categories} icon={<ClipboardList size={18} />} helper="Tipos activos" />
        <MetricCard label="Registros recientes" value={totals.logs} icon={<Wrench size={18} />} helper="Bitácora" />
        <MetricCard label="Preventivos" value={totals.preventive} icon={<ShieldCheck size={18} />} helper="Programados" />
        <MetricCard label="Correctivos" value={totals.corrective} icon={<CircleAlert size={18} />} helper="Incidencias" />
        <MetricCard label="Con próxima fecha" value={totals.upcoming} icon={<CalendarClock size={18} />} helper="Seguimiento" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "24px", marginBottom: "24px" }}>
        <SectionCard title="Categorías activas" subtitle="Puedes empezar con grupos como Baño, Cocina, Minisplits o Boilers." icon={<ClipboardList size={18} />}>
          {categories.length === 0 ? (
            <p>Aún no hay categorías. Puedes empezar con algunas como Baño, Cocina, Minisplits o Boilers.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {categories.map((category) => (
                <div key={category.id} style={{ border: "1px solid #E5E7EB", borderRadius: "12px", padding: "16px" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "6px" }}>{category.name}</p>
                  <p style={{ marginBottom: "6px" }}>Estatus: {category.status}</p>
                  <p>{category.description || "Sin descripción"}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Actividad reciente" subtitle="Aquí ya puedes ubicar rápidamente de qué edificio y departamento viene cada registro." icon={<Wrench size={18} />}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              style={{ padding: "10px 12px", border: "1px solid #D0D5DD", borderRadius: "10px", background: "white", minWidth: "220px" }}
            >
              <option value="ALL">Todos los edificios</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.code ? `${building.code} - ` : ""}
                  {building.name}
                </option>
              ))}
            </select>

            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, asset o departamento"
              style={{ padding: "10px 12px", border: "1px solid #D0D5DD", borderRadius: "10px", minWidth: "260px" }}
            />
          </div>

          {filteredLogs.length === 0 ? (
            <p>No hay registros que coincidan con los filtros actuales.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {filteredLogs.map((log) => (
                <div key={log.id} style={{ border: "1px solid #E5E7EB", borderRadius: "12px", padding: "16px" }}>
                  <p style={{ fontSize: "13px", color: "#667085", marginBottom: "6px" }}>
                    <strong>{log.building_label}</strong>
                    {log.unit_label ? " · " : ""}
                    {log.unit_label}
                  </p>
                  <p style={{ fontWeight: "bold", marginBottom: "6px" }}>{log.title}</p>
                  <p style={{ marginBottom: "6px" }}>Tipo: {formatLogType(log.log_type)}</p>
                  <p style={{ marginBottom: "6px" }}>Fecha realizada: {log.performed_at || "Sin fecha"}</p>
                  <p style={{ marginBottom: "6px" }}>Equipo / área: {log.asset_name_snapshot || "Sin equipo ligado"}</p>
                  <p style={{ marginBottom: "6px" }}>Categoría: {log.category_name_snapshot || "Sin categoría"}</p>
                  <p>Próxima fecha: {log.next_due_at || "Sin próxima fecha"}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <Modal
        open={isCreateCategoryModalOpen}
        onClose={() => setIsCreateCategoryModalOpen(false)}
        title="Crear categoría de mantenimiento"
        subtitle="El formulario ahora vive en modal para no robar protagonismo a la vista operativa."
      >
        <form onSubmit={handleCreateCategory}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Nombre</label>
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Ej. Baño, Cocina, Minisplits, Boilers"
              style={{ width: "100%", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px" }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Descripción</label>
            <textarea
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
              placeholder="Opcional. Útil para explicar qué entra dentro de esta categoría."
              style={{ width: "100%", minHeight: "100px", padding: "12px", border: "1px solid #D0D5DD", borderRadius: "10px", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <UiButton type="submit" disabled={savingCategory} variant="primary">
              {savingCategory ? "Guardando..." : "Guardar categoría"}
            </UiButton>
            <UiButton onClick={() => setIsCreateCategoryModalOpen(false)}>Cancelar</UiButton>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
