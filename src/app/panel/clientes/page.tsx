"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  bookings_count?: number;
};

function ClientesContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const impersonateOrgId = useMemo(
    () => searchParams?.get("impersonate") || null,
    [searchParams?.toString()]
  );

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
    const loadCustomers = async () => {
      try {
        setLoading(true);

        // Cargar clientes con conteo de reservas
        const { data: customersData, error: customersError } = await supabase
          .from("customers")
          .select(
            `
            *,
            bookings:bookings(count)
          `
          )
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (customersError) {
          throw new Error(customersError.message);
        }

        if (mounted) {
          const customersWithCount = (customersData || []).map((c: any) => ({
            ...c,
            bookings_count: c.bookings?.[0]?.count || 0,
          }));
          setCustomers(customersWithCount as Customer[]);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Error al cargar clientes");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCustomers();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel("rt-customers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadCustomers();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId]);

  const openNewModal = () => {
    setEditingCustomer(null);
    setForm({ name: "", email: "", phone: "" });
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
    });
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setForm({ name: "", email: "", phone: "" });
    setError(null);
  };

  const handleSubmit = async () => {
    if (!tenantId || !form.name.trim() || saving) return;

    setError(null);
    setSaving(true);

    try {
      if (editingCustomer) {
        // Actualizar
        const { data, error: updateError } = await supabase
          .from("customers")
          .update({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
          })
          .eq("id", editingCustomer.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editingCustomer.id
              ? { ...data, bookings_count: c.bookings_count }
              : c
          )
        );
        setSuccessMessage("Cliente actualizado correctamente");
      } else {
        // Crear
        const { data, error: createError } = await supabase
          .from("customers")
          .insert({
            tenant_id: tenantId,
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
          })
          .select()
          .single();

        if (createError) {
          throw new Error(createError.message);
        }

        setCustomers((prev) => [{ ...data, bookings_count: 0 }, ...prev]);
        setSuccessMessage("Cliente creado correctamente");
      }

      closeModal();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Error al guardar cliente");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const search = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.phone?.includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !tenantId) {
    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <div className="text-red-400">
          <h3 className="mb-2 font-semibold">Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con búsqueda y botón */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass rounded-xl p-4 border border-[rgba(255,255,255,0.08)] backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] font-satoshi tracking-tight">Clientes</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {customers.length} {customers.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
            style={{ borderRadius: "var(--radius-md)" }}
          />
          <Button onClick={openNewModal}>+ Nuevo Cliente</Button>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {successMessage && (
        <Card className="border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.08)]">
          <p className="text-sm text-emerald-400">{successMessage}</p>
        </Card>
      )}

      {/* Mensaje de error */}
      {error && (
        <Card className="border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)]">
          <p className="text-sm text-red-400">{error}</p>
        </Card>
      )}

      {/* Lista de clientes */}
      {filteredCustomers.length === 0 ? (
        <Card>
          <EmptyState
            title={
              searchTerm
                ? "No se encontraron clientes"
                : "No hay clientes registrados"
            }
            description={
              searchTerm
                ? "Intenta con otro criterio de búsqueda"
                : "Crea tu primer cliente para empezar"
            }
          />
        </Card>
      ) : (
        <>
          {/* Vista Desktop: Tabla */}
          <div className="hidden md:block overflow-x-auto">
            <Card padding="none">
              <table className="w-full">
                <thead className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.08em]">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.08em]">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.08em]">
                      Teléfono
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.08em]">
                      Reservas
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.08em]">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {customer.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {customer.email || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {customer.phone || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {customer.bookings_count || 0}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(customer)}
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Vista Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-base font-semibold text-[var(--text-primary)]">
                        {customer.name}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(customer)}
                    >
                      Editar
                    </Button>
                  </div>
                  <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                    {customer.email && (
                      <div>
                        <span className="text-[var(--text-tertiary)]">Email:</span>{" "}
                        <span className="text-[var(--text-secondary)]">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div>
                        <span className="text-[var(--text-tertiary)]">Teléfono:</span>{" "}
                        <span className="text-[var(--text-secondary)]">{customer.phone}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-[var(--text-tertiary)]">Reservas:</span>{" "}
                      <span className="text-[var(--text-secondary)]">
                        {customer.bookings_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Modal de crear/editar */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.name.trim()}
              isLoading={saving}
            >
              {editingCustomer ? "Guardar" : "Crear"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)] font-satoshi">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
              placeholder="Nombre completo"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)] font-satoshi">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
              placeholder="email@ejemplo.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)] font-satoshi">
              Teléfono
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
              placeholder="+34 600 000 000"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <ClientesContent />
    </Suspense>
  );
}
