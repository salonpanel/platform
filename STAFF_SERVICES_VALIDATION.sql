
SELECT
    'staff_provides_services table' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_provides_services'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
    'Should exist with tenant_id, staff_id, service_id columns' as description;

SELECT
    'staff_provides_services columns' as check_name,
    CASE
        WHEN (
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'staff_provides_services'
            AND column_name IN ('id', 'tenant_id', 'staff_id', 'service_id', 'created_at', 'updated_at')
        ) = 6 THEN '✅ CORRECT'
        ELSE '❌ INCORRECT'
    END as status,
    'Should have: id, tenant_id, staff_id, service_id, created_at, updated_at' as description;

SELECT
    'staff_provides_services unique constraint' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'staff_provides_services'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%tenant_id_staff_id_service_id%'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
    'Should have unique constraint on (tenant_id, staff_id, service_id)' as description;

SELECT
    'staff_provides_services indexes' as check_name,
    CASE WHEN (
        SELECT COUNT(*) FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'staff_provides_services'
        AND indexname IN (
            'idx_staff_provides_services_tenant_staff',
            'idx_staff_provides_services_tenant_service',
            'idx_staff_provides_services_composite'
        )
    ) = 3 THEN '✅ CORRECT' ELSE '❌ MISSING INDEXES' END as status,
    'Should have 3 performance indexes' as description;

SELECT
    'sync_staff_only_ids_from_relations function' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'sync_staff_only_ids_from_relations'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
    'Should exist to sync legacy staff_only_ids field' as description;


SELECT
    'RLS enabled on staff_provides_services' as check_name,
    CASE WHEN (
        SELECT rowsecurity FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'staff_provides_services'
    ) THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status,
    'RLS should be enabled for tenant isolation' as description;

SELECT
    'RLS enabled on staff' as check_name,
    CASE WHEN (
        SELECT rowsecurity FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'staff'
    ) THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status,
    'RLS should be enabled for tenant isolation' as description;

SELECT
    'RLS enabled on services' as check_name,
    CASE WHEN (
        SELECT rowsecurity FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'services'
    ) THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status,
    'RLS should be enabled for tenant isolation' as description;

SELECT
    'staff_provides_services RLS policies' as check_name,
    CASE WHEN (
        SELECT COUNT(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'staff_provides_services'
        AND policyname IN ('tenant_read_staff_services', 'tenant_manage_staff_services')
    ) = 2 THEN '✅ CORRECT' ELSE '❌ MISSING' END as status,
    'Should have read and manage policies' as description;

SELECT
    'get_available_slots function' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'get_available_slots'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
    'Should exist for availability calculations' as description;

SELECT
    'services.staff_only_ids triggers' as check_name,
    CASE WHEN (
        SELECT COUNT(*) FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND event_object_table = 'services'
        AND trigger_name LIKE '%staff_only_ids%'
    ) = 0 THEN '✅ NO TRIGGERS (GOOD)' ELSE '❌ HAS TRIGGERS (BAD)' END as status,
    'staff_only_ids should only be modified by sync function, not triggers' as description;


SELECT
    'TOTAL VALIDATION CHECKS' as summary,
    (
        SELECT COUNT(*) FROM (
            VALUES
            ('staff_provides_services table'),
            ('staff_provides_services columns'),
            ('staff_provides_services unique constraint'),
            ('staff_provides_services indexes'),
            ('sync_staff_only_ids_from_relations function'),
            ('RLS enabled on staff_provides_services'),
            ('RLS enabled on staff'),
            ('RLS enabled on services'),
            ('staff_provides_services RLS policies'),
            ('get_available_slots function'),
            ('services.staff_only_ids triggers')
        ) as checks(check_name)
    ) as total_checks,
    'Run all checks above and verify ✅ status' as description;
