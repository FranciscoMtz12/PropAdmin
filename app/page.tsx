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

      {/* Textura SVG sutil */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.04,
          zIndex: 1,
          pointerEvents: "none",
        }}
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="10" y="20" width="28" height="38" />
          <rect x="14" y="25" width="6" height="7" />
          <rect x="24" y="25" width="6" height="7" />
          <rect x="14" y="36" width="6" height="7" />
          <rect x="24" y="36" width="6" height="7" />
          <rect x="19" y="48" width="8" height="10" />
          <circle cx="75" cy="30" r="8" />
          <line x1="83" y1="30" x2="100" y2="30" />
          <line x1="97" y1="30" x2="97" y2="36" />
          <line x1="92" y1="30" x2="92" y2="34" />
          <rect x="120" y="15" width="35" height="28" />
          <line x1="127" y1="22" x2="148" y2="22" />
          <line x1="127" y1="27" x2="148" y2="27" />
          <line x1="127" y1="32" x2="140" y2="32" />
          <rect x="180" y="5" width="20" height="53" />
          <rect x="183" y="10" width="5" height="6" />
          <rect x="192" y="10" width="5" height="6" />
          <rect x="183" y="20" width="5" height="6" />
          <rect x="192" y="20" width="5" height="6" />
          <rect x="183" y="30" width="5" height="6" />
          <rect x="192" y="30" width="5" height="6" />
          <rect x="187" y="51" width="6" height="7" />
          <rect x="230" y="18" width="22" height="32" />
          <path d="M241 50 Q252 34 241 18" />
          <circle cx="248" cy="34" r="1.5" />
          <line x1="320" y1="55" x2="320" y2="10" />
          <line x1="320" y1="10" x2="355" y2="10" />
          <line x1="355" y1="10" x2="355" y2="20" />
          <line x1="340" y1="10" x2="340" y2="22" />
          <rect x="336" y="22" width="8" height="6" />
          <rect x="370" y="15" width="24" height="20" />
          <line x1="382" y1="15" x2="382" y2="35" />
          <line x1="370" y1="25" x2="394" y2="25" />
          <rect x="5" y="90" width="30" height="38" />
          <line x1="10" y1="98" x2="30" y2="98" />
          <line x1="10" y1="104" x2="30" y2="104" />
          <line x1="10" y1="110" x2="22" y2="110" />
          <rect x="55" y="103" width="18" height="14" rx="2" />
          <path d="M58 103 v-5 a6 6 0 0 1 12 0 v5" />
          <circle cx="64" cy="110" r="2" />
          <rect x="95" y="118" width="6" height="10" />
          <rect x="104" y="112" width="6" height="16" />
          <rect x="113" y="106" width="6" height="22" />
          <rect x="122" y="114" width="6" height="14" />
          <line x1="92" y1="128" x2="132" y2="128" />
          <rect x="155" y="82" width="34" height="46" />
          <rect x="159" y="88" width="7" height="8" />
          <rect x="170" y="88" width="7" height="8" />
          <rect x="181" y="88" width="7" height="8" />
          <rect x="159" y="100" width="7" height="8" />
          <rect x="170" y="100" width="7" height="8" />
          <rect x="168" y="120" width="9" height="8" />
          <path d="M230 88 a12 12 0 0 1 24 0 c0 10-12 24-12 24 s-12-14-12-24z" />
          <circle cx="242" cy="88" r="5" />
          <rect x="315" y="82" width="32" height="28" rx="2" />
          <line x1="315" y1="92" x2="347" y2="92" />
          <line x1="324" y1="82" x2="324" y2="88" />
          <line x1="338" y1="82" x2="338" y2="88" />
          <path d="M370 128 h10 v-8 h10 v-8 h10 v-8" />
          <rect x="130" y="162" width="40" height="24" rx="3" />
          <path d="M150 162 v24" />
          <circle cx="143" cy="174" r="3" />
          <line x1="155" y1="169" x2="165" y2="169" />
          <line x1="155" y1="174" x2="165" y2="174" />
          <path d="M60 155 l15 40" />
          <ellipse cx="60" cy="155" rx="8" ry="5" transform="rotate(-20,60,155)" />
          <path d="M100 188 a4 4 0 0 1 8 0" />
          <path d="M96 183 a10 10 0 0 1 16 0" />
          <path d="M91 178 a16 16 0 0 1 26 0" />
          <circle cx="104" cy="190" r="2" />
          <rect x="200" y="158" width="20" height="28" />
          <rect x="203" y="163" width="5" height="5" />
          <rect x="212" y="163" width="5" height="5" />
          <rect x="203" y="172" width="5" height="5" />
          <rect x="212" y="172" width="5" height="5" />
          <rect x="207" y="178" width="6" height="8" />
          <rect x="290" y="172" width="40" height="16" rx="3" />
          <rect x="296" y="166" width="28" height="8" rx="2" />
          <circle cx="298" cy="190" r="4" />
          <circle cx="322" cy="190" r="4" />
          <line x1="360" y1="186" x2="360" y2="155" />
          <line x1="370" y1="186" x2="370" y2="155" />
          <line x1="360" y1="162" x2="370" y2="162" />
          <line x1="360" y1="170" x2="370" y2="170" />
          <line x1="360" y1="178" x2="370" y2="178" />
        </g>
      </svg>

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
