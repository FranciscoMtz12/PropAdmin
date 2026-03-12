import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { UserProvider } from "@/contexts/UserContext";
import GlobalBreadcrumbs from "@/components/GlobalBreadcrumbs";
import Sidebar from "@/components/Sidebar";
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

  Aquí mantenemos fijo el shell visual del sistema:
  - sidebar siempre visible en desktop
  - breadcrumb global
  - área principal centrada
  - provider global de usuario
  - provider global de toasts flotantes

  Importante:
  Los mensajes de éxito / error ya no deben vivir dentro del layout
  normal de cada página porque eso provoca "brincos" visuales.
  Por eso AppToastProvider se monta aquí y queda disponible en toda la app.
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
            <div
              style={{
                minHeight: "100vh",
                display: "flex",
                background: "#F5F7FB",
              }}
            >
              {/* Sidebar global fijo del sistema */}
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

                {/* Contenido principal de cada módulo */}
                <main
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {children}
                </main>
              </div>
            </div>
          </AppToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}