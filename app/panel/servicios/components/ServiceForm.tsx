"use client";

import { GlassInput } from "@/components/ui/glass";
import { SERVICE_PRESET_CATEGORIES } from "../hooks";
import type { ServiceFormState } from "../types";
import { ImageIcon, FileText } from "lucide-react";

interface Props {
  initialData?: ServiceFormState;
  form: ServiceFormState;
  onChange: (patch: Partial<ServiceFormState>) => void;
  saving?: boolean;
  isEditing?: boolean;
  categoryOptions: string[];
  staffOptions?: Array<{ id: string; name: string }>;
  staffOptionsLoading?: boolean;
  tenantId: string;
  serviceId?: string;
  onStaffChange?: (staffIds: string[]) => void;
}

const formatPriceField = (value: number) => (value / 100).toFixed(2);

const PRICING_LEVELS = [
  { key: "junior",   label: "Nivel junior" },
  { key: "standard", label: "Nivel estándar" },
  { key: "senior",   label: "Nivel senior" },
  { key: "master",   label: "Nivel master" },
] as const;

export function ServiceForm({ form, onChange, categoryOptions }: Props) {
  const handleInput =
    (field: keyof ServiceFormState, parser: (value: string) => unknown = (v) => v) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      onChange({ [field]: parser(event.target.value) } as Partial<ServiceFormState>);
    };

  const parseNumber = (value: string, min = 0) => Math.max(min, Number(value) || 0);
  const parsePriceToCents = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100));

  return (
    <div className="space-y-6">

      {/* ── Información básica ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
          Información básica
        </p>

        <GlassInput
          label="Nombre del servicio"
          value={form.name}
          onChange={handleInput("name")}
          placeholder="Corte clásico, Afeitado navaja, Color completo…"
          required
        />

        {/* Category with datalist */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white">
            Categoría
          </label>
          <input
            list="service-category-options"
            value={form.category}
            onChange={handleInput("category")}
            placeholder="Corte, Barba, Color…"
            className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent-blue)]/40 focus:outline-none transition-colors"
          />
          <datalist id="service-category-options">
            {[...new Set([...SERVICE_PRESET_CATEGORIES, ...categoryOptions])]
              .filter(Boolean)
              .map((cat) => <option value={cat} key={cat} />)}
          </datalist>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Elige una categoría o escribe una personalizada.
          </p>
        </div>

        {/* Description — active, shown in booking portal */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-white">
            <FileText className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            Descripción
            <span className="text-[10px] font-normal text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 px-1.5 py-0.5 rounded-full">
              Visible en el portal
            </span>
          </label>
          <textarea
            value={form.description ?? ""}
            onChange={handleInput("description")}
            rows={3}
            placeholder="Descripción que verá el cliente al elegir este servicio. Incluye qué trae, duración real, qué productos se usan…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent-blue)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/20 transition-colors resize-none"
          />
        </div>

        {/* Media URL */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-white">
            <ImageIcon className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            Imagen del servicio (URL)
          </label>
          <GlassInput
            value={form.media_url ?? ""}
            onChange={handleInput("media_url")}
            placeholder="https://ejemplo.com/imagen-corte.jpg"
          />
          {form.media_url && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.media_url}
                alt="Vista previa"
                className="h-24 w-full object-cover rounded-xl border border-white/10"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Imagen decorativa que aparece en el portal de reservas.
          </p>
        </div>
      </div>

      {/* ── Configuración de tiempo y precio ──────────────────────────────── */}
      <div className="space-y-4 pt-2 border-t border-white/5">
        <p className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
          Tiempo y precio
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassInput
            label="Duración (min)"
            type="number"
            min={5}
            step={5}
            value={form.duration_min}
            onChange={handleInput("duration_min", (v) => parseNumber(v, 5))}
            helperText="Mínimo 5 min"
          />
          <GlassInput
            label="Buffer adicional (min)"
            type="number"
            min={0}
            step={5}
            value={form.buffer_min}
            onChange={handleInput("buffer_min", (v) => parseNumber(v, 0))}
            helperText="Limpieza / preparación"
          />
          <GlassInput
            label="Precio base (€)"
            type="number"
            min={0}
            step={0.5}
            value={formatPriceField(form.price_cents)}
            onChange={handleInput("price_cents", parsePriceToCents)}
            helperText="IVA incluido"
          />
        </div>
      </div>

      {/* ── Precios por nivel de staff ────────────────────────────────────── */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
            Precios por nivel de staff
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Opcional. Si se deja vacío, se usa el precio base para ese nivel.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRICING_LEVELS.map(({ key, label }) => (
            <GlassInput
              key={key}
              label={label}
              type="number"
              min={0}
              step={0.5}
              value={
                form.pricing_levels[key] !== null && form.pricing_levels[key] !== undefined
                  ? formatPriceField(form.pricing_levels[key]!)
                  : ""
              }
              onChange={(event) => {
                const val = event.target.value;
                onChange({
                  pricing_levels: {
                    ...form.pricing_levels,
                    [key]: val === "" ? null : parsePriceToCents(val),
                  },
                });
              }}
              placeholder="—"
            />
          ))}
        </div>
      </div>

      {/* ── Estado ───────────────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-white/5">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => onChange({ active: !form.active })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 cursor-pointer ${
              form.active ? "bg-[var(--accent-blue)]" : "bg-white/20"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                form.active ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-white group-hover:text-white/80 transition-colors">
              Servicio activo
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {form.active
                ? "Visible para clientes en el portal de reservas"
                : "Oculto — solo visible para el equipo interno"}
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}
