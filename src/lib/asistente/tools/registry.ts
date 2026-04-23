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
import { buildGetTopCustomersTool } from "./read/top-customers";
import { buildGetTopServicesTool } from "./read/top-services";
import { buildGetStaffPerformanceTool } from "./read/staff-performance";
import { buildListBookingsRangeTool } from "./read/list-bookings-range";
import { buildListStaffBlockingsTool } from "./read/list-staff-blockings";
import { buildGetStaffScheduleTool } from "./read/staff-schedule";
import { buildListPaymentsTool } from "./read/list-payments";
import { buildSearchBookingsTool } from "./read/search-bookings";
import { buildGetCustomerInsightsTool } from "./read/customer-insights";
import { buildFindReactivationCandidatesTool } from "./read/reactivation-candidates";
import { buildGetBusinessOverviewTool } from "./read/business-overview";
import { buildGetTenantInfoTool } from "./read/tenant-info";
import { buildListMarketingCampaignsTool } from "./read/list-marketing-campaigns";
import { buildGetCampaignStatsTool } from "./read/get-campaign-stats";
import { buildListStaffServicesTool } from "./read/list-staff-services";
import { buildGetStripeStatusTool } from "./read/stripe-status";
import { buildGetWalletBalanceTool } from "./read/wallet-balance";
import { buildListPayoutsTool } from "./read/list-payouts-stripe";
import { buildListCustomerBirthdaysTool } from "./read/customer-birthdays";
import { buildGetCancellationAnalysisTool } from "./read/cancellation-analysis";

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
import { buildBlockStaffTimeTool } from "./write/block-staff-time";
import { buildAddCustomerNoteTool } from "./write/add-customer-note";
import { buildConfirmBookingTool } from "./write/confirm-booking";
import { buildCompleteBookingTool } from "./write/complete-booking";
import { buildDeleteStaffBlockingTool } from "./write/delete-staff-blocking";
import { buildAddBookingNoteTool } from "./write/add-booking-note";
import { buildCreateMarketingCampaignTool } from "./write/create-marketing-campaign";
import { buildSendMessageToCustomerTool } from "./write/send-message-to-customer";
import { buildCreateStaffTool } from "./write/create-staff";
import { buildUpdateStaffTool } from "./write/update-staff";
import { buildSetStaffActiveTool } from "./write/set-staff-active";
import { buildAssignServiceToStaffTool } from "./write/assign-service-to-staff";
import { buildUnassignServiceFromStaffTool } from "./write/unassign-service-from-staff";
import { buildUpdateStaffScheduleTool } from "./write/update-staff-schedule";
import { buildUpdateBusinessHoursTool } from "./write/update-business-hours";
import { buildUpdateBookingPolicyTool } from "./write/update-booking-policy";
import { buildRefundPaymentTool } from "./write/refund-payment";
import { buildUpdateNoShowPolicyTool } from "./write/update-no-show-policy";
import { buildUpdateAsistenteSettingsTool } from "./write/update-asistente-settings";
import { buildDeactivateServiceTool } from "./write/deactivate-service";
import { buildCloneServiceTool } from "./write/clone-service";

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
    get_top_customers: buildGetTopCustomersTool(ctx),
    get_top_services: buildGetTopServicesTool(ctx),
    get_staff_performance: buildGetStaffPerformanceTool(ctx),
    list_bookings_range: buildListBookingsRangeTool(ctx, tz),
    list_staff_blockings: buildListStaffBlockingsTool(ctx, tz),
    get_staff_schedule: buildGetStaffScheduleTool(ctx),
    list_payments: buildListPaymentsTool(ctx, tz),
    search_bookings: buildSearchBookingsTool(ctx, tz),
    get_customer_insights: buildGetCustomerInsightsTool(ctx),
    find_reactivation_candidates: buildFindReactivationCandidatesTool(ctx, tz),
    get_business_overview: buildGetBusinessOverviewTool(ctx, tz),
    get_tenant_info: buildGetTenantInfoTool(ctx),
    list_marketing_campaigns: buildListMarketingCampaignsTool(ctx, tz),
    get_campaign_stats: buildGetCampaignStatsTool(ctx, tz),
    list_staff_services: buildListStaffServicesTool(ctx),
    get_stripe_status: buildGetStripeStatusTool(ctx),
    get_wallet_balance: buildGetWalletBalanceTool(ctx),
    list_payouts: buildListPayoutsTool(ctx, tz),
    list_customer_birthdays: buildListCustomerBirthdaysTool(ctx, tz),
    get_cancellation_analysis: buildGetCancellationAnalysisTool(ctx, tz),

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
    block_staff_time: buildBlockStaffTimeTool(ctx, tz),
    add_customer_note: buildAddCustomerNoteTool(ctx),
    confirm_booking: buildConfirmBookingTool(ctx, tz),
    complete_booking: buildCompleteBookingTool(ctx, tz),
    delete_staff_blocking: buildDeleteStaffBlockingTool(ctx, tz),
    add_booking_note: buildAddBookingNoteTool(ctx, tz),
    create_marketing_campaign: buildCreateMarketingCampaignTool(ctx),
    send_message_to_customer: buildSendMessageToCustomerTool(ctx),
    create_staff: buildCreateStaffTool(ctx),
    update_staff: buildUpdateStaffTool(ctx),
    set_staff_active: buildSetStaffActiveTool(ctx),
    assign_service_to_staff: buildAssignServiceToStaffTool(ctx),
    unassign_service_from_staff: buildUnassignServiceFromStaffTool(ctx),
    update_staff_schedule: buildUpdateStaffScheduleTool(ctx),
    update_business_hours: buildUpdateBusinessHoursTool(ctx),
    update_booking_policy: buildUpdateBookingPolicyTool(ctx),
    refund_payment: buildRefundPaymentTool(ctx),
    update_no_show_policy: buildUpdateNoShowPolicyTool(ctx),
    update_asistente_settings: buildUpdateAsistenteSettingsTool(ctx),
    deactivate_service: buildDeactivateServiceTool(ctx),
    clone_service: buildCloneServiceTool(ctx),
  };
}
