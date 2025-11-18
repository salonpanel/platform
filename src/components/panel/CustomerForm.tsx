"use client";

import { Dispatch, SetStateAction, useMemo } from "react";
import { Alert } from "@/components/ui/Alert";

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
        <Alert type="error">
          {error}
        </Alert>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
          Nombre <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="w-full rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 transition-all duration-200"
          placeholder="Nombre completo"
          autoFocus
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
          Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => {
            const value = e.target.value;
            handleChange("email", value);
            if (value) onEmailValidate(value);
          }}
          onBlur={() => onEmailValidate(form.email)}
          className={`w-full rounded-lg border px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${
            emailError
              ? "border-red-500/50 bg-red-500/10 focus:border-red-500 focus:ring-red-500/20"
              : "border-slate-700/50 bg-slate-800/30 focus:border-slate-500 focus:ring-slate-500/30"
          }`}
          placeholder="email@ejemplo.com"
        />
        {emailError && (
          <p className="mt-1 text-xs text-red-400">{emailError}</p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
          Teléfono
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          className="w-full rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 transition-all duration-200"
          placeholder="+34 600 000 000"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
          Fecha de nacimiento
        </label>
        <input
          type="date"
          value={form.birth_date}
          max={today}
          onChange={(e) => handleChange("birth_date", e.target.value)}
          className="w-full rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 transition-all duration-200"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
          Notas internas
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 transition-all duration-200 resize-none"
          placeholder="Notas sobre el cliente..."
        />
      </div>
    </div>
  );
}

