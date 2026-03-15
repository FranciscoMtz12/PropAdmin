"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Crumb = {
  href: string;
  label: string;
};

function isUuidLike(segment: string) {
  return /^[0-9a-fA-F-]{8,}$/.test(segment);
}

function humanizeSegment(segment: string) {
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    buildings: "Edificios",
    maintenance: "Mantenimiento",
    payments: "Pagos",
    agenda: "Agenda",
    "unit-types": "Tipologías",
    units: "Departamentos",
    assets: "Assets",
    schedules: "Programaciones",
    calendar: "Calendario",
    "work-orders": "Órdenes de trabajo",
    login: "Login",
    portal: "Portal",
  };

  return map[segment] || segment;
}

function labelForDynamicSegment(previousSegment: string | undefined) {
  if (previousSegment === "buildings") return "Detalle del edificio";
  if (previousSegment === "unit-types") return "Detalle de tipología";
  if (previousSegment === "units") return "Detalle del departamento";
  if (previousSegment === "assets") return "Detalle del asset";
  if (previousSegment === "schedules") return "Detalle de programación";
  if (previousSegment === "work-orders") return "Detalle de orden";
  return "Detalle";
}

function buildCrumbs(pathname: string): Crumb[] {
  const rawSegments = pathname.split("/").filter(Boolean);

  const isPortalPath = pathname.startsWith("/portal");
  const crumbs: Crumb[] = isPortalPath
    ? [{ href: "/portal/dashboard", label: "Portal" }]
    : [{ href: "/dashboard", label: "Dashboard" }];

  if (pathname === "/dashboard" || pathname === "/portal/dashboard") {
    return crumbs;
  }

  let hrefAccumulator = "";

  rawSegments.forEach((segment, index) => {
    hrefAccumulator += `/${segment}`;

    if (segment === "dashboard") return;
    if (segment === "portal" && isPortalPath) return;

    const previousSegment = rawSegments[index - 1];
    const isDynamic =
      isUuidLike(segment) || segment.startsWith("[") || /Id$/i.test(segment);

    crumbs.push({
      href: hrefAccumulator,
      label: isDynamic
        ? labelForDynamicSegment(previousSegment)
        : humanizeSegment(segment),
    });
  });

  return crumbs;
}

export default function GlobalBreadcrumbs() {
  const pathname = usePathname();

  if (
    !pathname ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/portal/login" ||
    pathname.startsWith("/portal")
  ) {
    return null;
  }

  const crumbs = buildCrumbs(pathname);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1320px",
        margin: "0 auto",
        padding: "18px 32px 0 32px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          fontSize: "13px",
          color: "#6B7280",
        }}
      >
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <div
              key={`${crumb.href}-${index}`}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              {isLast ? (
                <span style={{ fontWeight: 600, color: "#111827" }}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  style={{ color: "#6B7280", textDecoration: "none" }}
                >
                  {crumb.label}
                </Link>
              )}

              {!isLast && <span style={{ color: "#9CA3AF" }}>{">"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}