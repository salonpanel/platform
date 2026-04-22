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
import {
  SettingsGeneral,
  SettingsBranding,
  SettingsContact,
  SettingsPayments,
  SettingsPortal,
  SettingsHorarios,
  SettingsReservas,
  SettingsNotificaciones,
} from "@/components/settings";
import type { BusinessHours, NotificationPrefs } from "@/components/settings";
import { ShieldCheck } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday:    { open: "09:00", close: "20:00", is_closed: false },
  tuesday:   { open: "09:00", close: "20:00", is_closed: false },
  wednesday: { open: "09:00", close: "20:00", is_closed: false },
  thursday:  { open: "09:00", close: "20:00", is_closed: false },
  friday:    { open: "09:00", close: "20:00", is_closed: false },
  saturday:  { open: "10:00", close: "18:00", is_closed: false },
  sunday:    { open: "10:00", close: "14:00", is_closed: true  },
};

// ─── Content ──────────────────────────────────────────────────────────────────

function AjustesContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [tenant, setTenant] = useState<{ id: string; name: string; timezone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── General / Branding / Contact / Portal form ──
  const [form, setForm] = useState({
    name: "",
    timezone: "Europe/Madrid",
    logo_url: "",
    primary_color: "#4cb3ff",
    contact_email: "",
    contact_phone: "",
    address: "",
    portal_url: "",
    public_subdomain: "",
  });

  // ── Horarios ──
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);

  // ── Reservas ──
  const [reservas, setReservas] = useState({
    slot_duration_min: 30,
    buffer_between_bookings_min: 0,
    cancellation_hours_notice: 24,
    booking_window_days: 30,
  });

  // ── Notificaciones ──
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    notif_booking_confirmed: true,
    notif_booking_cancelled: true,
    notif_reminder_24h: true,
    notif_reminder_1h: false,
    notif_new_booking_owner: true,
  });

  // ── Stripe ──
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    account_id?: string;
    onboarding_status?: string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
    future_requirements?: unknown;
  } | null>(null);

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams]);
  const { tenantId: ctxTenantId, loading: ctxLoading, role } = usePermissions();
  const canEdit = role === "owner" || role === "admin";

  // ── Load all tenant data ────────────────────────────────────────────────────
  useEffect(() => {
    const loadTenantData = async () => {
      try {
        setLoading(true);
        setError(null);

        const tenantId = ctxTenantId || (await getCurrentTenant(impersonateOrgId)).tenant?.id;
        if (!tenantId) { setError("No tienes acceso a ninguna barbería"); return; }

        const { data: t, error: tError } = await supabase
          .from("tenants")
          .select(`
            id, name, timezone, slug,
            logo_url, primary_color,
            contact_email, contact_phone, address, portal_url,
            public_subdomain,
            business_hours,
            slot_duration_min, buffer_between_bookings_min,
            cancellation_hours_notice, booking_window_days,
            notif_booking_confirmed, notif_booking_cancelled,
            notif_reminder_24h, notif_reminder_1h, notif_new_booking_owner
          `)
          .eq("id", tenantId)
          .single();

        if (tError) {
          throw new Error(tError.message || "No se pudo cargar la configuración del negocio");
        }

        if (t) {
          setTenant({ id: t.id, name: t.name, timezone: t.timezone });

          setForm({
            name: t.name || "",
            timezone: t.timezone || "Europe/Madrid",
            logo_url: t.logo_url || "",
            primary_color: t.primary_color || "#4cb3ff",
            contact_email: t.contact_email || "",
            contact_phone: t.contact_phone || "",
            address: t.address || "",
            portal_url: t.portal_url || `/r/${t.slug || ""}`,
            public_subdomain: (t as any).public_subdomain || "",
          });

          if (t.business_hours) setBusinessHours(t.business_hours as BusinessHours);

          setReservas({
            slot_duration_min: t.slot_duration_min ?? 30,
            buffer_between_bookings_min: t.buffer_between_bookings_min ?? 0,
            cancellation_hours_notice: t.cancellation_hours_notice ?? 24,
            booking_window_days: t.booking_window_days ?? 30,
          });

          setNotifPrefs({
            notif_booking_confirmed: t.notif_booking_confirmed ?? true,
            notif_booking_cancelled: t.notif_booking_cancelled ?? true,
            notif_reminder_24h: t.notif_reminder_24h ?? true,
            notif_reminder_1h: t.notif_reminder_1h ?? false,
            notif_new_booking_owner: t.notif_new_booking_owner ?? true,
          });
        }
      } catch (err: any) {
        setError(err?.message || "Error al cargar información");
      } finally {
        setLoading(false);
      }
    };

    if (!ctxLoading) loadTenantData();
  }, [impersonateOrgId, ctxTenantId, ctxLoading, supabase]);

  // Load Stripe status
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/payments/stripe/status");
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data) setStripeStatus(data);
      } catch { /* silent */ }
    })();
  }, []);

  // ── Save helpers ────────────────────────────────────────────────────────────

  const saveFields = async (fields: Record<string, unknown>, successMsg: string) => {
    if (!tenant || saving) return;
    if (!canEdit) {
      setError("No tienes permisos para guardar cambios en Ajustes (se requiere owner/admin).");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: updated, error: err } = await supabase
        .from("tenants")
        .update(fields)
        .eq("id", tenant.id)
        .select("id")
        .maybeSingle();
      if (err) throw new Error(err.message);
      // Si RLS bloquea, puede devolver 0 filas sin error.
      if (!updated) {
        throw new Error("No tienes permisos para guardar estos cambios (se requiere owner/admin).");
      }
      setSuccess(successMsg);
      setTimeout(() => setSuccess(null), 3000);
      // Notify layout to refresh tenant name/timezone in sidebar & topbar
      if (typeof window !== "undefined" && (fields.name || fields.timezone)) {
        window.dispatchEvent(
          new CustomEvent("bookfast:tenant-updated", {
            detail: {
              name: fields.name ?? tenant.name,
              timezone: fields.timezone ?? tenant.timezone,
            },
          })
        );
      }
    } catch (e: any) {
      setError(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const saveGeneral = () =>
    saveFields(
      {
        name: form.name.trim(),
        timezone: form.timezone,
        logo_url: form.logo_url.trim() || null,
        primary_color: form.primary_color || "#4cb3ff",
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        address: form.address.trim() || null,
        portal_url: form.portal_url.trim() || null,
      },
      "Configuración general guardada"
    );

  const saveHorarios = () =>
    saveFields({ business_hours: businessHours }, "Horarios guardados correctamente");

  const saveReservas = () =>
    saveFields(reservas as unknown as Record<string, unknown>, "Configuración de reservas guardada");

  const saveNotificaciones = () =>
    saveFields(notifPrefs as unknown as Record<string, unknown>, "Preferencias de notificaciones guardadas");

  const savePortal = (slug: string) =>
    saveFields({ public_subdomain: slug.trim() || null }, "Subdominio guardado correctamente");

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFieldChange = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleReservasChange = (field: string, value: number) =>
    setReservas((prev) => ({ ...prev, [field]: value }));

  const handleNotifChange = (field: keyof NotificationPrefs, value: boolean) =>
    setNotifPrefs((prev) => ({ ...prev, [field]: value }));

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <TableSkeleton rows={6} />;

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {!canEdit && (
            <GlassCard className="p-4 border-white/10 bg-white/5">
              <p className="text-sm text-[var(--text-secondary)]">
                Estás en modo solo lectura. Solo <span className="text-white/80">owner</span> o <span className="text-white/80">admin</span> pueden modificar Ajustes.
              </p>
            </GlassCard>
          )}

          {/* 1. General */}
          <SettingsGeneral
            name={form.name}
            timezone={form.timezone}
            onChange={handleFieldChange}
            onSave={saveGeneral}
            isLoading={saving || !canEdit}
          />

          {/* 2. Horarios */}
          <SettingsHorarios
            businessHours={businessHours}
            onChange={setBusinessHours}
            onSave={saveHorarios}
            isLoading={saving || !canEdit}
          />

          {/* 3. Reservas */}
          <SettingsReservas
            slotDurationMin={reservas.slot_duration_min}
            bufferBetweenBookingsMin={reservas.buffer_between_bookings_min}
            cancellationHoursNotice={reservas.cancellation_hours_notice}
            bookingWindowDays={reservas.booking_window_days}
            onChange={handleReservasChange}
            onSave={saveReservas}
            isLoading={saving || !canEdit}
          />

          {/* 4. Pagos */}
          <SettingsPayments
            status={stripeStatus}
            onRefreshStatus={async () => {
              try {
                const res = await fetch("/api/payments/stripe/status");
                if (!res.ok) return;
                const data = await res.json().catch(() => null);
                if (data) setStripeStatus(data);
              } catch { /* silent */ }
            }}
            canManage={canEdit}
          />

          {/* 5. Branding */}
          <SettingsBranding
            logoUrl={form.logo_url}
            primaryColor={form.primary_color}
            onChange={handleFieldChange}
            onSave={saveGeneral}
            isLoading={saving || !canEdit}
          />

          {/* 6. Contacto */}
          <SettingsContact
            email={form.contact_email}
            phone={form.contact_phone}
            address={form.address}
            onChange={handleFieldChange}
            onSave={saveGeneral}
            isLoading={saving || !canEdit}
          />

          {/* 7. Portal */}
          <SettingsPortal
            subdomain={form.public_subdomain}
            tenantId={tenant?.id ?? ""}
            onSave={savePortal}
            isLoading={saving || !canEdit}
          />

          {/* 8. Notificaciones */}
          <SettingsNotificaciones
            prefs={notifPrefs}
            onChange={handleNotifChange}
            onSave={saveNotificaciones}
            isLoading={saving || !canEdit}
          />
        </div>

        {/* ── Sidebar column ───────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* No-show protection link */}
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

          {/* Quick summary: today's hours */}
          {tenant && (
            <TodaySummary businessHours={businessHours} reservas={reservas} tenant={tenant} />
          )}

          {/* System info */}
          <GlassCard className="p-5 space-y-3 opacity-60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Sistema</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Tenant ID</span>
                <span className="font-mono text-white/70">{tenant?.id.substring(0, 8)}…</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Zona horaria</span>
                <span className="font-mono text-white/70">{tenant?.timezone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Slot mínimo</span>
                <span className="font-mono text-white/70">{reservas.slot_duration_min} min</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {success && <GlassToast message={success} tone="success" onClose={() => setSuccess(null)} />}
      {error && tenant && <GlassToast message={error} tone="danger" onClose={() => setError(null)} />}
    </div>
  );
}

// ─── Sidebar: today's schedule ────────────────────────────────────────────────

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_ES: Record<string, string> = {
  sunday: "Domingo", monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
  thursday: "Jueves", friday: "Viernes", saturday: "Sábado",
};

function TodaySummary({
  businessHours,
  reservas,
  tenant,
}: {
  businessHours: BusinessHours;
  reservas: { slot_duration_min: number; cancellation_hours_notice: number };
  tenant: { timezone: string };
}) {
  const todayKey = DAY_KEYS[new Date().getDay()];
  const today = businessHours[todayKey];
  const isOpen = today && !today.is_closed;

  return (
    <GlassCard className="p-5 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Hoy — {DAY_ES[todayKey]}</h4>
      <div className={`flex items-center gap-2 ${isOpen ? "text-green-400" : "text-red-400"}`}>
        <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-green-400" : "bg-red-400"}`} />
        <span className="text-sm font-medium">{isOpen ? "Abierto" : "Cerrado"}</span>
      </div>
      {isOpen && today && (
        <p className="text-xs text-[var(--text-secondary)]">
          {today.open} – {today.close} · slots {reservas.slot_duration_min} min
        </p>
      )}
    </GlassCard>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function AjustesPage() {
  return (
    <ProtectedRoute requiredPermission="ajustes">
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <AjustesContent />
      </Suspense>
    </ProtectedRoute>
  );
}
