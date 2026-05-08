# Edge Functions — SAPROA

## generate-monthly-charges

Genera automáticamente los `collection_records` del mes para todos los
leases activos de cada empresa. Replica la lógica de "Generar cobros del
mes" del módulo de Cobranza.

### Flujo

1. Para cada empresa activa, obtiene leases ACTIVE con sus unidades.
2. Crea `collection_schedules` de renta y/o parking si no existen.
3. Inserta `collection_records` para el mes/año actuales, saltando los
   que ya existen (idempotente).
4. Los cobros de tipo variable (electricity, water, gas, services)
   se crean con `amount_due: 0` y `notes: 'needs_amount'`.

### Trigger

Cron pg_cron: **día 1 de cada mes a las 06:00 UTC**
(`0 6 1 * *` en `supabase/migrations/enable_cron.sql`)

---

## Setup — pasos para Francisco

### 1. Instalar Supabase CLI (si no está)

```bash
npm install -g supabase
```

### 2. Login y link al proyecto

```bash
supabase login
supabase link --project-ref mremgbneyztpbojwgwcc
```

### 3. Deploy de la Edge Function

```bash
npm run deploy:functions
# o directamente:
supabase functions deploy generate-monthly-charges
```

### 4. Agregar el secret en Supabase Dashboard

Dashboard → Edge Functions → `generate-monthly-charges` → **Secrets**:

| Key | Value |
|-----|-------|
| `CRON_SECRET` | `saproa-cron-2026` |

### 5. Habilitar extensiones en Dashboard

Dashboard → Database → **Extensions**:
- Habilitar `pg_cron`
- Habilitar `pg_net`

### 6. Configurar app settings para el cron

En Dashboard → Database → **SQL Editor**, ejecutar:

```sql
ALTER DATABASE postgres SET "app.supabase_url" = 'https://mremgbneyztpbojwgwcc.supabase.co';
ALTER DATABASE postgres SET "app.cron_secret"   = 'saproa-cron-2026';
```

### 7. Registrar el cron job

En Dashboard → Database → **SQL Editor**, ejecutar el contenido de
`supabase/migrations/enable_cron.sql`.

### 8. Verificar

```sql
SELECT * FROM cron.job;
```

Debe aparecer `generate-monthly-charges` con schedule `0 6 1 * *`.

### Probar manualmente (cualquier mes)

```bash
curl -X POST \
  https://mremgbneyztpbojwgwcc.supabase.co/functions/v1/generate-monthly-charges \
  -H "Authorization: Bearer saproa-cron-2026" \
  -H "Content-Type: application/json"
```

Respuesta esperada: `{"ok":true,"month":5,"year":2026,"results":{...}}`
