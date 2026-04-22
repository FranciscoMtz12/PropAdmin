import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/*
  POST /api/users/create — crea un usuario nuevo en auth + app_users.

  Solo superadmin puede usar este endpoint. Valida identidad vía
  el access_token que el cliente manda en el header Authorization.
  Si falla el insert en app_users hace rollback borrando el auth user.
*/

type CreateUserBody = {
  full_name?: string;
  email?: string;
  password?: string;
  role?: string;
  company_id?: string;
};

const VALID_ROLES = [
  "superadmin",
  "administracion",
  "directivo",
  "compras",
  "mantenimiento",
  "field",
];

export async function POST(request: Request) {
  try {
    // 1. Validar superadmin caller
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Token ausente." }, { status: 401 });
    }

    const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(token);
    if (callerAuthError || !callerAuth?.user) {
      return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    }

    const { data: caller, error: callerError } = await supabaseAdmin
      .from("app_users")
      .select("id, role, is_superadmin")
      .eq("id", callerAuth.user.id)
      .maybeSingle();

    if (callerError || !caller) {
      return NextResponse.json({ error: "Usuario autenticado no tiene perfil." }, { status: 403 });
    }

    const isSuperadmin = caller.role === "superadmin" || Boolean(caller.is_superadmin);
    if (!isSuperadmin) {
      return NextResponse.json({ error: "Requiere privilegios de superadmin." }, { status: 403 });
    }

    // 2. Validar body
    const body = (await request.json()) as CreateUserBody;
    const full_name = body.full_name?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password?.trim() || "";
    const role = body.role?.trim() || "";
    const company_id = body.company_id?.trim() || "";

    if (!full_name || !email || !password || !role || !company_id) {
      return NextResponse.json({ error: "Completa todos los campos." }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }

    // 3. Crear auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError || !authUser?.user) {
      return NextResponse.json(
        { error: authError?.message || "No se pudo crear el usuario auth." },
        { status: 500 }
      );
    }

    // 4. Insertar en app_users
    const { error: insertError } = await supabaseAdmin.from("app_users").insert({
      id: authUser.user.id,
      email,
      full_name,
      role,
      company_id,
      is_superadmin: role === "superadmin",
    });

    if (insertError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: authUser.user.id });
  } catch (error) {
    console.error("users/create failed", error);
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
