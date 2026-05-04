# Convenciones del proyecto SAPROA

## Ordenamiento de listas

**REGLA INQUEBRANTABLE:** Toda lista renderizada al usuario DEBE estar
ordenada explícitamente con el helper apropiado de `lib/sort-utils.ts`.

### Por tipo de campo

| Campo | Helper | Resultado |
|---|---|---|
| `unit_number`, `internal_number`, `meter_number`, `folio`, `code` | `sortByNatural()` | 1, 2, 3 … 10, 11, 12 … A1, A2 … PB |
| `name`, `full_name`, `building.name`, `supplier.name` (texto puro) | `sortByAlphabetic()` | Asunción, Marsella 232, Marsella 304 |
| `created_at`, `updated_at`, fechas | `.order()` de Supabase nativo | — |

### Patrón a seguir

```tsx
import { sortByNatural, sortByAlphabetic } from '@/lib/sort-utils'

const orderedUnits = sortByNatural(units, u => u.unit_number)
{orderedUnits.map(u => <Card unit={u} />)}
```

### NUNCA hacer

- `units.sort()` sin pasar comparador
- `localeCompare` sin `{ numeric: true }` para campos con números
- `Number(a) - Number(b)` — rompe con `"PB"`, `"A1"`, `"Depa 2B"`, etc.

---

## Detección de inquilinos (leases activos)

Para obtener el inquilino activo de una unidad, usar SIEMPRE:

```typescript
const today = new Date().toISOString().split('T')[0]

const { data } = await supabase
  .from('leases')
  .select('id, unit_id, start_date, end_date, tenant:tenants(id, full_name)')
  .in('unit_id', unitIds)
  .eq('status', 'ACTIVE')          // enum es ACTIVE (mayúsculas)
  .is('deleted_at', null)
  .lte('start_date', today)
  .or(`end_date.is.null,end_date.gte.${today}`)
```

El valor del enum `lease_status` es `'ACTIVE'` (mayúsculas).
Usar `'active'` (minúsculas) no retorna resultados.
