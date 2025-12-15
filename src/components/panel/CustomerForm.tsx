"use client";

import { Dispatch, SetStateAction, useMemo } from "react";
import { GlassInput, GlassCard } from "@/components/ui/glass";

export type CustomerFormValues = {
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  notes: string;
};

type CustomerFormProps = {
  form: CustomerFormValues;
  setForm: Dispatch<SetStateAction<CustomerFormValues>>;
  emailError: string | null;
  onEmailValidate: (email: string) => boolean;
  error?: string | null;
};

export function CustomerForm({
  form,
  setForm,
  emailError,
  onEmailValidate,
  error,
}: CustomerFormProps) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const handleChange = (field: keyof CustomerFormValues, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-4">
      {error && (
        <GlassCard className="border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </GlassCard>
      )}

      <div>
        <GlassInput
          label="Nombre"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Nombre completo"
          autoFocus
          className="h-11"
        />
      </div>

      <div>
        <GlassInput
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => {
            const value = e.target.value;
            handleChange("email", value);
            if (value) onEmailValidate(value);
          }}
          onBlur={() => onEmailValidate(form.email)}
          error={!!emailError}
          helperText={emailError || undefined}
          placeholder="email@ejemplo.com"
          className="h-11"
        />
      </div>

      <div>
        <GlassInput
          label="Teléfono"
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="+34 600 000 000"
          className="h-11"
        />
      </div>

      <div>
        <GlassInput
          label="Fecha de nacimiento"
          type="date"
          value={form.birth_date}
          max={today}
          onChange={(e) => handleChange("birth_date", e.target.value)}
          className="h-11"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
          Notas internas
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          rows={3}
          className="w-full rounded-lg glass border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20 transition-all duration-200 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
          placeholder="Notas sobre el cliente..."
        />
      </div>
    </div>
  );
}

