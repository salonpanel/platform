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
  // "cover" extends the viewport behind the notch / Dynamic Island / home indicator.
  // env(safe-area-inset-*) values are then non-zero and our layout respects them.
  viewportFit: "cover",
  // Match the app's dark background so the browser tab bar / status bar blends in
  themeColor: "#06141B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* ── Icons (explicit for broad browser compatibility) ── */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
        {/* apple-touch-icon: used by iOS when user adds app to Home Screen */}
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="shortcut icon" href="/favicon.ico" />

        {/* ── PWA: manifest (Next.js also adds this, kept for subdomains) ── */}
        <link rel="manifest" href="/manifest.json" />

        {/* ── iOS PWA standalone mode ──
            Next.js metadata export handles most of these, but we keep them
            explicitly so they always appear first in <head> and work on
            every subdomain / deploy preview. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/*
          black-translucent: the status bar overlaps app content (we use
          env(safe-area-inset-top) in TopBar to push content below it).
          This gives the true edge-to-edge fullscreen feel on iPhone.
        */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BookFast Pro" />
        {/* theme-color: browser tab bar / Android status bar colour */}
        <meta name="theme-color" content="#06141B" />

        {/* ── IMPORTANT: NO duplicate <meta name="viewport"> here ──
            The Next.js `viewport` export above generates it with viewport-fit=cover.
            A duplicate viewport meta causes unpredictable behaviour on iOS. */}

        {/* ── Prevent iOS Safari bounce / address-bar resize ──
            body { position: fixed } locks the body to the viewport so the
            browser chrome can never scroll the body itself. All scrolling
            happens inside the overflow-y-auto containers in our layout. */}
        <style>{`
          html {
            height: 100%;
            overflow: hidden;
            background-color: #06141B;
          }
          body {
            position: fixed;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: #06141B;
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
