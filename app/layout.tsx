import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import GlobalBreadcrumbs from "@/components/GlobalBreadcrumbs";
import SidebarGate from "@/components/SidebarGate";
import AppShell from "@/components/AppShell";
import RouteGuard from "@/components/RouteGuard";
import MainContentWrapper from "@/components/MainContentWrapper";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* La app es 100% autenticada — forzamos renderizado dinámico para evitar
   prerender estático y los errores de useSearchParams() sin Suspense en
   páginas cliente. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administración de Departamentos",
  description: "Sistema de administración de departamentos",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "PropAdmin",
    "theme-color": "#1E2A3A",
  },
};

/*
  RootLayout global de la aplicación.

  Jerarquía de providers (de exterior a interior):
  UserProvider → ThemeProvider → AppShell

  ThemeProvider debe estar DENTRO de UserProvider porque lee
  company_id del usuario autenticado para cargar el branding.

  AppShell es un client component que aplica el fondo según isDark.

  Toaster global de react-hot-toast vive al final del body para que
  los toasts floten encima de cualquier contenido de la app.
*/

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <UserProvider>
          {/* ThemeProvider lee company branding y gestiona dark/light mode */}
          <ThemeProvider>
            {/* Guard de navegación cliente */}
            <RouteGuard />

            {/* AppShell aplica el fondo dinámico según el modo activo */}
            <AppShell>
              {/* SidebarGate decide si mostrar Sidebar + BgTexture según la ruta
                  (ambos ocultos en /, /login y /portal/login). Envuelto en
                  Suspense porque Sidebar usa useSearchParams(). */}
              <Suspense fallback={null}>
                <SidebarGate />
              </Suspense>

              {/* Área principal del sistema — position: relative + z-index: 1
                  para quedar por encima de BgTexture. */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {/* Breadcrumb global superior */}
                <GlobalBreadcrumbs />

                {/* Contenido principal con contenedor centrado global */}
                <main
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <MainContentWrapper>
                    {children}
                  </MainContentWrapper>
                </main>
              </div>
            </AppShell>
          </ThemeProvider>
        </UserProvider>

        {/* Toaster global de react-hot-toast */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "0.5px solid var(--border-default)",
              borderRadius: "8px",
              fontSize: "13px",
              padding: "12px 16px",
            },
            success: {
              iconTheme: { primary: "#10B981", secondary: "white" },
            },
            error: {
              iconTheme: { primary: "#EF4444", secondary: "white" },
            },
          }}
        />
      </body>
    </html>
  );
}
