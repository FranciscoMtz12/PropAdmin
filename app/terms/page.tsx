import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Términos y Condiciones — SAPROA",
};

export default function TermsPage() {
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
          <pattern id="tp" x="0" y="0" width="110" height="110" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
            <g fill="none" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="8" width="18" height="24" /><rect x="11" y="12" width="4" height="5" />
              <rect x="19" y="12" width="4" height="5" /><rect x="11" y="20" width="4" height="5" />
              <rect x="19" y="20" width="4" height="5" /><rect x="14" y="27" width="6" height="5" />
              <circle cx="55" cy="16" r="6" /><line x1="61" y1="16" x2="75" y2="16" />
              <line x1="72" y1="16" x2="72" y2="21" /><line x1="67" y1="16" x2="67" y2="20" />
            </g>
          </pattern>
        </defs>
        <rect width="400" height="600" fill="url(#tp)" />
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
          Términos y Condiciones
        </h1>
        <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "rgba(255,255,255,.4)", marginBottom: "2rem" }}>
          Última actualización: Mayo 2026
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", color: "rgba(255,255,255,.8)", fontSize: "0.875rem", lineHeight: 1.7 }}>

          <Section title="1. Aceptación de los términos">
            <p>
              Al acceder y utilizar la plataforma SAPROA, usted acepta quedar vinculado por estos Términos y Condiciones, así como por nuestro <Link href="/privacy" style={{ color: "var(--accent, #8B2252)" }}>Aviso de Privacidad</Link>. Si no está de acuerdo con alguno de estos términos, le pedimos que no utilice la plataforma.
            </p>
          </Section>

          <Section title="2. Descripción del servicio">
            <p>
              SAPROA es una plataforma SaaS (Software as a Service) de administración de propiedades desarrollada por <strong style={{ color: "#fff" }}>Inmuebles y Desarrollos Fra Mar S.A. de C.V.</strong> Provee herramientas para la gestión de:
            </p>
            <ul style={{ paddingLeft: "1.25rem", marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Propiedades, unidades y espacios rentables</li>
              <li>Contratos de arrendamiento e inquilinos</li>
              <li>Cobranza, pagos y estados de cuenta</li>
              <li>Mantenimiento preventivo y correctivo</li>
              <li>Proveedores y servicios</li>
              <li>Documentación y facturación electrónica</li>
            </ul>
          </Section>

          <Section title="3. Uso permitido">
            <p>El acceso a SAPROA es exclusivo para usuarios autorizados por Fra-Mar. El uso permitido incluye:</p>
            <ul style={{ paddingLeft: "1.25rem", marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Gestión de propiedades propias o bajo administración autorizada</li>
              <li>Consulta y registro de información relacionada con contratos vigentes</li>
              <li>Comunicación interna entre administradores e inquilinos a través del portal</li>
              <li>Generación de reportes y documentos relacionados con los inmuebles</li>
            </ul>
          </Section>

          <Section title="4. Conductas prohibidas">
            <p>Está estrictamente prohibido:</p>
            <ul style={{ paddingLeft: "1.25rem", marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Usar la plataforma con fines fraudulentos o ilegales</li>
              <li>Compartir credenciales de acceso con terceros no autorizados</li>
              <li>Acceder o intentar acceder a información de otros usuarios o empresas</li>
              <li>Realizar ingeniería inversa, descompilar o modificar el software</li>
              <li>Introducir virus, malware o código malicioso de cualquier tipo</li>
              <li>Sobrecargar o interferir con la infraestructura de la plataforma</li>
            </ul>
            <p style={{ marginTop: 8 }}>
              El incumplimiento de estas prohibiciones puede resultar en la suspensión inmediata del acceso y, en su caso, en acciones legales correspondientes.
            </p>
          </Section>

          <Section title="5. Propiedad intelectual">
            <p>
              SAPROA, su nombre, logotipo, diseño, código fuente y todo el contenido de la plataforma son propiedad exclusiva de Inmuebles y Desarrollos Fra Mar S.A. de C.V. y están protegidos por las leyes de propiedad intelectual aplicables en México.
            </p>
            <p style={{ marginTop: 8 }}>
              Queda prohibida la reproducción, distribución o uso comercial de cualquier elemento de la plataforma sin autorización expresa y por escrito de Fra-Mar.
            </p>
          </Section>

          <Section title="6. Limitación de responsabilidad">
            <p>
              Fra-Mar no será responsable por daños directos, indirectos, incidentales o consecuentes derivados del uso o la imposibilidad de uso de SAPROA, incluyendo pérdida de datos, interrupción del servicio o daños económicos, en la medida permitida por la ley aplicable.
            </p>
            <p style={{ marginTop: 8 }}>
              La plataforma se proporciona "tal como está". Fra-Mar no garantiza que el servicio esté libre de errores o interrupciones, aunque se compromete a mantener altos estándares de disponibilidad y seguridad.
            </p>
          </Section>

          <Section title="7. Modificaciones al servicio">
            <p>
              Fra-Mar se reserva el derecho de modificar, suspender o discontinuar cualquier aspecto de SAPROA en cualquier momento, con o sin previo aviso. Los cambios significativos en los términos serán notificados con al menos 15 días de anticipación por correo electrónico.
            </p>
          </Section>

          <Section title="8. Cuentas y seguridad">
            <p>
              Usted es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades realizadas bajo su cuenta. Notifique inmediatamente a <a href="mailto:contacto@fra-mar.mx" style={{ color: "var(--accent, #8B2252)" }}>contacto@fra-mar.mx</a> ante cualquier uso no autorizado de su cuenta.
            </p>
          </Section>

          <Section title="9. Ley aplicable y jurisdicción">
            <p>
              Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia derivada de su interpretación o cumplimiento será sometida a la jurisdicción de los tribunales competentes de la Ciudad de México, renunciando expresamente a cualquier otro fuero que pudiera corresponder.
            </p>
          </Section>

          <Section title="10. Contacto">
            <p>
              Para cualquier consulta relacionada con estos términos, puede contactarnos en:<br />
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
