"use client";

import { GlassSection, GlassInput, GlassButton } from "@/components/ui/glass";

interface SettingsBrandingProps {
    logoUrl: string;
    primaryColor: string;
    onChange: (field: string, value: string) => void;
    onSave: () => void;
    isLoading: boolean;
}

export function SettingsBranding({
    logoUrl,
    primaryColor,
    onChange,
    onSave,
    isLoading,
}: SettingsBrandingProps) {
    return (
        <GlassSection
            title="Branding"
            description="Personaliza la apariencia de tu panel y portal de reservas."
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <GlassInput
                        label="Logo (URL)"
                        value={logoUrl}
                        onChange={(e) => onChange("logo_url", e.target.value)}
                        placeholder="https://ejemplo.com/logo.png"
                        disabled={isLoading}
                        className="h-11"
                    />
                    {logoUrl && (
                        <div className="mt-2 p-2 rounded-lg bg-white/5 inline-block border border-white/10">
                            <img
                                src={logoUrl}
                                alt="Logo preview"
                                className="h-16 w-16 object-contain rounded"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <label className="block text-sm font-medium text-[var(--text-secondary)]">
                        Color Primario
                    </label>
                    <div className="flex gap-3 items-center">
                        <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => onChange("primary_color", e.target.value)}
                            className="h-10 w-14 rounded-lg border border-white/10 bg-white/5 cursor-pointer p-1"
                            disabled={isLoading}
                        />
                        <div className="flex-1">
                            <GlassInput
                                value={primaryColor}
                                onChange={(e) => onChange("primary_color", e.target.value)}
                                placeholder="#4cb3ff"
                                disabled={isLoading}
                                className="w-full h-11"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <GlassButton onClick={onSave} isLoading={isLoading} className="h-11">
                        Guardar Branding
                    </GlassButton>
                </div>
            </div>
        </GlassSection>
    );
}
