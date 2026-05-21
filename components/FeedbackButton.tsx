"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, Lightbulb, AlertCircle, HelpCircle, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";

/*
  FeedbackButton — botón flotante global para enviar feedback.

  Aparece en rutas autenticadas (misma blacklist que SidebarGate, más
  todo /campo que tiene su propio shell móvil). Al hacer clic abre un
  panel con selector de tipo, título obligatorio y descripción libre.
  Inserta en la tabla `feedback` y cierra vía react-hot-toast.
*/

const HIDDEN_ROUTES = new Set(["/", "/login", "/portal/login", "/campo/login"]);

const schema = z.object({
  type: z.enum(["idea", "problema", "pregunta"]),
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const TYPE_OPTIONS: { v: FormValues["type"]; icon: React.ReactNode; label: string }[] = [
  { v: "idea",     icon: <Lightbulb size={14} />,   label: "Idea" },
  { v: "problema", icon: <AlertCircle size={14} />, label: "Problema" },
  { v: "pregunta", icon: <HelpCircle size={14} />,  label: "Pregunta" },
];

export default function FeedbackButton() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "idea", title: "", description: "" },
  });

  const selectedType = watch("type");

  if (!pathname) return null;
  if (HIDDEN_ROUTES.has(pathname)) return null;
  if (pathname.startsWith("/campo")) return null;
  if (!user) return null;

  const onSubmit = handleSubmit(async (data) => {
    const { error } = await supabase.from("feedback").insert({
      type: data.type,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      user_id: user.id,
      company_id: user.company_id,
      page_url: typeof window !== "undefined" ? window.location.href : null,
      status: "nuevo",
    });
    if (error) {
      console.error("feedback insert failed", error);
      toast.error("No se pudo enviar el feedback.");
      return;
    }
    toast.success("¡Gracias! Feedback enviado.");
    reset();
    setOpen(false);
  });

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Enviar feedback"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 100,
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,.25)",
            color: "#fff",
          }}
        >
          <MessageSquare size={20} />
        </button>
      )}

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 200 }}
          />
          <div
            style={{
              position: "fixed",
              bottom: "1.5rem",
              right: "1.5rem",
              zIndex: 201,
              width: 360,
              maxWidth: "calc(100vw - 2rem)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--border-radius-lg)",
              padding: "1.25rem",
              boxShadow: "0 12px 40px rgba(0,0,0,.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Enviar feedback</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {TYPE_OPTIONS.map((opt) => {
                  const active = selectedType === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setValue("type", opt.v)}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        padding: "8px 6px",
                        borderRadius: "var(--border-radius-md)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: active ? "var(--accent)" : "var(--bg-input)",
                        color: active ? "#fff" : "var(--text-secondary)",
                        border: "1px solid " + (active ? "var(--accent)" : "var(--border-default)"),
                      }}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <input
                  {...register("title")}
                  placeholder="Título *"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "var(--border-radius-md)",
                    fontSize: 13,
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {formState.errors.title && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                    {formState.errors.title.message}
                  </div>
                )}
              </div>

              <textarea
                {...register("description")}
                placeholder="Descripción (opcional)"
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "var(--border-radius-md)",
                  fontSize: 13,
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />

              <button
                type="submit"
                disabled={formState.isSubmitting}
                style={{
                  padding: "9px",
                  borderRadius: "var(--border-radius-md)",
                  fontSize: 13,
                  fontWeight: 600,
                  background: formState.isSubmitting ? "rgba(139,34,82,.5)" : "var(--accent)",
                  border: "none",
                  color: "#fff",
                  cursor: formState.isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {formState.isSubmitting ? "Enviando..." : "Enviar"}
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
