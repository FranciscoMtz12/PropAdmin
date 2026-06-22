# Casa como Unidad Real — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que una casa (residential_single) funcione end-to-end con 1 fila real en `units` + 1 fila en `unit_types`, eliminando `unit_id = NULL` y `building_features` como fuentes de verdad para contratos y espacios de la casa.

**Architecture:** Cada casa tendrá exactamente 1 `unit` ("unidad invisible" — nunca visible en la UI de unidades) y 1 `unit_types` (sus espacios/equipamiento, editable vía UnitTypeWizardModal). Los contratos existentes se migran con el `unit_id` real. El property sheet lee de `unit_types.bedrooms/bathrooms`. El checklist de casa tiene 3 pasos propios: configurar espacios → servicios → primer inquilino.

**Tech Stack:** Next.js 14+ (App Router), Supabase (PostgreSQL + RLS), TypeScript, React

---

## Mapa de archivos

| Archivo | Acción | Qué cambia |
|---------|--------|-----------|
| `supabase/migrations/20260609000000_house_units.sql` | CREAR | Crea unit_type+unit para casas existentes; migra leases NULL→unit_id; inserta tareas de checklist |
| `lib/property-features.ts` | MODIFICAR | Agrega feature `house_setup` con tareas `configure_spaces` y `add_first_lease` para residential_single |
| `app/buildings/page.tsx` | MODIFICAR | Creación de casa: auto-inserta unit_type+unit+tareas; elimina Step 3 de amenidades planas |
| `app/buildings/[buildingId]/page.tsx` | MODIFICAR | Carga houseUnit; cambia query de leases; property sheet desde unit_types; reemplaza form de edición por botón wizard; agrega toggle rental_type |

---

## Task 1: Migración SQL — crear unidades invisibles y migrar contratos

**Files:**
- Create: `supabase/migrations/20260609000000_house_units.sql`

### Contexto
Las casas existentes no tienen filas en `units` ni `unit_types`. Sus contratos tienen `unit_id = NULL`. Esta migración:
1. Crea 1 `unit_types` por casa (copiando bedrooms/bathrooms de `building_features`)
2. Crea 1 `unit` por casa, enlazada al unit_type
3. Actualiza los contratos NULL → unit_id real
4. Inserta la tarea `configure_spaces` en `building_setup_tasks` para cada casa

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260609000000_house_units.sql
-- Paso 1: crear unit_type por cada casa que aún no tenga uno
INSERT INTO unit_types (id, company_id, building_id, name, bedrooms, bathrooms, created_at, updated_at)
SELECT
  gen_random_uuid(),
  b.company_id,
  b.id,
  'Casa',
  GREATEST(COALESCE((b.building_features->>'bedrooms')::int, 1), 1),
  GREATEST(COALESCE((b.building_features->>'full_bathrooms')::int, 1), 1),
  NOW(),
  NOW()
FROM buildings b
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM unit_types ut
    WHERE ut.building_id = b.id
      AND ut.deleted_at IS NULL
  );

-- Paso 2: crear unit por cada casa que aún no tenga una
INSERT INTO units (id, company_id, building_id, unit_type_id, unit_number, display_code, status, rental_type, created_at, updated_at)
SELECT
  gen_random_uuid(),
  b.company_id,
  b.id,
  ut.id,
  '1',
  'Casa',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM leases l
      WHERE l.building_id = b.id
        AND l.unit_id IS NULL
        AND l.status = 'ACTIVE'
        AND l.deleted_at IS NULL
    ) THEN 'RENTED'
    ELSE 'VACANT'
  END,
  COALESCE(b.building_features->>'rental_mode', 'whole'),
  NOW(),
  NOW()
FROM buildings b
JOIN unit_types ut ON ut.building_id = b.id AND ut.deleted_at IS NULL
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM units u
    WHERE u.building_id = b.id
      AND u.deleted_at IS NULL
  );

