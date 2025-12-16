"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { GlassCard, GlassButton } from "@/components/ui/glass";

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
            <GlassCard className="max-w-md w-full p-8 flex flex-col items-center">
                <div className="mb-6 rounded-full bg-red-500/10 p-4 ring-1 ring-red-500/20">
                    <AlertCircle className="h-10 w-10 text-red-500" />
                </div>

                <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
                    Algo ha salido mal
                </h2>

                <p className="mb-8 text-sm text-[var(--text-secondary)]">
                    Ha ocurrido un error inesperado al cargar esta sección. No te preocupes, tus datos están seguros.
                </p>

                <div className="flex gap-4 w-full justify-center">
                    <GlassButton
                        variant="secondary"
                        onClick={() => window.location.reload()}
                        leftIcon={<RefreshCw className="h-4 w-4" />}
                    >
                        Recargar
                    </GlassButton>

                    <GlassButton
                        variant="primary"
                        onClick={() => reset()}
                    >
                        Reintentar
                    </GlassButton>
                </div>

                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-8 w-full rounded-lg bg-black/50 p-4 border border-red-900/50 text-left overflow-auto">
                        <p className="text-xs font-mono text-red-400 mb-2">Error Digest: {error.digest}</p>
                        <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">
                            {error.message}
                        </pre>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
