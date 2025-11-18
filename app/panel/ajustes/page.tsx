"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { motion } from "framer-motion";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

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
  const [webhookUrl, setWebhookUrl] = useState<string>("");

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams?.toString()]);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        setLoading(true);
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
      } catch (err: any) {
        setError(err?.message || "Error al cargar información");
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, [impersonateOrgId]);

  useEffect(() => {
    // Cargar estado de Stripe si hay tenant
    const loadStripeStatus = async () => {
      try {
        const res = await fetch("/api/payments/stripe/status");
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data) setStripeStatus(data);
      } catch {
        // Silencioso: dejar placeholder
      }
    };
    loadStripeStatus();

    // Calcular webhook URL en cliente
    try {
      const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
      if (origin) setWebhookUrl(origin + "/api/payments/stripe/webhook");
    } catch {
      setWebhookUrl("");
    }
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
      
      // Actualizar CSS variables si cambió el color primario
      if (form.primary_color) {
        document.documentElement.style.setProperty("--color-accent", form.primary_color);
      }
      
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Error al actualizar configuración");
    } finally {
      setSaving(false);
    }
  };

  const timezones = [
    { value: "Europe/Madrid", label: "Madrid (GMT+1/+2)" },
    { value: "Europe/London", label: "Londres (GMT+0/+1)" },
    { value: "America/New_York", label: "Nueva York (EST/EDT)" },
    { value: "America/Los_Angeles", label: "Los Ángeles (PST/PDT)" },
    { value: "America/Mexico_City", label: "Ciudad de México (CST/CDT)" },
    { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
    { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
    { value: "UTC", label: "UTC" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (error && !tenant) {

  if (userRole && userRole !== "owner" && userRole !== "admin") {
    return (
      <Alert type="warning" title="Permisos insuficientes">
        Solo los administradores pueden modificar los ajustes del tenant.
      </Alert>
    );
  }
    return (
      <Alert type="error" title="Error">
        {error}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] font-satoshi">Ajustes</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Configuración general de tu barbería</p>
      </div>

      {/* Mensajes */}
      {error && (
        <Alert type="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert type="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Enlace a Protección contra ausencias - integrado sin caja */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-[var(--radius-lg)] cursor-pointer hover:scale-[1.01] transition-all duration-200"
        style={{
          background: "linear-gradient(135deg, rgba(123, 92, 255, 0.05) 0%, rgba(77, 226, 195, 0.03) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <Link href="/panel/ajustes/no-show" className="block p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-satoshi">
                Protección contra ausencias
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Configura depósitos o tarifas de cancelación para reducir no-shows
              </p>
            </div>
            <div className="text-[var(--color-text-secondary)]">→</div>
          </div>
        </Link>
      </motion.div>

      {/* Pagos (Stripe) */}
      <div
        className="p-6 rounded-[var(--radius-lg)]"
        style={{
          background: "linear-gradient(135deg, rgba(58,109,255,0.05) 0%, rgba(79,227,193,0.04) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)] font-satoshi">Pagos (Stripe)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Conecta tu cuenta de Stripe para aceptar pagos, depósitos y realizar devoluciones.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-text-secondary)]">Estado:</span>
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[var(--color-text-primary)]">
                {stripeStatus?.connected ? (
                  <>
                    Conectado{stripeStatus?.account_name ? ` · ${stripeStatus.account_name}` : ""}
                    <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  </>
                ) : (
                  <>
                    No conectado
                    <span className="ml-1 inline-block h-2 w-2 rounded-full bg-red-400" />
                  </>
                )}
              </span>
            </div>
            {stripeStatus?.last_sync_at && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Última sincronización: {new Date(stripeStatus.last_sync_at).toLocaleString()}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  try {
                    setSuccess(null);
                    setError(null);
                    const res = await fetch("/api/payments/stripe/connect", { method: "POST" });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data?.error || "Error al iniciar la conexión con Stripe");
                    }
                    const data = await res.json().catch(() => ({}));
                    if (data?.url) {
                      window.location.href = data.url;
                      return;
                    }
                    setSuccess("Conexión con Stripe iniciada correctamente");
                  } catch (e: any) {
                    setError(e?.message || "No se pudo iniciar la conexión con Stripe");
                  }
                }}
              >
                {stripeStatus?.connected ? "Gestionar conexión" : "Conectar con Stripe"}
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    setSuccess(null);
                    setError(null);
                    const res = await fetch("/api/payments/stripe/sync", { method: "POST" });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data?.error || "Error al sincronizar catálogo");
                    }
                    setSuccess("Sincronización iniciada");
                    // refrescar estado
                    const status = await fetch("/api/payments/stripe/status").then(r=>r.ok?r.json():null).catch(()=>null);
                    if (status) setStripeStatus(status);
                  } catch (e: any) {
                    setError(e?.message || "No se pudo sincronizar el catálogo");
                  }
                }}
              >
                Sincronizar catálogo
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                Webhook URL (solo lectura)
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={webhookUrl}
                  className="flex-1 rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none"
                  style={{ borderRadius: "var(--radius-md)" }}
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    try {
                      if (webhookUrl) {
                        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(webhookUrl);
                          setSuccess("Webhook copiado al portapapeles");
                        } else {
                          setError("No se pudo copiar el webhook");
                        }
                      }
                    } catch (e: any) {
                      setError("No se pudo copiar el webhook");
                    }
                  }}
                >
                  Copiar
                </Button>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Configura este endpoint en el panel de Stripe para recibir eventos.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuración General - integrado sin caja */}
      <div
        className="p-6 rounded-[var(--radius-lg)]"
        style={{
          background: "linear-gradient(135deg, rgba(123, 92, 255, 0.03) 0%, rgba(77, 226, 195, 0.02) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)] font-satoshi">Información General</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                Nombre de la Barbería <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                style={{ borderRadius: "var(--radius-md)" }}
                placeholder="Nombre de tu barbería"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                Zona Horaria <span className="text-red-400">*</span>
              </label>
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                style={{ borderRadius: "var(--radius-md)" }}
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                La zona horaria afecta a cómo se muestran las fechas y horas en toda la aplicación.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={updateTenant}
                disabled={saving || !form.name.trim() || !form.timezone.trim()}
                isLoading={saving}
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
      </div>

      {/* Branding - integrado sin caja */}
      <div
        className="p-6 rounded-[var(--radius-lg)]"
        style={{
          background: "linear-gradient(135deg, rgba(123, 92, 255, 0.03) 0%, rgba(77, 226, 195, 0.02) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)] font-satoshi">Branding</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                Logo (URL)
              </label>
              <input
                type="url"
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                style={{ borderRadius: "var(--radius-md)" }}
                placeholder="https://ejemplo.com/logo.png"
              />
              {form.logo_url && (
                <img src={form.logo_url} alt="Logo preview" className="mt-2 h-16 w-16 rounded object-contain" />
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                Color Primario
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="h-10 w-20 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] cursor-pointer transition-smooth"
                  style={{ borderRadius: "var(--radius-md)" }}
                />
                <input
                  type="text"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="flex-1 rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                  style={{ borderRadius: "var(--radius-md)" }}
                  placeholder="#4cb3ff"
                />
              </div>
            </div>
          </div>
      </div>

      {/* Contacto - integrado sin caja */}
      <div
        className="p-6 rounded-[var(--radius-lg)]"
        style={{
          background: "linear-gradient(135deg, rgba(123, 92, 255, 0.03) 0%, rgba(77, 226, 195, 0.02) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)] font-satoshi">Contacto</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                Email de Contacto
              </label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                style={{ borderRadius: "var(--radius-md)" }}
                placeholder="contacto@barberia.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                style={{ borderRadius: "var(--radius-md)" }}
                placeholder="+34 600 000 000"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                Dirección
              </label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={3}
                className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth resize-none"
                style={{ borderRadius: "var(--radius-md)" }}
                placeholder="Calle, Número, Ciudad, Código Postal"
              />
            </div>
          </div>
      </div>

      {/* Portal - integrado sin caja */}
      <div
        className="p-6 rounded-[var(--radius-lg)]"
        style={{
          background: "linear-gradient(135deg, rgba(123, 92, 255, 0.03) 0%, rgba(77, 226, 195, 0.02) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)] font-satoshi">Portal de Reservas</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
                URL del Portal
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.portal_url}
                  onChange={(e) => setForm({ ...form, portal_url: e.target.value })}
                  className="flex-1 rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                  style={{ borderRadius: "var(--radius-md)" }}
                  placeholder="/r/mi-barberia"
                />
                {form.portal_url && (
                  <a
                    href={form.portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm text-[var(--gradient-primary-start)] hover:bg-[rgba(123,92,255,0.1)] transition-colors font-satoshi"
                    style={{ borderRadius: "var(--radius-md)" }}
                  >
                    Abrir →
                  </a>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)] font-medium">
                Esta es la URL pública donde tus clientes pueden hacer reservas.
              </p>
            </div>
          </div>
      </div>

      {/* Información del Sistema - integrado sin caja */}
      <div
        className="p-6 rounded-[var(--radius-lg)]"
        style={{
          background: "linear-gradient(135deg, rgba(123, 92, 255, 0.03) 0%, rgba(77, 226, 195, 0.02) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)] font-satoshi">Información del Sistema</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">ID del Tenant:</span>
              <span className="font-mono text-[var(--color-text-primary)]">{tenant?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Timezone Actual:</span>
              <span className="font-mono text-[var(--color-text-primary)]">{tenant?.timezone || "No configurado"}</span>
            </div>
          </div>
      </div>
    </div>
  );
}

export default function AjustesPage() {
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
      <AjustesContent />
    </Suspense>
  );
}

