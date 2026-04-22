"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { GlassSection, GlassButton } from "@/components/ui/glass";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Globe } from "lucide-react";

interface SettingsPortalProps {
    subdomain: string;
    tenantId: string;
    onSave: (slug: string) => void;
    isLoading: boolean;
}

type CheckStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "empty";

export function SettingsPortal({
    subdomain,
    tenantId,
    onSave,
    isLoading,
}: SettingsPortalProps) {
    const [value, setValue] = useState(subdomain);
    const [status, setStatus] = useState<CheckStatus>("idle");
    const [statusMsg, setStatusMsg] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync external value if parent reloads
    useEffect(() => {
        setValue(subdomain);
        setStatus("idle");
        setStatusMsg("");
    }, [subdomain]);

    const checkAvailability = useCallback(async (slug: string) => {
        if (!slug) { setStatus("empty"); setStatusMsg(""); return; }

        setStatus("checking");
        setStatusMsg("");
        try {
            const params = new URLSearchParams({ slug, tenant_id: tenantId });
            const res = await fetch(`/api/panel/subdomain/check?${params}`);
            const json = await res.json();
            if (json.available) {
                setStatus("available");
                setStatusMsg("Subdominio disponible");
            } else {
                setStatus("taken");
                setStatusMsg(json.error || "No disponible");
            }
        } catch {
            setStatus("idle");
            setStatusMsg("");
        }
    }, [tenantId]);

    const handleChange = (raw: string) => {
        const cleaned = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
        setValue(cleaned);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            checkAvailability(cleaned);
        }, 500);
    };

    const handleSave = () => {
        if (status !== "available" && value !== subdomain) return;
        onSave(value.trim());
    };

    const canSave = !isLoading && (
        (status === "available" && value !== subdomain) ||
        (value === subdomain && value !== "")
    );

    const publicUrl = value ? `https://${value}.bookfast.es` : null;

    return (
        <GlassSection
            title="Portal de Reservas"
            description="El subdominio donde tus clientes reservan citas. Elige un nombre único para tu negocio."
        >
            <div className="space-y-5">

                {/* Input row */}
                <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                        Subdominio
                    </label>
                    <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-white/10 bg-white/5 focus-within:border-[var(--bf-primary)]/60 transition-colors">
                        {/* prefix */}
                        <div className="flex items-center gap-2 pl-4 pr-3 py-3 border-r border-white/10 shrink-0">
                            <Globe className="w-4 h-4 text-[var(--bf-primary)]" />
                        </div>
                        {/* input */}
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleChange(e.target.value)}
                            placeholder="mi-barberia"
                            disabled={isLoading}
                            maxLength={32}
                            className="flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/25 outline-none disabled:opacity-50 font-mono"
                        />
                        {/* suffix */}
                        <div className="flex items-center pr-4 pl-2 py-3 shrink-0">
                            <span className="text-sm text-white/40 font-mono">.bookfast.es</span>
                        </div>
                    </div>
                    <p className="mt-1.5 text-xs text-white/30">
                        Solo letras minúsculas, números y guiones · 3–32 caracteres
                    </p>
                </div>

                {/* Status indicator */}
                {status !== "idle" && status !== "empty" && (
                    <div className={`flex items-center gap-2 text-sm ${
                        status === "available" ? "text-[var(--bf-success)]" :
                        status === "taken" || status === "invalid" ? "text-red-400" :
                        "text-white/50"
                    }`}>
                        {status === "checking" && <Loader2 className="w-4 h-4 animate-spin" />}
                        {status === "available" && <CheckCircle2 className="w-4 h-4" />}
                        {(status === "taken" || status === "invalid") && <XCircle className="w-4 h-4" />}
                        <span>{statusMsg}</span>
                    </div>
                )}

                {/* URL Preview */}
                {publicUrl && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-[var(--text-secondary)] mb-0.5">URL pública de reservas</p>
                            <p className="text-sm text-[var(--bf-primary)] font-mono truncate">{publicUrl}</p>
                        </div>
                        {value === subdomain && subdomain && (
                            <a
                                href={publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs text-white/70 hover:text-white"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Abrir
                            </a>
                        )}
                    </div>
                )}

                {/* Save */}
                <div className="pt-1">
                    <GlassButton
                        onClick={handleSave}
                        isLoading={isLoading}
                        disabled={!canSave}
                        className="h-11"
                    >
                        Guardar subdominio
                    </GlassButton>
                </div>
            </div>
        </GlassSection>
    );
}
