-- Read-only precheck counts for baseline objects
\pset pager off

\echo '== public tables (allowlist presence/missing)'
WITH expected AS (
  SELECT unnest(ARRAY[
    'audit_logs','customers','appointments','auth_login_requests','auth_logs',
    'bookings','chat_messages','daily_metrics','logs','memberships',
    'org_metrics_daily','tenants','payment_intents','payments','platform_users',
    'profiles','services','staff_blockings','staff','staff_provides_services',
    'staff_schedules','stripe_events_processed','system_events',
    'team_conversation_members','team_conversations','team_messages_archive',
    'team_messages','tenant_settings','users','user_display_names','user_permissions'
  ]::text[]) AS name
), mapped AS (
  SELECT e.name, c.oid
  FROM expected e
  LEFT JOIN LATERAL (
    SELECT c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = e.name
  ) c ON TRUE
)
SELECT
  (SELECT count(*) FROM expected) AS expected_total,
  count(oid) AS present_total,
  array_agg(name ORDER BY name) FILTER (WHERE oid IS NULL) AS missing
FROM mapped;

\echo '== public materialized views (allowlist)'
WITH expected AS (
  SELECT unnest(ARRAY[
    'daily_dashboard_kpis','vw_booking_overview_mat','vw_customer_summary',
    'vw_staff_overview_mat','vw_customer_summary_mat'
  ]::text[]) AS name
), mapped AS (
  SELECT e.name, m.matviewname IS NOT NULL AS present
  FROM expected e
  LEFT JOIN LATERAL (
    SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' AND matviewname = e.name
  ) m ON TRUE
)
SELECT
  (SELECT count(*) FROM expected) AS expected_total,
  count(*) FILTER (WHERE present) AS present_total,
  array_agg(name ORDER BY name) FILTER (WHERE NOT present) AS missing
FROM mapped;

\echo '== public views (allowlist placeholder; none expected)'
WITH expected AS (
  SELECT unnest(ARRAY[]::text[]) AS name
), mapped AS (
  SELECT e.name, v.viewname IS NOT NULL AS present
  FROM expected e
  LEFT JOIN LATERAL (
    SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname = e.name
  ) v ON TRUE
)
SELECT
  (SELECT count(*) FROM expected) AS expected_total,
  count(*) FILTER (WHERE present) AS present_total,
  array_agg(name ORDER BY name) FILTER (WHERE NOT present) AS missing
FROM mapped;

\echo '== public policies on allowlist tables'
WITH tbls AS (
  SELECT unnest(ARRAY[
    'audit_logs','customers','appointments','auth_login_requests','auth_logs',
    'bookings','chat_messages','daily_metrics','logs','memberships',
    'org_metrics_daily','tenants','payment_intents','payments','platform_users',
    'profiles','services','staff_blockings','staff','staff_provides_services',
    'staff_schedules','stripe_events_processed','system_events',
    'team_conversation_members','team_conversations','team_messages_archive',
    'team_messages','tenant_settings','users','user_display_names','user_permissions'
  ]::text[]) AS relname
)
SELECT count(*) AS policy_count
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (SELECT relname FROM tbls);

\echo '== public triggers (non-constraint) on allowlist tables'
WITH tbls AS (
  SELECT unnest(ARRAY[
    'audit_logs','customers','appointments','auth_login_requests','auth_logs',
    'bookings','chat_messages','daily_metrics','logs','memberships',
    'org_metrics_daily','tenants','payment_intents','payments','platform_users',
    'profiles','services','staff_blockings','staff','staff_provides_services',
    'staff_schedules','stripe_events_processed','system_events',
    'team_conversation_members','team_conversations','team_messages_archive',
    'team_messages','tenant_settings','users','user_display_names','user_permissions'
  ]::text[]) AS relname
)
SELECT count(*) AS trigger_count
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (SELECT relname FROM tbls)
  AND t.tgconstraint = 0;

\echo '== public functions (allowlist names; grouped)'
SELECT pr.proname, count(*) AS overloads
FROM pg_proc pr
JOIN pg_namespace n ON n.oid = pr.pronamespace
WHERE n.nspname = 'public'
  AND pr.proname IN (
    'archive_old_messages','audit_trigger','build_row_diff',
    'calculate_all_org_metrics_daily','calculate_org_metrics_daily',
    'calculate_total_revenue_per_tenant','check_admin_user_status',
    'check_booking_conflicts','check_booking_integrity','check_customer_integrity',
    'check_database_health','check_metrics_integrity','check_orphan_records',
    'check_platform_admin','check_slot_availability','check_staff_availability',
    'check_staff_integrity','cleanup_expired_holds','create_booking_with_validation',
    'create_or_update_booking','create_platform_admin',
    'create_staff_blocking_with_validation','enforce_booking_tenant_matches_appointment',
    'enforce_payment_tenant_matches_booking','ensure_default_team_conversation',
    'ensure_direct_conversations_for_user','find_direct_team_conversation',
    'fn_add_member','generate_time_range','get_agenda','get_agenda_grouped',
    'get_agenda_stats','get_available_slots','get_conversation_members',
    'get_conversation_messages_paginated','get_conversation_stats','get_dashboard_kpis',
    'get_filtered_bookings','get_metrics_range','get_or_create_direct_conversation',
    'get_org_features','get_org_plan_info','get_overlap_error_message',
    'get_public_available_slots','get_public_daily_staff_windows',
    'get_public_services','get_public_services_with_slots','get_service_categories',
    'get_service_price_range','get_services_filtered','get_services_without_price_id',
    'get_staff_availability','get_staff_schedule','get_staff_with_stats',
    'get_tenant_info','get_user_conversations_optimized','get_user_display_name',
    'get_user_permissions','get_user_profile_photo','get_user_role_and_permissions',
    'guard_paid_bookings','handle_booking_customer_stats','handle_new_user',
    'has_feature','initialize_daily_metrics','insert_stripe_event_if_new',
    'is_service_sellable','is_slot_in_past','list_tenant_members','log_event',
    'mark_conversation_as_read','mark_expired_login_requests','normalize_tenant_slug',
    'profiles_update_updated_at','provision_tenant_for_user','recompute_all_metrics',
    'refresh_customer_stats','release_expired_appointments','release_expired_holds',
    'safe_tenant','search_messages','set_updated_at','setup_admin_user_access',
    'team_conversations_touch_updated_at','team_messages_bump_conversation',
    'team_messages_set_edited_at','to_tenant_timezone','trg_bookings_update_metrics',
    'trigger_update_daily_metrics','update_booking_status',
    'update_chat_messages_updated_at','update_customers_updated_at',
    'update_daily_metrics','update_payment_intents_updated_at',
    'update_payments_updated_at','update_staff_provides_services_updated_at',
    'update_tenant_settings_updated_at','update_user_permissions_updated_at',
    'upsert_metrics_for_booking','user_display_names_update_updated_at',
    'user_has_role_for_tenant'
  )
