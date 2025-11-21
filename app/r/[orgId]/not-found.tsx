import Link from "next/link";
import { getMarketingUrl } from "@/lib/urls";

/**
 * Página 404 específica para tenant inexistente
 * 
 * Se muestra cuando se intenta acceder a un tenant que no existe
 * o que ya no está activo en BookFast.
 */
export default function TenantNotFound() {
  const marketingUrl = getMarketingUrl();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="glass rounded-2xl border border-slate-500/50 bg-slate-500/10 p-8 text-center max-w-md shadow-[0px_12px_48px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-bold text-slate-300 mb-2 font-satoshi">
          Esta barbería no existe o ya no está activa en BookFast
        </h1>
        <p className="text-slate-400 mb-6">
          La barbería que buscas no existe o ya no está disponible en nuestra plataforma.
        </p>
        <Link
          href={marketingUrl}
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          Ir a BookFast
        </Link>
      </div>
    </div>
  );
}




