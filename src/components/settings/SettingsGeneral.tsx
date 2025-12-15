"use client";

import { GlassSection, GlassInput, GlassSelect, GlassButton } from "@/components/ui/glass";

interface SettingsGeneralProps {
    name: string;
    timezone: string;
    onChange: (field: string, value: string) => void;
    onSave: () => void;
    isLoading: boolean;
}

const TIMEZONES = [
    { value: "Europe/Madrid", label: "Madrid (GMT+1/+2)" },
    { value: "Europe/London", label: "Londres (GMT+0/+1)" },
    { value: "America/New_York", label: "Nueva York (EST/EDT)" },
    { value: "America/Los_Angeles", label: "Los Ángeles (PST/PDT)" },
    { value: "America/Mexico_City", label: "Ciudad de México (CST/CDT)" },
    { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
    { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
    { value: "UTC", label: "UTC" },
];

export function SettingsGeneral({
    name,
    timezone,
    onChange,
    onSave,
    isLoading,
}: SettingsGeneralProps) {
    return (
        <GlassSection
            title="Información General"
            description="Configura los datos básicos de tu negocio."
        >
            <div className="space-y-4">
                <GlassInput
                    label="Nombre de la Barbería"
                    value={name}
                    onChange={(e) => onChange("name", e.target.value)}
                    placeholder="Nombre de tu negocio"
                    disabled={isLoading}
                    className="h-11"
                />

                <GlassSelect
                    label="Zona Horaria"
                    value={timezone}
                    onChange={(e) => onChange("timezone", e.target.value)}
                    disabled={isLoading}
                    helperText="Afecta a cómo se muestran las fechas y horas en toda la aplicación."
                    className="h-11"
                >
                    {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                            {tz.label}
                        </option>
                    ))}
                </GlassSelect>

                <div className="pt-2">
                    <GlassButton
                        onClick={onSave}
                        isLoading={isLoading}
                        disabled={!name.trim() || !timezone.trim()}
                        className="h-11"
                    >
                        Guardar Cambios General
                    </GlassButton>
                </div>
            </div>
        </GlassSection>
    );
}
