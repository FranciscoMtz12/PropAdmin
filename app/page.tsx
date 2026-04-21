"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrentUser } from "@/contexts/UserContext";

const ROLES = [
  {
    id: "admin",
    label: "Administración",
    bg: "url(/brands/bg/admin.jpg)",
    bgFallback: "#2a0f1e",
    d1: "Control total de tu patrimonio inmobiliario.",
    d2: "Edificios, cobranza, contratos y reportes en un solo panel.",
    path: "/login",
  },
  {
    id: "campo",
    label: "Equipo de Campo",
    bg: "url(/brands/bg/campo.jpg)",
    bgFallback: "#0a1f35",
    d1: "Tu herramienta de trabajo, siempre contigo.",
    d2: "Tickets, materiales y órdenes de compra desde el celular.",
    path: "/campo/login",
  },
  {
    id: "inquilino",
    label: "Inquilinos",
    bg: "url(/brands/bg/inquilino.jpg)",
    bgFallback: "#1a1a1a",
    d1: "Portal de inquilinos — próximamente.",
    d2: "Consulta tu contrato y pagos desde cualquier dispositivo.",
    path: "/portal/login",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [active, setActive] = useState<string | null>(null);
  const [fading, setFading] = useState(false);

  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    // Ya tiene sesión — redirigir según rol del UserContext
    const role = user.role as string;
    if (role === "tenant") { router.replace("/portal/dashboard"); return; }
    if (role === "field")  { router.replace("/campo/dashboard");  return; }
    router.replace("/dashboard");
  }, [user, loading, router]);

  const current = ROLES.find((r) => r.id === active);

  function pick(id: string) {
    if (active === id) return;
    setFading(true);
    setTimeout(() => {
      setActive(id);
      setFading(false);
    }, 250);
  }

  function goLogin() {
    router.push(current?.path ?? "/login");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: current ? current.bg : undefined,
        backgroundColor: current ? current.bgFallback : isDark ? "#0d1117" : "#1c2a3a",
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "background-color .6s ease",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "1.75rem 2rem",
        fontFamily: "var(--font-sans, sans-serif)",
      }}
    >
      {/* Overlay oscuro degradado */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.45) 50%, rgba(0,0,0,.18) 100%)",
          zIndex: 1,
        }}
      />

      {/* TOP BAR */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image
            src="/brands/saproa/saproa-icon-dark.png"
            alt="SAPROA"
            width={36}
            height={36}
            style={{ objectFit: "contain" }}
          />
          <span style={{ fontSize: 16, fontWeight: 500, color: "#fff", letterSpacing: "2px" }}>
            SAPROA
          </span>
        </div>
        <button
          type="button"
          onClick={goLogin}
          style={{
            padding: ".45rem 1.1rem",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,.28)",
            background: "rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.85)",
            letterSpacing: ".3px",
            transition: "all .2s",
          }}
        >
          Iniciar sesión
        </button>
      </div>

      {/* CENTRO */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
        {/* Ícono SAPROA */}
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
          <Image
            src="/brands/saproa/saproa-icon-dark.png"
            alt="SAPROA"
            width={64}
            height={64}
            style={{ objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,.4))" }}
          />
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,.45)",
            letterSpacing: "4px",
            marginBottom: "1rem",
          }}
        >
          BIENVENIDO
        </div>
        <div
          style={{
            fontSize: "clamp(28px, 5vw, 52px)",
            fontWeight: 500,
            color: "#fff",
            lineHeight: 1.15,
            marginBottom: ".6rem",
            textShadow: "0 2px 12px rgba(0,0,0,.4)",
          }}
        >
          Gestión inmobiliaria
          <br />
          en un solo lugar
        </div>
        <div style={{ fontSize: "clamp(12px, 1.5vw, 16px)", color: "rgba(255,255,255,.45)" }}>
          Selecciona tu área de acceso
        </div>
      </div>

      {/* BOTTOM */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          paddingBottom: "2rem",
        }}
      >
        {/* Botones de rol */}
        <div style={{ display: "flex", gap: ".5rem" }}>
          {ROLES.map((r) => {
            const isActive = active === r.id;
            const activeStyle =
              r.id === "admin"
                ? { background: "#8B2252", borderColor: "#8B2252", color: "#fff" }
                : r.id === "campo"
                ? { background: "#185FA5", borderColor: "#185FA5", color: "#fff" }
                : { background: "rgba(255,255,255,.2)", borderColor: "rgba(255,255,255,.5)", color: "#fff" };
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => pick(r.id)}
                style={{
                  padding: ".65rem 1.75rem",
                  borderRadius: 25,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  letterSpacing: ".3px",
                  transition: "all .2s",
                  border: "1px solid rgba(255,255,255,.22)",
                  background: "rgba(255,255,255,.08)",
                  color: "rgba(255,255,255,.65)",
                  ...(isActive ? activeStyle : {}),
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Descripción (2 líneas) */}
        <div
          style={{
            textAlign: "center",
            minHeight: 36,
            opacity: fading ? 0 : active ? 1 : 0,
            transition: "opacity .3s",
          }}
        >
          {current && (
            <>
              <div style={{ fontSize: "clamp(13px, 1.5vw, 16px)", fontWeight: 500, color: "#fff", marginBottom: 4 }}>
                {current.d1}
              </div>
              <div style={{ fontSize: "clamp(11px, 1.2vw, 14px)", color: "rgba(255,255,255,.5)" }}>{current.d2}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
