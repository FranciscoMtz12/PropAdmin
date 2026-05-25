"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Calendar, Coins, LogOut, Wrench } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { type QuickLink, ICON_MAP, getAllowedModules, getDefaultQuickLinks } from "@/lib/quick-links";

/* ─── Color utilities ─────────────────────────────────────────────────── */

function hexToHsl(hex: string): [number, number, number] {
  const c = hex.replace(/^#/, "");
  if (c.length !== 6) return [336, 55, 34];
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100, hn = h / 360;
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue = (t: number) => {
    const tt = ((t % 1) + 1) % 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const toH = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toH(hue(hn + 1 / 3))}${toH(hue(hn))}${toH(hue(hn - 1 / 3))}`;
}

function darkBgColors(brandHex: string): [string, string, string] {
  const [h, s] = hexToHsl(brandHex);
  const sat = Math.min(s * 0.85, 65);
  return [hslToHex(h, sat, 12), hslToHex(h, sat, 7), hslToHex(h, sat, 3)];
}

function lightAccent(brandHex: string): string {
  const [h, s] = hexToHsl(brandHex);
  return hslToHex(h, Math.max(s * 0.7, 30), 78);
}

/* ─── Greetings ───────────────────────────────────────────────────────── */

const TEMPLATES = {
  morning: [
    "Buenos días, {name}. ¿Listo para el día?",
    "Buen día, {name}. Aquí está tu resumen.",
    "Buenos días, {name}. Esto te espera hoy.",
    "Hola, {name}. Empecemos bien el día.",
  ],
  afternoon: [
    "Buenas tardes, {name}. ¿Cómo va el día?",
    "Buenas tardes, {name}. Aquí el resumen de la tarde.",
    "Hola de nuevo, {name}. Así va {company}.",
    "Buenas tardes, {name}. Sigamos adelante.",
  ],
  night: [
    "Buenas noches, {name}. Un último vistazo antes de cerrar.",
    "Buenas noches, {name}. Así terminó el día.",
    "Hola, {name}. Revisando antes de salir.",
    "Buenas noches, {name}. Aquí el cierre del día.",
  ],
};

function timeBlock(h: number): "morning" | "afternoon" | "night" {
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 19) return "afternoon";
  return "night";
}

/* ─── Types ───────────────────────────────────────────────────────────── */

type Metrics = {
  cobrosPendientes: number;
  cobrosVencidos: number;
  cobrosDeuda: number;
  ticketsAbiertos: number;
  ticketsUrgentes: number;
  contratosVenciendo: number;
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", minimumFractionDigits: 0,
  }).format(n);
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "U";
}

/* ─── Animation variants ──────────────────────────────────────────────── */

const E = [0.16, 1, 0.3, 1] as const;

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: E, delay } },
});

const cardsStagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } },
};

const linksStagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.85 } },
};

const itemVariant = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: E } },
};

/* ─── Main component ──────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { accentColor, logoUrl, shortName } = useTheme();
  const { isRealSuperAdmin, isImpersonating } = useImpersonation();

  const [now, setNow] = useState(() => new Date());
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [windowWidth, setWindowWidth] = useState(1280);
  const [logoutHover, setLogoutHover] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const check = () => setWindowWidth(window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (isRealSuperAdmin && !isImpersonating) { router.replace("/saproa-admin/overview"); return; }
  }, [loading, user, isRealSuperAdmin, isImpersonating, router]);

  useEffect(() => {
    if (!user?.company_id) return;
    void fetchMetrics(user.company_id);
  }, [user?.company_id]);

  useEffect(() => {
    if (!user?.id) return;
    void fetchQuickLinks(user.id, (user as { role?: string }).role ?? "");
  }, [user?.id]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function fetchMetrics(cid: string) {
    const today = new Date().toISOString().slice(0, 10);
    const in60 = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

    const [cobrosRes, ticketsRes, contratosRes] = await Promise.all([
      supabase
        .from("collection_records")
        .select("status, amount_due, amount_collected")
        .in("status", ["pending", "partial", "overdue"])
        .eq("company_id", cid)
        .is("deleted_at", null),
      supabase
        .from("maintenance_logs")
        .select("priority")
        .not("status", "in", "(DONE,CANCELLED)")
        .eq("company_id", cid)
        .is("deleted_at", null),
      supabase
        .from("leases")
        .select("id", { count: "exact", head: true })
        .eq("status", "ACTIVE")
        .eq("company_id", cid)
        .is("deleted_at", null)
        .gte("end_date", today)
        .lte("end_date", in60),
    ]);

    const cobros = (cobrosRes.data ?? []) as { status: string; amount_due: number; amount_collected: number | null }[];
    const tickets = (ticketsRes.data ?? []) as { priority: string }[];

    setMetrics({
      cobrosPendientes: cobros.length,
      cobrosVencidos: cobros.filter(r => r.status === "overdue").length,
      cobrosDeuda: cobros.reduce((acc, r) => acc + r.amount_due - (r.amount_collected ?? 0), 0),
      ticketsAbiertos: tickets.length,
      ticketsUrgentes: tickets.filter(r => r.priority === "urgent").length,
      contratosVenciendo: contratosRes.count ?? 0,
    });
  }

  async function fetchQuickLinks(uid: string, role: string) {
    const { data } = await supabase
      .from("user_preferences")
      .select("quick_links")
      .eq("user_id", uid)
      .maybeSingle();
    const stored = data?.quick_links;
    const allowedPaths = new Set([...getAllowedModules(role).map(m => m.path), "/dashboard"]);
    const raw: QuickLink[] = (stored && Array.isArray(stored) && stored.length > 0)
      ? (stored as QuickLink[])
      : getDefaultQuickLinks(role);
    setQuickLinks(raw.filter(l => allowedPaths.has(l.path)));
  }

  /* Computed */
  const [c1, c2, c3] = useMemo(() => darkBgColors(accentColor), [accentColor]);
  const nameColor = useMemo(() => lightAccent(accentColor), [accentColor]);

  const block = timeBlock(now.getHours());
  const firstName = (user?.full_name || "").split(" ")[0] || "Usuario";
  const company = shortName || "la empresa";
  const greetingIdx = useMemo(() => Math.floor(Math.random() * 4), []);
  const rawTemplate = TEMPLATES[block][greetingIdx].replace("{company}", company);
  const [greetBefore, greetAfter] = rawTemplate.split("{name}");

  const dateStr = now
    .toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" })
    .toUpperCase();

  const logoInitials = initials(shortName || company);
  const userInitials = initials(user?.full_name || "");

  const DASHBOARD_LINK: QuickLink = { label: "Dashboard", icon: "ti-layout-dashboard", path: "/dashboard" };
  const displayLinks = [DASHBOARD_LINK, ...quickLinks.filter(l => l.path !== "/dashboard")];
  const links1 = displayLinks.slice(0, 4);
  const links2 = displayLinks.slice(4, 7);
  const ticketsNormales = (metrics?.ticketsAbiertos ?? 0) - (metrics?.ticketsUrgentes ?? 0);

  const isSmall = windowWidth < 768;
  const isLarge = windowWidth >= 1280;

  /* Loading state — dark bg before user loads */
  if (loading) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "linear-gradient(135deg, #2d0d1f 0%, #1a0812 45%, #0d0508 100%)",
        }}
      />
    );
  }
  if (!user) return null;

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflowY: "auto",
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 45%, ${c3} 100%)`,
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Orb arriba-derecha */}
      <div
        style={{
          position: "fixed", top: -80, right: -80,
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}4D 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Orb abajo-izquierda */}
      <div
        style={{
          position: "fixed", bottom: -100, left: -100,
          width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}26 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Grid de líneas */}
      <div
        style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          backgroundImage: [
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 60px)",
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 60px)",
          ].join(","),
        }}
      />

      {/* Textura de fondo */}
      <svg
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          opacity: 0.03, pointerEvents: "none",
        }}
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="hptx" x="0" y="0" width="110" height="110" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
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
        <rect width="400" height="600" fill="url(#hptx)" />
      </svg>

      {/* ── Contenido ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: isSmall ? "100%" : isLarge ? 1100 : 900,
          margin: "0 auto",
          padding: isSmall ? "24px 16px 48px" : isLarge ? "40px 64px 56px" : "40px 48px 64px",
          height: isLarge ? "100dvh" : undefined,
          minHeight: isLarge ? undefined : "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: isLarge ? "space-between" : undefined,
          gap: isSmall ? 32 : isLarge ? 0 : 44,
          boxSizing: "border-box",
        }}
      >
        {/* ── Topbar ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Logo empresa */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={shortName || "Logo"}
              style={{ height: 44, objectFit: "contain", filter: "brightness(0) invert(1)", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 44, height: 44,
                borderRadius: 12,
                background: accentColor,
                display: "grid", placeItems: "center",
                color: "#fff", fontSize: 15, fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {logoInitials}
            </div>
          )}

          {/* Usuario */}
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.05)",
              border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: 100,
              padding: "5px 14px 5px 6px",
            }}
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: accentColor,
                display: "grid", placeItems: "center",
                color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}
            >
              {userInitials}
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>
              {user.full_name || user.email}
            </span>
          </div>
        </div>

        {/* ── Greeting ────────────────────────────────────────────── */}
        <div style={{ maxWidth: 640 }}>
          <motion.p
            {...fadeUp(0.05)}
            style={{
              margin: "0 0 10px",
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
            }}
          >
            {dateStr}
          </motion.p>

          <motion.h1
            {...fadeUp(0.15)}
            style={{
              margin: "0 0 8px",
              fontSize: isSmall ? 28 : isLarge ? 42 : 36,
              fontWeight: 500,
              color: "#fff",
              lineHeight: 1.25,
            }}
          >
            {greetBefore}
            <span style={{ color: nameColor }}>{firstName}</span>
            {greetAfter}
          </motion.h1>

          <motion.p
            {...fadeUp(0.25)}
            style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.35)" }}
          >
            Aquí está el resumen de {company} para hoy.
          </motion.p>
        </div>

        {/* ── Metric cards ────────────────────────────────────────── */}
        <motion.div
          variants={cardsStagger}
          initial="initial"
          animate="animate"
          style={{
            display: "grid",
            gridTemplateColumns: isSmall ? "1fr" : "repeat(3, 1fr)",
            gap: 14,
          }}
        >
          {/* Cobros pendientes */}
          <motion.div variants={itemVariant} style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "clamp(10px, 1.5vw, 20px)" }}>
              <IconBox bg="rgba(226,75,74,0.18)"><Coins style={{ width: "clamp(18px, 2vw, 28px)", height: "clamp(18px, 2vw, 28px)" }} color="#f87171" /></IconBox>
              {(metrics?.cobrosVencidos ?? 0) > 0 && (
                <Badge bg="rgba(239,68,68,0.2)" color="#f87171">{metrics!.cobrosVencidos} vencidos</Badge>
              )}
            </div>
            <div style={BIG_VAL}>{metrics?.cobrosPendientes ?? "—"}</div>
            <div style={CARD_LABEL}>Cobros pendientes</div>
            {metrics && (
              <div style={CARD_DETAIL}>{fmtMXN(metrics.cobrosDeuda)} por cobrar</div>
            )}
            {(metrics?.cobrosVencidos ?? 0) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
                <AlertCircle style={{ width: "clamp(11px, 1vw, 14px)", height: "clamp(11px, 1vw, 14px)" }} color="#f87171" />
                <span style={{ fontSize: "clamp(11px, 1vw, 14px)", color: "#f87171" }}>Requiere atención</span>
              </div>
            )}
          </motion.div>

          {/* Tickets abiertos */}
          <motion.div variants={itemVariant} style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "clamp(10px, 1.5vw, 20px)" }}>
              <IconBox bg="rgba(239,159,39,0.18)"><Wrench style={{ width: "clamp(18px, 2vw, 28px)", height: "clamp(18px, 2vw, 28px)" }} color="#fbbf24" /></IconBox>
              {(metrics?.ticketsUrgentes ?? 0) > 0 && (
                <Badge bg="rgba(245,158,11,0.2)" color="#fbbf24">{metrics!.ticketsUrgentes} urgentes</Badge>
              )}
            </div>
            <div style={BIG_VAL}>{metrics?.ticketsAbiertos ?? "—"}</div>
            <div style={CARD_LABEL}>Tickets abiertos</div>
            {metrics && (
              <div style={CARD_DETAIL}>{metrics.ticketsUrgentes} urgentes · {ticketsNormales} normales</div>
            )}
          </motion.div>

          {/* Contratos por vencer */}
          <motion.div variants={itemVariant} style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "clamp(10px, 1.5vw, 20px)" }}>
              <IconBox bg="rgba(99,102,241,0.18)"><Calendar style={{ width: "clamp(18px, 2vw, 28px)", height: "clamp(18px, 2vw, 28px)" }} color="#a5b4fc" /></IconBox>
              <Badge bg="rgba(99,102,241,0.2)" color="#a5b4fc">próximos 60 días</Badge>
            </div>
            <div style={BIG_VAL}>{metrics?.contratosVenciendo ?? "—"}</div>
            <div style={CARD_LABEL}>Contratos por vencer</div>
            <div style={CARD_DETAIL}>Requieren renovación pronto</div>
          </motion.div>
        </motion.div>

        {/* ── Accesos rápidos ──────────────────────────────────────── */}
        {displayLinks.length > 0 && (
          <motion.div
            variants={linksStagger}
            initial="initial"
            animate="animate"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {isSmall ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
                {displayLinks.map(link => (
                  <motion.div key={link.path} variants={itemVariant}>
                    <LinkBtn link={link} onClick={() => router.push(link.customPath || link.path)} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <>
                {links1.length > 0 && (
                  <div style={{ display: "flex", gap: 36, flexWrap: "wrap", justifyContent: "center" }}>
                    {links1.map(link => (
                      <motion.div key={link.path} variants={itemVariant}>
                        <LinkBtn link={link} onClick={() => router.push(link.customPath || link.path)} />
                      </motion.div>
                    ))}
                  </div>
                )}
                {links2.length > 0 && (
                  <div style={{ display: "flex", gap: 36, flexWrap: "wrap", justifyContent: "center", marginLeft: 44 }}>
                    {links2.map(link => (
                      <motion.div key={link.path} variants={itemVariant}>
                        <LinkBtn link={link} onClick={() => router.push(link.customPath || link.path)} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Botón cerrar sesión */}
      <button
        type="button"
        onClick={handleLogout}
        onMouseEnter={() => setLogoutHover(true)}
        onMouseLeave={() => setLogoutHover(false)}
        style={{
          position: "absolute",
          bottom: 24,
          left: 32,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: logoutHover ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
          fontSize: 12,
          cursor: "pointer",
          padding: 0,
          transition: "color 0.15s",
          zIndex: 2,
        }}
      >
        <LogOut size={13} />
        Cerrar sesión
      </button>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────── */

function LinkBtn({ link, onClick }: { link: QuickLink; onClick: () => void }) {
  const Icon = ICON_MAP[link.icon];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "none", border: "none",
        color: "rgba(255,255,255,0.45)",
        fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "2px 0",
      }}
    >
      {Icon && <Icon size={18} />}
      {link.label}
    </button>
  );
}

function IconBox({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "clamp(32px, 3vw, 48px)", height: "clamp(32px, 3vw, 48px)",
        borderRadius: "var(--border-radius-md, 8px)",
        background: bg,
        display: "grid", placeItems: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block", padding: "3px 9px",
        borderRadius: 100, background: bg, color,
        fontSize: "clamp(9px, 0.9vw, 12px)", fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* ─── Style constants (always dark — intentional) ─────────────────────── */

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "var(--border-radius-xl, 16px)",
  padding: "clamp(16px, 2vw, 28px)",
  backdropFilter: "blur(10px)",
};

const BIG_VAL: React.CSSProperties = {
  fontSize: "clamp(32px, 5vw, 64px)", fontWeight: 700, color: "#fff", lineHeight: 1, marginBottom: 6,
};

const CARD_LABEL: React.CSSProperties = {
  fontSize: "clamp(11px, 1.2vw, 16px)", color: "rgba(255,255,255,0.45)", marginBottom: 4,
};

const CARD_DETAIL: React.CSSProperties = {
  fontSize: "clamp(12px, 1vw, 15px)", color: "rgba(255,255,255,0.28)",
};
