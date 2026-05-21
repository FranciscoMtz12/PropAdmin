import { notFound } from "next/navigation";
import {
  Bath, BedDouble, Box, Building2, Droplets,
  Flame, Hash, MapPin, Package, Ruler, Shirt,
  Snowflake, Wifi, Wind, Zap,
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import CopyLinkButton from "./CopyLinkButton";

/* ─── constants ─────────────────────────────────────────────────────── */

const ASSET_LABELS: Record<string, string> = {
  MINISPLIT:  "Minisplit",
  CENTRAL_AC: "A/C Central",
  BOILER:     "Boiler",
  FRIDGE:     "Refrigerador",
  WASHER:     "Lavadora",
  DRYER:      "Secadora",
  STOVE:      "Estufa",
  FAN:        "Abanico",
  OTHER:      "Equipo",
};

type ServiceKey = "electricity" | "water" | "gas" | "internet";

const SERVICE_INFO: Record<ServiceKey, { label: string; Icon: React.ElementType }> = {
  electricity: { label: "Electricidad", Icon: Zap      },
  water:       { label: "Agua",         Icon: Droplets },
  gas:         { label: "Gas",          Icon: Flame    },
  internet:    { label: "Internet",     Icon: Wifi     },
};

/* ─── helpers ───────────────────────────────────────────────────────── */

function assetIcon(type: string) {
  const s = 20;
  switch ((type || "").toUpperCase()) {
    case "MINISPLIT":  return <Snowflake size={s} />;
    case "CENTRAL_AC": return <Wind      size={s} />;
    case "BOILER":     return <Flame     size={s} />;
    case "FRIDGE":     return <Box       size={s} />;
    case "WASHER":     return <Droplets  size={s} />;
    case "DRYER":      return <Shirt     size={s} />;
    case "STOVE":      return <Flame     size={s} />;
    case "FAN":        return <Wind      size={s} />;
    default:           return <Package   size={s} />;
  }
}

function cleanPhone(raw: string) {
  return (raw || "").replace(/\D/g, "");
}

/* ─── page ──────────────────────────────────────────────────────────── */

export default async function PublicUnitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  /* 1 — resolve token ------------------------------------------------- */
  const { data: shareToken } = await supabaseAdmin
    .from("unit_share_tokens")
    .select("unit_id, company_id")
    .eq("token", token)
    .eq("active", true)
    .single();

  if (!shareToken) notFound();

  /* 2 — unit + company in parallel ------------------------------------ */
  const [unitRes, companyRes] = await Promise.all([
    supabaseAdmin
      .from("units")
      .select("id, unit_number, display_code, floor, status, sqm, bedrooms, bathrooms, unit_type_id, building_id, company_id")
      .eq("id", shareToken.unit_id)
      .is("deleted_at", null)
      .single(),
    supabaseAdmin
      .from("companies")
      .select("name, logo_url, brand_color, phone, admin_contact_phone")
      .eq("id", shareToken.company_id)
      .single(),
  ]);

  const unit    = unitRes.data;
  const company = companyRes.data;

  if (!unit) notFound();

  /* 3 — building + photos + equipment + services ---------------------- */
  const [buildingRes, photosRes, equipmentRes, servicesRes] = await Promise.all([
    supabaseAdmin
      .from("buildings")
      .select("id, name, address")
      .eq("id", unit.building_id)
      .single(),

    supabaseAdmin
      .from("building_files")
      .select("id, public_url, is_cover, sort_order")
      .eq("building_id", unit.building_id)
      .eq("file_type", "image")
      .is("deleted_at", null)
      .order("is_cover", { ascending: false })
      .order("sort_order",  { ascending: true })
      .limit(6),

    unit.unit_type_id
      ? supabaseAdmin
          .from("unit_type_assets")
          .select("id, asset_type, name")
          .eq("unit_type_id", unit.unit_type_id)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
      : supabaseAdmin
          .from("assets")
          .select("id, asset_type, name")
          .eq("unit_id", unit.id)
          .is("deleted_at", null),

    supabaseAdmin
      .from("building_utility_meters")
      .select("id, service_type")
      .eq("building_id", unit.building_id)
      .eq("active", true)
      .is("deleted_at", null),
  ]);

  const building  = buildingRes.data;
  const photos    = (photosRes.data   || []) as Array<{ id: string; public_url: string | null; is_cover: boolean | null; sort_order: number | null }>;
  const equipment = (equipmentRes.data || []) as Array<{ id: string; asset_type: string; name: string }>;
  const allSvcs   = (servicesRes.data  || []) as Array<{ id: string; service_type: string }>;

  /* derived ----------------------------------------------------------- */
  const coverPhoto    = photos.find(p => p.is_cover) ?? photos[0];
  const nonCover      = photos.filter(p => p.id !== coverPhoto?.id);
  const galleryPhotos = nonCover.slice(0, 4);
  const extraCount    = Math.max(0, nonCover.length - galleryPhotos.length);

  const isAvailable = ["VACANT", "AVAILABLE"].includes((unit.status || "").toUpperCase());
  const unitDisplay = unit.display_code?.trim() || unit.unit_number;
  const accent      = company?.brand_color?.trim() || "#1a56db";

  const waPhone     = cleanPhone(company?.admin_contact_phone || company?.phone || "");
  const waMsg       = encodeURIComponent(
    `Hola, vi la ficha de ${unitDisplay} en ${building?.name ?? "el edificio"} y me interesa más información.`
  );
  const shareUrl = `https://saproa.com/p/${token}`;

  // deduplicate services and filter to known types
  const uniqueServices = allSvcs.filter(
    (s, i, arr) => arr.findIndex(x => x.service_type === s.service_type) === i
  );

  /* ── render ─────────────────────────────────────────────────────────── */

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", paddingBottom: 100 }}>

      {/* ── Company header ─────────────────────────────────────────── */}
      <header style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border-default)",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        {company?.logo_url ? (
          <img src={company.logo_url} alt={company.name ?? "Logo"} style={{ height: 30, objectFit: "contain" }} />
        ) : (
          <span style={{ fontWeight: 800, fontSize: 16, color: accent }}>{company?.name ?? "SAPROA"}</span>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", width: "100%", background: "var(--bg-page)", overflow: "hidden", maxHeight: 420 }}>
        {coverPhoto?.public_url ? (
          <img
            src={coverPhoto.public_url}
            alt="Foto principal"
            style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
          }}>
            <Building2 size={72} style={{ color: "rgba(255,255,255,0.35)" }} />
          </div>
        )}

        {/* Status badge */}
        <span style={{
          position: "absolute",
          top: 14,
          right: 14,
          background: isAvailable ? "#10B981" : "#EF4444",
          color: "#fff",
          fontWeight: 700,
          fontSize: 13,
          padding: "5px 13px",
          borderRadius: 999,
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        }}>
          {isAvailable ? "Disponible" : "Ocupado"}
        </span>
      </div>

      {/* ── Gallery strip ───────────────────────────────────────────── */}
      {galleryPhotos.length > 0 && (
        <div style={{
          display: "flex",
          gap: 3,
          background: "#000",
          overflowX: "auto",
        }}>
          {galleryPhotos.map((photo, idx) => {
            const isLastAndMore = idx === galleryPhotos.length - 1 && extraCount > 0;
            return (
              <div key={photo.id} style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={photo.public_url ?? ""}
                  alt={`Foto ${idx + 2}`}
                  style={{ width: 90, height: 64, objectFit: "cover", display: "block", opacity: isLastAndMore ? 0.5 : 1 }}
                />
                {isLastAndMore && (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.35)",
                    color: "#fff", fontWeight: 700, fontSize: 13,
                  }}>
                    +{extraCount} fotos
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>

        {/* Unit header card */}
        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", marginTop: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
                {unitDisplay}
              </h1>
              {building && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 14 }}>
                  <MapPin size={14} style={{ flexShrink: 0 }} />
                  <span>{building.name}{building.address ? ` · ${building.address}` : ""}</span>
                </div>
              )}
            </div>
            <CopyLinkButton url={shareUrl} />
          </div>

          {/* Tags row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(unit.bedrooms != null && unit.bedrooms > 0) && (
              <Tag icon={<BedDouble size={14} />} label={`${unit.bedrooms} rec.`} />
            )}
            {(unit.bathrooms != null && unit.bathrooms > 0) && (
              <Tag icon={<Bath size={14} />} label={`${unit.bathrooms} baño${unit.bathrooms !== 1 ? "s" : ""}`} />
            )}
            {unit.sqm ? (
              <Tag icon={<Ruler size={14} />} label={`${unit.sqm} m²`} />
            ) : null}
            {unit.floor != null ? (
              <Tag icon={<Hash size={14} />} label={`Piso ${unit.floor}`} />
            ) : null}
          </div>
        </div>

        {/* Equipment */}
        {equipment.length > 0 && (
          <Section title="Lo que incluye">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 10 }}>
              {equipment.map(item => (
                <div key={item.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}>
                  <span style={{ color: accent, flexShrink: 0 }}>{assetIcon(item.asset_type)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", lineHeight: 1.3 }}>
                    {item.name || ASSET_LABELS[(item.asset_type || "").toUpperCase()] || item.asset_type}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Services */}
        {uniqueServices.length > 0 && (
          <Section title="Servicios disponibles">
            <div>
              {uniqueServices.map(svc => {
                const key = (svc.service_type || "").toLowerCase() as ServiceKey;
                const info = SERVICE_INFO[key] ?? { label: svc.service_type, Icon: Package };
                const { Icon } = info;
                return (
                  <div key={svc.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 0",
                    borderBottom: "1px solid var(--border-subtle, var(--border-default))",
                  }}>
                    <span style={{ color: accent, flexShrink: 0 }}><Icon size={18} /></span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>{info.label}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Building */}
        {building && (
          <Section title="Sobre el edificio">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "var(--bg-page)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Building2 size={22} style={{ color: "var(--text-muted)" }} />
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{building.name}</p>
                {building.address && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{building.address}</p>
                )}
              </div>
            </div>
          </Section>
        )}

      </div>

      {/* ── Fixed CTA ───────────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border-default)",
        padding: "12px 20px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        zIndex: 20,
      }}>
        {waPhone ? (
          <a
            href={`https://wa.me/${waPhone}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              width: "100%",
              maxWidth: 480,
              textAlign: "center",
              background: "#25D366",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
              borderRadius: 12,
              padding: "14px 20px",
              boxShadow: "0 4px 14px rgba(37,211,102,0.3)",
            }}
          >
            Contactar por WhatsApp
          </a>
        ) : (
          <div style={{
            width: "100%", maxWidth: 480,
            background: "var(--bg-page)", borderRadius: 12, padding: "14px 20px",
            textAlign: "center", fontSize: 14, color: "var(--text-muted)",
          }}>
            Sin contacto disponible
          </div>
        )}
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
          Impulsado por SAPROA
        </span>
      </div>
    </div>
  );
}

/* ─── small reusable server pieces ──────────────────────────────────── */

function Tag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: "var(--bg-page)",
      border: "1px solid var(--border-default)",
      borderRadius: 8,
      padding: "5px 10px",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-secondary)",
    }}>
      {icon}
      {label}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-card)",
      borderRadius: 16,
      padding: "20px",
      marginTop: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
      {children}
    </div>
  );
}
