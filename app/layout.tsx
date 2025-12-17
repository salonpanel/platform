import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "./supabase-provider";
import { SpeedInsights } from '@vercel/speed-insights/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  // Configuración PWA para modo app standalone
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BookFast Pro",
  },
  formatDetection: {
    telephone: true,
  },
  // Metaetiquetas adicionales para PWA
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
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
        
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Metaetiquetas para PWA - Modo standalone sin barras de navegación */}
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BookFast Pro" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        
        {/* Prevent UI to show browser bars on scrolling */}
        <style>{`
          html, body {
            display: flex;
            flex-direction: column;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          body {
            position: fixed;
            width: 100%;
            height: 100%;
          }
        `}</style>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
