"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Building2, User, Palette, CheckCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Upload, X } from "lucide-react";

const REGISTRATION_MODE =
  process.env.NEXT_PUBLIC_REGISTRATION_MODE ?? "invite_only";

// ─── step labels ───────────────────────────────────────────
const STEPS = [
  { key: "cuenta",  label: "Cuenta",   icon: <User     size={14} /> },
  { key: "tipo",    label: "Tipo",     icon: <Building2 size={14} /> },
  { key: "datos",   label: "Datos",    icon: <Building2 size={14} /> },
  { key: "marca",   label: "Marca",    icon: <Palette  size={14} /> },
  { key: "confirm", label: "Listo",    icon: <CheckCircle size={14} /> },
];

// ─── shared input style ────────────────────────────────────
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

const errStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "#f87171",
  marginTop: 4,
};

// ─── background texture (same as login) ───────────────────
function BgTexture() {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }}
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="rp" x="0" y="0" width="110" height="110" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
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
      <rect width="400" height="600" fill="url(#rp)" />
    </svg>
  );
}

// ─── main component ────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── step 1: cuenta
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [inviteCode, setInviteCode] = useState(searchParams?.get("invite") ?? "");
  const [showPwd, setShowPwd]       = useState(false);
  const [showCpwd, setShowCpwd]     = useState(false);
  const [step1Err, setStep1Err]     = useState<Record<string,string>>({});

  // ── step 2: tipo
  const [orgType, setOrgType] = useState<"empresa" | "personal" | "">("");

  // ── step 3: datos
  const [fullName, setFullName]   = useState("");
  const [companyName, setCompanyName] = useState("");
  const [rfc, setRfc]             = useState("");
  const [phone, setPhone]         = useState("");
  const [address, setAddress]     = useState("");
  const [step3Err, setStep3Err]   = useState<Record<string,string>>({});

  // ── step 4: marca
  const [shortName, setShortName]   = useState("");
  const [brandColor, setBrandColor] = useState("#8B2252");
  const [logoFile, setLogoFile]     = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [step4Err, setStep4Err]     = useState<Record<string,string>>({});

  // ── step 2: tipo inline error
  const [step2Err, setStep2Err]     = useState("");

  // ── invite validation
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [validatingToken, setValidatingToken] = useState(false);

  // ─────────────────────────────────────────────────────────
  function validateStep1() {
    const e: Record<string,string> = {};
    if (!email.trim()) e.email = "El email es obligatorio";
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Email inválido";
    if (!password) e.password = "La contraseña es obligatoria";
    else if (password.length < 8) e.password = "Mínimo 8 caracteres";
    if (!confirmPwd) e.confirmPwd = "Confirma la contraseña";
    else if (confirmPwd !== password) e.confirmPwd = "Las contraseñas no coinciden";
    if (REGISTRATION_MODE === "invite_only" && !inviteCode.trim())
      e.inviteCode = "El código de invitación es obligatorio";
    setStep1Err(e);
    return Object.keys(e).length === 0;
  }

  function validateStep3() {
    const e: Record<string,string> = {};
    if (orgType === "empresa") {
      if (!companyName.trim()) e.companyName = "El nombre de la empresa es obligatorio";
    } else {
      if (!fullName.trim()) e.fullName = "Tu nombre completo es obligatorio";
    }
    setStep3Err(e);
    return Object.keys(e).length === 0;
  }

  function validateStep4() {
    const e: Record<string,string> = {};
    if (!shortName.trim()) e.shortName = "El nombre corto es obligatorio";
    setStep4Err(e);
    return Object.keys(e).length === 0;
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function nextStep() {
    setGlobalError("");
    if (step === 0) {
      if (!validateStep1()) return;
      if (REGISTRATION_MODE === "invite_only") {
        setValidatingToken(true);
        const { data: inv, error: invErr } = await supabase
          .from("invitations")
          .select("id")
          .eq("token", inviteCode.trim())
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .single();
        setValidatingToken(false);
        if (invErr || !inv) {
          setStep1Err((e) => ({ ...e, inviteCode: "Código de invitación inválido o ya utilizado" }));
          return;
        }
        setInvitationId(inv.id);
      }
    }
    if (step === 1) {
      if (!orgType) { setStep2Err("Selecciona un tipo de cuenta para continuar"); return; }
      setStep2Err("");
    }
    if (step === 2 && !validateStep3()) return;
    if (step === 3 && !validateStep4()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function prevStep() {
    setGlobalError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  // ─── final submit ────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setGlobalError("");

    try {
      // 1. Validate invite token if required
      if (REGISTRATION_MODE === "invite_only") {
        const { data: inv, error: invErr } = await supabase
          .from("invitations")
          .select("id")
          .eq("token", inviteCode.trim())
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .single();
        if (invErr || !inv) {
          setGlobalError("El código de invitación no es válido o ya fue usado.");
          setStep(0);
          setSubmitting(false);
          return;
        }
      }

      // 2. Create auth user
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      });
      if (signUpErr || !authData.user) {
        setGlobalError(signUpErr?.message ?? "Error al crear la cuenta.");
        setSubmitting(false);
        return;
      }
      const userId = authData.user.id;
      console.error('Auth result:', userId);

      // 3. Upload logo if provided
      let logoUrl = "";
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `logos/${userId}/logo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("company-assets")
          .upload(path, logoFile, { upsert: true });
        if (!upErr) {
          const { data: pub } = supabase.storage
            .from("company-assets")
            .getPublicUrl(path);
          logoUrl = pub.publicUrl;
        }
      }

      // 4. Insert company via SECURITY DEFINER RPC (bypasses RLS for new users)
      const compName = orgType === "empresa" ? companyName.trim() : fullName.trim();
      console.error('Insertando company con:', { name: compName, short_name: shortName.trim() || compName, phone: phone.trim() || null, tax_id: rfc.trim() || null, brand_color: brandColor });
      const { data: companyId, error: compErr } = await supabase.rpc(
        "create_company_on_register",
        {
          p_name:        compName,
          p_short_name:  shortName.trim() || compName,
          p_phone:       phone.trim() || "",
          p_address:     address.trim() || "",
          p_tax_id:      rfc.trim() || "",
          p_brand_color: brandColor || "#8B2252",
          p_logo_url:    logoUrl || "",
        }
      );
      console.error('Company insert error:', JSON.stringify(compErr));
      if (compErr || !companyId) {
        setGlobalError("Error al crear la empresa. Intenta de nuevo.");
        setSubmitting(false);
        return;
      }

      // 5. Insert app_user via SECURITY DEFINER RPC (bypasses RLS for new users)
      const { error: userErr } = await supabase.rpc("create_app_user_on_register", {
        p_id:         userId,
        p_company_id: companyId,
        p_full_name:  orgType === "empresa" ? (fullName.trim() || compName) : fullName.trim(),
        p_email:      email.toLowerCase().trim(),
        p_role:       "titular",
      });
      console.error('App users insert error:', JSON.stringify(userErr));
      if (userErr) {
        setGlobalError("Error al registrar el usuario. Intenta de nuevo.");
        setSubmitting(false);
        return;
      }

      // 6. Mark invite as used
      if (REGISTRATION_MODE === "invite_only") {
        await supabase
          .from("invitations")
          .update({ used_at: new Date().toISOString() })
          .eq("token", inviteCode.trim());
      }

      // 7. Sign in automatically (signUp may not auto-confirm in some configs)
      await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      sessionStorage.setItem("show_splash", "1");
      router.push("/dashboard");
    } catch {
      setGlobalError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── step renderers ──────────────────────────────────────
  function renderStep0() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="usuario@empresa.com"
            style={inputStyle}
          />
          {step1Err.email && <p style={errStyle}>{step1Err.email}</p>}
        </div>

        <div>
          <label style={labelStyle}>Contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              style={{ ...inputStyle, paddingRight: "2.5rem" }}
            />
            <button type="button" onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 0, display: "flex" }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {step1Err.password && <p style={errStyle}>{step1Err.password}</p>}
        </div>

        <div>
          <label style={labelStyle}>Confirmar contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              type={showCpwd ? "text" : "password"}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              style={{ ...inputStyle, paddingRight: "2.5rem" }}
            />
            <button type="button" onClick={() => setShowCpwd((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 0, display: "flex" }}>
              {showCpwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {step1Err.confirmPwd && <p style={errStyle}>{step1Err.confirmPwd}</p>}
        </div>

        {REGISTRATION_MODE === "invite_only" && (
          <div>
            <label style={labelStyle}>Código de invitación</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="xxxx-xxxx-xxxx"
              style={inputStyle}
            />
            {step1Err.inviteCode && <p style={errStyle}>{step1Err.inviteCode}</p>}
          </div>
        )}
      </div>
    );
  }

  function renderStep1() {
    const cardBase: React.CSSProperties = {
      border: "1px solid rgba(255,255,255,.15)",
      borderRadius: "var(--border-radius-lg)",
      padding: "1.25rem 1rem",
      cursor: "pointer",
      transition: "all .15s",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      flex: 1,
    };
    return (
      <>
        <div style={{ display: "flex", gap: "1rem" }}>
          {(["empresa", "personal"] as const).map((t) => {
            const active = orgType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setOrgType(t)}
                style={{
                  ...cardBase,
                  background: active ? "rgba(139,34,82,.3)" : "rgba(255,255,255,.04)",
                  border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,.15)",
                  color: "#fff",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", color: active ? "#fff" : "rgba(255,255,255,.6)" }}>
                  {t === "empresa" ? <Building2 size={40} /> : <User size={40} />}
                </span>
                <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                  {t === "empresa" ? "Empresa" : "Personal"}
                </span>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.5)", lineHeight: 1.4 }}>
                  {t === "empresa"
                    ? "Persona moral, administra múltiples propiedades"
                    : "Persona física, propiedades propias"}
                </span>
              </button>
            );
          })}
        </div>
        {step2Err && (
          <p style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 10 }}>{step2Err}</p>
        )}
      </>
    );
  }

  function renderStep2() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {orgType === "empresa" && (
          <div>
            <label style={labelStyle}>Nombre de la empresa *</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Inmobiliaria XYZ S.A. de C.V." style={inputStyle} />
            {step3Err.companyName && <p style={errStyle}>{step3Err.companyName}</p>}
          </div>
        )}

        <div>
          <label style={labelStyle}>{orgType === "empresa" ? "Tu nombre completo" : "Nombre completo *"}</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Pérez García" style={inputStyle} />
          {step3Err.fullName && <p style={errStyle}>{step3Err.fullName}</p>}
        </div>

        {orgType === "empresa" && (
          <div>
            <label style={labelStyle}>RFC</label>
            <input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} placeholder="XYZ010101ABC" maxLength={13} style={inputStyle} />
          </div>
        )}

        <div>
          <label style={labelStyle}>Teléfono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+52 55 1234 5678" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Dirección / Ciudad</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ciudad de México, CDMX" style={inputStyle} />
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label style={labelStyle}>Nombre corto / pantalla</label>
          <input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder={orgType === "empresa" ? companyName.slice(0, 20) : fullName.split(" ")[0]}
            style={inputStyle}
          />
          {step4Err.shortName
            ? <p style={errStyle}>{step4Err.shortName}</p>
            : <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,.3)", marginTop: 4 }}>Como aparecerá en la plataforma</p>
          }
        </div>

        <div>
          <label style={labelStyle}>Color de marca</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              style={{ width: 44, height: 44, borderRadius: "var(--border-radius-md)", border: "none", background: "none", cursor: "pointer", padding: 0 }}
            />
            <input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#8B2252"
              maxLength={7}
              style={{ ...inputStyle, width: "auto", flex: 1 }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Logo (opcional)</label>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            style={{ display: "none" }}
          />
          {logoPreview ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreview} alt="Logo preview" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: "var(--border-radius-md)", border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.05)" }} />
              <button
                type="button"
                onClick={() => { setLogoFile(null); setLogoPreview(""); }}
                style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: "#E24B4A", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: ".6rem 1rem", background: "rgba(255,255,255,.06)", border: "1px dashed rgba(255,255,255,.2)", borderRadius: "var(--border-radius-md)", color: "rgba(255,255,255,.5)", fontSize: "0.8125rem", cursor: "pointer" }}
            >
              <Upload size={14} />
              Subir logo
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderStep4() {
    const compName = orgType === "empresa" ? companyName : fullName;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", alignItems: "center", textAlign: "center", padding: "0.5rem 0" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: `${brandColor}33`,
            border: `2px solid ${brandColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.75rem",
          }}
        >
          {logoPreview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoPreview} alt="" style={{ width: 52, height: 52, objectFit: "contain", borderRadius: "var(--border-radius-sm)" }} />
            : orgType === "empresa" ? <Building2 size={32} color="#fff" /> : <User size={32} color="#fff" />}
        </div>

        <div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>{shortName || compName}</div>
          <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,.4)", marginTop: 4 }}>{email}</div>
        </div>

        <div style={{ width: "100%", background: "rgba(255,255,255,.05)", borderRadius: "var(--border-radius-md)", padding: "1rem", display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
          {[
            { label: "Tipo", value: orgType === "empresa" ? "Empresa" : "Personal" },
            { label: "Nombre", value: compName },
            orgType === "empresa" && rfc ? { label: "RFC", value: rfc } : null,
            phone ? { label: "Teléfono", value: phone } : null,
            { label: "Color", value: brandColor },
          ].filter(Boolean).map((row) => row && (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
              <span style={{ color: "rgba(255,255,255,.4)" }}>{row.label}</span>
              <span style={{ color: "#fff", fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.3)", lineHeight: 1.5 }}>
          Al crear tu cuenta aceptas los términos de uso de SAPROA.
        </p>
      </div>
    );
  }

  // ─── step content map ────────────────────────────────────
  const stepContent = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];
  const isLast = step === STEPS.length - 1;
  const cardMaxWidth = step === 1 ? 480 : 420;

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
        overflowY: "auto",
      }}
    >
      <BgTexture />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.6) 0%, rgba(0,0,0,.2) 100%)", pointerEvents: "none" }} />

      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/login")}
        style={{ position: "fixed", top: "1.5rem", left: "1.5rem", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "rgba(255,255,255,.7)", borderRadius: "var(--border-radius-xl)", padding: ".4rem 1rem", fontSize: "0.75rem", cursor: "pointer", zIndex: 10 }}
      >
        ← Iniciar sesión
      </button>

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "rgba(255,255,255,.06)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: "var(--border-radius-xl)",
          padding: "2rem 1.75rem",
          width: "100%",
          maxWidth: cardMaxWidth,
          boxShadow: "0 8px 40px rgba(0,0,0,.4)",
          transition: "max-width .2s",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
            <Image src="/brands/saproa/saproa-stacked-dark.png" alt="SAPROA" width={100} height={100} style={{ objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff" }}>Crear cuenta</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "1.75rem" }}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={s.key}
                style={{
                  width: active ? 28 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: done ? "var(--accent)" : active ? "var(--accent)" : "rgba(255,255,255,.2)",
                  opacity: active ? 1 : done ? 0.7 : 0.4,
                  transition: "all .2s",
                }}
              />
            );
          })}
        </div>

        {/* Step label */}
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "rgba(255,255,255,.6)", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--accent)" }}>Paso {step + 1} de {STEPS.length}</span>
          <span style={{ color: "rgba(255,255,255,.2)" }}>—</span>
          <span>{STEPS[step].label}</span>
        </div>

        {/* Step content */}
        {stepContent[step]()}

        {/* Global error */}
        {globalError && (
          <div style={{ marginTop: "1rem", background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", borderRadius: "var(--border-radius-md)", padding: ".6rem .9rem", fontSize: "0.8125rem", color: "#fca5a5" }}>
            {globalError}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem", gap: 10 }}>
          {step > 0 ? (
            <button
              type="button"
              onClick={prevStep}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: ".65rem 1.1rem", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: "var(--border-radius-md)", color: "rgba(255,255,255,.7)", fontSize: "0.875rem", cursor: "pointer" }}
            >
              <ArrowLeft size={15} /> Atrás
            </button>
          ) : <span />}

          {isLast ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: ".75rem", background: submitting ? "rgba(139,34,82,.5)" : "var(--accent)", border: "none", borderRadius: "var(--border-radius-md)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
            >
              {submitting ? "Creando cuenta..." : (
                <><CheckCircle size={15} /> Crear cuenta</>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              disabled={validatingToken}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: ".75rem", background: validatingToken ? "rgba(139,34,82,.5)" : "var(--accent)", border: "none", borderRadius: "var(--border-radius-md)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: validatingToken ? "not-allowed" : "pointer" }}
            >
              {validatingToken ? "Verificando..." : <>{" "}Continuar <ArrowRight size={15} /></>}
            </button>
          )}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 2, marginTop: "1.5rem", fontSize: "0.6875rem", color: "rgba(255,255,255,.25)", letterSpacing: 1 }}>
        SAPROA © {new Date().getFullYear()}
      </div>
    </div>
  );
}
