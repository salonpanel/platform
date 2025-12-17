"use client";

import React, { useState, useEffect, useCallback } from "react";
import { GlassModal } from "@/components/ui/glass/GlassModal";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassInput } from "@/components/ui/glass/GlassInput";
import { GlassSelect } from "@/components/ui/glass/GlassSelect";
import { UserPermissions, DEFAULT_PERMISSIONS } from "@/hooks/useUserPermissions";
import { updateStaffServices, getStaffServices } from "@/lib/staff/staffServicesRelations";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, XCircle, Shield, User, Image as ImageIcon } from "lucide-react";

type Staff = {
  id: string;
  name: string;
  display_name: string | null;
  active: boolean;
  skills: string[] | null;
  profile_photo_url?: string | null;
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
    // Nuevos campos para crear usuario
    createUser?: boolean;
    email?: string;
    userRole?: string;
    // Permisos
    permissions?: UserPermissions;
    provides_services?: boolean;
    // Servicios asignados (IDs)
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
  console.log("[StaffEditModal] Render:", { isOpen, staffId: staff?.id, staffName: staff?.name, tenantId });

  const [form, setForm] = useState({
    name: "",
    skills: "",
    profile_photo_url: "",
    weekly_hours: 40,
    email: "",
    userRole: "staff",
    createUser: false,
    providesServices: true,
  });
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
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
      console.log("[StaffEditModal] Skipping loadSchedules: no staff or tenantId");
      return;
    }

    console.log("[StaffEditModal] Loading schedules for staff:", staff.id);
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
      console.log("[StaffEditModal] Schedules loaded successfully");
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
  }, [staff?.id, tenantId, supabase]);

  // Función para cargar permisos
  const loadPermissions = useCallback(async () => {
    if (!staff || !staff.user_id || !tenantId) {
      console.log("[StaffEditModal] Skipping loadPermissions: no staff.user_id or tenantId");
      return;
    }

    console.log("[StaffEditModal] Loading permissions for user:", staff.user_id);
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
        console.log("[StaffEditModal] Permissions loaded successfully");
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
        console.log("[StaffEditModal] Using default permissions");
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
      console.log("[StaffEditModal] Skipping loadStaffServices: no staff or tenantId");
      setSelectedServices([]);
      return;
    }

    console.log("[StaffEditModal] Loading services for staff:", staff.id);
    try {
      const serviceIds = await getStaffServices(staff.id, tenantId);
      setSelectedServices(serviceIds);
      console.log("[StaffEditModal] Services loaded successfully:", serviceIds.length);
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
    console.log("[StaffEditModal] useEffect triggered:", { isOpen, staffId: staff?.id, tenantId });

    if (!isOpen || !tenantId) {
      console.log("[StaffEditModal] Modal closed or no tenantId, resetting form");
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
      });
      setSchedules(DAYS_OF_WEEK.map((day) => ({
        day: day.day,
        name: day.name,
        startTime: "09:00",
        endTime: "19:00",
        isActive: day.day !== 0 && day.day !== 6, // Activo de lunes a viernes por defecto
      })));
      setSelectedServices([]);
      setSaveError(null);
      return;
    }

    if (staff) {
      console.log("[StaffEditModal] Initializing form for staff:", staff.display_name || staff.name);
      setForm({
        name: staff.display_name || staff.name,
        skills: staff.skills?.join(", ") || "",
        profile_photo_url: staff.profile_photo_url || "",
        weekly_hours: staff.weekly_hours || 40,
        email: "",
        userRole: "staff",
        createUser: false,
        providesServices: staff.provides_services ?? true,
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
      console.log("[StaffEditModal] No staff provided, using defaults for new staff");
      // Nuevo staff - valores por defecto
      setSchedules(DAYS_OF_WEEK.map((day) => ({
        day: day.day,
        name: day.name,
        startTime: "09:00",
        endTime: "19:00",
        isActive: day.day !== 0 && day.day !== 6, // Activo de lunes a viernes por defecto
      })));
      setSelectedServices([]);
    }
  }, [isOpen, staff?.id, tenantId, loadSchedules, loadPermissions, loadStaffServices]);

  const handleScheduleChange = (day: number, field: "startTime" | "endTime" | "isActive", value: string | boolean) => {
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
      // Usar selectedServices en lugar de parsear form.skills
      const skillsArray = selectedServices.length > 0 ? selectedServices : [];

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
        // Siempre crear usuario para nuevo staff (obligatorio)
        createUser: !staff, // true si es nuevo, false si estás editando
        email: !staff ? form.email.trim() : undefined,
        provides_services: form.providesServices,
        userRole: !staff ? form.userRole : undefined,
        permissions: staff?.user_id ? permissions : undefined, // Solo enviar permisos si el staff tiene user_id
        serviceIds: selectedServices, // Pasar IDs de servicios asignados
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
      title={staff ? "Editar Barbero" : "Nuevo Barbero"}
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
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200 flex items-center gap-2">
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
                : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
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
                : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
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
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
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
              placeholder="Nombre del barbero"
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
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Todos los miembros del equipo deben tener una cuenta para acceder al panel
                </p>

                <GlassInput
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="barbero@ejemplo.com"
                  helperText="Se enviará un email de bienvenida con instrucciones de acceso"
                />

                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-[var(--text-secondary)] ml-0.5">
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
                  <p className="text-[10px] sm:text-xs ml-0.5 text-[var(--text-secondary)]">
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

            <div className="rounded-xl p-4 border border-white/10 bg-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-white block">
                    Ofrece servicios
                  </label>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
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
                <p className="text-sm text-[var(--text-secondary)]">
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
                      <span className="text-sm text-[var(--text-primary)] group-hover:text-white transition-colors">
                        {service.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-[var(--text-secondary)] mt-2">
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
              <div className="text-center py-8 text-[var(--text-secondary)]">
                Cargando horarios...
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.day}
                    className={cn(
                      "rounded-xl p-4 border transition-all duration-200",
                      schedule.isActive
                        ? "bg-white/5 border-white/10"
                        : "bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 min-w-[120px]">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={schedule.isActive}
                            onChange={(e) =>
                              handleScheduleChange(schedule.day, "isActive", e.target.checked)
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                        </label>
                        <span className={cn(
                          "text-sm font-medium transition-colors",
                          schedule.isActive ? "text-white" : "text-[var(--text-secondary)]"
                        )}>
                          {schedule.name}
                        </span>
                      </div>

                      {schedule.isActive && (
                        <div className="flex items-center gap-2 flex-1">
                          <div className="relative flex-1">
                            <input
                              type="time"
                              value={schedule.startTime}
                              onChange={(e) =>
                                handleScheduleChange(schedule.day, "startTime", e.target.value)
                              }
                              className="w-full rounded-lg glass border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition-all duration-200 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <span className="text-[var(--text-secondary)]">-</span>
                          <div className="relative flex-1">
                            <input
                              type="time"
                              value={schedule.endTime}
                              onChange={(e) =>
                                handleScheduleChange(schedule.day, "endTime", e.target.value)
                              }
                              className="w-full rounded-lg glass border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition-all duration-200 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                        </div>
                      )}

                      {!schedule.isActive && (
                        <span className="text-xs text-[var(--text-disabled)] italic ml-auto">
                          Día libre
                        </span>
                      )}
                    </div>
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
              <div className="text-center py-8 text-[var(--text-secondary)]">
                Cargando permisos...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Descripción */}
                <div className="p-4 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Configura qué secciones del panel puede ver y acceder este usuario. Si desactivas una sección, no aparecerá en el menú y tampoco podrá acceder mediante URL directa.
                  </p>
                </div>

                {/* Grid de permisos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: "dashboard", label: "Dashboard", desc: "Vista general y estadísticas" },
                    { key: "agenda", label: "Agenda", desc: "Calendario y citas" },
                    { key: "clientes", label: "Clientes", desc: "Base de datos de clientes" },
                    { key: "servicios", label: "Servicios", desc: "Gestión de servicios" },
                    { key: "staff", label: "Staff", desc: "Equipo y barberos" },
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
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
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

