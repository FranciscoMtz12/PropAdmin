# Fase 3.3 — Verificación y Pulido del Wizard Mixto por Zonas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar que la implementación ya committeada (ff0b060) del wizard mixto por zonas funciona correctamente, y aplicar los dos pulidos pendientes de calidad.

**Architecture:** La implementación ya existe en `components/PropertyWizardModal.tsx`. El plan cubre: (1) pulir 2 detalles de calidad en el código; (2) test end-to-end del caso extremo de 8 pisos mixto; (3) verificar conteos en BD y limpiar datos de prueba.

**Tech Stack:** Next.js 14, TypeScript, Framer Motion, Supabase (project: mremgbneyztpbojwgwcc)

**Estado al iniciar:**
- Commit ff0b060 ya realizado con la implementación completa
- TS build: limpio (0 errores)
- DB: todos los schemas correctos (is_active en space_subdivisions ✅, property_id en assets ✅)
- Datos existentes: solo seed de fase 2 (7 propiedades, todas is_test=true)
- Pendiente: 2 pulidos de código + test del caso mixto extremo

---

### Task 1: Fix animation ease curve en LateralPanel

**Files:**
- Modify: `components/PropertyWizardModal.tsx:332`

El LateralPanel usa `ease: "easeOut"` en su AnimatePresence. La especificación de diseño (saproa-diseno.md) requiere usar el ease del sistema: `[0.16, 1, 0.3, 1]`.

- [ ] **Step 1: Localizar y editar la línea**

En `components/PropertyWizardModal.tsx`, alrededor de línea 332, dentro del componente `LateralPanel`:

```tsx
// ANTES:
transition={{ duration: 0.15, ease: "easeOut" }}

// DESPUÉS:
transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
```

- [ ] **Step 2: Verificar que no hay otros ease hardcodeados**

```bash
grep -n '"easeOut"\|"easeIn"\|"linear"' components/PropertyWizardModal.tsx
```

Expected: 0 matches after fix.

- [ ] **Step 3: Run TS check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

---

### Task 2: Remover función CounterRow no usada

**Files:**
- Modify: `components/PropertyWizardModal.tsx:211-232`

`CounterRow` fue reemplazada por `Counter` (líneas 236-261) durante la implementación pero quedó definida sin uso. No causa error TS (no hay `noUnusedLocals` en tsconfig) pero es dead code que confunde.

- [ ] **Step 1: Eliminar el bloque CounterRow (líneas 211-232)**

Borrar las líneas:
```tsx
function CounterRow({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderBottom: "1px solid var(--border-default)" }}>
      <span style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {(["−", "+"] as const).map((sym) => (
          <button key={sym} type="button"
            onClick={() => onChange(sym === "−" ? Math.max(min, value - 1) : Math.min(max, value + 1))}
            style={{ width: 30, height: 30, borderRadius: "var(--border-radius-sm)",
              border: "1px solid var(--border-default)", background: "var(--bg-card)",
              color: "var(--text-primary)", cursor: "pointer", fontSize: "1.125rem",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            {sym}
          </button>
        ))}
        {/* render value between buttons */}
      </div>
    </div>
  );
}
```

Y también borrar el comentario que queda en la línea siguiente:
```tsx
// CounterRow renders +/- but value needs to be between — let's use an inline render instead
```

- [ ] **Step 2: Run TS check again**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit las 2 correcciones**

```bash
git add components/PropertyWizardModal.tsx
git commit -m "fix: pulido fase 3.3 — ease curve sistema + remove dead CounterRow"
```

---

### Task 3: Test end-to-end — Caso Extremo 8 pisos mixto

**Goal:** Verificar que el wizard crea correctamente una propiedad mixta con 3 zonas:
- Zona 1: Piso 1 — Comercial, 4 locales
- Zona 2: Pisos 2-3 — Oficinas por metraje, 600 m² cada piso
- Zona 3: Pisos 4-8 — Residencial multi, distribución 4,4,4,3,2 deptos por piso

**Expected en BD:**
- 1 `property` con `property_label = "Mixto · Comercial + Oficinas + Residencial"` (o el orden que resulte de selectedTypes)
- 4 `spaces` tipo `commercial_local`, `floor = "1"`, sin `space_group_id`
- 2 `space_groups` tipo `piso` (Piso 2, Piso 3), con 1 `space` cada uno (`office`, `is_divisible=true`, `total_sqm=600`)
- 17 `spaces` tipo `apartment`, distribuidos en pisos 4-8 (floor 4→4, 5→4, 6→4, 7→3, 8→2), sin `space_group_id`

**Total:** 1 property, 2 space_groups, 23 spaces

**Cómo ejecutar (requires dev server):**

- [ ] **Step 1: Iniciar el servidor de desarrollo**

```bash
npm run dev
```

Esperar a que esté en `http://localhost:3000`.

- [ ] **Step 2: Abrir el wizard como superadmin impersonando Inmobiliaria Demo**

