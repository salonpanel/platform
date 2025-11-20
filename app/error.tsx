"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { getAppContextFromHost } from "@/lib/domains";
import { URLS } from "@/lib/urls";

/**
 * Página de error genérica - BookFast Platform
 * 
 * Se muestra cuando ocurre un error no manejado en la aplicación.
 * El botón "Volver al inicio" redirige según el contexto del dominio.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  // Determinar URL de inicio según el contexto
  const getHomeUrl = (): string => {
    if (typeof window === "undefined") {
      return "/";
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
      <div className="glass rounded-2xl border border-red-500/50 bg-red-500/10 p-8 text-center max-w-md shadow-[0px_12px_48px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-bold text-red-400 mb-2 font-satoshi">
          Algo salió mal
        </h1>
        <p className="text-slate-400 mb-4">
          Ha ocurrido un error inesperado. Por favor, intenta de nuevo.
        </p>
        
        {process.env.NODE_ENV === "development" && error.message && (
          <div className="mb-4 p-3 bg-slate-800/50 rounded-lg text-left">
            <p className="text-xs text-slate-500 mb-1">Error (solo en desarrollo):</p>
            <p className="text-xs text-red-300 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-slate-500 mt-1">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Intentar de nuevo
          </button>
          <Link
            href={getHomeUrl()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

