import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Aviso de Privacidad — SAPROA",
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0d1b2a 0%, #1c3a5e 60%, #0d1b2a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "var(--font-sans, sans-serif)",
        padding: "2rem 1rem 3rem",
        position: "relative",
      }}
    >
      {/* Textura de fondo */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }}
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="pp" x="0" y="0" width="110" height="110" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
            <g fill="none" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="8" width="18" height="24" /><rect x="11" y="12" width="4" height="5" />
              <rect x="19" y="12" width="4" height="5" /><rect x="11" y="20" width="4" height="5" />
              <rect x="19" y="20" width="4" height="5" /><rect x="14" y="27" width="6" height="5" />
              <circle cx="55" cy="16" r="6" /><line x1="61" y1="16" x2="75" y2="16" />
              <line x1="72" y1="16" x2="72" y2="21" /><line x1="67" y1="16" x2="67" y2="20" />
            </g>
          </pattern>
        </defs>
        <rect width="400" height="600" fill="url(#pp)" />
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.5) 0%, rgba(0,0,0,.15) 100%)", pointerEvents: "none" }} />

      {/* Botón volver */}
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 800, marginBottom: "1rem" }}>
        <Link
          href="/login"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)",
            color: "rgba(255,255,255,.75)", borderRadius: "var(--border-radius-xl)",
            padding: ".5rem 1rem", fontSize: "0.75rem", textDecoration: "none",
            minHeight: 44,
          }}
        >
          ← Volver
        </Link>
      </div>

      {/* Card principal */}
      <div
        style={{
          position: "relative", zIndex: 2,
          background: "rgba(255,255,255,.06)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,.12)", borderRadius: "var(--border-radius-xl)",
          padding: "2.5rem 2rem", width: "100%", maxWidth: 800,
          boxShadow: "0 8px 40px rgba(0,0,0,.4)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
          <Image src="/brands/saproa/saproa-stacked-dark.png" alt="SAPROA" width={100} height={100} style={{ objectFit: "contain" }} />
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.25rem", textAlign: "center" }}>
          Aviso de Privacidad
        </h1>
        <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "rgba(255,255,255,.4)", marginBottom: "2rem" }}>
          Última actualización: Mayo 2026
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", color: "rgba(255,255,255,.8)", fontSize: "0.875rem", lineHeight: 1.7 }}>

          <Section title="1. Responsable del tratamiento de datos personales">
            <p>
              <strong style={{ color: "#fff" }}>Inmuebles y Desarrollos Fra Mar S.A. de C.V.</strong>, en adelante "Fra-Mar", con domicilio en México, es responsable del tratamiento de sus datos personales recabados a través de la plataforma SAPROA.
            </p>
            <p style={{ marginTop: 8 }}>
              Para cualquier consulta o ejercicio de derechos, puede contactarnos en: <a href="mailto:contacto@fra-mar.mx" style={{ color: "var(--accent, #8B2252)" }}>contacto@fra-mar.mx</a>
            </p>
          </Section>

          <Section title="2. Datos personales que recabamos">
            <p>Recabamos los siguientes datos personales para las finalidades descritas en este aviso:</p>
            <ul style={{ paddingLeft: "1.25rem", marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Nombre completo y razón social</li>
              <li>Correo electrónico</li>
              <li>Número de teléfono</li>
              <li>RFC (Registro Federal de Contribuyentes)</li>
              <li>Dirección postal</li>
              <li>Datos del arrendamiento (inmueble, contrato, pagos, historial)</li>
              <li>Datos de facturación fiscal</li>
            </ul>
            <p style={{ marginTop: 8 }}>
              No recabamos datos personales sensibles (según la definición de la LFPDPPP).
            </p>
          </Section>

          <Section title="3. Finalidades del tratamiento">
            <p>Sus datos personales serán utilizados para las siguientes finalidades primarias:</p>
            <ul style={{ paddingLeft: "1.25rem", marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Administración y gestión de contratos de arrendamiento</li>
              <li>Cobranza y seguimiento de pagos de renta y servicios</li>
              <li>Mantenimiento y atención de reportes en los inmuebles</li>
              <li>Comunicación con inquilinos y proveedores de servicios</li>
              <li>Generación de documentos y facturas electrónicas (CFDI)</li>
              <li>Cumplimiento de obligaciones fiscales y legales</li>
            </ul>
            <p style={{ marginTop: 8 }}>
              Finalidades secundarias (usted puede oponerse a estas sin que afecte la relación contractual):
            </p>
            <ul style={{ paddingLeft: "1.25rem", marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Envío de comunicaciones informativas y avisos sobre el inmueble</li>
              <li>Evaluación de satisfacción de los servicios prestados</li>
            </ul>
          </Section>

          <Section title="4. Transferencia de datos personales">
            <p>
              Fra-Mar no transfiere sus datos personales a terceros sin su consentimiento previo, salvo en los casos previstos en el artículo 37 de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), incluyendo el cumplimiento de obligaciones legales o requerimientos de autoridades competentes.
            </p>
          </Section>

          <Section title="5. Derechos ARCO">
            <p>
              Usted tiene derecho a <strong style={{ color: "#fff" }}>Acceder, Rectificar, Cancelar u Oponerse</strong> (derechos ARCO) al tratamiento de sus datos personales. Para ejercer estos derechos, envíe una solicitud a:
            </p>
            <p style={{ marginTop: 8 }}>
              <a href="mailto:contacto@fra-mar.mx" style={{ color: "var(--accent, #8B2252)" }}>contacto@fra-mar.mx</a>
            </p>
            <p style={{ marginTop: 8 }}>
              La solicitud debe incluir: nombre completo, correo electrónico registrado, descripción clara del derecho que desea ejercer y, en su caso, los documentos que acrediten su identidad. Daremos respuesta en un plazo máximo de 20 días hábiles.
            </p>
          </Section>

          <Section title="6. Uso de cookies">
            <p>
              SAPROA utiliza cookies de sesión estrictamente necesarias para el funcionamiento de la autenticación y la seguridad de la plataforma. No se utilizan cookies de rastreo publicitario ni de análisis de comportamiento de terceros.
            </p>
            <p style={{ marginTop: 8 }}>
              Puede configurar su navegador para rechazar cookies; sin embargo, esto puede afectar la funcionalidad de inicio de sesión.
            </p>
          </Section>

          <Section title="7. Cambios al aviso de privacidad">
            <p>
              Fra-Mar se reserva el derecho de modificar este aviso de privacidad en cualquier momento. Los cambios serán notificados a través del correo electrónico registrado en la plataforma o mediante un aviso visible dentro de SAPROA al iniciar sesión.
            </p>
          </Section>

          <Section title="8. Contacto">
            <p>
              Para cualquier duda o comentario sobre el tratamiento de sus datos personales, puede contactarnos en:<br />
              <a href="mailto:contacto@fra-mar.mx" style={{ color: "var(--accent, #8B2252)" }}>contacto@fra-mar.mx</a>
            </p>
          </Section>

        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "relative", zIndex: 2, marginTop: "1.5rem", fontSize: "0.6875rem", color: "rgba(255,255,255,.25)", letterSpacing: 1, display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <span>© {new Date().getFullYear()} SAPROA</span>
        <span>·</span>
        <Link href="/privacy" style={{ color: "rgba(255,255,255,.35)", textDecoration: "none" }}>Aviso de privacidad</Link>
        <span>·</span>
        <Link href="/terms" style={{ color: "rgba(255,255,255,.35)", textDecoration: "none" }}>Términos y condiciones</Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,.1)", paddingBottom: "0.5rem" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