-- Paso 3: asignar unit_id real a contratos existentes de casas (unit_id IS NULL)
UPDATE leases l
SET unit_id = u.id,
    updated_at = NOW()
FROM units u
JOIN buildings b ON b.id = u.building_id
WHERE b.building_category = 'residential_single'
  AND l.building_id = b.id
  AND l.unit_id IS NULL
  AND l.deleted_at IS NULL;

-- Paso 4: insertar tarea configure_spaces para casas que no la tengan en building_setup_tasks
INSERT INTO building_setup_tasks (id, building_id, company_id, task_key, feature_key, is_completed, created_at)
SELECT
  gen_random_uuid(),
  b.id,
  b.company_id,
  'configure_spaces',
  'house_setup',
  false,
  NOW()
FROM buildings b
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM building_setup_tasks bst
    WHERE bst.building_id = b.id
      AND bst.task_key = 'configure_spaces'
  );
```

- [ ] **Step 2: Aplicar la migración vía Supabase MCP**

Usar la tool `mcp__claude_ai_Supabase__apply_migration` con el contenido del archivo, o ejecutar:
```
npx supabase db push
```
Verificar que no haya errores. Si hay error de columna inexistente (`updated_at`, `deleted_at`), ajustar el SQL eliminando esas columnas del INSERT.

- [ ] **Step 3: Verificar en BD que el resultado es correcto**

Ejecutar (con Supabase MCP `execute_sql`):
```sql
-- Casas sin unit_type (debe devolver 0 filas)
SELECT b.id, b.name FROM buildings b
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM unit_types ut WHERE ut.building_id = b.id);

-- Casas sin unit (debe devolver 0 filas)
SELECT b.id, b.name FROM buildings b
WHERE b.building_category = 'residential_single'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM units u WHERE u.building_id = b.id);

-- Contratos de casa con unit_id aún NULL (debe devolver 0 filas)
SELECT l.id FROM leases l
JOIN buildings b ON b.id = l.building_id
WHERE b.building_category = 'residential_single'
  AND l.unit_id IS NULL
  AND l.deleted_at IS NULL;
```

---

## Task 2: `lib/property-features.ts` — agregar feature `house_setup`

**Files:**
- Modify: `lib/property-features.ts` (insertar después de la feature `units`, ~línea 37)

### Contexto
La feature `units` (residential_multi/commercial/industrial) tiene la tarea `add_first_lease` para residencial_single pero la feature misma **no** incluye `residential_single` en `applicableTypes`, por lo que esa tarea nunca se selecciona para casas. Necesitamos una feature específica para casas.

- [ ] **Step 1: Insertar la nueva feature `house_setup` después de la línea 37**

En `lib/property-features.ts`, después del cierre del objeto de la feature `units` (línea 37, `},`), insertar:

```typescript
  {
    key: 'house_setup',
    label: 'Configuración de la casa',
    description: 'Espacios, equipamiento y primer contrato de la casa',
    category: 'space' as FeatureCategory,
    icon: 'Home',
    color: '#8B2252',
    applicableTypes: ['residential_single'],
    tasks: [
      {
        key: 'configure_spaces',
        label: 'Configurar espacios y equipamiento',
        description: 'Define las recámaras, baños y equipamiento de la casa usando el wizard',
        route: '/buildings/[id]?tab=overview&openWizard=true',
        applicableTypes: ['residential_single'],
      },
      {
        key: 'add_first_lease',
        label: 'Registrar primer contrato',
        description: 'Da de alta el primer contrato de arrendamiento',
        route: '/buildings/[id]?tab=leases',
        applicableTypes: ['residential_single'],
      },
    ],
  },
