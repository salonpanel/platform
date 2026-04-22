/**
 * Registry de tools del asistente.
 *
 * Construye el ToolSet que se pasa al LLM vinculando cada tool con el
 * contexto runtime actual: tenantId, userId, role, sessionId, etc.
 *
 * La idea es que las tools no conozcan Supabase auth — el endpoint
 * autentica al usuario, verifica membership, y pasa un ToolRuntimeContext
 * ya seguro. Cada tool ejecuta contra la DB usando el admin client con el
 * tenantId del contexto, garantizando el aislamiento.
 *
 * Añadir una tool nueva:
 *   1. Crear el archivo en ./read/ o ./write/ siguiendo el patrón.
 *   2. Importar la build function y añadir al objeto que devuelve buildToolSet.
 *   3. Si es WRITE, asegurar RBAC en el propio archivo + patrón preview/confirm.
 */

import type { ToolSet } from "ai";
import type { TenantRole } from "../security/types";

// READ
import { buildGetPendingPaymentsTool } from "./read/pending-payments";
import { buildGetTodayAgendaTool } from "./read/today-agenda";
import { buildSearchCustomersTool } from "./read/search-customers";
import { buildListServicesTool } from "./read/list-services";
import { buildGetRevenueSummaryTool } from "./read/revenue-summary";
import { buildGetCustomerDetailTool } from "./read/customer-detail";
import { buildGetBookingDetailTool } from "./read/booking-detail";
import { buildListStaffTool } from "./read/list-staff";
import { buildFindAvailableSlotsTool } from "./read/find-available-slots";

// WRITE
import { buildCreateServiceTool } from "./write/create-service";
import { buildUpdateServiceTool } from "./write/update-service";
import { buildCreateCustomerTool } from "./write/create-customer";
import { buildUpdateCustomerTool } from "./write/update-customer";
import { buildCreateBookingTool } from "./write/create-booking";
import { buildCancelBookingTool } from "./write/cancel-booking";
import { buildRescheduleBookingTool } from "./write/reschedule-booking";
import { buildMarkBookingPaidTool } from "./write/mark-booking-paid";
import { buildMarkBookingNoShowTool } from "./write/mark-booking-no-show";

export interface ToolRuntimeContext {
  tenantId: string;
  userId: string;
  userRole: TenantRole;
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface BuildToolSetOptions {
  tenantTimezone?: string;
}

/**
 * Construye el ToolSet completo para un turno del asistente.
 *
 * NOTA: las tools se registran con nombres snake_case — son los que verá el
 * LLM y los que aparecerán en los logs. Mantenerlos estables: cambiar un
 * nombre rompe la memoria/handoff de sesiones activas.
 */
export function buildToolSet(
  ctx: ToolRuntimeContext,
  opts: BuildToolSetOptions = {},
): ToolSet {
  const tz = opts.tenantTimezone ?? "Europe/Madrid";

  return {
    // READ — libres, sin confirmación.
    get_pending_payments: buildGetPendingPaymentsTool(ctx),
    get_today_agenda: buildGetTodayAgendaTool(ctx, tz),
    search_customers: buildSearchCustomersTool(ctx),
    list_services: buildListServicesTool(ctx),
    get_revenue_summary: buildGetRevenueSummaryTool(ctx, tz),
    get_customer_detail: buildGetCustomerDetailTool(ctx),
    get_booking_detail: buildGetBookingDetailTool(ctx, tz),
    list_staff: buildListStaffTool(ctx),
    find_available_slots: buildFindAvailableSlotsTool(ctx, tz),

    // WRITE — patrón preview (sin confirm) → confirm=true.
    create_service: buildCreateServiceTool(ctx),
    update_service: buildUpdateServiceTool(ctx),
    create_customer: buildCreateCustomerTool(ctx),
    update_customer: buildUpdateCustomerTool(ctx),
    create_booking: buildCreateBookingTool(ctx, tz),
    cancel_booking: buildCancelBookingTool(ctx, tz),
    reschedule_booking: buildRescheduleBookingTool(ctx, tz),
    mark_booking_paid: buildMarkBookingPaidTool(ctx, tz),
    mark_booking_no_show: buildMarkBookingNoShowTool(ctx, tz),
  };
}
