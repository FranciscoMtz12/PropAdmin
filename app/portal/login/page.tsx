"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";

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
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
type ActivateValues = z.infer<typeof activateSchema>;

type PortalTab = "login" | "activate";

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  border: "1px solid #E5E7EB",
  borderRadius: 24,
  padding: 28,
  background: "#FFFFFF",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #D1D5DB",
  borderRadius: 14,
  padding: "14px 16px",
  outline: "none",
  fontSize: 14,
  color: "#111827",
  background: "#FFFFFF",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
};

const helperStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#6B7280",
  lineHeight: 1.5,
};

const fieldErrorStyle: React.CSSProperties = {
  marginTop: 6,
  marginBottom: 0,
  fontSize: 12,
  color: "#EF4444",
  lineHeight: 1.4,
};

const buttonBaseStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  padding: "14px 16px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

export default function PortalLoginPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<PortalTab>("login");

  const [loginMessage, setLoginMessage] = useState("");
  const [activateMessage, setActivateMessage] = useState("");
  const [activateSuccess, setActivateSuccess] = useState(false);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const activateForm = useForm<ActivateValues>({
    resolver: zodResolver(activateSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const tabButtonStyle = useMemo(
    () =>
      ({
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 14,
        border: "1px solid #E5E7EB",
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        background: "#FFFFFF",
        color: "#111827",
        flex: 1,
      }) satisfies React.CSSProperties,
    []
  );

  const onLogin = loginForm.handleSubmit(async (data) => {
    setLoginMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.password,
    });

    if (error) {
      setLoginMessage(error.message);
      return;
    }

    router.push("/portal/dashboard");
  });

  const onActivate = activateForm.handleSubmit(async (data) => {
    setActivateMessage("");
    setActivateSuccess(false);

    try {
      const normalizedEmail = data.email.trim().toLowerCase();

      const response = await fetch("/api/portal/activate-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });

      const rawText = await response.text();

      let payload: any = null;

      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        setActivateMessage(
          payload?.error ||
            "El servidor devolvió un error inesperado. Revisa la terminal de Next para ver el detalle."
        );
        return;
      }

      setActivateSuccess(true);
      setActivateMessage(
        payload?.message ||
          "Cuenta activada correctamente. Ya puedes iniciar sesión."
      );

      setActiveTab("login");
      loginForm.reset({ email: normalizedEmail, password: "" });
      activateForm.reset({ email: "", password: "", confirmPassword: "" });
    } catch (error) {
      console.error("Error activando cuenta:", error);
      setActivateMessage("Ocurrió un error inesperado.");
    }
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
      }}
    >
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              background: "#EEF2FF",
              color: "#4338CA",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <UserRound size={22} />
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#6366F1",
              }}
            >
              PropAdmin
            </div>

            <h1
              style={{
                margin: "6px 0 8px",
                fontSize: 28,
                fontWeight: 800,
                color: "#111827",
                letterSpacing: "-0.03em",
              }}
            >
              Portal del inquilino
            </h1>

            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: "#6B7280",
              }}
            >
              Usa el mismo correo que registraste previamente con administración
              para activar tu cuenta o iniciar sesión.
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 10,
            padding: 6,
            borderRadius: 18,
            background: "#F9FAFB",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            style={{
              ...tabButtonStyle,
              background: activeTab === "login" ? "#111827" : "#FFFFFF",
              color: activeTab === "login" ? "#FFFFFF" : "#111827",
              border:
                activeTab === "login"
                  ? "1px solid #111827"
                  : "1px solid #E5E7EB",
            }}
          >
            <LogIn size={16} />
            Iniciar sesión
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("activate")}
            style={{
              ...tabButtonStyle,
              background: activeTab === "activate" ? "#111827" : "#FFFFFF",
              color: activeTab === "activate" ? "#FFFFFF" : "#111827",
              border:
                activeTab === "activate"
                  ? "1px solid #111827"
                  : "1px solid #E5E7EB",
            }}
          >
            <ShieldCheck size={16} />
            Activar cuenta
          </button>
        </div>

        {activeTab === "login" ? (
          <form onSubmit={onLogin} style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Correo electrónico</label>
              <input
                type="email"
                placeholder="tuemail@dominio.com"
                style={inputStyle}
                {...loginForm.register("email")}
              />
              {loginForm.formState.errors.email ? (
                <p style={fieldErrorStyle}>
                  {loginForm.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                style={inputStyle}
                {...loginForm.register("password")}
              />
              {loginForm.formState.errors.password ? (
                <p style={fieldErrorStyle}>
                  {loginForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            {loginMessage ? (
              <div
                style={{
                  marginBottom: 16,
                  borderRadius: 14,
                  padding: "12px 14px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#B91C1C",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {loginMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              style={{
                ...buttonBaseStyle,
                border: "1px solid #111827",
                background: "#111827",
                color: "#FFFFFF",
                opacity: loginForm.formState.isSubmitting ? 0.7 : 1,
              }}
            >
              {loginForm.formState.isSubmitting
                ? "Iniciando sesión..."
                : "Entrar al portal"}
            </button>
          </form>
        ) : (
          <form onSubmit={onActivate} style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Correo electrónico registrado</label>
              <input
                type="email"
                placeholder="Debe coincidir con el correo de tu perfil"
                style={inputStyle}
                {...activateForm.register("email")}
              />
              {activateForm.formState.errors.email ? (
                <p style={fieldErrorStyle}>
                  {activateForm.formState.errors.email.message}
                </p>
              ) : null}
              <div style={helperStyle}>
                Debe ser exactamente el mismo correo que administración usó al
                crear tu perfil de inquilino.
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Crear contraseña</label>
              <input
                type="password"
                placeholder="Mínimo 8 caracteres"
                style={inputStyle}
                {...activateForm.register("password")}
              />
              {activateForm.formState.errors.password ? (
                <p style={fieldErrorStyle}>
                  {activateForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Confirmar contraseña</label>
              <input
                type="password"
                placeholder="Vuelve a escribir tu contraseña"
                style={inputStyle}
                {...activateForm.register("confirmPassword")}
              />
              {activateForm.formState.errors.confirmPassword ? (
                <p style={fieldErrorStyle}>
                  {activateForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            {activateMessage ? (
              <div
                style={{
                  marginBottom: 16,
                  borderRadius: 14,
                  padding: "12px 14px",
                  background: activateSuccess ? "#ECFDF5" : "#FEF2F2",
                  border: activateSuccess
                    ? "1px solid #A7F3D0"
                    : "1px solid #FECACA",
                  color: activateSuccess ? "#065F46" : "#B91C1C",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {activateMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={activateForm.formState.isSubmitting}
              style={{
                ...buttonBaseStyle,
                border: "1px solid #4338CA",
                background: "#4338CA",
                color: "#FFFFFF",
                opacity: activateForm.formState.isSubmitting ? 0.7 : 1,
              }}
            >
              {activateForm.formState.isSubmitting
                ? "Activando..."
                : "Activar cuenta"}
            </button>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                borderRadius: 16,
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                padding: 14,
              }}
            >
              <Mail
                size={16}
                color="#6B7280"
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#6B7280",
                }}
              >
                Si tu correo no coincide con el que aparece en tu perfil de
                inquilino, primero tendrás que solicitar a administración que lo
                corrija dentro del sistema.
              </div>
            </div>
          </form>
        )}

        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid #E5E7EB",
            fontSize: 12,
            color: "#6B7280",
            lineHeight: 1.6,
          }}
        >
          Este acceso es exclusivo para inquilinos registrados. El acceso
          administrativo sigue viviendo fuera del portal.
        </div>
      </div>
    </div>
  );
}