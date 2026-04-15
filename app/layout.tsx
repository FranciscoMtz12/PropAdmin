import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import GlobalBreadcrumbs from "@/components/GlobalBreadcrumbs";
import Sidebar from "@/components/Sidebar";
import AppShell from "@/components/AppShell";
import RouteGuard from "@/components/RouteGuard";
import MainContentWrapper from "@/components/MainContentWrapper";
import { AppToastProvider } from "@/components/AppToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  UserProvider → AppToastProvider → ThemeProvider → AppShell

  ThemeProvider debe estar DENTRO de UserProvider porque lee
  company_id del usuario autenticado para cargar el branding.

  AppShell es un client component que aplica el fondo según isDark.
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
          <AppToastProvider>
            {/* ThemeProvider lee company branding y gestiona dark/light mode */}
            <ThemeProvider>
              {/* Guard de navegación cliente */}
              <RouteGuard />

              {/* AppShell aplica el fondo dinámico según el modo activo */}
              <AppShell>
                {/* Sidebar global del sistema */}
                <Sidebar />

                {/* Área principal del sistema */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
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
          </AppToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
