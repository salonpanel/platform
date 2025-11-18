"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Spinner } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StaffEditModal } from "@/components/panel/StaffEditModal";
import { Alert } from "@/components/ui/Alert";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

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
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

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
        
        // Cargar staff con conteo de reservas
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select(`
            *,
            bookings:bookings(count)
          `)
          .eq("tenant_id", tenantId)
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

  // La función createStaff ahora está integrada en handleSaveStaff

  const startEdit = (staff: Staff) => {
    if (!canManageStaff) return;
    setEditingStaff(staff);
    setShowEditModal(true);
  };

  const handleSaveStaff = async (data: {
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
  }) => {
    if (!tenantId || !canManageStaff) return;

    setError(null);
    setSaving(true);

    try {
      if (editingStaff) {
        // Actualizar staff existente
        const { data: updatedStaff, error: updateError } = await supabase
          .from("staff")
          .update({
            name: data.name.trim(),
            display_name: data.name.trim(),
            skills: data.skills.length > 0 ? data.skills : null,
            profile_photo_url: data.profile_photo_url || null,
            weekly_hours: data.weekly_hours || null,
          })
          .eq("id", editingStaff.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Actualizar horarios
        if (data.schedules && data.schedules.length > 0) {
          // Eliminar horarios existentes
          await supabase
            .from("staff_schedules")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("staff_id", editingStaff.id);

          // Insertar nuevos horarios
          const schedulesToInsert = data.schedules.map((s) => ({
            tenant_id: tenantId,
            staff_id: editingStaff.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            is_active: s.is_active,
          }));

          const { error: schedulesError } = await supabase
            .from("staff_schedules")
            .insert(schedulesToInsert);

          if (schedulesError) throw schedulesError;
        }

        setStaffList((prev) =>
          prev.map((s) =>
            s.id === editingStaff.id
              ? { ...updatedStaff, bookings_count: s.bookings_count }
              : s
          )
        );
      } else {
        // Crear nuevo staff
        const { data: newStaff, error: createError } = await supabase
          .from("staff")
          .insert({
            tenant_id: tenantId,
            name: data.name.trim(),
            display_name: data.name.trim(),
            active: true,
            skills: data.skills.length > 0 ? data.skills : null,
            profile_photo_url: data.profile_photo_url || null,
            weekly_hours: data.weekly_hours || null,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Insertar horarios
        if (data.schedules && data.schedules.length > 0) {
          const schedulesToInsert = data.schedules.map((s) => ({
            tenant_id: tenantId,
            staff_id: newStaff.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            is_active: s.is_active,
          }));

          const { error: schedulesError } = await supabase
            .from("staff_schedules")
            .insert(schedulesToInsert);

          if (schedulesError) throw schedulesError;
        }

        setStaffList((prev) => [...prev, { ...newStaff, bookings_count: 0 }]);
      }

      setShowEditModal(false);
      setEditingStaff(null);
    } catch (err: any) {
      setError(err?.message || "Error al guardar staff");
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
    } catch (err: any) {
      setError(err?.message || "Error al actualizar staff");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-slate-400">Cargando staff...</p>
        </div>
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
    <div className="space-y-4">
      {/* Header con búsqueda y botón de añadir */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] font-satoshi leading-tight">Staff</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {staffList.filter((s) => s.active).length} activos de {staffList.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Buscar por nombre o habilidades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 transition-all duration-200"
            />
            {canManageStaff && (
              <Button onClick={() => {
                setEditingStaff(null);
                setShowEditModal(true);
              }}>
                + Nuevo Staff
              </Button>
            )}
          </div>
        </div>

        {!canManageStaff && (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Solo los administradores pueden crear o editar miembros del staff.
          </p>
        )}
      </GlassCard>

      {/* Mensaje de error */}
      {error && (
        <Alert type="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Lista de staff */}
      {filteredStaff.length === 0 ? (
        <EmptyState
          title={searchTerm ? "No se encontró staff" : "No hay staff registrado"}
          description={searchTerm ? "Intenta con otro criterio de búsqueda" : "Crea tu primer miembro del staff"}
        />
      ) : (
        <div className="space-y-3">
          {filteredStaff.map((staff) => (
            <motion.div
              key={staff.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-[var(--radius-lg)] hover:scale-[1.01] transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, rgba(123, 92, 255, 0.05) 0%, rgba(77, 226, 195, 0.03) 100%)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)] font-satoshi">
                        {staff.display_name || staff.name}
                      </span>
                      <StatusBadge status={staff.active ? "active" : "inactive"} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
                      {staff.skills && staff.skills.length > 0 && (
                        <span className="flex items-center gap-1">
                          <span>✂️</span>
                          {staff.skills.join(", ")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span>📅</span>
                        {staff.bookings_count || 0} {staff.bookings_count === 1 ? "reserva" : "reservas"}
                      </span>
                    </div>
                  </div>
                  {canManageStaff && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(staff)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant={staff.active ? "danger" : "secondary"}
                        size="sm"
                        onClick={() => toggleActive(staff.id, staff.active)}
                      >
                        {staff.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  )}
                </div>
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
    </div>
  );
}

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <StaffContent />
    </Suspense>
  );
}

