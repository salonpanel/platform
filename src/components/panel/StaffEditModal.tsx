"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";

type Staff = {
  id: string;
  name: string;
  display_name: string | null;
  active: boolean;
  skills: string[] | null;
  profile_photo_url?: string | null;
  weekly_hours?: number | null;
};

type DaySchedule = {
  day: number; // 0 = Domingo, 6 = Sábado
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

interface StaffEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    skills: string[];
    profile_photo_url?: string;
    weekly_hours?: number;
    schedules?: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_active: boolean;
    }>;
  }) => Promise<void>;
  staff: Staff | null;
  tenantId: string;
  supabase: any;
}

const DAYS_OF_WEEK = [
  { day: 0, name: "Domingo", short: "Dom" },
  { day: 1, name: "Lunes", short: "Lun" },
  { day: 2, name: "Martes", short: "Mar" },
  { day: 3, name: "Miércoles", short: "Mié" },
  { day: 4, name: "Jueves", short: "Jue" },
  { day: 5, name: "Viernes", short: "Vie" },
  { day: 6, name: "Sábado", short: "Sáb" },
];

export function StaffEditModal({
  isOpen,
  onClose,
  onSave,
  staff,
  tenantId,
  supabase,
}: StaffEditModalProps) {
  const [form, setForm] = useState({
    name: "",
    skills: "",
    profile_photo_url: "",
    weekly_hours: 40,
  });
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Función para cargar horarios
  const loadSchedules = useCallback(async () => {
    if (!staff || !tenantId) return;

    setLoadingSchedules(true);
    try {
      const { data, error } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("staff_id", staff.id)
        .order("day_of_week");

      if (error) throw error;

      // Crear horarios para todos los días
      const daySchedules: DaySchedule[] = DAYS_OF_WEEK.map((day) => {
        const existing = data?.find((s: any) => s.day_of_week === day.day);
        return {
          day: day.day,
          name: day.name,
          startTime: existing?.start_time?.substring(0, 5) || "09:00",
          endTime: existing?.end_time?.substring(0, 5) || "19:00",
          isActive: existing?.is_active ?? true,
        };
      });

      setSchedules(daySchedules);
    } catch (err: any) {
      console.error("Error al cargar horarios:", err);
      // En caso de error, usar valores por defecto
      setSchedules(DAYS_OF_WEEK.map((day) => ({
        day: day.day,
        name: day.name,
        startTime: "09:00",
        endTime: "19:00",
        isActive: day.day !== 0 && day.day !== 6,
      })));
    } finally {
      setLoadingSchedules(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id, tenantId]);

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !tenantId) {
      // Reset form when closing
      setForm({
        name: "",
        skills: "",
        profile_photo_url: "",
        weekly_hours: 40,
      });
      setSchedules(DAYS_OF_WEEK.map((day) => ({
        day: day.day,
        name: day.name,
        startTime: "09:00",
        endTime: "19:00",
        isActive: day.day !== 0 && day.day !== 6, // Activo de lunes a viernes por defecto
      })));
      return;
    }

    if (staff) {
      setForm({
        name: staff.display_name || staff.name,
        skills: staff.skills?.join(", ") || "",
        profile_photo_url: staff.profile_photo_url || "",
        weekly_hours: staff.weekly_hours || 40,
      });

      // Cargar horarios
      loadSchedules();
    } else {
      // Nuevo staff - valores por defecto
      setSchedules(DAYS_OF_WEEK.map((day) => ({
        day: day.day,
        name: day.name,
        startTime: "09:00",
        endTime: "19:00",
        isActive: day.day !== 0 && day.day !== 6, // Activo de lunes a viernes por defecto
      })));
    }
  }, [isOpen, staff?.id, tenantId, loadSchedules]);

  const handleScheduleChange = (day: number, field: "startTime" | "endTime" | "isActive", value: string | boolean) => {
    setSchedules((prev) =>
      prev.map((s) => (s.day === day ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const skillsArray = form.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const schedulesData = schedules
        .filter((s) => s.isActive)
        .map((s) => ({
          day_of_week: s.day,
          start_time: `${s.startTime}:00`,
          end_time: `${s.endTime}:00`,
          is_active: true,
        }));

      await onSave({
        name: form.name.trim(),
        skills: skillsArray,
        profile_photo_url: form.profile_photo_url.trim() || undefined,
        weekly_hours: form.weekly_hours || undefined,
        schedules: schedulesData,
      });
    } catch (err: any) {
      console.error("Error al guardar:", err);
    } finally {
      setLoading(false);
    }
  };

  // El modal se puede abrir sin staff (para crear nuevo) o con staff (para editar)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={staff ? "Editar Barbero" : "Nuevo Barbero"}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={loading}>
            Guardar
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="schedule">Horarios</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <Input
            label="Nombre completo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Nombre del barbero"
          />

          <Input
            label="Foto de perfil (URL)"
            value={form.profile_photo_url}
            onChange={(e) => setForm({ ...form, profile_photo_url: e.target.value })}
            placeholder="https://ejemplo.com/foto.jpg"
            helperText="URL de la foto que se mostrará al público"
          />

          {form.profile_photo_url && (
            <div className="mt-2">
              <img
                src={form.profile_photo_url}
                alt="Preview"
                className="w-24 h-24 rounded-full object-cover border-2 border-[var(--glass-border)]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          <Input
            label="Habilidades"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="Corte, Barba, Tinte (separadas por comas)"
            helperText="Separa las habilidades con comas"
          />

          <Input
            label="Horas semanales"
            type="number"
            value={form.weekly_hours}
            onChange={(e) =>
              setForm({ ...form, weekly_hours: parseInt(e.target.value) || 40 })
            }
            min={1}
            max={168}
            helperText="Número de horas semanales de alta (para configuración con IA de horarios)"
          />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 mt-4">
          {loadingSchedules ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              Cargando horarios...
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.day}
                  className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <input
                        type="checkbox"
                        checked={schedule.isActive}
                        onChange={(e) =>
                          handleScheduleChange(schedule.day, "isActive", e.target.checked)
                        }
                        className="rounded border-[var(--glass-border)]"
                      />
                      <label className="text-sm font-medium text-[var(--color-text-primary)] font-satoshi">
                        {schedule.name}
                      </label>
                    </div>

                    {schedule.isActive && (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) =>
                            handleScheduleChange(schedule.day, "startTime", e.target.value)
                          }
                          className="rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                          style={{ borderRadius: "var(--radius-md)" }}
                        />
                        <span className="text-[var(--color-text-secondary)]">-</span>
                        <input
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) =>
                            handleScheduleChange(schedule.day, "endTime", e.target.value)
                          }
                          className="rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                          style={{ borderRadius: "var(--radius-md)" }}
                        />
                      </div>
                    )}

                    {!schedule.isActive && (
                      <span className="text-xs text-[var(--color-text-disabled)]">
                        Día libre
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Modal>
  );
}