```

- [ ] **Step 2: Verificar TypeScript**

```
cd C:\Users\fcomt\property-admin && npx tsc --noEmit 2>&1 | head -30
```
O `next build` si no hay `tsc` separado. No debe haber errores en este archivo.

---

## Task 3: `app/buildings/page.tsx` — creación de casa auto-crea unit+unit_type+tareas

**Files:**
- Modify: `app/buildings/page.tsx` (handler `handleSubmitBuilding`, ~líneas 766–815)

### Contexto
Cuando se crea una casa, se deben insertar automáticamente: 1 unit_type, 1 unit, y las tareas del checklist `house_setup`. El formularió de amenidades planas del Step 3 (líneas ~1700–1777) se **elimina**.

- [ ] **Step 1: Agregar auto-creación de unit_type+unit en `handleSubmitBuilding`**

Después de la línea `const newBuildingId = newBuilding.id;` (línea 766) e **inmediatamente antes** del bloque `if (selectedFeatureKeys.length > 0)` (línea 768), insertar:

```typescript
    /* ── Casa: crear unit_type invisible + unit ── */
    if (data.building_category === "residential_single") {
      const { data: newUT, error: utErr } = await supabase
        .from("unit_types")
        .insert({
          company_id: activeCompanyId,
          building_id: newBuildingId,
          name: "Casa",
          bedrooms: 1,
          bathrooms: 1,
        })
        .select("id")
        .single();
      if (!utErr && newUT) {
        await supabase.from("units").insert({
          company_id: activeCompanyId,
          building_id: newBuildingId,
          unit_type_id: newUT.id,
          unit_number: "1",
          display_code: "Casa",
          status: "VACANT",
          rental_type: "whole",
        });
      }
      /* Tareas de checklist propias de la casa */
      await supabase.from("building_setup_tasks").insert([
        { company_id: activeCompanyId, building_id: newBuildingId, task_key: "configure_spaces", feature_key: "house_setup", is_completed: false },
        { company_id: activeCompanyId, building_id: newBuildingId, task_key: "add_first_lease",  feature_key: "house_setup", is_completed: false },
      ]);
    }
