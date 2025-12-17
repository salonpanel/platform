-- Selective cleanup for Supabase Cloud
-- Constraints:
-- - Do NOT drop schema public entirely
-- - Drop app/platform schemas fully with CASCADE
-- - In public, drop only allowlisted objects (policies, triggers, matviews, tables, functions)
-- - Ignore Supabase-managed schemas (auth, storage, realtime, extensions, etc.)

BEGIN;

-- ============================================================================
-- Phase 1: Drop our schemas completely
-- ============================================================================
DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS platform CASCADE;

-- ============================================================================
-- Phase 2: Selective cleanup in public schema
-- ============================================================================

-- 2.1) Drop materialized views (CASCADE removes dependent objects)
DROP MATERIALIZED VIEW IF EXISTS public.daily_dashboard_kpis CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.vw_booking_overview_mat CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.vw_customer_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.vw_staff_overview_mat CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.vw_customer_summary_mat CASCADE;

-- 2.2) Drop tables (CASCADE removes policies, triggers, constraints, FKs, sequences automatically)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.auth_login_requests CASCADE;
DROP TABLE IF EXISTS public.auth_logs CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.daily_metrics CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.org_metrics_daily CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.payment_intents CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.platform_users CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.staff_blockings CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;
DROP TABLE IF EXISTS public.staff_provides_services CASCADE;
DROP TABLE IF EXISTS public.staff_schedules CASCADE;
DROP TABLE IF EXISTS public.stripe_events_processed CASCADE;
DROP TABLE IF EXISTS public.system_events CASCADE;
DROP TABLE IF EXISTS public.team_conversation_members CASCADE;
DROP TABLE IF EXISTS public.team_conversations CASCADE;
DROP TABLE IF EXISTS public.team_messages_archive CASCADE;
DROP TABLE IF EXISTS public.team_messages CASCADE;
DROP TABLE IF EXISTS public.tenant_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.user_display_names CASCADE;
DROP TABLE IF EXISTS public.user_permissions CASCADE;

-- 2.3) Drop functions (explicit signatures from baseline)
DROP FUNCTION IF EXISTS public.archive_old_messages(integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.audit_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.build_row_diff(jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_all_org_metrics_daily(date) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_org_metrics_daily(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_total_revenue_per_tenant(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_admin_user_status() CASCADE;
DROP FUNCTION IF EXISTS public.check_booking_conflicts(uuid, uuid, timestamp with time zone, timestamp with time zone, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_booking_integrity() CASCADE;
DROP FUNCTION IF EXISTS public.check_customer_integrity() CASCADE;
DROP FUNCTION IF EXISTS public.check_database_health() CASCADE;
DROP FUNCTION IF EXISTS public.check_metrics_integrity() CASCADE;
DROP FUNCTION IF EXISTS public.check_orphan_records() CASCADE;
DROP FUNCTION IF EXISTS public.check_platform_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_slot_availability(uuid, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.check_staff_availability(uuid, uuid, timestamp with time zone, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.check_staff_integrity() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_holds() CASCADE;
DROP FUNCTION IF EXISTS public.create_booking_with_validation(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.create_booking_with_validation(uuid, uuid, uuid, timestamp with time zone, timestamp with time zone, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_log(uuid, uuid, text, text, uuid, jsonb, inet, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_or_update_booking(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.create_platform_admin(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_blocking_with_validation(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.enforce_booking_tenant_matches_appointment() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_payment_tenant_matches_booking() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_default_team_conversation(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_direct_conversations_for_user(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.find_direct_team_conversation(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.fn_add_member(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.generate_time_range(time without time zone, time without time zone, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_agenda(uuid, timestamp with time zone, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.get_agenda_grouped(uuid, date, date, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_agenda_grouped(uuid, timestamp with time zone, timestamp with time zone, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_agenda_stats(uuid, date, date, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_available_slots(uuid, uuid, uuid, date, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_conversation_members(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_conversation_messages_paginated(uuid, integer, timestamp with time zone, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.get_conversation_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_filtered_bookings(uuid, timestamp with time zone, timestamp with time zone, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_metrics_range(uuid, date, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_direct_conversation(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_org_features(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_org_plan_info(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_overlap_error_message(uuid, uuid, timestamp with time zone, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.get_public_available_slots(uuid, uuid, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_public_daily_staff_windows(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_public_services(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_public_services_with_slots(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_service_categories(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_service_price_range(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_services_filtered(uuid, text, text, integer, integer, boolean, boolean, text, text, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_services_without_price_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_availability(uuid, timestamp with time zone, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_schedule(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_with_stats(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.get_tenant_info(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_conversations_optimized(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_display_name(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_profile_photo(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role_and_permissions(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.guard_paid_bookings() CASCADE;
DROP FUNCTION IF EXISTS public.handle_booking_customer_stats() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.has_feature(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.initialize_daily_metrics(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.insert_stripe_event_if_new(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.is_service_sellable(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_slot_in_past(uuid, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.list_tenant_members(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.log_event(text, uuid, uuid, text, uuid, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.mark_conversation_as_read(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.mark_expired_login_requests() CASCADE;
DROP FUNCTION IF EXISTS public.normalize_tenant_slug() CASCADE;
DROP FUNCTION IF EXISTS public.profiles_update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.provision_tenant_for_user(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.recompute_all_metrics() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_customer_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.release_expired_appointments() CASCADE;
DROP FUNCTION IF EXISTS public.release_expired_holds() CASCADE;
DROP FUNCTION IF EXISTS public.safe_tenant() CASCADE;
DROP FUNCTION IF EXISTS public.search_messages(uuid, text, uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.setup_admin_user_access(text) CASCADE;
DROP FUNCTION IF EXISTS public.team_conversations_touch_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.team_messages_bump_conversation() CASCADE;
DROP FUNCTION IF EXISTS public.team_messages_set_edited_at() CASCADE;
DROP FUNCTION IF EXISTS public.to_tenant_timezone(uuid, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.trg_bookings_update_metrics() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_update_daily_metrics() CASCADE;
DROP FUNCTION IF EXISTS public.update_booking_status() CASCADE;
DROP FUNCTION IF EXISTS public.update_chat_messages_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_customers_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_daily_metrics(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS public.update_payment_intents_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_payments_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_staff_provides_services_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_tenant_settings_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_permissions_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.upsert_metrics_for_booking(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS public.user_display_names_update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.user_has_role_for_tenant(uuid, text[]) CASCADE;

-- No custom public enums/types detected in baseline; skip types

COMMIT;
