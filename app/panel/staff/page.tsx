"use client";

import { useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { GlassCard, GlassButton, GlassEmptyState, GlassToast } from "@/components/ui/glass";
import { StaffEditModal } from "@/components/panel/StaffEditModal";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { useStaffPageData } from "@/hooks/useOptimizedData";
import { useStaffHandlers } from "@/hooks/useStaffHandlersV2";
import {
  UserPlus, Search, X, User, Calendar, Scissors,
  Power, Edit, CheckCircle, XCircle, Clock
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffMember = {
  id: string;
  name: string;
  display_name: string | null;
  active: boolean;
  skills: string[] | null;
  user_id: string | null;
  created_at: string;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  color?: string | null;
  bio?: string | null;
  weekly_hours?: number | null;
  provides_services?: boolean;
  bookings_today?: number;
  bookings_this_week?: number;
  bookings_all_time?: number;
  role?: string | null;
};

// ─── Staff card ───────────────────────────────────────────────────────────────

function StaffCard({
  member,
  onEdit,
  onToggle,
  isToggling,
}: {
  member: StaffMember;
  onEdit: (m: StaffMember) => void;
  onToggle: (id: string, active: boolean) => void;
  isToggling: boolean;
}) {
  const photo = member.profile_photo_url || member.avatar_url;
  const displayName = member.display_name || member.name;
  const color = member.color || "#4cb3ff";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      <GlassCard className={`p-4 transition-all duration-200 hover:border-white/15 ${!member.active ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-4">

          {/* Avatar */}
          <div className="relative shrink-0">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt={displayName}
                className="w-12 h-12 rounded-xl object-cover border-2"
                style={{ borderColor: color + "60" }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: color + "25", border: `2px solid ${color}40` }}
              >
                <span style={{ color }}>{initials}</span>
              </div>
            )}
            {/* Active indicator */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f0f1a] ${
                member.active ? "bg-green-400" : "bg-white/20"
              }`}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{displayName}</p>
                {member.bio && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">{member.bio}</p>
                )}
                {member.role && (
                  <p className="text-xs text-[var(--text-secondary)] capitalize mt-0.5">{member.role}</p>
                )}
              </div>

              {/* Color dot */}
              <div
                className="w-3 h-3 rounded-full shrink-0 mt-1"
                style={{ backgroundColor: color }}
                title={`Color en agenda: ${color}`}
              />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-secondary)]">
              {member.provides_services !== false && (
                <span className="flex items-center gap-1">
                  <Scissors className="w-3 h-3" />
                  Reservable
                </span>
              )}
              {(member.bookings_today ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {member.bookings_today} hoy
                </span>
              )}
              {(member.bookings_all_time ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {member.bookings_all_time} total
                </span>
              )}
              {member.weekly_hours && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {member.weekly_hours}h/sem
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => onEdit(member)}
            className="flex-1 h-8"
          >
            <Edit className="w-3.5 h-3.5 mr-1.5" />
            Editar
          </GlassButton>
          <GlassButton
            variant={member.active ? "secondary" : "primary"}
            size="sm"
            isLoading={isToggling}
            disabled={isToggling}
            onClick={() => onToggle(member.id, !member.active)}
            className="flex-1 h-8"
          >
            <Power className="w-3.5 h-3.5 mr-1.5" />
            {member.active ? "Desactivar" : "Activar"}
          </GlassButton>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function StaffContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams]);

  const { data: pageData, isLoading, error, revalidate } = useStaffPageData(impersonateOrgId);

  const tenantId = pageData?.tenant?.id || null;
  const staffList: StaffMember[] = pageData?.staff || [];

  const { createStaff, updateStaff, toggleActive, isSubmitting } = useStaffHandlers(
    supabase,
    tenantId,
    revalidate
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "danger" } | null>(null);

  const filteredStaff = useMemo(() => {
    return staffList.filter((m) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.display_name?.toLowerCase().includes(q) ?? false) ||
        (m.bio?.toLowerCase().includes(q) ?? false);
      const matchesFilter =
        filterActive === "all" ||
        (filterActive === "active" && m.active) ||
        (filterActive === "inactive" && !m.active);
      return matchesSearch && matchesFilter;
    });
  }, [staffList, searchTerm, filterActive]);

  const activeCount = staffList.filter((m) => m.active).length;

  const openNew = () => { setEditingStaff(null); setShowModal(true); };
  const openEdit = (m: StaffMember) => { setEditingStaff(m); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingStaff(null); };

  const handleSave = async (staffData: any) => {
    try {
      if (editingStaff) {
        await updateStaff({
          id: editingStaff.id,
          name: staffData.name,
          display_name: staffData.display_name,
          weekly_hours: staffData.weekly_hours,
          schedules: staffData.schedules,
          service_ids: staffData.serviceIds,
          color: staffData.color,
          bio: staffData.bio,
        });
      } else {
        await createStaff({
          name: staffData.name,
          display_name: staffData.display_name,
          weekly_hours: staffData.weekly_hours,
          user_id: staffData.user_id,
          role: staffData.userRole,
          schedules: staffData.schedules,
          service_ids: staffData.serviceIds,
          color: staffData.color,
          bio: staffData.bio,
        });
      }
      closeModal();
      setToast({ message: editingStaff ? "Miembro actualizado" : "Miembro añadido al equipo", tone: "success" });
    } catch (err: any) {
      setToast({ message: err?.message || "Error al guardar", tone: "danger" });
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    setTogglingId(id);
    try {
      await toggleActive(id, active);
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) return <TableSkeleton rows={4} />;

  if (error && !tenantId) {
    return (
      <GlassCard className="p-6 border-red-500/20 bg-red-500/5">
        <p className="text-red-400">{error.message || "Error al cargar staff"}</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Staff</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {staffList.length} miembro{staffList.length !== 1 ? "s" : ""} · {activeCount} activo{activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        <GlassButton onClick={openNew} className="shrink-0 h-10 px-5">
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo Miembro
        </GlassButton>
      </div>

      {/* Search + filter */}
      <GlassCard className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o bio…"
              className="w-full h-9 pl-9 pr-9 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-blue)]/40 transition-colors"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active filter pills */}
          <div className="flex gap-1.5">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterActive(f)}
                className={`h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                  filterActive === f
                    ? "bg-[var(--accent-blue)] text-white"
                    : "bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
                }`}
              >
                {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Staff grid */}
      {filteredStaff.length === 0 ? (
        staffList.length === 0 ? (
          <GlassEmptyState
            icon={User}
            title="Aún no hay miembros"
            description="Añade los miembros de tu equipo para que puedan aparecer en la agenda y el portal de reservas."
            actionLabel="Añadir primer miembro"
            onAction={openNew}
            variant="default"
          />
        ) : (
          <GlassEmptyState
            icon={Search}
            title="Sin resultados"
            description="No hay miembros que coincidan con la búsqueda."
            variant="default"
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStaff.map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              onEdit={openEdit}
              onToggle={handleToggle}
              isToggling={togglingId === member.id || isSubmitting}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {tenantId && (
        <StaffEditModal
          isOpen={showModal}
          onClose={closeModal}
          onSave={handleSave}
          staff={editingStaff}
          tenantId={tenantId}
          supabase={supabase}
        />
      )}

      {toast && (
        <GlassToast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  return (
    <ProtectedRoute requiredPermission="staff">
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <StaffContent />
      </Suspense>
    </ProtectedRoute>
  );
}