1. Ir a `/propiedades`
2. Verificar que se muestra la empresa activa (Inmobiliaria Demo)
3. Click "Nueva propiedad"

- [ ] **Step 3: Paso 1 — Seleccionar 3 tipos**

Click en: "Comercial / Plaza", "Comercial · Oficinas", "Residencial multifamiliar"

Verificar que la etiqueta preview muestra algo como `Mixto · Comercial + Oficinas + Residencial`.

- [ ] **Step 4: Paso 2 — Nombre**

Nombre: `Edificio Mixto Test 8P`

Click Siguiente →

- [ ] **Step 5: Paso 3 — Configurar zonas**

El wizard debe entrar automáticamente en `Step3Mixto` con 3 zonas pre-inicializadas.

**Zona 1 (Comercial):**
- Nombre: `Planta Baja Locales`
- Tipo: Comercial / Plaza
- Rango de pisos: 1 hasta 1
- Espacios por piso: Piso 1 → 4

**Zona 2 (Oficinas):**
- Click "Zona 2" en el panel lateral
- Nombre: `Pisos Oficinas`
- Tipo: Comercial · Oficinas
- Rango de pisos: 2 hasta 3
- Piso 2: 600 m², mínimo 100 m², Metraje libre
- Piso 3: 600 m², mínimo 100 m², Metraje libre

**Zona 3 (Residencial):**
- Click "Zona 3" en el panel lateral
- Nombre: `Torre Departamentos`
- Tipo: Residencial multifamiliar
- Rango de pisos: 4 hasta 8
- Piso 4: 4 deptos
- Piso 5: 4 deptos
- Piso 6: 4 deptos
- Piso 7: 3 deptos
- Piso 8: 2 deptos

Verificar que el panel lateral muestra las 3 zonas con su descripción de tipo y rango.
Verificar que NO hay overlap warning.

- [ ] **Step 6: Paso 4 — Assets**

Saltar (sin agregar equipos).

- [ ] **Step 7: Paso 5 — Resumen**

Verificar que el resumen muestra:
- Nombre: `Edificio Mixto Test 8P`
- Label: `Mixto · ...`
- 3 zonas
- Desglose: `4 locales (P1) + 1,200m² oficinas (P2–P3) + 17 deptos (P4–P8)`

Click "Crear propiedad".

- [ ] **Step 8: Verificar conteos en BD**

```sql
-- Buscar la propiedad recién creada
SELECT p.id, p.name, p.property_label,
       COUNT(DISTINCT sg.id) AS space_groups,
       COUNT(DISTINCT sp.id) AS spaces
FROM properties p
LEFT JOIN space_groups sg ON sg.property_id = p.id AND sg.deleted_at IS NULL
LEFT JOIN spaces sp ON sp.property_id = p.id AND sp.deleted_at IS NULL
WHERE p.name = 'Edificio Mixto Test 8P' AND p.deleted_at IS NULL
GROUP BY p.id, p.name, p.property_label;

-- Verificar spaces por tipo
SELECT sp.space_type, sp.floor, sp.space_group_id IS NOT NULL AS tiene_group,
       sp.is_divisible, sp.total_sqm, COUNT(*) AS cantidad
FROM spaces sp
JOIN properties p ON p.id = sp.property_id
WHERE p.name = 'Edificio Mixto Test 8P' AND sp.deleted_at IS NULL
GROUP BY sp.space_type, sp.floor, tiene_group, sp.is_divisible, sp.total_sqm
ORDER BY sp.floor, sp.space_type;
```

Expected:
- 1 property
- 2 space_groups
- 4 `commercial_local` floor=1, sin group
- 2 `office` floor=2,3, CON group, is_divisible=true, total_sqm=600
- 17 `apartment` floors 4-8, sin group

---

### Task 4: Limpiar datos de prueba

- [ ] **Step 1: Soft-delete la propiedad de prueba**

```sql
UPDATE properties
SET deleted_at = now()
WHERE name = 'Edificio Mixto Test 8P' AND is_test = true;
```

O dejarla con `is_test = true` para referencia futura.

---

### Task 5: Commit docs y verify script

- [ ] **Step 1: Commit los archivos no trackeados**

```bash
git add docs/superpowers/plans/2026-06-22-fase-3-3-verificacion.md
git add scripts/verify-propiedades.ts
git commit -m "docs: plan de verificacion fase 3.3 + script verify propiedades"
```

- [ ] **Step 2: Push a main**

```bash
git push origin main
```

---

## Resumen del Estado de la BD

| Tabla | Descripción | Estado |
|---|---|---|
| `properties` | Columnas correctas, `property_label` existe | ✅ |
| `space_groups` | Columnas correctas | ✅ |
| `spaces` | Todas las columnas (is_divisible, floor, etc.) | ✅ |
| `space_subdivisions` | `is_active` existe | ✅ |
| `assets` | `property_id`, `space_group_id`, `space_id` opcionales | ✅ |

## Schema Issues Detectados

Ninguno. El esquema en producción coincide con lo que usa el código.
