"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { resolveUserDestination } from "@/lib/auth-routing";

const loginSchema = z.object({
  email: z.string().min(1, "El email es obligatorio").email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
type LoginValues = z.infer<typeof loginSchema>;

const activateSchema = z
  .object({
    email: z.string().min(1, "El email es obligatorio").email("Email inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
type ActivateValues = z.infer<typeof activateSchema>;
type LoginTab = "login" | "activate";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: ".65rem .9rem",
  background: "rgba(255,255,255,.08)",
  border: "1px solid rgba(255,255,255,.15)",
  borderRadius: "var(--border-radius-md)",
  color: "#fff",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "rgba(255,255,255,.5)",
  display: "block",
  marginBottom: 6,
};

const errorStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "#f87171",
  marginTop: 4,
};

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LoginTab>("login");
  const [loginError, setLoginError] = useState("");
  const [activateMessage, setActivateMessage] = useState("");
  const [activateSuccess, setActivateSuccess] = useState(false);

  /* Garantizar colores SAPROA en cuanto la página monta, sin esperar ThemeContext */
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent",           "#6366F1");
    root.setProperty("--accent-gradient",  "linear-gradient(135deg,#818cf8 0%,#6366F1 45%,#4f46e5 100%)");
    root.setProperty("--color-accent",     "#6366F1");
    root.setProperty("--color-primary",    "#6366F1");
    root.setProperty("--group-accent",     "#6366F1");
    root.setProperty("--color-accent-rgb", "99, 102, 241");
    root.setProperty("--font-scale",       "1");
  }, []);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const activateForm = useForm<ActivateValues>({
    resolver: zodResolver(activateSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onLogin = loginForm.handleSubmit(async (data) => {
    setLoginError("");
    const { data: authData, error: err } = await supabase.auth.signInWithPassword({
      email: data.email.toLowerCase().trim(),
      password: data.password,
    });
    if (err) {
      setLoginError("Credenciales incorrectas");
      return;
    }

    const uid = authData.session?.user.id;
    if (!uid) { setLoginError("Error inesperado. Intenta de nuevo."); return; }

    const profile = await resolveUserDestination(uid);
    if (profile.type === "unknown") {
      setLoginError("Tu cuenta no tiene un perfil asignado. Contacta al administrador.");
      await supabase.auth.signOut();
      return;
    }
    router.push(profile.destination);
  });

  const onActivate = activateForm.handleSubmit(async (data) => {
    setActivateMessage("");
    setActivateSuccess(false);
    try {
      const normalizedEmail = data.email.trim().toLowerCase();
      const response = await fetch("/api/portal/activate-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });
      const rawText = await response.text();
      let payload: { error?: string; message?: string } | null = null;
      try { payload = rawText ? JSON.parse(rawText) : null; } catch { payload = null; }
      if (!response.ok) {
        setActivateMessage(payload?.error || "Error inesperado.");
        return;
      }
      setActivateSuccess(true);
      setActivateMessage(payload?.message || "Cuenta activada correctamente.");
      setActiveTab("login");
      loginForm.reset({ email: normalizedEmail, password: "" });
      activateForm.reset({ email: "", password: "", confirmPassword: "" });
    } catch {
      setActivateMessage("Ocurrió un error inesperado.");
    }
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(160deg, #0d1b2a 0%, #1c3a5e 60%, #0d1b2a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans, sans-serif)",
        padding: "1rem",
      }}
    >
      {/* Textura */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }}
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="lp" x="0" y="0" width="110" height="110" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
            <g fill="none" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
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
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.6) 0%,rgba(0,0,0,.2) 100%)", pointerEvents: "none" }} />

      {/* Botón volver */}
      <button
        type="button"
        onClick={() => router.push("/")}
        style={{
          position: "absolute", top: "1.5rem", left: "1.5rem",
          background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)",
          color: "rgba(255,255,255,.7)", borderRadius: "var(--border-radius-xl)",
          padding: ".5rem 1rem", fontSize: "0.75rem", cursor: "pointer",
          zIndex: 2, minHeight: 44, display: "inline-flex", alignItems: "center",
        }}
      >
        ← Volver
      </button>

      {/* Card */}
      <div
        style={{
          position: "relative", zIndex: 2,
          background: "rgba(255,255,255,.06)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,.12)", borderRadius: "var(--border-radius-xl)",
          padding: "2.5rem 2rem", width: "100%", maxWidth: 400,
          boxShadow: "0 8px 40px rgba(0,0,0,.4)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
            <Image
              src="/brands/saproa/saproa-stacked-dark.png"
              alt="SAPROA"
              width={120}
              height={120}
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: ".5rem", marginBottom: "1.5rem" }}>
          {(["login", "activate"] as LoginTab[]).map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: ".55rem", borderRadius: "var(--border-radius-md)",
              fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", transition: "all .2s",
              background: activeTab === tab ? "rgba(255,255,255,.15)" : "transparent",
              border: activeTab === tab ? "1px solid rgba(255,255,255,.25)" : "1px solid rgba(255,255,255,.08)",
              color: activeTab === tab ? "#fff" : "rgba(255,255,255,.45)",
            }}>
              {tab === "login" ? "Iniciar sesión" : "Activar cuenta"}
            </button>
          ))}
        </div>

        {/* Tab: Iniciar sesión */}
        {activeTab === "login" && (
          <form onSubmit={onLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input {...loginForm.register("email")} type="email" autoComplete="email" placeholder="usuario@empresa.com" style={inputStyle} />
              {loginForm.formState.errors.email && <p style={errorStyle}>{loginForm.formState.errors.email.message}</p>}
            </div>

            <div>
              <label style={labelStyle}>Contraseña</label>
              <input {...loginForm.register("password")} type="password" autoComplete="current-password" placeholder="••••••••" style={inputStyle} />
              {loginForm.formState.errors.password && <p style={errorStyle}>{loginForm.formState.errors.password.message}</p>}
            </div>

            {loginError && (
              <div style={{ background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", borderRadius: "var(--border-radius-md)", padding: ".6rem .9rem", fontSize: "0.8125rem", color: "#fca5a5" }}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              style={{
                marginTop: ".5rem", padding: ".75rem",
                background: loginForm.formState.isSubmitting ? "rgba(139,34,82,.5)" : "var(--accent)",
                border: "none", borderRadius: "var(--border-radius-md)",
                color: "#fff", fontSize: "0.875rem", fontWeight: 500,
                cursor: loginForm.formState.isSubmitting ? "not-allowed" : "pointer",
                transition: "background .2s",
              }}
            >
              {loginForm.formState.isSubmitting ? "Iniciando sesión..." : "Entrar"}
            </button>

            <p style={{ textAlign: "center", marginTop: "8px", fontSize: "0.6875rem", color: "rgba(255,255,255,.3)", lineHeight: 1.5 }}>
              Al iniciar sesión aceptas nuestros{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,.5)", textDecoration: "underline" }}>Términos y condiciones</a>{" "}y{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,.5)", textDecoration: "underline" }}>Aviso de privacidad</a>
            </p>
          </form>
        )}

        {/* Tab: Activar cuenta */}
        {activeTab === "activate" && (
          <form onSubmit={onActivate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input {...activateForm.register("email")} type="email" placeholder="inquilino@empresa.com" style={inputStyle} />
              {activateForm.formState.errors.email && <p style={errorStyle}>{activateForm.formState.errors.email.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>Nueva contraseña</label>
              <input {...activateForm.register("password")} type="password" placeholder="Mínimo 8 caracteres" style={inputStyle} />
              {activateForm.formState.errors.password && <p style={errorStyle}>{activateForm.formState.errors.password.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>Confirmar contraseña</label>
              <input {...activateForm.register("confirmPassword")} type="password" placeholder="••••••••" style={inputStyle} />
              {activateForm.formState.errors.confirmPassword && <p style={errorStyle}>{activateForm.formState.errors.confirmPassword.message}</p>}
            </div>

            {activateMessage && (
              <div style={{
                background: activateSuccess ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)",
                border: `1px solid ${activateSuccess ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"}`,
                borderRadius: "var(--border-radius-md)", padding: ".6rem .9rem",
                fontSize: "0.8125rem", color: activateSuccess ? "#6ee7b7" : "#fca5a5",
              }}>
                {activateMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={activateForm.formState.isSubmitting}
              style={{
                marginTop: ".25rem", padding: ".75rem",
                background: activateForm.formState.isSubmitting ? "rgba(139,34,82,.5)" : "var(--accent)",
                border: "none", borderRadius: "var(--border-radius-md)",
                color: "#fff", fontSize: "0.875rem", fontWeight: 500,
                cursor: activateForm.formState.isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {activateForm.formState.isSubmitting ? "Activando..." : "Activar cuenta"}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          position: "relative", zIndex: 2, marginTop: "1.5rem",
          fontSize: "0.6875rem", color: "rgba(255,255,255,.25)", letterSpacing: 1,
          display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center",
        }}
      >
        <span>© {new Date().getFullYear()} SAPROA</span>
        <span>·</span>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,.35)", textDecoration: "none" }}>Aviso de privacidad</a>
        <span>·</span>
        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,.35)", textDecoration: "none" }}>Términos y condiciones</a>
      </div>
    </div>
  );
}
