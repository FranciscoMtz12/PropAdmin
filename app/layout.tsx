import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { UserProvider } from "@/contexts/UserContext";
import GlobalBreadcrumbs from "@/components/GlobalBreadcrumbs";
import Sidebar from "@/components/Sidebar";

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
*/
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <UserProvider>
          <div style={{ display: "flex", minHeight: "100vh", background: "#F8FAFC" }}>
            <Sidebar />

            <div style={{ flex: 1, minWidth: 0 }}>
              <GlobalBreadcrumbs />

              <div
                style={{
                  width: "100%",
                  maxWidth: "1320px",
                  margin: "0 auto",
                }}
              >
                {children}
              </div>
            </div>
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
