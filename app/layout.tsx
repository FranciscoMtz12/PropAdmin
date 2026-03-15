import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { UserProvider } from "@/contexts/UserContext";
import GlobalBreadcrumbs from "@/components/GlobalBreadcrumbs";
import Sidebar from "@/components/Sidebar";
import RouteGuard from "@/components/RouteGuard";
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
};

/*
  RootLayout global de la aplicación.

  Aquí mantenemos:
  - sidebar global
  - breadcrumbs globales
  - provider de usuario
  - provider de toasts
  - route guard cliente para separar admin vs tenant
  - contenedor principal centrado con ancho máximo consistente
*/

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <UserProvider>
          <AppToastProvider>
            {/* Guard de navegación cliente */}
            <RouteGuard />

            <div
              style={{
                minHeight: "100vh",
                display: "flex",
                background: "#F5F7FB",
              }}
            >
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
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 1280,
                      padding: "24px 32px 40px",
                      boxSizing: "border-box",
                    }}
                  >
                    {children}
                  </div>
                </main>
              </div>
            </div>
          </AppToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}