```

- [ ] **Step 2: Eliminar el formulario de amenidades planas del Step 3**

Buscar el bloque `{buildingCategory === "residential_single" && (() => {` dentro del Step 3 del wizard de creación (aproximadamente líneas 1700–1777). Es el formulario que tiene campos de `bedrooms`, `bathrooms`, `parking_spots`, checkboxes de amenidades, y el radio de `rental_mode`.

Eliminar **ese bloque completo** (desde `{buildingCategory === "residential_single" && (() => {` hasta su `})()}` de cierre).

**Importante:** No eliminar nada del Step 3 que aplique a otros tipos de propiedad.

- [ ] **Step 3: Verificar que el formulario de creación sigue funcionando para otros tipos**

Compilar: `npx tsc --noEmit 2>&1 | head -30`. No debe haber errores TypeScript.

---

## Task 4: `app/buildings/[buildingId]/page.tsx` — cargar houseUnit

**Files:**
- Modify: `app/buildings/[buildingId]/page.tsx`

### Contexto
El detalle de edificio necesita un nuevo estado `houseUnit` que contiene la unidad invisible de la casa (id, rental_type, y el unit_type con bedrooms/bathrooms/wizard_state). Se carga dentro de `loadBuilding()`.

- [ ] **Step 1: Agregar el estado `houseUnit` cerca de los otros estados del componente**

Buscar la zona de declaraciones de estado del componente (~líneas 270–350). Agregar:

```typescript
  const [houseUnit, setHouseUnit] = React.useState<{
    id: string;
    rental_type: string | null;
    unit_types: {
      id: string;
      bedrooms: number | null;
      bathrooms: number | null;
      wizard_state: { s2: unknown; eq: unknown } | null;
    } | null;
  } | null>(null);
```

- [ ] **Step 2: Cargar houseUnit dentro de `loadBuilding()`**

Dentro de `loadBuilding()`, en el bloque de queries paralelas (buscar el `const [` que abre las queries en paralelo, ~línea 1418), agregar la query de houseUnit **dentro del mismo `await Promise.all([...])`** o justo después de setBuilding(b):

Añadir en el array de queries paralelas:

```typescript
      /* ── Casa: cargar unidad invisible ── */
      b.building_category === "residential_single"
        ? supabase
            .from("units")
            .select("id, rental_type, unit_types(id, bedrooms, bathrooms, wizard_state)")
            .eq("building_id", buildingId)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
```

Y en el destructuring del resultado de esas queries, capturar:

```typescript
      const { data: houseUnitData } = resultN; // donde N es el índice del nuevo elemento
      if (b.building_category === "residential_single") {
        setHouseUnit(houseUnitData as typeof houseUnit);
      }
```

**Nota para el ejecutor:** La función `loadBuilding` tiene un bloque `Promise.all` o queries secuenciales. Identificar el patrón exacto y agregar la query de houseUnit de forma consistente. El resultado debe quedar en el estado `houseUnit`.

- [ ] **Step 3: Verificar TypeScript**

```
npx tsc --noEmit 2>&1 | head -40
```

---

## Task 5: `app/buildings/[buildingId]/page.tsx` — cambiar query de contratos de casa

**Files:**
- Modify: `app/buildings/[buildingId]/page.tsx` (~líneas 1494–1517)

### Contexto
Hoy la query de contratos de casa filtra `.is("unit_id", null)`. Después de la migración SQL (Task 1), todos los contratos tienen `unit_id` real. La query debe cambiar para casas.

- [ ] **Step 1: Localizar el bloque de carga de landLeases (~línea 1494)**

El bloque actual es:
```typescript
if (["land", "commercial", "industrial", "residential_single"].includes(b.building_category ?? "")) {
  // ...
  .eq("building_id", buildingId)
  .is("unit_id", null)
  // ...
}
```

- [ ] **Step 2: Separar residential_single de los demás tipos**

Reemplazar ese bloque con dos bloques separados:

```typescript
    /* Contratos directos del edificio (land, commercial, industrial) — unit_id IS NULL */
    if (["land", "commercial", "industrial"].includes(b.building_category ?? "")) {
      type LLRow = { id: string; tenant_id: string; rent_amount: number; start_date: string | null; end_date: string | null; status: string; leased_sqm: number | null };
      const { data: llData } = await supabase
        .from("leases")
        .select("id, tenant_id, rent_amount, start_date, end_date, status, leased_sqm")
        .eq("building_id", buildingId)
        .is("unit_id", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      // ... (mantener el resto del bloque original, incluyendo el join con tenants)
    }

    /* Casa: contratos por unit_id real (cargado en houseUnit) */
    if (b.building_category === "residential_single") {
      // houseUnit se carga en loadBuilding() — puede llegar antes o después según el orden de queries.
      // Si houseUnit no está disponible aún en este punto, usar una sub-query:
      const { data: houseUnitRow } = await supabase
        .from("units")
        .select("id")
        .eq("building_id", buildingId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (houseUnitRow?.id) {
        type LLRow = { id: string; tenant_id: string; rent_amount: number; start_date: string | null; end_date: string | null; status: string; leased_sqm: number | null; room_number: number | null };
        const { data: llData } = await supabase
          .from("leases")
          .select("id, tenant_id, rent_amount, start_date, end_date, status, leased_sqm, room_number")
          .eq("unit_id", houseUnitRow.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        // Mantener el mismo join con tenants y setLandLeases que el bloque original
        // (buscar cómo el bloque original enriquece con tenant_name y copiar ese patrón)
      }
    }
```

**Nota para el ejecutor:** El bloque original probablemente hace un segundo query a `tenants` para obtener `tenant_name`. Copiar ese patrón exacto para el nuevo bloque de casa.

- [ ] **Step 3: Verificar TypeScript**

```
npx tsc --noEmit 2>&1 | head -40
```

---

## Task 6: `app/buildings/[buildingId]/page.tsx` — property sheet desde unit_types

**Files:**
- Modify: `app/buildings/[buildingId]/page.tsx` (~líneas 3325–3404)

### Contexto
El property sheet (`SectionCard "Ficha de la propiedad"`) lee `building.building_features` para mostrar recámaras, baños, etc. Debe cambiar a leer de `houseUnit?.unit_types`.

- [ ] **Step 1: Reemplazar las lecturas de `building_features` en el property sheet**

Localizar el bloque (~línea 3325):
```typescript
{isResidentialSingle && (() => {
  const hf = building.building_features ?? {};
  const bedrooms       = Number(hf.bedrooms ?? 0);
  const fullBathrooms  = Number(hf.full_bathrooms ?? 0);
  const parkingSpots   = Number(hf.parking_spots ?? 0);
  const rentalMode     = hf.rental_mode as string | undefined;
```

Reemplazarlo con:
```typescript
{isResidentialSingle && (() => {
  const ut = houseUnit?.unit_types;
  const bedrooms      = ut?.bedrooms ?? 0;
  const fullBathrooms = ut?.bathrooms ?? 0;
  const parkingSpots  = 0; // los cajones se gestionan en el tab de parking
  const rentalMode    = houseUnit?.rental_type ?? undefined;
```

- [ ] **Step 2: Eliminar la lectura de `activeAmenities` y `otherNotes` que usan building_features**

Localizar y eliminar:
```typescript
  const activeAmenities = HOUSE_AMENITIES.filter((a) => Boolean(hf[a.key]));
  const otherNotes = hf.other_notes as string | undefined;
  const hasAnyData = pills.length > 0 || activeAmenities.length > 0 || otherNotes || rentalMode;
```

Reemplazar con:
```typescript
  const hasAnyData = pills.filter(p => (p.value ?? 0) > 0).length > 0 || rentalMode;
```

Y eliminar también los JSX que renderizan `activeAmenities` y `otherNotes` (las dos secciones con `.map(a => ...)` y `.map((line, idx) => ...)`).

- [ ] **Step 3: Verificar TypeScript y que no quedan referencias a `hf` en ese bloque**

```
npx tsc --noEmit 2>&1 | head -40
```

---

## Task 7: `app/buildings/[buildingId]/page.tsx` — reemplazar form de edición por botón wizard

**Files:**
- Modify: `app/buildings/[buildingId]/page.tsx` (~líneas 5815–5897)

### Contexto
El formulario de edición de amenidades planas de la casa (`editHouseFeatures`) debe ser reemplazado por un botón "Configurar espacios" que abre el `UnitTypeWizardModal` en modo edición.

- [ ] **Step 1: Localizar y eliminar el formulario de amenidades (~5815–5897)**

Buscar el bloque:
```typescript
{buildingCategory === "residential_single" && (() => {
  const hf = editHouseFeatures;
  const setHF = (key: string, val: unknown) => setEditHouseFeatures((prev) => ({ ...prev, [key]: val }));
  return (
    <div style={{ marginTop: 4 }}>
      <p>Características de la casa</p>
      // ... campos bedrooms, bathrooms, amenity checkboxes, rental_mode radios
    </div>
  );
})()}
```

**Eliminar ese bloque completo.**

- [ ] **Step 2: En el modal de edición de propiedad, agregar botón "Configurar espacios" para casas**

En el mismo modal de edición (`openEditModal`), donde estaba el formulario eliminado, agregar:

```typescript
{buildingCategory === "residential_single" && (
  <div style={{ marginTop: 16, padding: "12px 0", borderTop: "1px solid var(--border-default)" }}>
    <p style={{ margin: "0 0 8px", fontSize: "0.8125rem", fontWeight: 600 }}>
      Espacios y equipamiento
    </p>
    <p style={{ margin: "0 0 12px", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
      Configura las recámaras, baños y equipamiento de la casa en el wizard de espacios.
    </p>
    <UiButton
      variant="secondary"
      onClick={() => {
        // Cerrar el modal de edición y abrir el wizard
        closeEditModal(); // o setEditModalOpen(false) — usar la función correcta
        setIsHouseWizardOpen(true);
      }}
    >
      Abrir wizard de espacios
    </UiButton>
  </div>
)}
```

- [ ] **Step 3: Agregar el estado `isHouseWizardOpen` y el modal `UnitTypeWizardModal` para la casa**

Buscar donde están declarados los estados del modal de tipologías (buscar `isTypologiesWizardOpen`). Agregar junto a ellos:

```typescript
  const [isHouseWizardOpen, setIsHouseWizardOpen] = React.useState(false);
  const [houseEditTypology, setHouseEditTypology] = React.useState<EditTypologyData | null>(null);
```

Y cargar `houseEditTypology` cuando `houseUnit?.unit_types` esté disponible (en `loadBuilding` o en un efecto):
```typescript
  React.useEffect(() => {
    if (houseUnit?.unit_types) {
      const ut = houseUnit.unit_types;
      setHouseEditTypology({
        id: ut.id,
        name: "Casa",
        bedrooms: ut.bedrooms ?? 1,
        bathrooms: ut.bathrooms ?? 1,
        has_living_room: false,
        has_dining_room: false,
        has_patio: false,
        has_fridge: false,
        has_washer: false,
        has_dryer: false,
        stove_type: "NONE",
        assets: [],
        wizard_state: ut.wizard_state as EditTypologyData["wizard_state"] ?? null,
      });
    }
  }, [houseUnit]);
```

Agregar el modal en el JSX (junto a los otros modales de tipología, ~líneas 7068–7104):

```typescript
{/* Modal de wizard de espacios para casa */}
{isResidentialSingle && (
  <UnitTypeWizardModal
    open={isHouseWizardOpen}
    buildingId={building?.id ?? ""}
    companyId={building?.company_id ?? ""}
    editTypology={houseEditTypology}
    onClose={() => setIsHouseWizardOpen(false)}
    onSuccess={async () => {
      setIsHouseWizardOpen(false);
      // Recargar houseUnit para reflejar cambios en property sheet
      await loadBuilding();
    }}
  />
)}
```

- [ ] **Step 4: Agregar botón "Configurar espacios" en la SectionCard "Ficha de la propiedad"**

En la SectionCard del property sheet (~línea 3345), agregar una `action` prop con el botón:

```typescript
<SectionCard
  title="Ficha de la propiedad"
  icon={<Home size={18} />}
  action={
    <UiButton
      variant="secondary"
      size="sm"
      icon={<Settings size={14} />}
      onClick={() => setIsHouseWizardOpen(true)}
    >
      Configurar
    </UiButton>
  }
>
```

- [ ] **Step 5: TypeScript check**

```
npx tsc --noEmit 2>&1 | head -40
```

---

## Task 8: `app/buildings/[buildingId]/page.tsx` — toggle rental_type en overview

**Files:**
- Modify: `app/buildings/[buildingId]/page.tsx` (dentro del property sheet, después de los pills)

### Contexto
El toggle "Renta completa / Renta por cuartos" actualmente leía de `building_features.rental_mode`. Ahora debe leer/escribir en `units.rental_type`.

- [ ] **Step 1: Agregar toggle en el property sheet, después del badge de rentalMode**

Localizar el bloque del badge de `rentalMode` (~líneas 3389–3398) dentro del property sheet. Reemplazar la visualización estática con un toggle interactivo:

```typescript
{rentalMode !== undefined && (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <button
      type="button"
      onClick={async () => {
        if (!houseUnit?.id) return;
        const newMode = rentalMode === "whole" ? "by_room" : "whole";
        const { error } = await supabase
          .from("units")
          .update({ rental_type: newMode })
          .eq("id", houseUnit.id);
        if (!error) {
          setHouseUnit((prev) => prev ? { ...prev, rental_type: newMode } : prev);
        }
      }}
      style={{
        padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600,
        cursor: "pointer", border: "1px solid var(--border-default)",
        background: rentalMode === "whole" ? "#0369a11a" : "var(--accent-tint-soft)",
        color:      rentalMode === "whole" ? "var(--color-info-dark)"   : "var(--accent)",
      }}
    >
      {rentalMode === "whole" ? "Renta completa" : "Renta por cuartos"}
    </button>
    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
      (toca para cambiar)
    </span>
  </div>
)}
```

- [ ] **Step 2: Asegurar que houseUnit tiene rental_type inicial**

Si `houseUnit` carga después de que el componente renderiza, `rentalMode` inicialmente será `undefined`. Agregar un valor por defecto:

```typescript
const rentalMode = houseUnit?.rental_type ?? "whole";
```

- [ ] **Step 3: TypeScript check**

```
npx tsc --noEmit 2>&1 | head -40
```

---

## Task 8b: Tab "Contratos" de casa — agregar botón "Gestionar contratos"

**Files:**
- Modify: `app/buildings/[buildingId]/page.tsx` (tab "Contratos de Terreno", ~línea 5182)

### Contexto
Hoy el tab de Contratos para casas es solo lectura — no hay botón "Crear contrato". Después de la migración, la casa tiene un `unit` real. La creación de contratos vive en el unit detail page (`/buildings/[buildingId]/units/[unitId]`), que ya soporta renta completa y por cuartos. Solo necesitamos un botón que lleve ahí.

- [ ] **Step 1: Agregar `action` prop a la SectionCard de Contratos para casas**

Localizar (~línea 5182):
```typescript
<SectionCard
  title={labels.leases}
  subtitle={`${labels.building} — contratos activos y disponibilidad.`}
  icon={<FileClockIcon size={18} />}
>
```

Reemplazar con:
```typescript
<SectionCard
  title={labels.leases}
  subtitle={`${labels.building} — contratos activos y disponibilidad.`}
  icon={<FileClockIcon size={18} />}
  action={
    isResidentialSingle && houseUnit?.id ? (
      <UiButton
        variant="secondary"
        icon={<Plus size={15} />}
        onClick={() => {
          void router.push(`/buildings/${buildingId as string}/units/${houseUnit.id}`);
        }}
      >
        Gestionar contratos
      </UiButton>
    ) : undefined
  }
>
```

**Nota:** Verificar que `router` está disponible en el componente (Next.js `useRouter`). Si no está importado, agregar `import { useRouter } from "next/navigation";` y declarar `const router = useRouter();`.

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit 2>&1 | head -40
```

---

## Task 9: Auto-completar tarea `configure_spaces` en el checklist

**Files:**
- Modify: `app/buildings/[buildingId]/page.tsx` (~líneas 1678–1708, bloque `autoCompleteMap`)

### Contexto
La tarea `configure_spaces` se completa cuando la casa tiene `wizard_state` configurado en su `unit_types`. El `autoCompleteMap` define cuándo marcar tareas como completadas automáticamente.

- [ ] **Step 1: Agregar la regla de auto-completado para `configure_spaces`**

Localizar el objeto `autoCompleteMap` (~línea 1678). Agregar:

```typescript
configure_spaces: houseUnit?.unit_types?.wizard_state != null,
```

**Nota:** Si `autoCompleteMap` se construye antes de que `houseUnit` esté disponible, ajustar el orden de carga en `loadBuilding()` para que `houseUnit` se cargue antes de este bloque.

- [ ] **Step 2: Verificar que el checklist renderiza `configure_spaces` para casas**

Localizar la lógica de filtrado del checklist (~líneas 6310–6316). Buscar el filtro por `applicableTypes`. Si filtra por `PROPERTY_FEATURES.find(f => f.key === featureKey)?.applicableTypes`, entonces `house_setup` (con `applicableTypes: ['residential_single']`) debe mostrarse automáticamente para casas.

Si el filtro usa la tabla `building_feature_config` (features seleccionadas por el usuario), agregar la inserción de `house_setup` en el nuevo handler de creación de casas (Task 3) y en la migración SQL (Task 1).

Verificar ejecutando la app y abriendo el detalle de una casa: el checklist debe mostrar "Configurar espacios y equipamiento" y "Registrar primer contrato".

---

## Task 10: Build final, verificación y commit

**Files:** Todos los modificados

- [ ] **Step 1: Build limpio**

```powershell
cd C:\Users\fcomt\property-admin
npx next build 2>&1 | tail -30
```
Debe terminar con `✓ Compiled successfully` o similar. Si hay errores TypeScript, corregirlos antes de continuar.

- [ ] **Step 2: Verificación funcional — casa con renta completa**

1. Abrir el detalle de una casa existente
2. Tab "Overview": property sheet debe mostrar recámaras/baños leídos de unit_types (no de building_features)
3. Tab "Contratos": debe mostrar contratos existentes (migrados con unit_id real)
4. Crear un contrato nuevo → confirmar que se crea con unit_id real (no NULL)
5. Ocupación de la casa en el listado de edificios: debe ser 100% si hay contrato activo

- [ ] **Step 3: Verificación funcional — casa con renta por cuartos**

1. En el property sheet, tocar el toggle → cambiar a "Renta por cuartos"
2. Ir al detalle de la unidad de la casa (si es accesible vía URL directa `/buildings/[id]/units/[unitId]`)
3. Crear 2 contratos de cuartos distintos
4. Badge en unidades debe mostrar "2/N cuartos"
5. Cada contrato debe tener su propio `collection_schedule`

- [ ] **Step 4: Verificación funcional — checklist de casa**

1. Crear una casa nueva
2. El checklist debe mostrar: "Configurar espacios y equipamiento" + "Registrar primer contrato"
3. NO debe mostrar "Configurar tipologías" ni "Registrar primer espacio"
4. Hacer click en "Configurar espacios" → debe abrir el wizard
5. Completar el wizard → tarea debe marcarse como completada

- [ ] **Step 5: Verificación funcional — edificio residential_multi sin cambios**

1. Abrir un edificio con departamentos
2. Contratos, ocupación y cobranza deben funcionar idéntico al estado anterior

- [ ] **Step 6: Commit y push**

```powershell
cd C:\Users\fcomt\property-admin
git add -p  # revisar cada cambio
git commit -m "refactor: casa usa unit_id real en contratos/ocupación + checklist propio de casa"
git push origin main
```

---

## Notas de implementación

### `building_features` en casas
Después de esta migración, `building_features` queda como campo legado para casas. No se borra la columna (podría afectar otras queries genéricas), pero el código ya no lo escribe ni lo lee para residential_single. Si en el futuro se quiere limpiar: agregar una migración que setee `building_features = NULL` para todas las casas.

### Contratos de land/commercial/industrial
El bloque de `landLeases` con `.is("unit_id", null)` **sigue activo** para land, commercial e industrial (que no tienen unidades invisibles). No tocar esa lógica.

### Checklist para casas con `building_feature_config`
Si el checklist usa `building_feature_config` para filtrar qué features mostrar, se necesita insertar `house_setup` en esa tabla al crear la casa. Verificar en la lógica de `loadBuilding` si la query de setup tasks filtra por `building_feature_config`.

### Estado `houseUnit` en loading
Si `loadBuilding` carga el building y las queries paralelas en un solo `Promise.all`, el `houseUnit` estará disponible al mismo tiempo que el resto. Si el building se carga primero y luego las queries paralelas, asegurar que la query de houseUnit está en ese segundo bloque paralelo.
