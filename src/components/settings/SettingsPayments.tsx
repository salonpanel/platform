"use client";

import { useState, useEffect } from "react";
import { GlassSection, GlassButton, GlassInput, GlassCard } from "@/components/ui/glass";
import { Copy, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassToast } from "@/components/ui/glass/GlassToast";

interface StripeStatus {
    connected: boolean;
    account_id?: string;
    onboarding_status?: "pending" | "restricted" | "completed" | string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
    future_requirements?: unknown;
}

interface SettingsPaymentsProps {
    status: StripeStatus | null;
    onRefreshStatus: () => Promise<void>;
    canManage?: boolean;
}

export function SettingsPayments({
    status,
    onRefreshStatus,
    canManage = true,
}: SettingsPaymentsProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState("");
    const [toast, setToast] = useState<{ message: string; tone: "success" | "danger" } | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setWebhookUrl(window.location.origin + "/api/payments/stripe/webhook");
        }
    }, []);

    const handleConnect = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/payments/stripe/connect", { method: "POST" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || "Error al iniciar conexión");
            }
            const data = await res.json().catch(() => ({}));
            if (data?.url) {
                window.location.href = data.url;
            } else {
                setToast({ message: "Conexión iniciada", tone: "success" });
            }
        } catch (e: any) {
            setToast({ message: e.message, tone: "danger" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/payments/stripe/sync", { method: "POST" });
            if (!res.ok) throw new Error("Error al sincronizar");

            await onRefreshStatus();
            setToast({ message: "Catálogo sincronizado correctamente", tone: "success" });
        } catch (e: any) {
            setToast({ message: e.message, tone: "danger" });
        } finally {
            setIsLoading(false);
        }
    };

    const copyWebhook = () => {
        if (webhookUrl) {
            navigator.clipboard.writeText(webhookUrl);
            setToast({ message: "Webhook copiado", tone: "success" });
        }
    };

    return (
        <GlassSection
            title="Pagos (Stripe)"
            description="Gestiona la conexión con Stripe para aceptar pagos."
            containerClassName="from-blue-500/5 to-purple-500/5"
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">Estado de la cuenta</span>
                            {status?.connected ? (
                                <GlassBadge variant="success" size="sm">
                                    <CheckCircle2 className="w-3 h-3 mr-1.5" />
                                    Conectado
                                </GlassBadge>
                            ) : (
                                <GlassBadge variant="danger" size="sm">
                                    <AlertCircle className="w-3 h-3 mr-1.5" />
                                    No conectado
                                </GlassBadge>
                            )}
                        </div>
                        {status?.connected && status?.onboarding_status && (
                            <p className="text-xs text-[var(--text-secondary)]">
                                Onboarding: <span className="text-white/80">{status.onboarding_status}</span>
                            </p>
                        )}
                        {status?.connected && typeof status?.charges_enabled === "boolean" && typeof status?.payouts_enabled === "boolean" && (
                            <p className="text-[10px] text-[var(--text-secondary)] opacity-70">
                                Cobros: {status.charges_enabled ? "activados" : "pendientes"} · Payouts: {status.payouts_enabled ? "activados" : "pendientes"}
                            </p>
                        )}
                        {status?.connected && status?.account_id && (
                            <p className="text-[10px] text-[var(--text-secondary)] opacity-70">
                                Account: <span className="font-mono">{status.account_id}</span>
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <GlassButton
                            onClick={handleConnect}
                            isLoading={isLoading}
                            variant={status?.connected ? "secondary" : "primary"}
                            size="sm"
                            disabled={!canManage}
                            className="h-11 px-4"
                        >
                            {status?.connected ? "Gestionar Cuenta" : "Conectar Stripe"}
                        </GlassButton>
                        <GlassButton
                            onClick={handleSync}
                            isLoading={isLoading}
                            variant="secondary"
                            size="sm"
                            disabled={!canManage || !status?.connected}
                            className="h-11 px-4"
                        >
                            Sincronizar Catálogo
                        </GlassButton>
                    </div>
                </div>

                {!canManage && (
                    <GlassCard className="p-4 border-white/10 bg-white/5">
                        <p className="text-xs text-[var(--text-secondary)]">
                            Solo <span className="text-white/80">owner</span> o <span className="text-white/80">admin</span> pueden gestionar Stripe.
                        </p>
                    </GlassCard>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">
                        Webhook URL
                    </label>
                    <div className="flex gap-2">
                        <GlassInput
                            value={webhookUrl}
                            readOnly
                            className="flex-1 font-mono text-xs"
                        />
                        <GlassButton onClick={copyWebhook} variant="secondary" className="h-11 w-11 p-0 flex items-center justify-center">
                            <Copy className="w-4 h-4" />
                        </GlassButton>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                        Configura este endpoint en tu dashboard de Stripe para recibir eventos.
                    </p>
                </div>
            </div>

            {toast && (
                <GlassToast
                    message={toast.message}
                    tone={toast.tone}
                    onClose={() => setToast(null)}
                />
            )}
        </GlassSection>
    );
}