GROUP BY pr.proname
ORDER BY pr.proname;

\echo '== public functions total (allowlist)'
SELECT count(*) AS total_functions
FROM pg_proc pr
JOIN pg_namespace n ON n.oid = pr.pronamespace
WHERE n.nspname = 'public'
  AND pr.proname IN (
    'archive_old_messages','audit_trigger','build_row_diff',
    'calculate_all_org_metrics_daily','calculate_org_metrics_daily',
    'calculate_total_revenue_per_tenant','check_admin_user_status',
    'check_booking_conflicts','check_booking_integrity','check_customer_integrity',
    'check_database_health','check_metrics_integrity','check_orphan_records',
    'check_platform_admin','check_slot_availability','check_staff_availability',
    'check_staff_integrity','cleanup_expired_holds','create_booking_with_validation',
    'create_or_update_booking','create_platform_admin',
    'create_staff_blocking_with_validation','enforce_booking_tenant_matches_appointment',
    'enforce_payment_tenant_matches_booking','ensure_default_team_conversation',
    'ensure_direct_conversations_for_user','find_direct_team_conversation',
    'fn_add_member','generate_time_range','get_agenda','get_agenda_grouped',
    'get_agenda_stats','get_available_slots','get_conversation_members',
    'get_conversation_messages_paginated','get_conversation_stats','get_dashboard_kpis',
    'get_filtered_bookings','get_metrics_range','get_or_create_direct_conversation',
    'get_org_features','get_org_plan_info','get_overlap_error_message',
    'get_public_available_slots','get_public_daily_staff_windows',
    'get_public_services','get_public_services_with_slots','get_service_categories',
    'get_service_price_range','get_services_filtered','get_services_without_price_id',
    'get_staff_availability','get_staff_schedule','get_staff_with_stats',
    'get_tenant_info','get_user_conversations_optimized','get_user_display_name',
    'get_user_permissions','get_user_profile_photo','get_user_role_and_permissions',
    'guard_paid_bookings','handle_booking_customer_stats','handle_new_user',
    'has_feature','initialize_daily_metrics','insert_stripe_event_if_new',
    'is_service_sellable','is_slot_in_past','list_tenant_members','log_event',
    'mark_conversation_as_read','mark_expired_login_requests','normalize_tenant_slug',
    'profiles_update_updated_at','provision_tenant_for_user','recompute_all_metrics',
    'refresh_customer_stats','release_expired_appointments','release_expired_holds',
    'safe_tenant','search_messages','set_updated_at','setup_admin_user_access',
    'team_conversations_touch_updated_at','team_messages_bump_conversation',
    'team_messages_set_edited_at','to_tenant_timezone','trg_bookings_update_metrics',
    'trigger_update_daily_metrics','update_booking_status',
    'update_chat_messages_updated_at','update_customers_updated_at',
    'update_daily_metrics','update_payment_intents_updated_at',
    'update_payments_updated_at','update_staff_provides_services_updated_at',
    'update_tenant_settings_updated_at','update_user_permissions_updated_at',
    'upsert_metrics_for_booking','user_display_names_update_updated_at',
    'user_has_role_for_tenant'
  );

\echo '== app/platform tables by schema'
SELECT n.nspname, count(*) AS table_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('app','platform') AND c.relkind = 'r'
GROUP BY n.nspname
ORDER BY n.nspname;

\echo '== app/platform functions by schema'
SELECT n.nspname, count(*) AS function_count
FROM pg_proc pr
JOIN pg_namespace n ON n.oid = pr.pronamespace
WHERE n.nspname IN ('app','platform')
GROUP BY n.nspname
ORDER BY n.nspname;

\echo '== app/platform materialized views by schema'
SELECT schemaname, count(*) AS matview_count
FROM pg_matviews
WHERE schemaname IN ('app','platform')
GROUP BY schemaname
ORDER BY schemaname;

\echo '== app/platform views by schema'
SELECT schemaname, count(*) AS view_count
FROM pg_views
WHERE schemaname IN ('app','platform')
GROUP BY schemaname
ORDER BY schemaname;
