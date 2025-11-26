"use client";

import { useEffect, useState, Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Spinner, Card, Button, EmptyState, Alert, SearchInput, useToast, TitleBar, PageHeader } from "@/components/ui";
import { StaffEditModal } from "@/components/panel/StaffEditModal";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { motion } from "framer-motion";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { User, UserPlus, Scissors, Calendar, Edit, Power } from "lucide-react";
import { UserPermissions } from "@/hooks/useUserPermissions";

type Staff = {
  id: string;
  name: string;
  display_name: string | null;
  active: boolean;
  skills: string[] | null;
  user_id: string | null;
  created_at: string;
  bookings_count?: number;
  profile_photo_url?: string | null;
  weekly_hours?: number | null;
};

function StaffContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const hasSyncedRef = useRef<boolean>(false);

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams?.toString()]);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        const { tenant, role } = await getCurrentTenant(impersonateOrgId);
        if (tenant) {
          setTenantId(tenant.id);
          setUserRole(role || null);
        } else {
          setError("No tienes acceso a ninguna barbería");
          setLoading(false);
        }
      } catch (err: any) {
        setError(err?.message || "Error al cargar información");
        setLoading(false);
      }
    };

    loadTenant();
  }, [impersonateOrgId]);

  const canManageStaff = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    if (!tenantId) return;

    let mounted = true;

    const loadStaff = async () => {
      try {
        setLoading(true);

        // Intentar sincronizar memberships -> staff una sola vez por tenantId
        if (!hasSyncedRef.current) {
          try {
            await fetch("/api/staff/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tenantId }),
            });
          } catch {}
          hasSyncedRef.current = true;
        }

        // Cargar staff con conteo de reservas - SOLO usuarios con cuenta
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select(`
            *,
            bookings:bookings(count)
          `)
          .eq("tenant_id", tenantId)
          .not("user_id", "is", null) // Solo staff con cuenta de usuario
          .order("name");

        if (staffError) {
          throw new Error(staffError.message);
        }

        if (mounted) {
          const staffWithCount = (staffData || []).map((s: any) => ({
            ...s,
            display_name: s.display_name || s.name,
            bookings_count: s.bookings?.[0]?.count || 0,
          }));
          setStaffList(staffWithCount as Staff[]);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Error al cargar staff");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadStaff();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel("rt-staff")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadStaff();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId]);

  const startEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setShowEditModal(true);
  };

  const handleSaveStaff = async (staffData: Partial<Staff> & { 
    createUser?: boolean; 
    email?: string; 
    userRole?: string;
    schedules?: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_active: boolean;
    }>;
    profile_photo_url?: string;
    weekly_hours?: number;
    permissions?: UserPermissions;
  }) => {
    if (!tenantId) return;

    setSaving(true);
    setError(null);

    try {
      let userId = editingStaff?.user_id || null;

      // Si se solicita crear usuario, llamar al endpoint
      if (staffData.createUser && staffData.email && staffData.userRole && !editingStaff) {
        try {
          const response = await fetch("/api/staff/create-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: staffData.email,
              full_name: staffData.name,
              role: staffData.userRole,
              tenant_id: tenantId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error al crear usuario");
          }

          const userData = await response.json();
          userId = userData.user_id;

          toast.showToast({
            type: "success",
            title: "Usuario creado",
            message: `Se ha enviado un email de acceso a ${staffData.email}`,
          });
        } catch (userError: any) {
          toast.showToast({
            type: "error",
            title: "Error al crear usuario",
            message: userError.message,
          });
          throw userError;
        }
      }

      // Si estamos editando, actualizar
      if (editingStaff) {
        const { data, error: updateError } = await supabase
          .from("staff")
          .update({
            name: staffData.name,
            display_name: staffData.display_name,
            skills: staffData.skills,
          })
          .eq("id", editingStaff.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Si hay horarios, actualizarlos
        if (staffData.schedules && staffData.schedules.length > 0) {
          // Primero eliminar horarios existentes
          await supabase
            .from("staff_schedules")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("staff_id", editingStaff.id);

          // Luego insertar los nuevos
          const schedulesToInsert = staffData.schedules.map((s) => ({
            tenant_id: tenantId,
            staff_id: editingStaff.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            is_active: s.is_active,
          }));

          const { error: scheduleError } = await supabase
            .from("staff_schedules")
            .insert(schedulesToInsert);

          if (scheduleError) {
            console.error("Error al guardar horarios:", scheduleError);
          }
        }

        // Si hay permisos y el staff tiene user_id, guardarlos o actualizarlos
        if (staffData.permissions && editingStaff.user_id) {
          const { error: permError } = await supabase
            .from("user_permissions")
            .upsert({
              user_id: editingStaff.user_id,
              tenant_id: tenantId,
              permissions: staffData.permissions,
            }, {
              onConflict: "user_id,tenant_id"
            });

          if (permError) {
            console.error("Error al guardar permisos:", permError);
          }
        }

        setStaffList((prev) =>
          prev.map((s) =>
            s.id === editingStaff.id
              ? { ...data, display_name: data.display_name || data.name, bookings_count: s.bookings_count }
              : s
          )
        );

        toast.showToast({
          type: "success",
          title: "Staff actualizado",
          message: "El miembro del staff se ha actualizado correctamente",
        });
      } else {
        // Crear nuevo staff
        const { data, error: insertError } = await supabase
          .from("staff")
          .insert({
            tenant_id: tenantId,
            name: staffData.name,
            display_name: staffData.display_name || staffData.name,
            skills: staffData.skills,
            active: true,
            profile_photo_url: staffData.profile_photo_url,
            weekly_hours: staffData.weekly_hours,
            user_id: userId,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        // Si hay horarios, insertarlos
        if (staffData.schedules && staffData.schedules.length > 0) {
          const schedulesToInsert = staffData.schedules.map((s) => ({
            tenant_id: tenantId,
            staff_id: data.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            is_active: s.is_active,
          }));

          const { error: scheduleError } = await supabase
            .from("staff_schedules")
            .insert(schedulesToInsert);

          if (scheduleError) {
            console.error("Error al guardar horarios:", scheduleError);
          }
        }

        // Si hay permisos y userId, guardarlos
        if (staffData.permissions && userId) {
          const { error: permError } = await supabase
            .from("user_permissions")
            .upsert({
              user_id: userId,
              tenant_id: tenantId,
              permissions: staffData.permissions,
            }, {
              onConflict: "user_id,tenant_id"
            });

          if (permError) {
            console.error("Error al guardar permisos:", permError);
          }
        }

        setStaffList((prev) => [...prev, { ...data, display_name: data.display_name || data.name, bookings_count: 0 }]);

        toast.showToast({
          type: "success",
          title: "Staff creado",
          message: `${data.display_name || data.name} se ha añadido al equipo${userId ? " con cuenta de usuario" : ""}`,
        });
      }

      setShowEditModal(false);
      setEditingStaff(null);
    } catch (err: any) {
      setError(err?.message || "Error al guardar staff");
      toast.showToast({
        type: "error",
        title: "Error",
        message: err?.message || "Error al guardar staff",
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    if (!canManageStaff) return;
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from("staff")
        .update({ active: !currentActive })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setStaffList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, active: data.active } : s))
      );
      toast.showToast({
        type: "success",
        title: data.active ? "Staff activado" : "Staff desactivado",
        message: `El miembro del staff ha sido ${data.active ? "activado" : "desactivado"}`,
      });
    } catch (err: any) {
      setError(err?.message || "Error al actualizar staff");
      toast.showToast({
        type: "error",
        title: "Error",
        message: err?.message || "Error al actualizar staff",
      });
    }
  };

  const filteredStaff = staffList.filter((staff) => {
    const search = searchTerm.toLowerCase();
    return (
      staff.name.toLowerCase().includes(search) ||
      staff.display_name?.toLowerCase().includes(search) ||
      staff.skills?.some((skill) => skill.toLowerCase().includes(search))
    );
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: "easeOut" as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !tenantId) {
    return (
      <Alert type="error" title="Error">
        {error}
      </Alert>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Premium Header */}
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Staff"
          subtitle={`${staffList.filter((s) => s.active).length} activos de ${staffList.length} total`}
          description="Gestiona los miembros de tu equipo, configura sus horarios y habilidades."
          actions={
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar por nombre o habilidades..."
                debounceMs={300}
                className="w-full sm:w-64"
              />
              {canManageStaff && (
                <Button
                  onClick={() => {
                    setEditingStaff(null);
                    setShowEditModal(true);
                  }}
                  icon={<UserPlus className="h-4 w-4" />}
                >
                  Nuevo Staff
                </Button>
              )}
            </div>
          }
        />
      </motion.div>

      {/* Mensaje de error */}
      {error && (
        <motion.div variants={itemVariants}>
          <Alert type="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      {/* Lista de staff */}
      {filteredStaff.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card variant="default">
            <EmptyState
              title={searchTerm ? "No se encontró staff" : "No hay staff registrado"}
              description={searchTerm ? "Intenta con otro criterio de búsqueda" : "Crea tu primer miembro del staff"}
            />
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filteredStaff.map((staff, index) => (
            <motion.div
              key={staff.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
            >
              <Card variant="default" className="cursor-default">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-[var(--radius-md)] bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)] p-2">
                        <User className="h-4 w-4 text-[var(--accent-aqua)]" />
                      </div>
                      <span
                        className="font-medium"
                        style={{
                          fontFamily: "var(--font-heading)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {staff.display_name || staff.name}
                      </span>
                      {staff.active ? (
                        <span className="rounded-[var(--radius-pill)] bg-[var(--color-success-glass)] border border-[var(--color-success)]/30 px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">
                          Activo
                        </span>
                      ) : (
                        <span className="rounded-[var(--radius-pill)] bg-[var(--glass-bg)] border border-[var(--glass-border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {staff.skills && staff.skills.length > 0 && (
                        <div
                          className="flex items-center gap-2"
                          style={{
                            fontFamily: "var(--font-body)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <Scissors className="h-4 w-4" />
                          {staff.skills.join(", ")}
                        </div>
                      )}
                      <div
                        className="flex items-center gap-2"
                        style={{
                          fontFamily: "var(--font-body)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Calendar className="h-4 w-4" />
                        {staff.bookings_count || 0} {staff.bookings_count === 1 ? "reserva" : "reservas"}
                      </div>
                    </div>
                  </div>
                  {canManageStaff && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(staff)}
                        icon={<Edit className="h-4 w-4" />}
                      >
                        Editar
                      </Button>
                      <Button
                        variant={staff.active ? "danger" : "secondary"}
                        size="sm"
                        onClick={() => toggleActive(staff.id, staff.active)}
                        icon={<Power className="h-4 w-4" />}
                      >
                        {staff.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal de edición/creación de staff */}
      {tenantId && canManageStaff && (
        <StaffEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingStaff(null);
          }}
          onSave={handleSaveStaff}
          staff={editingStaff}
          tenantId={tenantId}
          supabase={supabase}
        />
      )}
    </motion.div>
  );
}

export default function StaffPage() {
  return (
    <ProtectedRoute requiredPermission="staff">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        }
      >
        <StaffContent />
      </Suspense>
    </ProtectedRoute>
  );
}
