import { createClient } from "@supabase/supabase-js";

/*
  Cliente server-side con permisos administrativos.

  Se usa SOLO en routes del servidor para:
  - crear usuarios en Supabase Auth
  - vincular auth_user_id con tenants
  - ejecutar validaciones sensibles sin depender del cliente

  IMPORTANTE:
  - Nunca importarlo en componentes client
  - Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
*/

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});