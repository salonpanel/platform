"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";

type Staff = {
  id: string;
  name: string;
  display_name: string | null;
  active: boolean;
  skills: string[] | null;
  user_id: string | null;
  created_at: string;
  bookings_count?: number;
};

function StaffContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    skills: "",
  });
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    skills: "",
  });

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams?.toString()]);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        const { tenant } = await getCurrentTenant(impersonateOrgId);
        if (tenant) {
          setTenantId(tenant.id);
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

  const createStaff = async () => {
    if (!tenantId || !form.name.trim() || saving) return;

    setError(null);
    setSaving(true);

    try {
      const skillsArray = form.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const { data, error: createError } = await supabase
        .from("staff")
        .insert({
          tenant_id: tenantId,
          name: form.name.trim(),
          display_name: form.name.trim(),
          active: true,
          skills: skillsArray.length > 0 ? skillsArray : null,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      setStaffList((prev) => [{ ...data, display_name: data.display_name || data.name, bookings_count: 0 }, ...prev]);
      setForm({ name: "", skills: "" });
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message || "Error al crear staff");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setEditForm({
      name: staff.display_name || staff.name,
      skills: staff.skills?.join(", ") || "",
    });
  };

  const cancelEdit = () => {
    setEditingStaff(null);
    setEditForm({ name: "", skills: "" });
  };

  const updateStaff = async () => {
    if (!tenantId || !editingStaff || !editForm.name.trim() || saving) return;

    setError(null);
    setSaving(true);

    try {
      const skillsArray = editForm.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const { data, error: updateError } = await supabase
        .from("staff")
        .update({
          name: editForm.name.trim(),
          display_name: editForm.name.trim(),
          skills: skillsArray.length > 0 ? skillsArray : null,
        })
        .eq("id", editingStaff.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setStaffList((prev) =>
        prev.map((s) =>
          s.id === editingStaff.id
            ? { ...data, display_name: data.display_name || data.name, bookings_count: s.bookings_count }
            : s
        )
      );
      cancelEdit();
    } catch (err: any) {
      setError(err?.message || "Error al actualizar staff");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
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
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">Cargando staff...</p>
        </div>
      </div>
    );
  }

  if (error && !tenantId) {
    return (
      <div className="rounded border border-red-500 bg-red-50 p-4 text-red-600">
        <h3 className="mb-2 font-semibold">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con búsqueda y botón de añadir */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-600">
            {staffList.filter((s) => s.active).length} activos de {staffList.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre o habilidades..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nuevo Staff"}
          </button>
        </div>
      </div>

      {/* Formulario de nuevo staff */}
      {showForm && (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold">Nuevo Miembro del Staff</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Habilidades</label>
              <input
                type="text"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="Ej: Corte, Barba, Tinte (separadas por comas)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Separa las habilidades con comas
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createStaff}
                disabled={saving || !form.name.trim()}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Crear Staff"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setForm({ name: "", skills: "" });
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Lista de staff */}
      {filteredStaff.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <p className="text-gray-500">
            {searchTerm ? "No se encontró staff con ese criterio." : "No hay staff registrado."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <div className="divide-y">
            {filteredStaff.map((staff) => (
              <div key={staff.id}>
                {editingStaff?.id === staff.id ? (
                  <div className="p-4 space-y-3 bg-blue-50">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Nombre <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Habilidades</label>
                      <input
                        type="text"
                        value={editForm.skills}
                        onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                        placeholder="Ej: Corte, Barba, Tinte (separadas por comas)"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={updateStaff}
                        disabled={saving || !editForm.name.trim()}
                        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {staff.display_name || staff.name}
                        </span>
                        {staff.active ? (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            Activo
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-600">
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(staff)}
                        className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActive(staff.id, staff.active)}
                        className={`rounded px-3 py-1 text-sm font-medium ${
                          staff.active
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {staff.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      }
    >
      <StaffContent />
    </Suspense>
  );
}

