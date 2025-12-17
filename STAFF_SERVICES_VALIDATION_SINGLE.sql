-- STAFF ⇄ SERVICES MODULE VALIDATION SCRIPT - SINGLE QUERY VERSION
-- Run this entire query in Supabase SQL Editor to get all validation results at once

WITH validation_checks AS (
    -- Check if staff_provides_services table exists
    SELECT 'staff_provides_services table' as check_name,
           CASE WHEN EXISTS (
               SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'staff_provides_services'
           ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
           'Should exist with tenant_id, staff_id, service_id columns' as description

    UNION ALL

    -- Check table structure
    SELECT 'staff_provides_services columns' as check_name,
           CASE WHEN (
               SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'staff_provides_services'
               AND column_name IN ('id', 'tenant_id', 'staff_id', 'service_id', 'created_at', 'updated_at')
           ) = 6 THEN '✅ CORRECT' ELSE '❌ INCORRECT' END as status,
           'Should have: id, tenant_id, staff_id, service_id, created_at, updated_at' as description

    UNION ALL

    -- Check unique constraint
    SELECT 'staff_provides_services unique constraint' as check_name,
           CASE WHEN EXISTS (
               SELECT 1 FROM information_schema.table_constraints
               WHERE table_schema = 'public' AND table_name = 'staff_provides_services'
               AND constraint_type = 'UNIQUE'
           ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
           'Should have unique constraint on (tenant_id, staff_id, service_id)' as description

    UNION ALL

    -- Check indexes
    SELECT 'staff_provides_services indexes' as check_name,
           CASE WHEN (
               SELECT COUNT(*) FROM pg_indexes
               WHERE schemaname = 'public' AND tablename = 'staff_provides_services'
               AND indexname IN (
                   'idx_staff_provides_services_tenant_staff',
                   'idx_staff_provides_services_tenant_service',
                   'idx_staff_provides_services_composite'
               )
           ) = 3 THEN '✅ CORRECT' ELSE '❌ MISSING INDEXES' END as status,
           'Should have 3 performance indexes' as description

    UNION ALL

    -- Check sync function exists
    SELECT 'sync_staff_only_ids_from_relations function' as check_name,
           CASE WHEN EXISTS (
               SELECT 1 FROM information_schema.routines
               WHERE routine_schema = 'public' AND routine_name = 'sync_staff_only_ids_from_relations'
           ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
           'Should exist to sync legacy staff_only_ids field' as description

    UNION ALL

    -- Check RLS enabled on staff_provides_services
    SELECT 'RLS enabled on staff_provides_services' as check_name,
           CASE WHEN (
               SELECT rowsecurity FROM pg_tables
               WHERE schemaname = 'public' AND tablename = 'staff_provides_services'
           ) THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status,
           'RLS should be enabled for tenant isolation' as description

    UNION ALL

    -- Check RLS enabled on staff
    SELECT 'RLS enabled on staff' as check_name,
           CASE WHEN (
               SELECT rowsecurity FROM pg_tables
               WHERE schemaname = 'public' AND tablename = 'staff'
           ) THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status,
           'RLS should be enabled for tenant isolation' as description

    UNION ALL

    -- Check RLS enabled on services
    SELECT 'RLS enabled on services' as check_name,
           CASE WHEN (
               SELECT rowsecurity FROM pg_tables
               WHERE schemaname = 'public' AND tablename = 'services'
           ) THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status,
           'RLS should be enabled for tenant isolation' as description

    UNION ALL

    -- Check RLS policies exist
    SELECT 'staff_provides_services RLS policies' as check_name,
           CASE WHEN (
               SELECT COUNT(*) FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'staff_provides_services'
               AND policyname IN ('tenant_read_staff_services', 'tenant_manage_staff_services')
           ) = 2 THEN '✅ CORRECT' ELSE '❌ MISSING' END as status,
           'Should have read and manage policies' as description

    UNION ALL

    -- Check get_available_slots function exists
    SELECT 'get_available_slots function' as check_name,
           CASE WHEN EXISTS (
               SELECT 1 FROM information_schema.routines
               WHERE routine_schema = 'public' AND routine_name = 'get_available_slots'
           ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
           'Should exist for availability calculations' as description

    UNION ALL

    -- Check no triggers on staff_only_ids
    SELECT 'services.staff_only_ids triggers' as check_name,
           CASE WHEN (
               SELECT COUNT(*) FROM information_schema.triggers
               WHERE event_object_schema = 'public'
               AND event_object_table = 'services'
               AND trigger_name LIKE '%staff_only_ids%'
           ) = 0 THEN '✅ NO TRIGGERS (GOOD)' ELSE '❌ HAS TRIGGERS (BAD)' END as status,
           'staff_only_ids should only be modified by sync function, not triggers' as description
)
SELECT
    check_name,
    status,
    description
FROM validation_checks
ORDER BY
    CASE
        WHEN check_name LIKE '%table%' THEN 1
        WHEN check_name LIKE '%columns%' THEN 2
        WHEN check_name LIKE '%constraint%' THEN 3
        WHEN check_name LIKE '%indexes%' THEN 4
        WHEN check_name LIKE '%function%' THEN 5
        WHEN check_name LIKE '%RLS enabled%' THEN 6
        WHEN check_name LIKE '%policies%' THEN 7
        WHEN check_name LIKE '%triggers%' THEN 8
        ELSE 9
    END,
    check_name;
