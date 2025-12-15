"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function PanelError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to an error reporting service if available
        console.error("Panel Error:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
            <div className="mb-6 rounded-full bg-red-500/10 p-4 ring-1 ring-red-500/20">
                <AlertCircle className="h-10 w-10 text-red-500" />
            </div>

            <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
                Algo ha salido mal
            </h2>

            <p className="mb-8 max-w-md text-sm text-[var(--color-text-secondary)]">
                Ha ocurrido un error inesperado al cargar esta sección. No te preocupes, tus datos están seguros.
            </p>

            <div className="flex gap-4">
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                >
                    <RefreshCw className="h-4 w-4" />
                    Recargar página
                </button>

                <button
                    onClick={() => reset()}
                    className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all"
                >
                    Reintentar acción
                </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
                <div className="mt-8 max-w-lg rounded-lg bg-slate-950 p-4 border border-red-900/50 text-left overflow-auto">
                    <p className="text-xs font-mono text-red-400 mb-2">Error Digest: {error.digest}</p>
                    <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">
                        {error.message}
                    </pre>
                </div>
            )}
        </div>
    );
}
