"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";

const schema = z.object({
  email: z.string().min(1, "El email es obligatorio").email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: data.email.toLowerCase().trim(),
      password: data.password,
    });
    if (err) {
      setError("Credenciales incorrectas");
      return;
    }
    router.push("/home");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(160deg, #0d1b2a 0%, #1c3a5e 60%, #0d1b2a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans, sans-serif)",
        padding: "1rem",
      }}
    >
      {/* Textura igual que la landing */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.04,
          pointerEvents: "none",
        }}
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="lp"
            x="0"
            y="0"
            width="110"
            height="110"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-12)"
          >
            <g
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="8" y="8" width="18" height="24" />
              <rect x="11" y="12" width="4" height="5" />
              <rect x="19" y="12" width="4" height="5" />
              <rect x="11" y="20" width="4" height="5" />
              <rect x="19" y="20" width="4" height="5" />
              <rect x="14" y="27" width="6" height="5" />
              <circle cx="55" cy="16" r="6" />
              <line x1="61" y1="16" x2="75" y2="16" />
              <line x1="72" y1="16" x2="72" y2="21" />
              <line x1="67" y1="16" x2="67" y2="20" />
              <rect x="8" y="55" width="22" height="28" />
              <line x1="13" y1="62" x2="26" y2="62" />
              <line x1="13" y1="68" x2="26" y2="68" />
              <line x1="13" y1="74" x2="20" y2="74" />
              <path d="M55 50 a8 8 0 0 1 16 0 c0 8-8 18-8 18 s-8-10-8-18z" />
              <circle cx="63" cy="50" r="4" />
              <rect x="8" y="100" width="14" height="12" rx="2" />
              <path d="M11 100 v-4 a4 4 0 0 1 8 0 v4" />
              <rect x="82" y="8" width="22" height="20" rx="2" />
              <line x1="82" y1="16" x2="104" y2="16" />
              <line x1="89" y1="8" x2="89" y2="14" />
              <line x1="99" y1="8" x2="99" y2="14" />
              <rect x="82" y="88" width="18" height="14" />
              <line x1="91" y1="88" x2="91" y2="102" />
              <line x1="82" y1="95" x2="100" y2="95" />
              <rect x="55" y="95" width="5" height="14" />
              <rect x="63" y="89" width="5" height="20" />
              <rect x="71" y="92" width="5" height="17" />
              <line x1="52" y1="109" x2="79" y2="109" />
            </g>
          </pattern>
        </defs>
        <rect width="400" height="600" fill="url(#lp)" />
      </svg>

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,.6) 0%, rgba(0,0,0,.2) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Botón volver */}
      <button
        type="button"
        onClick={() => router.push("/")}
        style={{
          position: "absolute",
          top: "1.5rem",
          left: "1.5rem",
          background: "rgba(255,255,255,.1)",
          border: "1px solid rgba(255,255,255,.2)",
          color: "rgba(255,255,255,.7)",
          borderRadius: "var(--border-radius-xl)",
          padding: ".5rem 1rem",
          fontSize: "0.75rem",
          cursor: "pointer",
          zIndex: 2,
          minHeight: 44,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        ← Volver
      </button>

      {/* Card de login */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "rgba(255,255,255,.06)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: "var(--border-radius-xl)",
          padding: "2.5rem 2rem",
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 8px 40px rgba(0,0,0,.4)",
        }}
      >
        {/* Logo + título */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
            <Image
              src="/brands/saproa/saproa-stacked-dark.png"
              alt="SAPROA"
              width={140}
              height={140}
              style={{ objectFit: "contain" }}
            />
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff" }}>
            Iniciar sesión
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,.5)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="usuario@empresa.com"
              style={{
                width: "100%",
                padding: ".65rem .9rem",
                background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(255,255,255,.15)",
                borderRadius: "var(--border-radius-md)",
                color: "#fff",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
            {errors.email && (
              <p style={{ fontSize: "0.6875rem", color: "#f87171", marginTop: 4 }}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,.5)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Contraseña
            </label>
            <input
              {...register("password")}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: ".65rem .9rem",
                background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(255,255,255,.15)",
                borderRadius: "var(--border-radius-md)",
                color: "#fff",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
            {errors.password && (
              <p style={{ fontSize: "0.6875rem", color: "#f87171", marginTop: 4 }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {error && (
            <div
              style={{
                background: "rgba(239,68,68,.15)",
                border: "1px solid rgba(239,68,68,.3)",
                borderRadius: "var(--border-radius-md)",
                padding: ".6rem .9rem",
                fontSize: "0.8125rem",
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: ".5rem",
              padding: ".75rem",
              background: isSubmitting ? "rgba(139,34,82,.5)" : "var(--accent)",
              border: "none",
              borderRadius: "var(--border-radius-md)",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "background .2s",
            }}
          >
            {isSubmitting ? "Iniciando sesión..." : "Entrar"}
          </button>

          <p style={{ textAlign: "center", marginTop: "12px", fontSize: "0.875rem", color: "rgba(255,255,255,.55)" }}>
            ¿No tienes cuenta?{" "}
            <a href="/register" style={{ color: "var(--accent)", fontWeight: 600, display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 4px" }}>
              Regístrate →
            </a>
          </p>
        </form>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          marginTop: "1.5rem",
          fontSize: "0.6875rem",
          color: "rgba(255,255,255,.25)",
          letterSpacing: 1,
        }}
      >
        SAPROA © {new Date().getFullYear()}
      </div>
    </div>
  );
}
