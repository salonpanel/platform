"use client";

import { useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner, Card, Button, Alert, SearchInput } from "@/components/ui";
import { GlassEmptyState } from "@/components/ui/glass";
import { StaffEditModal } from "@/components/panel/StaffEditModal";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { motion } from "framer-motion";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { User, UserPlus, Scissors, Calendar, Edit, Power } from "lucide-react";
import { useStaffPageData } from "@/hooks/useOptimizedData";
import { useStaffHandlers } from "@/hooks/useStaffHandlersV2";

type Staff = {
  id: string;
  name: string;
  display_name: string | null;
  active: boolean;
  skills: string[] | null;
  user_id: string | null;
  created_at: string;
  profile_photo_url?: string | null;
  weekly_hours?: number | null;
  provides_services?: boolean;
  bookings_today?: number;
  bookings_this_week?: number;
  bookings_all_time?: number;
  bookings_count?: number;
};

function StaffContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams?.toString()]);

  // Hook optimizado: obtiene tenant + staff en UNA llamada
  const { data: pageData, isLoading, error, revalidate } = useStaffPageData(impersonateOrgId);

  // Extraer datos
  const tenantId = pageData?.tenant?.id || null;
  const staffList = pageData?.staff || [];

  // Handlers RPC
  const { createStaff, updateStaff, toggleActive, isSubmitting } = useStaffHandlers(supabase, tenantId, revalidate);

  // Estados UI
  const [searchTerm, setSearchTerm] = useState("");
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Permissions placeholder (enforce in RPC + UI)
  const canManageStaff = true;

  const startEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setShowEditModal(true);
  };

  const handleSaveStaff = async (staffData: any) => {
    // Adapter for RPC params
    // Note: User creation (email invites) is handled by StaffEditModal calling API routes? 
    // Or we assume the modal passes us a userId if created. 
    // The previous implementation mingled API calls in page.tsx. 
    // Ideally, StaffEditModal should handle the "Invite User" API call internally and pass us the user_id, 
    // OR we pass that responsibility to the RPC wrapper if simple.
    // For now, consistent with H.7 plan: use RPCs for DB.

    if (editingStaff) {
      await updateStaff({
        id: editingStaff.id,
        name: staffData.name,
        display_name: staffData.display_name,
        weekly_hours: staffData.weekly_hours,
        schedules: staffData.schedules,
        service_ids: staffData.serviceIds
      });
    } else {
      // NOTE: User creation logic in modal or here? 
      // If the modal handles the /api/staff/create-user call, it should pass the user_id here.
      // If we keep it here, we are mixing logic again. 
      // STRICT DECISION: logic for calling API route stays in Modal or separate helper, NOT in page.tsx.
      // We assume staffData contains what we need.

      await createStaff({
        name: staffData.name,
        display_name: staffData.display_name,
        weekly_hours: staffData.weekly_hours,
        user_id: staffData.user_id, // Modal must populate this if created
        role: staffData.userRole,
        schedules: staffData.schedules,
        service_ids: staffData.serviceIds
      });
    }
    setShowEditModal(false);
    setEditingStaff(null);
  };

  const filteredStaff = staffList.filter((staff: any) => {
    const search = searchTerm.toLowerCase();
    return (
      staff.name.toLowerCase().includes(search) ||
      staff.display_name?.toLowerCase().includes(search)
    );
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>;
  if (error && !tenantId) return <Alert type="error" title="Error">{error.message || "Error al cargar staff"}</Alert>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex gap-2 w-full sm:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar..."
            className="w-full sm:w-64"
          />
          {canManageStaff && (
            <Button
              onClick={() => { setEditingStaff(null); setShowEditModal(true); }}
              icon={<UserPlus className="h-4 w-4" />}
            >
              Nuevo Staff
            </Button>
          )}
        </div>
      </div>

      {filteredStaff.length === 0 ? (
        <Card variant="default">
          <GlassEmptyState
            icon={User}
            title={searchTerm ? "No se encontró staff" : "No hay staff"}
            description="Gestiona tu equipo desde aquí"
            variant="compact"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredStaff.map((staff: any, index: number) => (
            <Card key={staff.id} variant="default">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-[var(--accent-aqua)]" />
                    <span className="font-medium">{staff.display_name || staff.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${staff.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {staff.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-[var(--text-secondary)]">
                    {staff.bookings_all_time > 0 && <span>{staff.bookings_all_time} reservas</span>}
                    {staff.bookings_today > 0 && <span>{staff.bookings_today} hoy</span>}
                  </div>
                </div>
                {canManageStaff && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(staff)} icon={<Edit className="h-4 w-4" />}>
                      Editar
                    </Button>
                    <Button
                      variant={staff.active ? "danger" : "secondary"}
                      size="sm"
                      onClick={() => toggleActive(staff.id, !staff.active)}
                      icon={<Power className="h-4 w-4" />}
                    >
                      {staff.active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tenantId && canManageStaff && (
        <StaffEditModal
          isOpen={showEditModal}
          onClose={() => { setShowEditModal(false); setEditingStaff(null); }}
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
      <Suspense fallback={<Spinner />}>
        <StaffContent />
      </Suspense>
    </ProtectedRoute>
  );
}
