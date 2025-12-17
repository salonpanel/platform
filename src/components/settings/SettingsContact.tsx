"use client";

import { GlassSection, GlassInput, GlassButton } from "@/components/ui/glass";

interface SettingsContactProps {
    email: string;
    phone: string;
    address: string;
    onChange: (field: string, value: string) => void;
    onSave: () => void;
    isLoading: boolean;
}

export function SettingsContact({
    email,
    phone,
    address,
    onChange,
    onSave,
    isLoading,
}: SettingsContactProps) {
    return (
        <GlassSection
            title="Contacto"
            description="Información pública de contacto para tus clientes."
        >
            <div className="space-y-4">
                <GlassInput
                    label="Email de Contacto"
                    type="email"
                    value={email}
                    onChange={(e) => onChange("contact_email", e.target.value)}
                    placeholder="contacto@barberia.com"
                    disabled={isLoading}
                    className="h-11"
                />

                <GlassInput
                    label="Teléfono de Contacto"
                    type="tel"
                    value={phone}
                    onChange={(e) => onChange("contact_phone", e.target.value)}
                    placeholder="+34 600 000 000"
                    disabled={isLoading}
                    className="h-11"
                />

                <div className="space-y-1">
                    <label className="block text-sm font-medium text-[var(--text-secondary)]">
                        Dirección
                    </label>
                    <textarea
                        value={address}
                        onChange={(e) => onChange("address", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-secondary)]/60 focus:border-[var(--accent-blue)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 transition-all resize-none"
                        placeholder="Calle, Número, Ciudad, Código Postal"
                        disabled={isLoading}
                    />
                </div>

                <div className="pt-2">
                    <GlassButton onClick={onSave} isLoading={isLoading} className="h-11">
                        Guardar Contacto
                    </GlassButton>
                </div>
            </div>
        </GlassSection>
    );
}
