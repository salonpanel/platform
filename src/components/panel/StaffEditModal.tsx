"use client";

import React, { useState, useEffect, useCallback } from "react";
import { GlassModal } from "@/components/ui/glass/GlassModal";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassInput } from "@/components/ui/glass/GlassInput";
import { GlassSelect } from "@/components/ui/glass/GlassSelect";
import { UserPermissions, DEFAULT_PERMISSIONS } from "@/hooks/useUserPermissions";
import { updateStaffServices, getStaffServices } from "@/lib/staff/staffServicesRelations";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, XCircle, Shield, User, Image as ImageIcon, Plus, Minus } from "lucide-react";

type Staff = {
  id: string;
  name: string;
  display_name: string | null;
  active: boolean;
  skills: string[] | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  color?: string | null;
  bio?: string | null;
  weekly_hours?: number | null;
  user_id?: string | null;
  provides_services?: boolean;
};

type DaySchedule = {
  day: number; // 0 = Domingo, 6 = Sábado
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  hasBreak: boolean;   // ¿tiene descanso intermedio?
  breakStart: string;  // Inicio del 2.º turno (tras descanso)
  breakEnd: string;    // Fin del 2.º turno
};

/** Construye un DaySchedule con valores por defecto */
const makeDefaultSchedule = (day: number, name: string): DaySchedule => ({
  day,
  name,
  startTime: "09:00",
  endTime: "19:00",
  isActive: day !== 0 && day !== 6,
  hasBreak: false,
  breakStart: "14:00",
  breakEnd: "16:00",
});

