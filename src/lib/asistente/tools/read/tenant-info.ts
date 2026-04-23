/**
 * Tool: get_tenant_info
 *
 * Devuelve la configuración operativa del tenant: timezone, horario base,
 * duración por defecto, política de cancelación, protección de no-shows,
 * estado de Stripe. Sirve al LLM para responder "¿a qué hora abrimos?",
 * "¿cuánto aviso pido para cancelar?", "¿cobramos por no-show?".
 *
 * NO expone datos sensibles (stripe_account_id, emails internos).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({}).describe("Sin parámetros.");

interface TenantInfoPayload {
  tenantId: string;
  name: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  portalUrl: string | null;
  stripeReady: boolean;
  // Settings
  defaultServiceDurationMin: number | null;
  businessOpenTime: string | null; // HH:MM
  businessCloseTime: string | null; // HH:MM
  slotDurationMin: number | null;
  bufferBetweenBookingsMin: number | null;
  cancellationHoursNotice: number | null;
  bookingWindowDays: number | null;
  noShowProtection: {
    enabled: boolean;
    mode: string | null;
    percentage: number | null;
    cancellationHours: number | null;
  };
}

function trimTime(t: string | null): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

export function buildGetTenantInfoTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Configuración operativa del negocio: zona horaria, horario de apertura/cierre, duración por defecto, política de cancelación, protección de no-shows, estado de Stripe. Úsala cuando el usuario pregunte por horarios, políticas o ajustes.",
    inputSchema: InputSchema,
    execute: async (): Promise<ToolOutput<TenantInfoPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_tenant_info",
          toolCategory: "READ_LOW",
          toolInput: null,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          const [{ data: tenant }, { data: settings }] = await Promise.all([
            supabase
              .from("tenants")
              .select(
                "id, name, timezone, contact_email, contact_phone, address, portal_url, stripe_charges_enabled",
              )
              .eq("id", ctx.tenantId)
              .maybeSingle(),
            supabase
              .from("tenant_settings")
              .select(
                "default_service_duration, business_open_time, business_close_time, slot_duration_min, buffer_between_bookings_min, cancellation_hours_notice, booking_window_days, no_show_protection_enabled, no_show_protection_mode, no_show_protection_percentage, no_show_cancellation_hours",
              )
              .eq("tenant_id", ctx.tenantId)
              .maybeSingle(),
          ]);

          const t = tenant as {
            id: string;
            name: string | null;
            timezone: string | null;
            contact_email: string | null;
            contact_phone: string | null;
            address: string | null;
            portal_url: string | null;
            stripe_charges_enabled: boolean | null;
          } | null;

          if (!t) return err("No se pudo leer la configuración del negocio.");

          const s = settings as {
            default_service_duration: number | null;
            business_open_time: string | null;
            business_close_time: string | null;
            slot_duration_min: number | null;
            buffer_between_bookings_min: number | null;
            cancellation_hours_notice: number | null;
            booking_window_days: number | null;
            no_show_protection_enabled: boolean | null;
            no_show_protection_mode: string | null;
            no_show_protection_percentage: number | null;
            no_show_cancellation_hours: number | null;
          } | null;

          const payload: TenantInfoPayload = {
            tenantId: t.id,
            name: t.name ?? "(sin nombre)",
            timezone: t.timezone ?? "Europe/Madrid",
            contactEmail: t.contact_email,
            contactPhone: t.contact_phone,
            address: t.address,
            portalUrl: t.portal_url,
            stripeReady: !!t.stripe_charges_enabled,
            defaultServiceDurationMin: s?.default_service_duration ?? null,
            businessOpenTime: trimTime(s?.business_open_time ?? null),
            businessCloseTime: trimTime(s?.business_close_time ?? null),
            slotDurationMin: s?.slot_duration_min ?? null,
            bufferBetweenBookingsMin: s?.buffer_between_bookings_min ?? null,
            cancellationHoursNotice: s?.cancellation_hours_notice ?? null,
            bookingWindowDays: s?.booking_window_days ?? null,
            noShowProtection: {
              enabled: !!s?.no_show_protection_enabled,
              mode: s?.no_show_protection_mode ?? null,
              percentage: s?.no_show_protection_percentage ?? null,
              cancellationHours: s?.no_show_cancellation_hours ?? null,
            },
          };

          const parts: string[] = [`${payload.name}`];
          if (payload.businessOpenTime && payload.businessCloseTime)
            parts.push(
              `abierto ${payload.businessOpenTime}–${payload.businessCloseTime}`,
            );
          parts.push(`TZ ${payload.timezone}`);
          if (payload.cancellationHoursNotice != null)
            parts.push(`cancelación ≥${payload.cancellationHoursNotice}h`);
          if (payload.noShowProtection.enabled)
            parts.push(
              `protección no-shows ${payload.noShowProtection.percentage ?? "?"}%`,
            );
          parts.push(payload.stripeReady ? "Stripe OK" : "Stripe pendiente");

          return ok<TenantInfoPayload>(parts.join(" · ") + ".", payload);
        },
      );
    },
  });
}
