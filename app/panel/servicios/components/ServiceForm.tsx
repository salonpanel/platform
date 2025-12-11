"use client";

import {
  SERVICE_PRESET_CATEGORIES,
} from "../hooks";
import type { ServiceFormState } from "../types";
import { useState, useEffect } from "react";
import { getServiceStaff } from "@/lib/staff/staffServicesRelations";

type Props = {
  form: ServiceFormState;
  onChange: (patch: Partial<ServiceFormState>) => void;
  categoryOptions: string[];
  staffOptions?: Array<{ id: string; name: string }>;
  staffOptionsLoading?: boolean;
  tenantId: string;
  serviceId?: string; // For editing existing services
  onStaffChange?: (staffIds: string[]) => void; // Callback for staff assignment changes
};

const formatPriceField = (value: number) => (value / 100).toFixed(2);

export function ServiceForm({ form, onChange, categoryOptions, staffOptions, staffOptionsLoading, tenantId, serviceId, onStaffChange }: Props) {
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Callback when staff selection changes
  useEffect(() => {
    onStaffChange?.(selectedStaffIds);
  }, [selectedStaffIds, onStaffChange]);

  // Load current staff assignments when editing a service
  useEffect(() => {
    if (!serviceId || !tenantId) {
      setSelectedStaffIds([]);
      return;
    }

    const loadStaffAssignments = async () => {
      setLoadingStaff(true);
      try {
        const staffIds = await getServiceStaff(serviceId, tenantId);
        setSelectedStaffIds(staffIds);
      } catch (error) {
        console.error("Error loading staff assignments:", error);
        setSelectedStaffIds([]);
      } finally {
        setLoadingStaff(false);
      }
    };

    loadStaffAssignments();
  }, [serviceId, tenantId]);

  const handleInput =
    (field: keyof ServiceFormState, parser: (value: string) => any = (value) => value) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange({ [field]: parser(event.target.value) } as Partial<ServiceFormState>);
    };

  const pricingLevels = [
    { key: "standard", label: "Nivel estándar" },
    { key: "junior", label: "Nivel junior" },
    { key: "senior", label: "Nivel senior" },
    { key: "master", label: "Nivel master" },
  ] as const;

  const parseNumber = (value: string, min = 0) =>
    Math.max(min, Number(value) || 0);

  const parsePriceToCents = (value: string) =>
    Math.max(0, Math.round((Number(value) || 0) * 100));

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-white/60">
          Información básica
        </p>
        <div>
          <label className="mb-2 block text-sm font-medium text-white">
            Nombre <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={handleInput("name")}
            className="w-full rounded-[10px] border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            placeholder="Corte premium, diseño, afeitado..."
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-white">
            Categoría
          </label>
          <input
            list="service-category-options"
            value={form.category}
            onChange={handleInput("category")}
            placeholder="Corte, Barba, Color..."
            className="w-full rounded-[10px] border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          />
          <datalist id="service-category-options">
            {[...new Set([...SERVICE_PRESET_CATEGORIES, ...categoryOptions])]
              .filter(Boolean)
              .map((category) => (
                <option value={category} key={category} />
              ))}
          </datalist>
          <p className="mt-1 text-xs text-white/60">
            Selecciona una sugerencia o escribe una categoría personalizada.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-white/60">
          Asignación de staff
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Miembros del staff que pueden prestar este servicio
            </label>
            {staffOptionsLoading ? (
              <div className="p-3 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-white/5">
                <p className="text-sm text-[var(--color-text-secondary)]">Cargando miembros del staff...</p>
              </div>
            ) : staffOptions && staffOptions.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto glass p-3 rounded-[var(--radius-md)] border border-[var(--glass-border)]">
                {loadingStaff ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">Cargando asignaciones...</p>
                ) : (
                  staffOptions.map((staff) => (
                    <label
                      key={staff.id}
                      className="flex items-center gap-3 p-2 rounded-[var(--radius-sm)] hover:bg-[rgba(255,255,255,0.05)] transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.includes(staff.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStaffIds([...selectedStaffIds, staff.id]);
                          } else {
                            setSelectedStaffIds(selectedStaffIds.filter(id => id !== staff.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-[var(--glass-border)] text-[var(--accent-aqua)] focus:ring-2 focus:ring-[var(--accent-aqua)]"
                      />
                      <span className="text-sm text-[var(--color-text-primary)] font-medium">
                        {staff.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]" style={{ fontFamily: "var(--font-body)" }}>
                No hay miembros del staff disponibles. Ve a la sección Staff para añadir miembros.
              </p>
            )}
            <p className="text-xs text-[var(--color-text-secondary)] mt-2" style={{ fontFamily: "var(--font-body)" }}>
              {selectedStaffIds.length === 0
                ? "Si no seleccionas ninguno, cualquier miembro del staff podrá prestar este servicio."
                : `Solo ${selectedStaffIds.length} miembro${selectedStaffIds.length === 1 ? '' : 's'} del staff puede${selectedStaffIds.length === 1 ? '' : 'n'} prestar este servicio.`}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-white/60">
          Configuración
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Duración (min)
            </label>
            <input
              type="number"
              min={5}
              step={5}
              value={form.duration_min}
              onChange={handleInput("duration_min", (value) =>
                parseNumber(value, 5)
              )}
              className="w-full rounded-[10px] border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
            <p className="mt-1 text-xs text-white/60">
              Mínimo 5 minutos. Usa múltiplos de 5 para cuadrar la agenda.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Buffer adicional (min)
            </label>
            <input
              type="number"
              min={0}
              step={5}
              value={form.buffer_min}
              onChange={handleInput("buffer_min", (value) =>
                parseNumber(value, 0)
              )}
              className="w-full rounded-[10px] border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
            <p className="mt-1 text-xs text-white/60">
              Tiempo extra para limpieza o preparación entre citas.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Precio base (€)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={formatPriceField(form.price_cents)}
              onChange={handleInput("price_cents", parsePriceToCents)}
              className="w-full rounded-[10px] border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
            <p className="mt-1 text-xs text-white/60">
              Se convierte automáticamente a céntimos para Stripe y reportes.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-white/60">
          Precios por nivel
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {pricingLevels.map(({ key, label }) => (
            <div key={key}>
              <label className="mb-2 block text-sm font-medium text-white">
                {label}
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={
                  form.pricing_levels[key] !== null
                    ? formatPriceField(form.pricing_levels[key]!)
                    : ""
                }
                onChange={(event) => {
                  const value = event.target.value;
                  onChange({
                    pricing_levels: {
                      ...form.pricing_levels,
                      [key]: value === ""
                        ? null
                        : parsePriceToCents(value),
                    },
                  });
                }}
                placeholder="Ej. 25"
                className="w-full rounded-[10px] border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
              <p className="mt-1 text-xs text-white/60">
                Opcional. Si se deja vacío, se usará el precio base.
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-white/60">
          Próximamente (planificación)
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Descripción larga
            </label>
            <textarea
              value={form.description}
              placeholder="Texto que verá el cliente cuando abramos la ficha..."
              className="w-full rounded-[10px] border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-white/50">
              Campo deshabilitado hasta desplegar la ficha detallada del
              servicio.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              URL de imagen / icono
            </label>
            <input
              type="text"
              value={form.media_url}
              placeholder="https://..."
              className="w-full rounded-[10px] border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-white/50">
              Reservado para la próxima iteración (galería visual).
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              VIP tier
            </label>
            <select
              value={form.vip_tier}
              className="w-full rounded-[10px] border border-dashed border-white/15 bg-white/5 px-4 py-3 text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              disabled
            >
              <option value="standard">Standard</option>
              <option value="vip">VIP</option>
              <option value="premium">Premium</option>
            </select>
            <p className="mt-1 text-xs text-white/50">
              Se activará cuando lancemos los planes VIP y precios dinámicos.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Servicios combinados
            </label>
            <input
              type="text"
              value={form.combo_service_ids.join(", ")}
              placeholder="IDs relacionados"
              className="w-full rounded-[10px] border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-white/50">
              Placeholder para packs (Corte + Barba, tratamientos, etc.).
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Duración dinámica
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={form.duration_variants?.min ?? ""}
                className="w-full rounded-[10px] border border-dashed border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                disabled
                readOnly
              />
              <input
                type="number"
                value={form.duration_variants?.max ?? ""}
                className="w-full rounded-[10px] border border-dashed border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                disabled
                readOnly
              />
            </div>
            <p className="mt-1 text-xs text-white/50">
              Definiremos rangos (mín / máx) cuando habilitemos duración flexible.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-white/10 bg-white/5 px-4 py-3">
        <label className="flex items-center gap-3 text-sm text-white">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) =>
              onChange({ active: event.target.checked })
            }
            className="h-4 w-4 rounded border-white/30 bg-transparent text-white focus:ring-white/30"
          />
          Servicio activo
        </label>
        <p className="mt-2 text-xs text-white/60">
          Si está activo, tu equipo y clientes podrán reservarlo.
        </p>
      </div>
    </div>
  );
}

