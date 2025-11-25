import type { Metadata } from "next";
import "./globals.css";
import { SupabaseProvider } from "./supabase-provider";

// Note: Using CSS system fonts as fallback since local fonts are not available
// The font CSS variables are still set for consistency with the design system

export const metadata: Metadata = {
  title: "BookFast Pro - Sistema de Reservas para Barberías",
  description: "Plataforma de gestión y reservas online para barberías",
  robots: {
    index: false, // Por defecto, no indexar (se sobrescribe en páginas públicas)
    follow: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
  // Añadir metadata adicional para favicon en todos los subdominios
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Favicon explícito para asegurar que funcione en todos los subdominios */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning
      >
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
