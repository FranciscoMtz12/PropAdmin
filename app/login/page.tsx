"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const loginSchema = z.object({
  email: z.string().min(1, "El email es obligatorio").email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();

  const [msg, setMsg] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    setMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push("/dashboard");
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border p-6 shadow-sm"
      >
        <h1 className="text-2xl font-bold mb-6">Iniciar sesión</h1>

        <div className="mb-4">
          <label className="block mb-2 text-sm">Email</label>
          <input
            type="email"
            className="w-full border rounded-xl px-4 py-3"
            placeholder="tu@email.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block mb-2 text-sm">Contraseña</label>
          <input
            type="password"
            className="w-full border rounded-xl px-4 py-3"
            placeholder="********"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>

        {msg && <p className="text-red-600 text-sm mb-4">{msg}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl border px-4 py-3 font-medium"
        >
          {isSubmitting ? "Iniciando sesión..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}