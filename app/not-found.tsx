"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { getAppContextFromHost } from "@/lib/domains";
import { URLS } from "@/lib/urls";

/**
 * Página 404 - BookFast Platform
 * 
 * Se muestra cuando una ruta no existe.
 * El botón "Volver al inicio" redirige según el contexto del dominio.
 */
export default function NotFound() {
  const pathname = usePathname();

  // Determinar URL de inicio según el contexto
  const getHomeUrl = (): string => {
    if (typeof window === "undefined") {
      return URLS.ROOT;
    }

    const host = window.location.host;
    const context = getAppContextFromHost(host);

    switch (context) {
      case "pro":
        return "/panel";
      case "admin":
        return "/admin";
      case "tenantPublic":
        return "/";
      case "marketing":
      default:
        return URLS.ROOT;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="glass rounded-2xl border border-slate-500/50 bg-slate-500/10 p-8 text-center max-w-md shadow-[0px_12px_48px_rgba(0,0,0,0.5)]">
        <h1 className="text-4xl font-bold text-slate-300 mb-2 font-satoshi">404</h1>
        <h2 className="text-xl font-semibold text-slate-400 mb-4">
          Página no encontrada
        </h2>
        <p className="text-slate-500 mb-6">
          La página que buscas no existe o ha sido movida.
        </p>
        <Link
          href={getHomeUrl()}
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

