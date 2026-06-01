import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { UserProvider } from "@/contexts/UserContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBridge } from "@/components/ImpersonationBridge";
import { ThemeProvider } from "@/contexts/ThemeContext";
import GlobalBreadcrumbs from "@/components/GlobalBreadcrumbs";
import SidebarGate from "@/components/SidebarGate";
import AppShell from "@/components/AppShell";
import RouteGuard from "@/components/RouteGuard";
import SplashScreen from "@/components/SplashScreen";
import FeedbackButton from "@/components/FeedbackButton";
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
  UserProvider → ImpersonationProvider → ImpersonationBridge → ThemeProvider → AppShell

  ImpersonationBridge re-provee UserContext con los valores efectivos cuando
  el superadmin está impersonando una empresa/usuario. ThemeProvider y todos
  los componentes hijos ven el usuario efectivo automáticamente.

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
          {/* ImpersonationProvider lee el usuario real y gestiona el estado de impersonación */}
          <ImpersonationProvider>
            {/* ImpersonationBridge re-provee UserContext con los valores efectivos */}
            <ImpersonationBridge>
              {/* ThemeProvider lee company branding y gestiona dark/light mode */}
              <ThemeProvider>
                {/* Guard de navegación cliente */}
                <RouteGuard />

                {/* Splash de bienvenida post-login (lee flag de sessionStorage) */}
                <SplashScreen />

                {/* Botón flotante de feedback (se auto-oculta en rutas públicas) */}
                <FeedbackButton />

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
            </ImpersonationBridge>
          </ImpersonationProvider>
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
              borderRadius: "var(--border-radius-md)",
              fontSize: "0.8125rem",
              padding: "12px 16px",
            },
            success: {
              iconTheme: { primary: "var(--color-chart-green)", secondary: "white" },
            },
            error: {
              iconTheme: { primary: "var(--priority-urgent)", secondary: "white" },
            },
          }}
        />
      </body>
    </html>
  );
}
