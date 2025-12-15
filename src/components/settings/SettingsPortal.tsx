"use client";

import { GlassSection, GlassInput, GlassButton } from "@/components/ui/glass";
import { ExternalLink } from "lucide-react";

interface SettingsPortalProps {
    portalUrl: string;
    onChange: (value: string) => void;
    onSave: () => void;
    isLoading: boolean;
}

export function SettingsPortal({
    portalUrl,
    onChange,
    onSave,
    isLoading,
}: SettingsPortalProps) {
    const fullUrl = portalUrl.startsWith("http") ? portalUrl : `${typeof window !== 'undefined' ? window.location.origin : ''}${portalUrl}`;

    return (
        <GlassSection
            title="Portal de Reservas"
            description="Configura el enlace público donde tus clientes pueden reservar."
        >
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 items-end">
                    <div className="flex-1 w-full">
                        <GlassInput
                            label="URL del Portal"
                            value={portalUrl}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="/r/mi-barberia"
                            disabled={isLoading}
                            className="h-11"
                        />
                    </div>
                    {portalUrl && (
                        <div className="pb-0.5">
                            <a
                                href={fullUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-[var(--accent-blue)]"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Abrir
                            </a>
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    <GlassButton onClick={onSave} isLoading={isLoading} className="h-11">
                        Guardar URL
                    </GlassButton>
                </div>
            </div>
        </GlassSection>
    );
}
