"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { usePermissions } from "@/contexts/PermissionsContext";
import { GlassCard, GlassToast } from "@/components/ui/glass";
import { SettingsGeneral, SettingsBranding, SettingsContact, SettingsPayments, SettingsPortal } from "@/components/settings";
import { ShieldCheck } from "lucide-react";

function AjustesContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [tenant, setTenant] = useState<{ id: string; name: string; timezone: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    timezone: "Europe/Madrid",
    logo_url: "",
    primary_color: "#4cb3ff",
    contact_email: "",
    contact_phone: "",
    address: "",
    portal_url: "",
  });
  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; account_name?: string; last_sync_at?: string } | null>(null);

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams]);
  const { tenantId: ctxTenantId, loading: ctxLoading } = usePermissions();

  useEffect(() => {
    const loadTenantData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (ctxTenantId) {
          const { data: tenantData } = await supabase
            .from("tenants")
            .select("id, name, timezone")
            .eq("id", ctxTenantId)
            .single();

          if (tenantData) {
            setTenant(tenantData);
            setUserRole(null);

            const { data: fullTenant } = await supabase
              .from("tenants")
              .select("name, timezone, logo_url, primary_color, contact_email, contact_phone, address, slug")
              .eq("id", ctxTenantId)
              .single();

            if (fullTenant) {
              setForm({
                name: fullTenant.name || "",
                timezone: fullTenant.timezone || "Europe/Madrid",
                logo_url: fullTenant.logo_url || "",
                primary_color: fullTenant.primary_color || "#4cb3ff",
                contact_email: fullTenant.contact_email || "",
                contact_phone: fullTenant.contact_phone || "",
                address: fullTenant.address || "",
                portal_url: `/r/${fullTenant.slug || ""}`,
              });
            }
          }
        } else {
          // Fallback for non-context (legacy)
          const { tenant: tenantData, role } = await getCurrentTenant(impersonateOrgId);

          if (tenantData) {
            setTenant(tenantData);
            setUserRole(role || null);
            const { data: fullTenant } = await supabase
              .from("tenants")
              .select("*")
              .eq("id", tenantData.id)
              .single();

            if (fullTenant) {
              setForm({
                name: fullTenant.name || "",
                timezone: fullTenant.timezone || "Europe/Madrid",
                logo_url: fullTenant.logo_url || "",
                primary_color: fullTenant.primary_color || "#4cb3ff",
                contact_email: fullTenant.contact_email || "",
                contact_phone: fullTenant.contact_phone || "",
                address: fullTenant.address || "",
                portal_url: fullTenant.portal_url || `/r/${fullTenant.slug || ""}`,
              });
            }
          } else {
            setError("No tienes acceso a ninguna barbería");
          }
        }
      } catch (err: any) {
        setError(err?.message || "Error al cargar información");
      } finally {
        setLoading(false);
      }
    };

    if (!ctxLoading) {
      loadTenantData();
    }
  }, [impersonateOrgId, ctxTenantId, ctxLoading, supabase]);

  const loadStripeStatus = async () => {
    try {
      const res = await fetch("/api/payments/stripe/status");
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data) setStripeStatus(data);
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    loadStripeStatus();
  }, []);

  const updateTenant = async () => {
    if (!tenant || saving) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from("tenants")
        .update({
          name: form.name.trim(),
          timezone: form.timezone.trim(),
          logo_url: form.logo_url.trim() || null,
          primary_color: form.primary_color.trim() || "#4cb3ff",
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          address: form.address.trim() || null,
          portal_url: form.portal_url.trim() || null,
        })
        .eq("id", tenant.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setTenant({ ...tenant, name: form.name.trim(), timezone: form.timezone.trim() });
      setSuccess("Configuración actualizada correctamente");

      if (form.primary_color) {
        document.documentElement.style.setProperty("--color-accent", form.primary_color);
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Error al actualizar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePortalChange = (value: string) => {
    setForm(prev => ({ ...prev, portal_url: value }));
  };

  if (loading) {
    return <TableSkeleton rows={4} />;
  }

  if (error && !tenant) {
    return (
      <div className="p-6">
        <GlassCard className="p-6 border-red-500/20 bg-red-500/5">
          <p className="text-red-400">{error}</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Ajustes</h1>
        <p className="text-sm text-[var(--text-secondary)]">Gestiona la configuración global de tu negocio.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          <SettingsGeneral
            name={form.name}
            timezone={form.timezone}
            onChange={handleFieldChange}
            onSave={updateTenant}
            isLoading={saving}
          />

          <SettingsPayments
            status={stripeStatus}
            onRefreshStatus={loadStripeStatus}
          />

          <SettingsBranding
            logoUrl={form.logo_url}
            primaryColor={form.primary_color}
            onChange={handleFieldChange}
            onSave={updateTenant}
            isLoading={saving}
          />

          <SettingsContact
            email={form.contact_email}
            phone={form.contact_phone}
            address={form.address}
            onChange={handleFieldChange}
            onSave={updateTenant}
            isLoading={saving}
          />

          <SettingsPortal
            portalUrl={form.portal_url}
            onChange={handlePortalChange}
            onSave={updateTenant}
            isLoading={saving}
          />
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* No Show Link Card */}
          <Link href="/panel/ajustes/no-show" className="block group">
            <GlassCard className="p-5 hover:border-[var(--accent-blue)]/30 transition-all duration-300 group-hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div className="bg-[var(--accent-blue)]/20 p-2 rounded-lg text-[var(--accent-blue)]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[var(--text-secondary)] group-hover:text-white transition-colors">→</span>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-white">Protección No-Show</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Configura políticas de cancelación y depósitos para reducir ausencias.
                </p>
              </div>
            </GlassCard>
          </Link>

          {/* System Info */}
          <GlassCard className="p-5 space-y-3 opacity-60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Sistema</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Tenant ID</span>
                <span className="font-mono text-white/70">{tenant?.id.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Timezone</span>
                <span className="font-mono text-white/70">{tenant?.timezone}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {success && <GlassToast message={success} tone="success" onClose={() => setSuccess(null)} />}
      {error && <GlassToast message={error} tone="danger" onClose={() => setError(null)} />}
    </div>
  );
}

export default function AjustesPage() {
  return (
    <ProtectedRoute requiredPermission="ajustes">
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <AjustesContent />
      </Suspense>
    </ProtectedRoute>
  );
}
