"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import {
  Card,
  Button,
  Modal,
  Spinner,
  EmptyState,
  SearchInput,
  Input,
  FormField,
  DataTable,
  useToast,
  TitleBar,
} from "@/components/ui";
import { HeightAwareContainer, useHeightAware } from "@/components/panel/HeightAwareContainer";
import { PanelSection } from "@/components/panel/PanelSection";
import { motion } from "framer-motion";
import { Users, UserPlus, Mail, Phone, Calendar, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { showToast } = useToast();
  const heightAware = useHeightAware();
  const { density: rawDensity } = heightAware;
  // Mapear Density type a valores aceptados por componentes UI
  const density = rawDensity === "normal" ? "default" : rawDensity;
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  }>({});

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
    setFormErrors({});
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
    setFormErrors({});
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setForm({ name: "", email: "", phone: "" });
    setFormErrors({});
    setError(null);
  };

  const validateForm = () => {
    const errors: typeof formErrors = {};
    if (!form.name.trim()) {
      errors.name = "El nombre es obligatorio";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "El email no es válido";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!tenantId || saving) return;

    if (!validateForm()) {
      return;
    }

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
        showToast({
          type: "success",
          title: "Cliente actualizado",
          message: "El cliente se ha actualizado correctamente",
        });
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
        showToast({
          type: "success",
          title: "Cliente creado",
          message: "El cliente se ha creado correctamente",
        });
      }

      closeModal();
    } catch (err: any) {
      setError(err?.message || "Error al guardar cliente");
      showToast({
        type: "error",
        title: "Error",
        message: err?.message || "Error al guardar cliente",
      });
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
      <Card variant="default" className="border-[var(--color-danger)]/50 bg-[var(--color-danger-glass)]">
        <div className="text-[var(--color-danger)]">
          <h3
            className="mb-2 font-semibold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Error
          </h3>
          <p
            className="text-sm"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {error}
          </p>
        </div>
      </Card>
    );
  }

  const columns = [
    {
      key: "name",
      header: "Nombre",
      sortable: true,
      accessor: (row: Customer) => (
        <div
          className="font-semibold"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--text-primary)",
          }}
        >
          {row.name}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      accessor: (row: Customer) => (
        <div
          className="flex items-center gap-2"
          style={{
            fontFamily: "var(--font-body)",
            color: row.email ? "var(--text-secondary)" : "var(--text-tertiary)",
          }}
        >
          {row.email ? (
            <>
              <Mail className="h-4 w-4" />
              {row.email}
            </>
          ) : (
            "-"
          )}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      sortable: false,
      accessor: (row: Customer) => (
        <div
          className="flex items-center gap-2"
          style={{
            fontFamily: "var(--font-body)",
            color: row.phone ? "var(--text-secondary)" : "var(--text-tertiary)",
          }}
        >
          {row.phone ? (
            <>
              <Phone className="h-4 w-4" />
              {row.phone}
            </>
          ) : (
            "-"
          )}
        </div>
      ),
    },
    {
      key: "bookings_count",
      header: "Reservas",
      sortable: true,
      accessor: (row: Customer) => (
        <div
          className="flex items-center gap-2"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--text-secondary)",
          }}
        >
          <Calendar className="h-4 w-4" />
          {row.bookings_count || 0}
        </div>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        {/* Header fijo: Búsqueda + Botón */}
        <motion.div variants={itemVariants} className="flex-shrink-0 mb-4">
          <PanelSection
            variant="default"
            density="auto"
            padding={density === "ultra-compact" ? "compact" : density === "compact" ? "sm" : "md"}
            scrollable={false}
          >
            <div className={cn(
              "flex flex-col gap-3",
              density === "ultra-compact" ? "sm:flex-row" : "sm:flex-row"
            )}>
              <TitleBar
                title="Clientes"
                subtitle={`${customers.length} ${customers.length === 1 ? "cliente" : "clientes"}`}
                density={density}
              >
                <div className={cn(
                  "flex gap-3",
                  density === "ultra-compact" ? "flex-col" : "flex-row"
                )}>
                  <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Buscar..."
                    debounceMs={300}
                    className="flex-1"
                  />
                  <Button
                    onClick={openNewModal}
                    icon={<UserPlus className="h-4 w-4" />}
                    density={rawDensity === "normal" ? "default" : rawDensity === "ultra-compact" ? "compact" : rawDensity}
                  >
                    Nuevo
                  </Button>
                </div>
              </TitleBar>
            </div>
          </PanelSection>
        </motion.div>

        {/* DataTable con scroll interno */}
        <motion.div variants={itemVariants} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {filteredCustomers.length === 0 ? (
            <Card variant="default" density={density}>
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
            <DataTable
              data={filteredCustomers}
              columns={columns}
              loading={loading}
              onRowClick={(customer) => openEditModal(customer)}
              emptyMessage="No hay clientes"
              mobileCard={(customer) => (
                <Card variant="default" className="cursor-pointer" density={density}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div
                          className={cn(
                            "font-semibold",
                            density === "ultra-compact" ? "text-sm" : "text-base"
                          )}
                          style={{
                            fontFamily: "var(--font-body)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {customer.name}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          openEditModal(customer);
                        }}
                        icon={<Edit className="h-4 w-4" />}
                        density={rawDensity === "normal" ? "default" : rawDensity === "ultra-compact" ? "compact" : rawDensity}
                      >
                        Editar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {customer.email && (
                        <div
                          className={cn(
                            "flex items-center gap-2",
                            density === "ultra-compact" ? "text-xs" : "text-sm"
                          )}
                          style={{
                            fontFamily: "var(--font-body)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <Mail className="h-4 w-4" />
                          {customer.email}
                        </div>
                      )}
                      {customer.phone && (
                        <div
                          className={cn(
                            "flex items-center gap-2",
                            density === "ultra-compact" ? "text-xs" : "text-sm"
                          )}
                          style={{
                            fontFamily: "var(--font-body)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <Phone className="h-4 w-4" />
                          {customer.phone}
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex items-center gap-2",
                          density === "ultra-compact" ? "text-xs" : "text-sm"
                        )}
                        style={{
                          fontFamily: "var(--font-body)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Calendar className="h-4 w-4" />
                        {customer.bookings_count || 0} reservas
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            />
          )}
        </motion.div>
      </motion.div>

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
            <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger-glass)] p-3">
              <p
                className="text-sm text-[var(--color-danger)]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {error}
              </p>
            </div>
          )}

          <FormField
            label="Nombre"
            error={formErrors.name}
            required
          >
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre completo"
              variant="glass"
              autoFocus
            />
          </FormField>

          <FormField
            label="Email"
            error={formErrors.email}
            helperText="Opcional"
          >
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@ejemplo.com"
              variant="glass"
              icon={<Mail className="h-4 w-4" />}
            />
          </FormField>

          <FormField
            label="Teléfono"
            helperText="Opcional"
          >
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+34 600 000 000"
              variant="glass"
              icon={<Phone className="h-4 w-4" />}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

function ClientesWrapper() {
  return (
    <HeightAwareContainer className="h-full">
      <ClientesContent />
    </HeightAwareContainer>
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
      <ClientesWrapper />
    </Suspense>
  );
}
