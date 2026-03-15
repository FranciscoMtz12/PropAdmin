import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/*
  Activación de cuenta para inquilinos.

  Regla de negocio:
  - NO existe registro libre
  - solo puede activarse un email que ya exista en public.tenants
  - si el tenant ya tiene auth_user_id, ya fue activado
  - al crear el usuario en auth, se guarda el vínculo en tenants.auth_user_id
*/

type ActivateBody = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActivateBody;

    const rawEmail = body.email?.trim() || "";
    const email = rawEmail.toLowerCase();
    const password = body.password?.trim() || "";
    const confirmPassword = body.confirmPassword?.trim() || "";

    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Completa todos los campos." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Las contraseñas no coinciden." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    // 1) Buscar tenant por email
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, full_name, email, auth_user_id, status")
      .ilike("email", email)
      .maybeSingle();

    if (tenantError) {
      console.error("Error consultando tenant:", tenantError);
      return NextResponse.json(
        { error: "No se pudo validar el perfil del inquilino." },
        { status: 500 }
      );
    }

    if (!tenant) {
      return NextResponse.json(
        {
          error:
            "No encontramos un perfil de inquilino con ese correo. Usa el mismo email registrado previamente en administración.",
        },
        { status: 404 }
      );
    }

    if (tenant.auth_user_id) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta ya fue activada. Intenta iniciar sesión con ese correo.",
        },
        { status: 409 }
      );
    }

    // 2) Validar que no exista ya un auth user con ese correo
    const { data: existingAuthUsers, error: listUsersError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listUsersError) {
      console.error("Error listando usuarios auth:", listUsersError);
      return NextResponse.json(
        { error: "No se pudo validar si el correo ya tiene acceso." },
        { status: 500 }
      );
    }

    const existingAuthUser = existingAuthUsers.users.find(
      (user) => (user.email || "").toLowerCase() === email
    );

    if (existingAuthUser) {
      return NextResponse.json(
        {
          error:
            "Ese correo ya existe en el sistema de acceso. Si ya habías activado tu cuenta, intenta iniciar sesión.",
        },
        { status: 409 }
      );
    }

    // 3) Crear usuario en Supabase Auth
    const { data: createdAuthUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "tenant",
          tenant_id: tenant.id,
          tenant_name: tenant.full_name || "",
        },
      });

    if (createUserError || !createdAuthUser.user) {
      console.error("Error creando usuario auth:", createUserError);
      return NextResponse.json(
        { error: "No se pudo crear la cuenta de acceso." },
        { status: 500 }
      );
    }

    // 4) Guardar auth_user_id en tenants
    const { error: updateTenantError } = await supabaseAdmin
      .from("tenants")
      .update({
        auth_user_id: createdAuthUser.user.id,
      })
      .eq("id", tenant.id);

    if (updateTenantError) {
      console.error("Error vinculando tenant con auth:", updateTenantError);

      // rollback simple: si ya se creó auth pero no se pudo vincular, borramos el auth user
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUser.user.id);

      return NextResponse.json(
        { error: "No se pudo vincular la cuenta con el perfil del inquilino." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Cuenta activada correctamente. Ya puedes iniciar sesión en el portal.",
    });
  } catch (error) {
    console.error("Error inesperado activando cuenta:", error);
    return NextResponse.json(
      { error: "Ocurrió un error inesperado al activar la cuenta." },
      { status: 500 }
    );
  }
}