interface StaffEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    display_name?: string;
    skills: string[];
    profile_photo_url?: string;
    weekly_hours?: number;
    color?: string;
    bio?: string;
    schedules?: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_active: boolean;
    }>;
    createUser?: boolean;
    email?: string;
    userRole?: string;
    permissions?: UserPermissions;
    provides_services?: boolean;
    serviceIds?: string[];
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
}: StaffEditModalProps): React.ReactElement {
  const [form, setForm] = useState({
    name: "",
    skills: "",
    profile_photo_url: "",
    weekly_hours: 40,
    email: "",
    userRole: "staff",
    createUser: false,
    providesServices: true,
    color: "#4cb3ff",
    bio: "",
  });
  const [schedules, setSchedules] = useState<DaySchedule[]>(
    () => DAYS_OF_WEEK.map((d) => makeDefaultSchedule(d.day, d.name))
  );
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [availableServices, setAvailableServices] = useState<Array<{ id: string, name: string }>>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Función para cargar horarios
  const loadSchedules = useCallback(async () => {
    if (!staff || !tenantId) {
      return;
    }

    setLoadingSchedules(true);
    try {
      const { data, error } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("staff_id", staff.id)
        .order("day_of_week");

      if (error) throw error;

      // Crear horarios para todos los días — soporte de hasta 2 filas/día (descanso)
      const daySchedules: DaySchedule[] = DAYS_OF_WEEK.map((day) => {
        const rows = (data || [])
          .filter((s: any) => s.day_of_week === day.day)
          .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

        const first = rows[0];
        const second = rows[1]; // 2.º turno (tras descanso), si existe

        if (!first) return makeDefaultSchedule(day.day, day.name);

        return {
          day: day.day,
          name: day.name,
          startTime: first.start_time.substring(0, 5),
          endTime:   first.end_time.substring(0, 5),
          isActive:  first.is_active ?? true,
          hasBreak:  !!second,
          breakStart: second ? second.start_time.substring(0, 5) : "14:00",
          breakEnd:   second ? second.end_time.substring(0, 5)   : "16:00",
        };
      });

      setSchedules(daySchedules);
    } catch (err: any) {
      console.error("Error al cargar horarios:", err);
      // En caso de error, usar valores por defecto
      setSchedules(DAYS_OF_WEEK.map((d) => makeDefaultSchedule(d.day, d.name)));
    } finally {
      setLoadingSchedules(false);
    }
  }, [staff?.id, tenantId, supabase]);

  // Función para cargar permisos
  const loadPermissions = useCallback(async () => {
    if (!staff || !staff.user_id || !tenantId) {
      return;
    }

    setLoadingPermissions(true);
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("permissions")
        .eq("user_id", staff.user_id)
        .eq("tenant_id", tenantId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned, es esperado si no tiene permisos configurados
        throw error;
      }

      if (data?.permissions) {
        setPermissions(data.permissions as UserPermissions);
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } catch (err: any) {
      console.error("Error al cargar permisos:", err);
      setPermissions(DEFAULT_PERMISSIONS);
    } finally {
      setLoadingPermissions(false);
    }
  }, [staff?.user_id, tenantId, supabase]);

  // Función para cargar servicios actuales del staff
  const loadStaffServices = useCallback(async () => {
    if (!staff || !tenantId) {
      setSelectedServices([]);
      return;
    }

    try {
      const serviceIds = await getStaffServices(staff.id, tenantId);
      setSelectedServices(serviceIds);
    } catch (err: any) {
      console.error("Error al cargar servicios del staff:", err);
      setSelectedServices([]);
    }
  }, [staff?.id, tenantId]);
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const loadServices = async () => {
      try {
        const { data, error } = await supabase
          .from("services")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("name");

        if (error) throw error;
        setAvailableServices(data || []);
      } catch (err: any) {
        console.error("Error al cargar servicios:", err);
      }
    };

    loadServices();
  }, [isOpen, tenantId, supabase]);

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !tenantId) {
      // Reset form when closing
      setForm({
        name: "",
        skills: "",
        profile_photo_url: "",
        weekly_hours: 40,
        email: "",
        userRole: "staff",
        createUser: false,
        providesServices: true,
        color: "#4cb3ff",
        bio: "",
      });
      setSchedules(DAYS_OF_WEEK.map((d) => makeDefaultSchedule(d.day, d.name)));
      setSelectedServices([]);
      setSaveError(null);
      return;
    }

    if (staff) {
      setForm({
        name: staff.display_name || staff.name,
        skills: staff.skills?.join(", ") || "",
        profile_photo_url: staff.profile_photo_url || staff.avatar_url || "",
        weekly_hours: staff.weekly_hours || 40,
        email: "",
        userRole: "staff",
        createUser: false,
        providesServices: staff.provides_services ?? true,
        color: staff.color || "#4cb3ff",
        bio: staff.bio || "",
      });

      // Cargar servicios seleccionados
      loadStaffServices();

      // Cargar horarios y permisos
      loadSchedules();
      if (staff.user_id) {
        loadPermissions();
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } else {
      // Nuevo staff - valores por defecto
      setSchedules(DAYS_OF_WEEK.map((d) => makeDefaultSchedule(d.day, d.name)));
      setSelectedServices([]);
    }
  }, [isOpen, staff?.id, tenantId, loadSchedules, loadPermissions, loadStaffServices]);

  const handleScheduleChange = (
    day: number,
    field: "startTime" | "endTime" | "isActive" | "hasBreak" | "breakStart" | "breakEnd",
    value: string | boolean
  ) => {
    setSchedules((prev) =>
      prev.map((s) => (s.day === day ? { ...s, [field]: value } : s))
    );
  };

  const handlePermissionChange = (key: keyof UserPermissions, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const [activeTab, setActiveTab] = useState("info");

  const handleSave = async () => {
    setSaveError(null);
    setLoading(true);
    try {
      // Skills (texto) y servicios (relación) son cosas distintas
      const skillsArray = form.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Genera 1 o 2 filas por día según tenga descanso
      const schedulesData = schedules
        .filter((s) => s.isActive)
        .flatMap((s) => {
          const turno1 = {
            day_of_week: s.day,
            start_time: `${s.startTime}:00`,
            end_time:   `${s.endTime}:00`,
            is_active: true,
          };
          if (s.hasBreak && s.breakStart && s.breakEnd) {
            return [
              turno1,
              {
                day_of_week: s.day,
                start_time: `${s.breakStart}:00`,
                end_time:   `${s.breakEnd}:00`,
                is_active: true,
              },
            ];
          }
          return [turno1];
        });

      await onSave({
        name: form.name.trim(),
        display_name: form.name.trim(),
        skills: skillsArray,
        profile_photo_url: form.profile_photo_url.trim() || undefined,
        weekly_hours: form.weekly_hours || undefined,
        color: form.color || undefined,
        bio: form.bio.trim() || undefined,
        schedules: schedulesData,
        createUser: !staff,
        email: !staff ? form.email.trim() : undefined,
        provides_services: form.providesServices,
        userRole: !staff ? form.userRole : undefined,
        permissions: staff?.user_id ? permissions : undefined,
        serviceIds: selectedServices,
      });
    } catch (err) {
      console.error("Error al guardar:", err);
      const message =
        err && typeof err === "object" && "message" in err && typeof (err as any).message === "string"
          ? (err as any).message
          : "No se pudo guardar el miembro del equipo. Inténtalo de nuevo.";
      setSaveError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={staff ? "Editar Miembro" : "Nuevo Miembro"}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <GlassButton variant="secondary" onClick={onClose}>
            Cancelar
          </GlassButton>
          <GlassButton onClick={handleSave} isLoading={loading}>
            Guardar
          </GlassButton>
        </div>
      }
    >
      {saveError && (
        <div className="mb-4 rounded-xl border border-[rgba(224,96,114,0.20)] bg-[rgba(224,96,114,0.10)] p-3 text-sm text-[#F2A0AC] flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          {saveError}
        </div>
      )}

      <div className="space-y-6">
        {/* Custom Tabs */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab("info")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all",
              activeTab === "info"
                ? "bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20"
                : "text-[var(--bf-ink-300)] hover:text-white hover:bg-white/5"
            )}
          >
            <User className="h-4 w-4" />
            Información
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all",
              activeTab === "schedule"
                ? "bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20"
                : "text-[var(--bf-ink-300)] hover:text-white hover:bg-white/5"
            )}
          >
            <Clock className="h-4 w-4" />
            Horarios
          </button>
          {staff?.user_id && (
            <button
              onClick={() => setActiveTab("permissions")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all",
                activeTab === "permissions"
                  ? "bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20"
                  : "text-[var(--bf-ink-300)] hover:text-white hover:bg-white/5"
              )}
            >
              <Shield className="h-4 w-4" />
              Permisos
            </button>
          )}
        </div>

        {/* Info Content */}
        {activeTab === "info" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <GlassInput
              label="Nombre completo"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Nombre del miembro"
            />

            {/* Sección de creación de usuario - OBLIGATORIO para nuevo staff */}
            {!staff && (
              <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  <h3 className="text-sm font-medium text-white">
                    Cuenta de usuario (Obligatorio)
                  </h3>
                </div>
                <p className="text-xs text-[var(--bf-ink-300)] mb-4">
                  Todos los miembros del equipo deben tener una cuenta para acceder al panel
                </p>

                <GlassInput
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="miembro@ejemplo.com"
                  helperText="Se enviará un email de bienvenida con instrucciones de acceso"
                />

                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-[var(--bf-ink-300)] ml-0.5">
                    Rol del usuario
                  </label>
                  <select
                    value={form.userRole}
                    onChange={(e) => setForm({ ...form, userRole: e.target.value })}
                    className="w-full appearance-none rounded-lg glass border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition-all duration-200 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="staff" className="bg-gray-900 text-white">Staff - Solo puede ver su agenda</option>
                    <option value="manager" className="bg-gray-900 text-white">Manager - Puede gestionar todo excepto configuración</option>
                    <option value="owner" className="bg-gray-900 text-white">Owner - Acceso completo</option>
                  </select>
                  <p className="text-[10px] sm:text-xs ml-0.5 text-[var(--bf-ink-300)]">
                    {form.userRole === "staff" && "Podrá ver y gestionar su propia agenda de citas"}
                    {form.userRole === "manager" && "Podrá gestionar staff, servicios y ver todas las citas"}
                    {form.userRole === "owner" && "Tendrá acceso completo a todas las funcionalidades"}
                  </p>
                </div>
              </div>
            )}

            <GlassInput
              label="Foto de perfil (URL)"
              value={form.profile_photo_url}
              onChange={(e) => setForm({ ...form, profile_photo_url: e.target.value })}
              placeholder="https://ejemplo.com/foto.jpg"
              helperText="URL de la foto que se mostrará al público"
            />

            {form.profile_photo_url && (
              <div className="mt-2 flex justify-center">
                <img
                  src={form.profile_photo_url}
                  alt="Preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-white/10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}

            {/* Color picker for agenda */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white">
                Color en la agenda
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 w-14 rounded-lg border border-white/10 bg-white/5 cursor-pointer p-1"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {["#4cb3ff", "#a78bfa", "#34d399", "#f59e0b", "#f87171", "#fb923c", "#e879f9", "#2dd4bf"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        form.color === c ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <span className="text-xs text-[var(--bf-ink-300)] font-mono">{form.color}</span>
              </div>
              <p className="text-xs text-[var(--bf-ink-300)]">
                Color que identifica a este miembro en la vista de agenda.
              </p>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white">
                Bio / descripción
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={2}
                maxLength={200}
                placeholder="Especialista en cortes clásicos y degradados…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[var(--bf-ink-300)]/50 focus:border-[var(--bf-primary)]/40 focus:outline-none resize-none transition-colors"
              />
              <p className="text-xs text-[var(--bf-ink-300)]">
                Visible en el portal de reservas al elegir miembro. Máx. 200 caracteres.
              </p>
            </div>

            <div className="rounded-xl p-4 border border-white/10 bg-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-white block">
                    Ofrece servicios
                  </label>
                  <p className="text-xs text-[var(--bf-ink-300)] mt-1">
                    Indica si este miembro aparece como reservable en la agenda
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.providesServices}
                    onChange={(e) => setForm({ ...form, providesServices: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-3">
                Servicios que ofrece
              </label>
              {availableServices.length === 0 ? (
                <p className="text-sm text-[var(--bf-ink-300)]">
                  No hay servicios configurados. Ve a la sección Servicios para crearlos.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar p-1">
                  {availableServices.map((service) => (
                    <label
                      key={service.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5 group"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        selectedServices.includes(service.id)
                          ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                          : "border-white/20 group-hover:border-white/40"
                      )}>
                        {selectedServices.includes(service.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedServices([...selectedServices, service.id]);
                          } else {
                            setSelectedServices(selectedServices.filter(s => s !== service.id));
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm text-[var(--bf-ink-50)] group-hover:text-white transition-colors">
                        {service.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-[var(--bf-ink-300)] mt-2">
                Selecciona los servicios que este miembro del equipo puede realizar
              </p>
            </div>

            <GlassInput
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
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {loadingSchedules ? (
              <div className="text-center py-8 text-[var(--bf-ink-300)]">
                Cargando horarios...
              </div>
            ) : (
              <div className="space-y-2">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.day}
                    className={cn(
                      "rounded-xl p-3 border transition-all duration-200",
                      schedule.isActive
                        ? "bg-white/5 border-white/10"
                        : "bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100"
                    )}
                  >
                    {/* Fila 1: toggle + nombre del día */}
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={schedule.isActive}
                          onChange={(e) =>
                            handleScheduleChange(schedule.day, "isActive", e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent)]" />
                      </label>
                      <span className={cn(
                        "text-sm font-medium transition-colors w-20 flex-shrink-0",
                        schedule.isActive ? "text-white" : "text-[var(--bf-ink-300)]"
                      )}>
                        {schedule.name}
                      </span>
                      {!schedule.isActive && (
                        <span className="text-xs text-[var(--text-disabled)] italic ml-auto">
                          Día libre
                        </span>
                      )}
                    </div>

                    {/* Filas de horario: solo cuando está activo */}
                    {schedule.isActive && (
                      <div className="mt-2.5 space-y-2 pl-12">
                        {/* Turno 1 */}
                        <div className="flex items-center gap-2">
                          {schedule.hasBreak && (
                            <span className="text-[10px] font-medium text-[var(--bf-ink-300)] uppercase tracking-wide w-12 flex-shrink-0">
                              Turno 1
                            </span>
                          )}
                          <input
                            type="time"
                            value={schedule.startTime}
                            onChange={(e) =>
                              handleScheduleChange(schedule.day, "startTime", e.target.value)
                            }
                            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white transition-all duration-200 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                          <span className="text-[var(--bf-ink-300)] text-xs">–</span>
                          <input
                            type="time"
                            value={schedule.endTime}
                            onChange={(e) =>
                              handleScheduleChange(schedule.day, "endTime", e.target.value)
                            }
                            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white transition-all duration-200 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                          {!schedule.hasBreak && (
                            <button
                              type="button"
                              onClick={() => handleScheduleChange(schedule.day, "hasBreak", true)}
                              title="Añadir descanso"
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--color-accent)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/10 transition-colors flex-shrink-0"
                            >
                              <Plus className="h-3 w-3" />
                              <span className="hidden sm:inline">Descanso</span>
                            </button>
                          )}
                        </div>

                        {/* Turno 2 (descanso intermedio) */}
                        {schedule.hasBreak && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-[var(--bf-ink-300)] uppercase tracking-wide w-12 flex-shrink-0">
                              Turno 2
                            </span>
                            <input
                              type="time"
                              value={schedule.breakStart}
                              onChange={(e) =>
                                handleScheduleChange(schedule.day, "breakStart", e.target.value)
                              }
                              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white transition-all duration-200 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                            <span className="text-[var(--bf-ink-300)] text-xs">–</span>
                            <input
                              type="time"
                              value={schedule.breakEnd}
                              onChange={(e) =>
                                handleScheduleChange(schedule.day, "breakEnd", e.target.value)
                              }
                              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white transition-all duration-200 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                            <button
                              type="button"
                              onClick={() => handleScheduleChange(schedule.day, "hasBreak", false)}
                              title="Eliminar descanso"
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--bf-danger)] border border-[rgba(224,96,114,0.20)] hover:bg-[rgba(224,96,114,0.10)] transition-colors flex-shrink-0"
                            >
                              <Minus className="h-3 w-3" />
                              <span className="hidden sm:inline">Quitar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pestaña de Permisos - Solo si el staff tiene user_id */}
        {/* Pestaña de Permisos - Solo si el staff tiene user_id */}
        {activeTab === "permissions" && staff?.user_id && (
          <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {loadingPermissions ? (
              <div className="text-center py-8 text-[var(--bf-ink-300)]">
                Cargando permisos...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Descripción */}
                <div className="p-4 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10">
                  <p className="text-sm text-[var(--bf-ink-300)]">
                    Configura qué secciones del panel puede ver y acceder este usuario. Si desactivas una sección, no aparecerá en el menú y tampoco podrá acceder mediante URL directa.
                  </p>
                </div>

                {/* Grid de permisos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: "dashboard", label: "Estadísticas", desc: "Vista general y métricas" },
                    { key: "agenda", label: "Agenda", desc: "Calendario y citas" },
                    { key: "clientes", label: "Clientes", desc: "Base de datos de clientes" },
                    { key: "servicios", label: "Servicios", desc: "Gestión de servicios" },
                    { key: "staff", label: "Staff", desc: "Equipo y miembros" },
                    { key: "marketing", label: "Marketing", desc: "Campañas y promociones" },
                    { key: "reportes", label: "Reportes", desc: "Informes y análisis" },
                    { key: "ajustes", label: "Ajustes", desc: "Configuración del sistema" },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl p-4 border border-white/10 bg-white/5 transition-all hover:bg-white/[0.07]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-white">
                            {item.label}
                          </h4>
                          <p className="text-xs text-[var(--bf-ink-300)] mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions[item.key as keyof UserPermissions]}
                            onChange={(e) => handlePermissionChange(item.key as keyof UserPermissions, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassModal>
  );
}

