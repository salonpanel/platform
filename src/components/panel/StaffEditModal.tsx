"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { UserPermissions, DEFAULT_PERMISSIONS } from "@/hooks/useUserPermissions";
import { updateStaffServices, getStaffServices } from "@/lib/staff/staffServicesRelations";

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
  const [availableServices, setAvailableServices] = useState<Array<{id: string, name: string}>>([]);
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
      {saveError && (
        <div className="mb-4 rounded-[12px] border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          {saveError}
        </div>
      )}
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="schedule">Horarios</TabsTrigger>
          {staff?.user_id && <TabsTrigger value="permissions">Permisos</TabsTrigger>}
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <Input
            label="Nombre completo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Nombre del barbero"
          />

          {/* Sección de creación de usuario - OBLIGATORIO para nuevo staff */}
          {!staff && (
            <div className="space-y-4 p-4 rounded-[var(--radius-md)] glass border border-[var(--glass-border)]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent-aqua)]" />
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
                  Cuenta de usuario (Obligatorio)
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4" style={{ fontFamily: "var(--font-body)" }}>
                Todos los miembros del equipo deben tener una cuenta para acceder al panel
              </p>

              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="barbero@ejemplo.com"
                helperText="Se enviará un email de bienvenida con instrucciones de acceso"
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
                  Rol del usuario
                </label>
                <select
                  value={form.userRole}
                  onChange={(e) => setForm({ ...form, userRole: e.target.value })}
                  className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                >
                  <option value="staff">Staff - Solo puede ver su agenda</option>
                  <option value="admin">Admin - Puede gestionar todo excepto configuración</option>
                  <option value="owner">Owner - Acceso completo</option>
                </select>
                <p className="text-xs text-[var(--color-text-secondary)]" style={{ fontFamily: "var(--font-body)" }}>
                  {form.userRole === "staff" && "Podrá ver y gestionar su propia agenda de citas"}
                  {form.userRole === "admin" && "Podrá gestionar staff, servicios y ver todas las citas"}
                  {form.userRole === "owner" && "Tendrá acceso completo a todas las funcionalidades"}
                </p>
              </div>
            </div>
          )}

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

          <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] block" style={{ fontFamily: "var(--font-heading)" }}>
                  Ofrece servicios
                </label>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1" style={{ fontFamily: "var(--font-body)" }}>
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
                <div className="w-11 h-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--accent-aqua)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-aqua)]"></div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-3" style={{ fontFamily: "var(--font-body)" }}>
              Servicios que ofrece
            </label>
            {availableServices.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]" style={{ fontFamily: "var(--font-body)" }}>
                No hay servicios configurados. Ve a la sección Servicios para crearlos.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto glass p-3 rounded-[var(--radius-md)] border border-[var(--glass-border)]">
                {availableServices.map((service) => (
                  <label
                    key={service.id}
                    className="flex items-center gap-3 p-2 rounded-[var(--radius-sm)] hover:bg-[rgba(255,255,255,0.05)] transition-colors cursor-pointer"
                  >
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
                      className="w-4 h-4 rounded border-[var(--glass-border)] text-[var(--accent-aqua)] focus:ring-2 focus:ring-[var(--accent-aqua)]"
                    />
                    <span className="text-sm text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-body)" }}>
                      {service.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-[var(--color-text-secondary)] mt-2" style={{ fontFamily: "var(--font-body)" }}>
              Selecciona los servicios que este miembro del equipo puede realizar
            </p>
          </div>

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

        {/* Pestaña de Permisos - Solo si el staff tiene user_id */}
        {staff?.user_id && (
          <TabsContent value="permissions" className="space-y-4 mt-4">
            {loadingPermissions ? (
              <div className="text-center py-8 text-[var(--color-text-secondary)]">
                Cargando permisos...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Descripción */}
                <div className="p-4 rounded-[var(--radius-md)] glass border border-[var(--glass-border)] bg-[var(--accent-aqua-glass)]">
                  <p className="text-sm text-[var(--color-text-secondary)]" style={{ fontFamily: "var(--font-body)" }}>
                    Configura qué secciones del panel puede ver y acceder este usuario. Si desactivas una sección, no aparecerá en el menú y tampoco podrá acceder mediante URL directa.
                  </p>
                </div>

                {/* Grid de permisos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Dashboard */}
                  <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                          Dashboard
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Vista general y estadísticas
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.dashboard}
                          onChange={(e) => handlePermissionChange("dashboard", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--gradient-primary-start)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gradient-primary-start)]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Agenda */}
                  <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                          Agenda
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Calendario y citas
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.agenda}
                          onChange={(e) => handlePermissionChange("agenda", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--gradient-primary-start)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gradient-primary-start)]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Clientes */}
                  <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                          Clientes
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Base de datos de clientes
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.clientes}
                          onChange={(e) => handlePermissionChange("clientes", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--gradient-primary-start)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gradient-primary-start)]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Servicios */}
                  <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                          Servicios
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Gestión de servicios
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.servicios}
                          onChange={(e) => handlePermissionChange("servicios", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--gradient-primary-start)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gradient-primary-start)]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Staff */}
                  <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                          Staff
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Equipo y barberos
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.staff}
                          onChange={(e) => handlePermissionChange("staff", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--gradient-primary-start)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gradient-primary-start)]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Marketing */}
                  <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                          Marketing
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Campañas y promociones
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.marketing}
                          onChange={(e) => handlePermissionChange("marketing", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--gradient-primary-start)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gradient-primary-start)]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Reportes */}
                  <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                          Reportes
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Informes y análisis
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.reportes}
                          onChange={(e) => handlePermissionChange("reportes", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--gradient-primary-start)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gradient-primary-start)]"></div>
                      </label>
                    </div>
                  </div>

                  {/* Ajustes */}
                  <div className="glass rounded-[var(--radius-md)] p-4 border border-[var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                          Ajustes
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Configuración del sistema
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.ajustes}
                          onChange={(e) => handlePermissionChange("ajustes", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--gradient-primary-start)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gradient-primary-start)]"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </Modal>
  );
}

