"use client";

/*
  Placeholder de login de campo — el flujo de autenticación del equipo de
  campo todavía no tiene UI propia, así que esta ruta redirige al selector
  de roles (/) donde el usuario puede elegir otra vía de acceso.
*/

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CampoLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
