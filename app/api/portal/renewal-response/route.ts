import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RenewalBody = {
  leaseId?: string;
  response?: "yes" | "no";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RenewalBody;

    const leaseId = body.leaseId?.trim();
    const response = body.response?.trim().toLowerCase() as "yes" | "no" | undefined;

    if (!leaseId || !response) {
      return NextResponse.json(
        { error: "Faltan datos para registrar la respuesta de renovación." },
        { status: 400 }
      );
    }

    if (!["yes", "no"].includes(response)) {
      return NextResponse.json(
        { error: "La respuesta de renovación no es válida." },
        { status: 400 }
      );
    }

    // 1) Buscar lease
    const { data: lease, error: leaseError } = await supabaseAdmin
      .from("leases")
      .select("id, tenant_id, company_id, end_date, renewal_status")
      .eq("id", leaseId)
      .maybeSingle();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "No encontramos el contrato relacionado con esta respuesta." },
        { status: 404 }
      );
    }

    // 2) Buscar tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, full_name, email, auth_user_id")
      .eq("id", lease.tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "No encontramos el inquilino relacionado con este contrato." },
        { status: 404 }
      );
    }

    // 3) Obtener usuario autenticado por bearer/cookies no lo estamos validando server-side todavía.
    // En esta fase dependemos del flujo cliente + RouteGuard + tenant auth ya enlazado.
    // Más adelante esto debe reforzarse con auth SSR.
    if (!tenant.auth_user_id) {
      return NextResponse.json(
        { error: "El inquilino no tiene cuenta activada para el portal." },
        { status: 400 }
      );
    }

    // 4) Insertar respuesta histórica
    const { error: insertResponseError } = await supabaseAdmin
      .from("lease_renewal_responses")
      .insert({
        lease_id: lease.id,
        tenant_id: tenant.id,
        company_id: lease.company_id,
        response,
      });

    if (insertResponseError) {
      console.error("Error insertando respuesta de renovación:", insertResponseError);
      return NextResponse.json(
        { error: "No se pudo guardar la respuesta de renovación." },
        { status: 500 }
      );
    }

    // 5) Actualizar lease
    const { error: updateLeaseError } = await supabaseAdmin
      .from("leases")
      .update({
        renewal_status: response,
      })
      .eq("id", lease.id);

    if (updateLeaseError) {
      console.error("Error actualizando renewal_status del lease:", updateLeaseError);
      return NextResponse.json(
        { error: "Se guardó la respuesta, pero no se pudo actualizar el contrato." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        response === "yes"
          ? "Tu interés de renovación quedó registrado correctamente."
          : "Tu decisión de no renovar quedó registrada correctamente.",
    });
  } catch (error) {
    console.error("Error inesperado en renewal-response:", error);
    return NextResponse.json(
      { error: "Ocurrió un error inesperado al registrar la renovación." },
      { status: 500 }
    );
  }
}