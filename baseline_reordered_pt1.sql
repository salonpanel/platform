

CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'Esquema público principal. Tablas legacy (users_backup, org_members_backup) eliminadas en migración 0063. Usar auth.users + public.profiles + public.memberships.';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";
-- ============================================================================
-- SCHEMA APP - Multi-tenant Context Functions
-- ============================================================================
-- Este schema contiene funciones para gestionar el contexto multi-tenant
-- Permite que las policies RLS accedan al tenant_id actual del usuario
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS "app";

ALTER SCHEMA "app" OWNER TO "postgres";

COMMENT ON SCHEMA "app" IS 'Schema para funciones de contexto multi-tenant (current_tenant_id, etc.)';

-- ============================================================================
-- Función: app.current_tenant_id()
-- ============================================================================
-- Retorna el tenant_id del usuario actual basado en su membership
-- Esta función es CRÍTICA para el sistema RLS multi-tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION "app"."current_tenant_id"() 
RETURNS "uuid"
LANGUAGE "sql" 
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT tenant_id 
  FROM public.memberships 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

ALTER FUNCTION "app"."current_tenant_id"() OWNER TO "postgres";

COMMENT ON FUNCTION "app"."current_tenant_id"() IS 'Retorna el tenant_id del usuario autenticado actual. Usado en policies RLS para multi-tenancy.';

-- Grant necesarios para que las policies puedan usar esta función
GRANT USAGE ON SCHEMA "app" TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "app"."current_tenant_id"() TO "anon", "authenticated", "service_role";



CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "public"."archive_old_messages"("p_days_old" integer DEFAULT 90, "p_batch_size" integer DEFAULT 1000) RETURNS TABLE("archived_count" integer, "deleted_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_archived_count INT := 0;
  v_deleted_count INT := 0;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := NOW() - (p_days_old || ' days')::INTERVAL;

  -- Mover mensajes a archivo
  WITH moved_messages AS (
    DELETE FROM team_messages
    WHERE created_at < v_cutoff_date
      AND id IN (
        SELECT id 
        FROM team_messages
        WHERE created_at < v_cutoff_date
        LIMIT p_batch_size
      )
    RETURNING *
  )
  INSERT INTO team_messages_archive
  SELECT * FROM moved_messages;

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  -- Eliminar mensajes marcados como borrados hace >180 días
  DELETE FROM team_messages_archive
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (NOW() - INTERVAL '180 days');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_archived_count, v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."archive_old_messages"("p_days_old" integer, "p_batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_old_messages"("p_days_old" integer, "p_batch_size" integer) IS 'Mueve mensajes antiguos a la tabla de archivo.
Ejecutar periódicamente para mantener la tabla principal optimizada.
Ejemplo: SELECT * FROM archive_old_messages(90, 1000);';



CREATE OR REPLACE FUNCTION "public"."audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_action text;
  v_table text := TG_TABLE_NAME;
  v_actor uuid := auth.uid();
  v_record uuid;
  v_tenant uuid;
  v_diff jsonb := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_record := NEW.id;
    -- Detectar tenant_id si existe
    BEGIN v_tenant := NEW.tenant_id; EXCEPTION WHEN others THEN v_tenant := NULL; END;
    v_diff := public.build_row_diff(NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record := NEW.id;
    BEGIN v_tenant := NEW.tenant_id; EXCEPTION WHEN others THEN v_tenant := NULL; END;
    v_diff := public.build_row_diff(to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record := OLD.id;
    BEGIN v_tenant := OLD.tenant_id; EXCEPTION WHEN others THEN v_tenant := NULL; END;
    v_diff := public.build_row_diff(to_jsonb(OLD), NULL);
  END IF;

  INSERT INTO public.audit_logs(actor_user_id, action, table_name, record_id, tenant_id, diff)
  VALUES (v_actor, v_action, v_table, v_record, v_tenant, v_diff);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."audit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_row_diff"("old_row" "jsonb", "new_row" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'old', old_row,
    'new', new_row
  );
$$;


ALTER FUNCTION "public"."build_row_diff"("old_row" "jsonb", "new_row" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_all_org_metrics_daily"("p_metric_date" "date" DEFAULT (CURRENT_DATE - '1 day'::interval)) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  r record;
  v_total_tenants int := 0;
  v_total_bookings int := 0;
  v_total_revenue_cents int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  -- Calcular métricas para cada tenant
  for r in select id from public.tenants loop
    perform public.calculate_org_metrics_daily(r.id, p_metric_date);
    v_total_tenants := v_total_tenants + 1;
  end loop;
  
  -- Obtener resumen de métricas calculadas
  select 
    count(*),
    coalesce(sum(total_bookings), 0),
    coalesce(sum(revenue_cents), 0)
  into 
    v_total_tenants,
    v_total_bookings,
    v_total_revenue_cents
  from public.org_metrics_daily
  where metric_date = p_metric_date;
  
  -- Retornar resumen en formato JSON
  return jsonb_build_object(
    'metric_date', p_metric_date,
    'tenants_processed', v_total_tenants,
    'total_bookings', v_total_bookings,
    'total_revenue_cents', v_total_revenue_cents
  );
end;
$$;


ALTER FUNCTION "public"."calculate_all_org_metrics_daily"("p_metric_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_all_org_metrics_daily"("p_metric_date" "date") IS 'Calcula métricas diarias para todos los tenants. Usado por cron ETL nocturno. Retorna resumen en formato JSON.';



CREATE OR REPLACE FUNCTION "public"."calculate_org_metrics_daily"("p_tenant_id" "uuid", "p_metric_date" "date" DEFAULT CURRENT_DATE) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_total_bookings int;
  v_confirmed_bookings int;
  v_cancelled_bookings int;
  v_no_show_bookings int;
  v_revenue_cents int;
  v_active_services int;
  v_active_staff int;
  v_slots_booked int;
  v_total_slots_available int;
  v_occupancy_rate numeric;
  v_webhook_events_total int;
  v_webhook_events_failed int;
  v_cron_holds_released int;
  v_date_start timestamptz;
  v_date_end timestamptz;
begin
  -- Calcular rangos de fecha (todo el día en UTC)
  v_date_start := p_metric_date::timestamp at time zone 'UTC';
  v_date_end := (p_metric_date + interval '1 day')::timestamp at time zone 'UTC';

  -- Contar reservas por estado (bookings)
  select 
    count(*) filter (where status in ('pending', 'paid', 'cancelled', 'no_show', 'completed')),
    count(*) filter (where status in ('paid', 'completed')),
    count(*) filter (where status = 'cancelled'),
    count(*) filter (where status = 'no_show')
  into 
    v_total_bookings,
    v_confirmed_bookings,
    v_cancelled_bookings,
    v_no_show_bookings
  from public.bookings
  where tenant_id = p_tenant_id
    and starts_at >= v_date_start
    and starts_at < v_date_end;

  -- Calcular ingresos (solo reservas confirmadas/pagadas)
  select coalesce(sum(
    case 
      when s.price_cents is not null then s.price_cents
      else 0
    end
  ), 0)
  into v_revenue_cents
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.tenant_id = p_tenant_id
    and b.status in ('confirmed', 'paid', 'completed')
    and b.starts_at >= v_date_start
    and b.starts_at < v_date_end;

  -- Contar servicios y staff activos
  select 
    count(*) filter (where active = true),
    (select count(*) from public.staff where tenant_id = p_tenant_id and active = true)
  into 
    v_active_services,
    v_active_staff
  from public.services
  where tenant_id = p_tenant_id;

  -- Calcular slots (simplificado: basado en horarios del staff)
  select count(*)
  into v_slots_booked
  from public.bookings
  where tenant_id = p_tenant_id
    and starts_at >= v_date_start
    and starts_at < v_date_end
    and status in ('confirmed', 'paid', 'hold');

  -- Calcular ocupación (simplificado)
  v_total_slots_available := coalesce(v_slots_booked * 2, 0); -- Aproximación
  v_occupancy_rate := case 
    when v_total_slots_available > 0 
    then (v_slots_booked::numeric / v_total_slots_available::numeric * 100)
    else 0
  end;

  -- Métricas de webhooks (últimas 24 horas)
  -- Nota: stripe_events_processed no tiene tenant_id, así que contamos todos los eventos
  -- Por ahora, las métricas de webhooks son globales, no por tenant
  -- En el futuro, podríamos añadir tenant_id a stripe_events_processed
  v_webhook_events_total := 0;
  v_webhook_events_failed := 0;

  -- Métricas de cron (holds liberados)
  -- Aproximación: contamos reservas canceladas en la ventana de tiempo
  -- Nota: Esta es una aproximación. En el futuro, podríamos añadir un campo
  -- 'cancelled_by' o 'cancellation_reason' para identificar mejor los holds liberados por cron
  select count(*)
  into v_cron_holds_released
  from public.bookings
  where tenant_id = p_tenant_id
    and updated_at >= v_date_start
    and updated_at < v_date_end
    and status = 'cancelled'
    and expires_at is null; -- Indica que fue cancelado por el cron (expires_at fue limpiado)

  -- Insertar o actualizar métricas
  insert into public.org_metrics_daily (
    tenant_id,
    metric_date,
    total_bookings,
    confirmed_bookings,
    cancelled_bookings,
    no_show_bookings,
    total_slots_available,
    slots_booked,
    occupancy_rate,
    active_services,
    active_staff,
    revenue_cents,
    webhook_events_total,
    webhook_events_failed,
    cron_holds_released,
    updated_at
  )
  values (
    p_tenant_id,
    p_metric_date,
    v_total_bookings,
    v_confirmed_bookings,
    v_cancelled_bookings,
    v_no_show_bookings,
    v_total_slots_available,
    v_slots_booked,
    v_occupancy_rate,
    v_active_services,
    v_active_staff,
    v_revenue_cents,
    v_webhook_events_total,
    v_webhook_events_failed,
    v_cron_holds_released,
    now()
  )
  on conflict (tenant_id, metric_date) do update set
    total_bookings = excluded.total_bookings,
    confirmed_bookings = excluded.confirmed_bookings,
    cancelled_bookings = excluded.cancelled_bookings,
    no_show_bookings = excluded.no_show_bookings,
    total_slots_available = excluded.total_slots_available,
    slots_booked = excluded.slots_booked,
    occupancy_rate = excluded.occupancy_rate,
    active_services = excluded.active_services,
    active_staff = excluded.active_staff,
    revenue_cents = excluded.revenue_cents,
    webhook_events_total = excluded.webhook_events_total,
    webhook_events_failed = excluded.webhook_events_failed,
    cron_holds_released = excluded.cron_holds_released,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."calculate_org_metrics_daily"("p_tenant_id" "uuid", "p_metric_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_org_metrics_daily"("p_tenant_id" "uuid", "p_metric_date" "date") IS 'Calcula y almacena métricas diarias para un tenant, incluyendo webhooks y cron. 
   Nota: cron_holds_released es una aproximación basada en reservas canceladas con expires_at null. 
   Las métricas de webhooks son globales (no por tenant) ya que stripe_events_processed no tiene tenant_id.';



CREATE OR REPLACE FUNCTION "public"."calculate_total_revenue_per_tenant"("tenant_uuid" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN (
    SELECT SUM(p.amount)
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.tenant_id = tenant_uuid  -- Usar la variable directamente sin comillas
  );
END;
$$;


ALTER FUNCTION "public"."calculate_total_revenue_per_tenant"("tenant_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_admin_user_status"() RETURNS TABLE("user_id" "uuid", "email" "text", "email_confirmed" boolean, "is_platform_admin" boolean, "platform_role" "text", "profile_exists" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    (u.email_confirmed_at IS NOT NULL) as email_confirmed,
    EXISTS(SELECT 1 FROM platform.platform_users pu WHERE pu.id = u.id AND pu.active = true) as is_platform_admin,
    COALESCE(pu.role, 'none')::text as platform_role,
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = u.id) as profile_exists
  FROM auth.users u
  LEFT JOIN platform.platform_users pu ON pu.id = u.id
  WHERE u.email = 'u0136986872@gmail.com';
END;
$$;


ALTER FUNCTION "public"."check_admin_user_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_admin_user_status"() IS 'Verifica el estado completo del usuario admin u0136986872@gmail.com. 
Útil para diagnosticar problemas de acceso.';



CREATE OR REPLACE FUNCTION "public"."check_booking_conflicts"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("conflict" boolean, "conflicts" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Buscar solapamientos en bookings
  RETURN QUERY
  SELECT
    CASE
      WHEN COUNT(*) > 0 THEN TRUE
      ELSE FALSE
    END,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'booking_id', b.id,
        'start_at', b.starts_at,
        'end_at', b.ends_at,
        'status', b.status,
        'customer', c.name
      )
    )
  FROM bookings b
  JOIN customers c ON b.customer_id = c.id
  WHERE b.staff_id = p_staff_id
    AND b.tenant_id = p_tenant_id
    AND b.status IN ('confirmed', 'completed', 'paid')
    AND (b.starts_at < p_end_at AND b.ends_at > p_start_at)
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
  GROUP BY b.staff_id;
END;
$$;


ALTER FUNCTION "public"."check_booking_conflicts"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_booking_integrity"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    issues jsonb := '{}'::jsonb;
BEGIN
    -- Bookings sin duración
    issues := issues || jsonb_build_object(
        'missing_duration',
        (SELECT jsonb_agg(id) FROM bookings WHERE duration_min IS NULL)
    );

    -- Bookings sin staff
    issues := issues || jsonb_build_object(
        'missing_staff',
        (SELECT jsonb_agg(id) FROM bookings WHERE staff_id IS NULL)
    );

    -- Bookings sin customer
    issues := issues || jsonb_build_object(
        'missing_customer',
        (SELECT jsonb_agg(id) FROM bookings WHERE customer_id IS NULL)
    );

    -- Bookings cuya hora final queda antes que la inicial
    issues := issues || jsonb_build_object(
        'invalid_times',
        (SELECT jsonb_agg(id) FROM bookings WHERE ends_at < starts_at)
    );

    -- Bookings pasados NO cerrados
    issues := issues || jsonb_build_object(
        'past_unclosed',
        (
            SELECT jsonb_agg(id)
            FROM bookings
            WHERE starts_at < now()
              AND status NOT IN ('completed', 'cancelled', 'no_show')
        )
    );

    RETURN issues;
END;
$$;


ALTER FUNCTION "public"."check_booking_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_customer_integrity"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    issues jsonb := '{}'::jsonb;
BEGIN
    issues := issues || jsonb_build_object(
        'customers_missing_name',
        (SELECT jsonb_agg(id) FROM customers WHERE name IS NULL)
    );

    issues := issues || jsonb_build_object(
        'customers_missing_contact',
        (
            SELECT jsonb_agg(id)
            FROM customers
            WHERE phone IS NULL AND email IS NULL
        )
    );

    RETURN issues;
END;
$$;


ALTER FUNCTION "public"."check_customer_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_database_health"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    results jsonb := '{}'::jsonb;
    r jsonb;
BEGIN
    -- Ejecutar cada check y acumular resultados
    r := public.check_booking_integrity();
    results := results || jsonb_build_object('booking_integrity', r);

    r := public.check_orphan_records();
    results := results || jsonb_build_object('orphan_records', r);

    r := public.check_metrics_integrity();
    results := results || jsonb_build_object('metrics_integrity', r);

    r := public.check_staff_integrity();
    results := results || jsonb_build_object('staff_integrity', r);

    r := public.check_customer_integrity();
    results := results || jsonb_build_object('customer_integrity', r);

    -- Registrar un evento del sistema
    PERFORM public.log_event(
        'health_check_executed',
        NULL,
        NULL,
        'system',
        NULL,
        'info',
        'Health check completo ejecutado',
        results
    );

    RETURN results;
END;
$$;


ALTER FUNCTION "public"."check_database_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_metrics_integrity"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    issues jsonb := '{}'::jsonb;
BEGIN
    issues := issues || jsonb_build_object(
        'metrics_without_tenant',
        (SELECT jsonb_agg(id) FROM org_metrics_daily WHERE tenant_id IS NULL)
    );

    issues := issues || jsonb_build_object(
        'negative_revenue',
        (SELECT jsonb_agg(id) FROM org_metrics_daily WHERE revenue_cents < 0)
    );

    issues := issues || jsonb_build_object(
        'duplicate_days',
        (
            SELECT jsonb_agg(metric_date)
            FROM org_metrics_daily
            GROUP BY tenant_id, metric_date
            HAVING COUNT(*) > 1
        )
    );

    -- Bookings con métricas faltantes
    issues := issues || jsonb_build_object(
        'missing_metric_days',
        (
            SELECT jsonb_agg(DISTINCT DATE(starts_at))
            FROM bookings b
            WHERE NOT EXISTS (
                SELECT 1
                FROM org_metrics_daily m
                WHERE m.tenant_id = b.tenant_id
                AND m.metric_date = DATE(b.starts_at)
            )
        )
    );

    RETURN issues;
END;
$$;


ALTER FUNCTION "public"."check_metrics_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_orphan_records"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    issues jsonb := '{}'::jsonb;
BEGIN
    issues := issues || jsonb_build_object(
        'customers_without_tenant',
        (
            SELECT jsonb_agg(id)
            FROM customers c
            WHERE NOT EXISTS (
                SELECT 1 FROM tenants t WHERE t.id = c.tenant_id
            )
        )
    );

    issues := issues || jsonb_build_object(
        'staff_without_tenant',
        (
            SELECT jsonb_agg(id)
            FROM staff s
            WHERE NOT EXISTS (
                SELECT 1 FROM tenants t WHERE t.id = s.tenant_id
            )
        )
    );

    issues := issues || jsonb_build_object(
        'bookings_invalid_service',
        (
            SELECT jsonb_agg(id)
            FROM bookings b
            WHERE NOT EXISTS (
                SELECT 1 FROM services s WHERE s.id = b.service_id
            )
        )
    );

    issues := issues || jsonb_build_object(
        'staff_services_orphans',
        (
            SELECT jsonb_agg(id)
            FROM staff_provides_services sps
            WHERE NOT EXISTS (SELECT 1 FROM staff s WHERE s.id = sps.staff_id)
               OR NOT EXISTS (SELECT 1 FROM services sr WHERE sr.id = sps.service_id)
        )
    );

    RETURN issues;
END;
$$;


ALTER FUNCTION "public"."check_orphan_records"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_platform_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'platform'
    AS $$
declare
  v_is_admin boolean;
begin
  select exists (
    select 1
    from platform.platform_users
    where id = p_user_id
      and active = true
  ) into v_is_admin;
  
  return coalesce(v_is_admin, false);
end;
$$;


ALTER FUNCTION "public"."check_platform_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_slot_availability"("tenant_uuid" "uuid", "slot_start" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM bookings WHERE tenant_id = tenant_uuid AND starts_at = slot_start AND status != 'cancelled') THEN
    RETURN FALSE;  -- Slot already booked
  ELSE
    RETURN TRUE;   -- Slot available
  END IF;
END;
$$;


ALTER FUNCTION "public"."check_slot_availability"("tenant_uuid" "uuid", "slot_start" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_staff_availability"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_overlap_count integer;
begin
  -- Verificar solapes en bookings (nuevo modelo)
  select count(*) into v_overlap_count
  from public.bookings
  where tenant_id = p_tenant_id
    and staff_id = p_staff_id
    and status in ('pending', 'paid')
    and tstzrange(p_starts_at, p_ends_at, '[)') && slot;
  
  if v_overlap_count > 0 then
    return false;
  end if;
  
  -- Verificar solapes en appointments si existe (legacy)
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
      and table_name = 'appointments'
  ) then
    select count(*) into v_overlap_count
    from public.appointments
    where org_id = p_tenant_id
      and staff_id = p_staff_id
      and status in ('hold', 'confirmed')
      and tstzrange(p_starts_at, p_ends_at, '[)') && slot;
    
    if v_overlap_count > 0 then
      return false;
    end if;
  end if;
  
  return true;
end;
$$;


ALTER FUNCTION "public"."check_staff_availability"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_staff_availability"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) IS 'Verifica si un staff está disponible en un rango de tiempo para un tenant específico. Retorna true si está disponible, false si hay solape. Incluye tenant_id para aislamiento multi-tenant.';



CREATE OR REPLACE FUNCTION "public"."check_staff_integrity"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    issues jsonb := '{}'::jsonb;
BEGIN
    issues := issues || jsonb_build_object(
        'staff_missing_display_name',
        (SELECT jsonb_agg(id) FROM staff WHERE display_name IS NULL)
    );

    issues := issues || jsonb_build_object(
        'inactive_staff_with_future_bookings',
        (
            SELECT jsonb_agg(id)
            FROM staff s
            WHERE active = false
              AND EXISTS (
                SELECT 1 FROM bookings b
                WHERE b.staff_id = s.id
                  AND b.starts_at >= now()
              )
        )
    );

    RETURN issues;
END;
$$;


ALTER FUNCTION "public"."check_staff_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_holds"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_bookings_count integer;
  v_appointments_count integer;
begin
  -- Limpiar bookings
  select public.release_expired_holds() into v_bookings_count;
  
  -- Limpiar appointments si existe
  v_appointments_count := 0;
  if exists (
    select 1 from information_schema.routines 
    where routine_schema = 'public' 
      and routine_name = 'release_expired_appointments'
  ) then
    select public.release_expired_appointments() into v_appointments_count;
  end if;
  
  return jsonb_build_object(
    'bookings_cancelled', v_bookings_count,
    'appointments_cancelled', v_appointments_count,
    'total', v_bookings_count + v_appointments_count
  );
end;
$$;


ALTER FUNCTION "public"."cleanup_expired_holds"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_holds"() IS 'Limpia holds expirados en bookings y appointments (legacy). Retorna estadísticas de limpieza.';



CREATE OR REPLACE FUNCTION "public"."create_booking_with_validation"("p_booking" "jsonb") RETURNS TABLE("booking" "jsonb", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_tenant_id UUID;
    v_staff_id UUID;
    v_customer_id UUID;
    v_service_id UUID;
    v_start_at TIMESTAMPTZ;
    v_end_at TIMESTAMPTZ;
    v_status TEXT;
BEGIN
    -- Extraer campos
    v_tenant_id := (p_booking->>'tenant_id')::UUID;
    v_staff_id := (p_booking->>'staff_id')::UUID;
    v_customer_id := (p_booking->>'customer_id')::UUID;
    v_service_id := (p_booking->>'service_id')::UUID;
    v_start_at := (p_booking->>'starts_at')::timestamptz;
    v_end_at := (p_booking->>'ends_at')::timestamptz;
    v_status := COALESCE(p_booking->>'status', 'confirmed');

    -- Validar conflictos
    IF EXISTS (
        SELECT 1 FROM public.check_booking_conflicts(
            v_tenant_id,
            v_staff_id,
            v_start_at,
            v_end_at,
            NULL
        )
    ) THEN
        RETURN QUERY SELECT NULL::jsonb, 'Conflicto detectado: el horario no está disponible';
        RETURN;
    END IF;

    -- Crear booking
    RETURN QUERY
    INSERT INTO bookings (
        tenant_id, staff_id, customer_id, service_id,
        starts_at, ends_at, status
    ) VALUES (
        v_tenant_id, v_staff_id, v_customer_id, v_service_id,
        v_start_at, v_end_at, v_status
    )
    RETURNING row_to_json(bookings.*)::jsonb, NULL;
END;
$$;


ALTER FUNCTION "public"."create_booking_with_validation"("p_booking" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_with_validation"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_customer_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_service_id" "uuid", "p_status" "text") RETURNS TABLE("booking_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_conflict BOOLEAN;
BEGIN
  -- Verificar si existe un conflicto
  PERFORM check_booking_conflicts(p_tenant_id, p_staff_id, p_start_at, p_end_at);

  -- Si hay conflicto, se retorna el error
  IF v_conflict THEN
    RETURN QUERY SELECT NULL, 'El horario ya está ocupado por otra reserva o bloqueo';
  END IF;

  -- Insertar el booking si no hay conflicto
  INSERT INTO bookings (
    tenant_id, staff_id, customer_id, starts_at, ends_at, service_id, status
  ) VALUES (
    p_tenant_id, p_staff_id, p_customer_id, p_start_at, p_end_at, p_service_id, p_status
  ) RETURNING id INTO booking_id;

  RETURN QUERY SELECT booking_id, NULL;
END;
$$;


ALTER FUNCTION "public"."create_booking_with_validation"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_customer_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_service_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_log"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text" DEFAULT NULL::"text", "p_resource_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_log_id uuid;
begin
  insert into public.logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent
  )
  values (
    p_tenant_id,
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    p_ip_address,
    p_user_agent
  )
  returning id into v_log_id;
  
  return v_log_id;
end;
$$;


ALTER FUNCTION "public"."create_log"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_log"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") IS 'Crea un log de acción. Usar desde service_role o triggers.';



CREATE OR REPLACE FUNCTION "public"."create_or_update_booking"("p_booking" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_id UUID;
    v_tenant_id UUID;
    v_staff_id UUID;
    v_start_at TIMESTAMPTZ;
    v_end_at TIMESTAMPTZ;
BEGIN
    -- Extraer campos
    v_id := (p_booking->>'id')::UUID;
    v_tenant_id := (p_booking->>'tenant_id')::UUID;
    v_staff_id := (p_booking->>'staff_id')::UUID;
    v_start_at := (p_booking->>'starts_at')::timestamptz;
    v_end_at   := (p_booking->>'ends_at')::timestamptz;

    ----------------------------------------------------------------------
    -- 1. VALIDAR CONFLICTOS
    ----------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 
        FROM public.check_booking_conflicts(
            v_tenant_id,
            v_staff_id,
            v_start_at,
            v_end_at,
            v_id
        )
    ) THEN
        RAISE EXCEPTION 'Booking conflict detected';
    END IF;

    ----------------------------------------------------------------------
    -- 2. CREAR O ACTUALIZAR BOOKING (transacción implícita)
    ----------------------------------------------------------------------
    IF v_id IS NULL THEN
        INSERT INTO bookings (
            tenant_id, staff_id, customer_id, service_id, 
            starts_at, ends_at, status, notes
        )
        VALUES (
            v_tenant_id,
            v_staff_id,
            (p_booking->>'customer_id')::UUID,
            (p_booking->>'service_id')::UUID,
            v_start_at,
            v_end_at,
            COALESCE(p_booking->>'status', 'confirmed'),
            p_booking->>'notes'
        )
        RETURNING row_to_json(bookings.*)::jsonb INTO p_booking;
    ELSE
        UPDATE bookings
        SET 
            staff_id = v_staff_id,
            customer_id = (p_booking->>'customer_id')::UUID,
            service_id = (p_booking->>'service_id')::UUID,
            starts_at = v_start_at,
            ends_at   = v_end_at,
            status = COALESCE(p_booking->>'status', status),
            notes  = COALESCE(p_booking->>'notes', notes)
        WHERE id = v_id
        RETURNING row_to_json(bookings.*)::jsonb INTO p_booking;
    END IF;

    RETURN p_booking;
END;
$$;


ALTER FUNCTION "public"."create_or_update_booking"("p_booking" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_platform_admin"("p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_role" "text" DEFAULT 'admin'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'platform'
    AS $$
declare
  v_admin_id uuid;
begin
  -- Verificar que el usuario existe en auth.users (solo service_role puede hacerlo)
  -- Por ahora, confiamos en que se pasa el ID correcto
  
  insert into platform.platform_users (id, email, name, role, active)
  values (p_user_id, p_email, p_name, p_role, true)
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    active = true
  returning id into v_admin_id;
  
  return v_admin_id;
end;
$$;


ALTER FUNCTION "public"."create_platform_admin"("p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_staff_blocking_with_validation"("p_block" "jsonb") RETURNS TABLE("blocking" "jsonb", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_tenant_id UUID;
    v_staff_id UUID;
    v_start_at TIMESTAMPTZ;
    v_end_at TIMESTAMPTZ;
BEGIN
    v_tenant_id := (p_block->>'tenant_id')::UUID;
    v_staff_id := (p_block->>'staff_id')::UUID;
    v_start_at := (p_block->>'start_at')::timestamptz;
    v_end_at := (p_block->>'end_at')::timestamptz;

    -- Validar conflictos
    IF EXISTS (
        SELECT 1 FROM public.check_booking_conflicts(
            v_tenant_id,
            v_staff_id,
            v_start_at,
            v_end_at,
            NULL
        )
    ) THEN
        RETURN QUERY SELECT NULL::jsonb, 'Conflicto detectado: existe una reserva en ese rango';
        RETURN;
    END IF;

    -- Crear bloqueo
    RETURN QUERY
    INSERT INTO staff_blockings (
        tenant_id, staff_id, start_at, end_at
    ) VALUES (
        v_tenant_id, v_staff_id, v_start_at, v_end_at
    )
    RETURNING row_to_json(staff_blockings.*)::jsonb, NULL;
END;
$$;


ALTER FUNCTION "public"."create_staff_blocking_with_validation"("p_block" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_booking_tenant_matches_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  appt_tenant uuid;
BEGIN
  IF NEW.appointment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.tenant_id INTO appt_tenant
  FROM public.appointments a
  WHERE a.id = NEW.appointment_id;

  IF appt_tenant IS NULL THEN
    RAISE EXCEPTION 'Appointment % no existe', NEW.appointment_id USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Autorrellenar tenant_id si viene NULL
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := appt_tenant;
  ELSIF NEW.tenant_id <> appt_tenant THEN
    RAISE EXCEPTION 'El tenant_id de bookings (%) no coincide con el de appointments (%)', NEW.tenant_id, appt_tenant
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_booking_tenant_matches_appointment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_payment_tenant_matches_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Solo comprobamos cuando haya booking asociado
  IF NEW.booking_id IS NOT NULL THEN
    PERFORM 1
    FROM public.bookings b
    WHERE b.id = NEW.booking_id
      AND b.tenant_id = NEW.tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'payments.tenant_id (%) must match bookings.tenant_id for booking (%)',
        NEW.tenant_id, NEW.booking_id
        USING ERRCODE = '23514'; -- violation of check constraint
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_payment_tenant_matches_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_default_team_conversation"("p_tenant_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_tenant_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.user_has_role_for_tenant(p_tenant_id, NULL) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id
  INTO v_conversation_id
  FROM public.team_conversations
  WHERE tenant_id = p_tenant_id
    AND type = 'all'
    AND is_default = true
  ORDER BY created_at
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    SELECT name INTO v_tenant_name FROM public.tenants WHERE id = p_tenant_id;

    INSERT INTO public.team_conversations (tenant_id, type, name, is_default, created_by)
    VALUES (
      p_tenant_id,
      'all',
      COALESCE(v_tenant_name, 'Chat de equipo'),
      true,
      auth.uid()
    )
    RETURNING id INTO v_conversation_id;

    INSERT INTO public.team_conversation_members (conversation_id, user_id, role)
    SELECT v_conversation_id, m.user_id, 'member'
    FROM public.memberships m
    WHERE m.tenant_id = p_tenant_id
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."ensure_default_team_conversation"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_default_team_conversation"("p_tenant_id" "uuid") IS 'Garantiza que exista el canal global de equipo por tenant y enrola a todos los usuarios.';



CREATE OR REPLACE FUNCTION "public"."ensure_direct_conversations_for_user"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_other record;
  v_conv_id uuid;
  v_other_name text;
begin
  -- Safeguard
  if p_user_id is null or p_tenant_id is null then
    return;
  end if;

  for v_other in
    select m.user_id
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id <> p_user_id
  loop
    -- Skip if a direct conversation with exactly these two users already exists
    if not exists (
      select 1
      from public.team_conversations tc
      join public.team_conversation_members a on a.conversation_id = tc.id and a.user_id = p_user_id
      join public.team_conversation_members b on b.conversation_id = tc.id and b.user_id = v_other.user_id
      where tc.tenant_id = p_tenant_id
        and tc.type = 'direct'
        and coalesce(tc.is_archived, false) = false
      group by tc.id
      having count(distinct a.user_id) = 1 and count(distinct b.user_id) = 1
    ) then
      -- Compute a friendly name with the other member's display_name or email
      select coalesce(p.display_name, u.email, 'Chat directo')
      into v_other_name
      from public.profiles p
      left join auth.users u on u.id = v_other.user_id
      where p.user_id = v_other.user_id;

      insert into public.team_conversations (tenant_id, type, name, created_by)
      values (p_tenant_id, 'direct', v_other_name, p_user_id)
      returning id into v_conv_id;

      insert into public.team_conversation_members (conversation_id, user_id, role)
      values
        (v_conv_id, p_user_id, 'member'),
        (v_conv_id, v_other.user_id, 'member')
      on conflict do nothing;
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."ensure_direct_conversations_for_user"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_direct_team_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.user_has_role_for_tenant(p_tenant_id, NULL) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT tc.id
  INTO v_conversation_id
  FROM public.team_conversations tc
  WHERE tc.tenant_id = p_tenant_id
    AND tc.type = 'direct'
    AND EXISTS (
      SELECT 1
      FROM public.team_conversation_members m1
      WHERE m1.conversation_id = tc.id
        AND m1.user_id = p_user_a
    )
    AND EXISTS (
      SELECT 1
      FROM public.team_conversation_members m2
      WHERE m2.conversation_id = tc.id
        AND m2.user_id = p_user_b
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.team_conversation_members mx
      WHERE mx.conversation_id = tc.id
        AND mx.user_id NOT IN (p_user_a, p_user_b)
    )
  LIMIT 1;

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."find_direct_team_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_direct_team_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") IS 'Busca una conversación directa existente entre dos usuarios del mismo tenant.';



CREATE OR REPLACE FUNCTION "public"."fn_add_member"("p_org" "uuid", "p_user" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (p_org, p_user, p_role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;


ALTER FUNCTION "public"."fn_add_member"("p_org" "uuid", "p_user" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_time_range"("start_time" time without time zone, "end_time" time without time zone, "slot_minutes" integer) RETURNS TABLE("slot_start" time without time zone, "slot_end" time without time zone)
    LANGUAGE "sql"
    AS $$
    SELECT 
        (start_time + (n * (slot_minutes || ' minutes')::interval))::time AS slot_start,
        LEAST(
            (start_time + ((n + 1) * (slot_minutes || ' minutes')::interval)),
            end_time
        )::time AS slot_end
    FROM generate_series(
        0,
        EXTRACT(epoch FROM (end_time - start_time)) / 60 / slot_minutes
    ) AS n;
$$;


ALTER FUNCTION "public"."generate_time_range"("start_time" time without time zone, "end_time" time without time zone, "slot_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agenda"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("booking_id" "uuid", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "status" "text", "staff_id" "uuid", "staff_name" "text", "customer_id" "uuid", "customer_name" "text", "service_id" "uuid", "service_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
begin
  return query
    select
      b.id,
      b.starts_at,
      b.ends_at,
      b.status,
      s.id,
      s.name,
      c.id,
      c.name,
      sv.id,
      sv.name
    from public.bookings b
    left join public.staff s on s.id = b.staff_id
    left join public.customers c on c.id = b.customer_id
    left join public.services sv on sv.id = b.service_id
    where b.tenant_id = p_tenant_id
      and b.starts_at >= p_start_date
      and b.starts_at <= p_end_date
    order by b.starts_at asc;
end;
$$;


ALTER FUNCTION "public"."get_agenda"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_group_by" "text") RETURNS TABLE("group_key" "text", "bookings" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Agrupar los bookings por el criterio de `p_group_by`
  IF p_group_by = 'day' THEN
    RETURN QUERY
    SELECT 
      TO_CHAR(b.starts_at, 'YYYY-MM-DD') AS group_key,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'booking_id', b.id,
          'start_at', b.starts_at,
          'end_at', b.ends_at,
          'customer_name', c.name,
          'status', b.status
        )
      )
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= p_start_date
      AND b.ends_at <= p_end_date
    GROUP BY TO_CHAR(b.starts_at, 'YYYY-MM-DD');
  ELSIF p_group_by = 'staff' THEN
    -- Agrupar por staff
    RETURN QUERY
    SELECT 
      st.name AS group_key,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'booking_id', b.id,
          'start_at', b.starts_at,
          'end_at', b.ends_at,
          'customer_name', c.name,
          'status', b.status
        )
      )
    FROM bookings b
    JOIN staff st ON b.staff_id = st.id
    JOIN customers c ON b.customer_id = c.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= p_start_date
      AND b.ends_at <= p_end_date
    GROUP BY st.name;
  END IF;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_group_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_group_by" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF p_group_by = 'day' THEN
        SELECT jsonb_agg(row_to_json(t))
        INTO v_result
        FROM (
            SELECT date(starts_at) AS day, jsonb_agg(row_to_json(b)) AS bookings
            FROM bookings b
            WHERE tenant_id = p_tenant_id
              AND starts_at >= p_start_date
              AND starts_at <= p_end_date
            GROUP BY date(starts_at)
            ORDER BY day
        ) t;

    ELSIF p_group_by = 'staff' THEN
        SELECT jsonb_agg(row_to_json(t))
        INTO v_result
        FROM (
            SELECT staff_id, jsonb_agg(row_to_json(b)) AS bookings
            FROM bookings b
            WHERE tenant_id = p_tenant_id
              AND starts_at >= p_start_date
              AND starts_at <= p_end_date
            GROUP BY staff_id
        ) t;

    ELSIF p_group_by = 'status' THEN
        SELECT jsonb_agg(row_to_json(t))
        INTO v_result
        FROM (
            SELECT status, jsonb_agg(row_to_json(b)) AS bookings
            FROM bookings b
            WHERE tenant_id = p_tenant_id
              AND starts_at >= p_start_date
              AND starts_at <= p_end_date
            GROUP BY status
        ) t;
    END IF;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_group_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agenda_stats"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_status" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_bookings INT;
    v_total_minutes NUMERIC;
    v_total_amount BIGINT;
    v_by_staff JSONB;
BEGIN
    --------------------------------------------------------------------
    -- 1. TOTAL BOOKINGS, MINUTES, REVENUE
    --------------------------------------------------------------------
    SELECT 
        COUNT(*) AS total_bookings,
        COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at)) / 60), 0) AS total_minutes,
        COALESCE(SUM(s.price_cents), 0) AS total_amount
    INTO v_total_bookings, v_total_minutes, v_total_amount
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= p_start_date
      AND b.ends_at <= p_end_date
      AND (p_status = 'all' OR b.status = p_status)
      AND (p_staff_id IS NULL OR b.staff_id = p_staff_id);

    --------------------------------------------------------------------
    -- 2. UTILIZACIÓN POR STAFF (agrupación → luego JSONB_AGG)
    --------------------------------------------------------------------
    WITH staff_data AS (
        SELECT 
            st.id AS staff_id,
            st.name AS staff_name,
            COUNT(b.id) AS total_bookings,
            COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at)) / 60), 0) AS total_minutes
        FROM bookings b
        JOIN staff st ON b.staff_id = st.id
        WHERE b.tenant_id = p_tenant_id
          AND b.starts_at >= p_start_date
          AND b.ends_at <= p_end_date
          AND (p_staff_id IS NULL OR b.staff_id = p_staff_id)
        GROUP BY st.id, st.name
    )
    SELECT JSONB_AGG(ROW_TO_JSON(staff_data))
    INTO v_by_staff
    FROM staff_data;

    --------------------------------------------------------------------
    -- 3. RETURN STRUCTURED JSON
    --------------------------------------------------------------------
    RETURN JSONB_BUILD_OBJECT(
        'total_bookings', v_total_bookings,
        'total_minutes', v_total_minutes,
        'total_amount', v_total_amount,
        'by_staff', v_by_staff
    );

END;
$$;


ALTER FUNCTION "public"."get_agenda_stats"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_staff_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_date" "date" DEFAULT CURRENT_DATE, "p_days_ahead" integer DEFAULT 30) RETURNS TABLE("slot_start" timestamp with time zone, "slot_end" timestamp with time zone, "staff_id" "uuid", "staff_name" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_service_duration interval;
  v_tenant_tz text;
  v_date_start date;
  v_date_end date;
begin
  -- Obtener duración del servicio y timezone del tenant
  select duration_min, t.timezone
  into v_service_duration, v_tenant_tz
  from public.services s
  join public.tenants t on t.id = s.tenant_id
  where s.id = p_service_id
    and s.tenant_id = p_tenant_id
    and s.active = true
  limit 1;

  if v_service_duration is null then
    return; -- Servicio no encontrado o inactivo
  end if;

  v_service_duration := (v_service_duration || ' minutes')::interval;
  v_tenant_tz := coalesce(v_tenant_tz, 'Europe/Madrid');
  v_date_start := p_date;
  v_date_end := p_date + (p_days_ahead || ' days')::interval;

  return query
  with date_series as (
    -- Generar serie de fechas
    select generate_series(
      v_date_start::timestamp,
      v_date_end::timestamp,
      '1 day'::interval
    )::date as day
  ),
  staff_schedules as (
    -- Horarios del staff para los días solicitados
    select 
      s.staff_id,
      s.weekday,
      s.start_time,
      s.end_time,
      st.display_name as staff_name
    from public.schedules s
    join public.staff st on st.id = s.staff_id
    join date_series ds on extract(dow from ds.day) = s.weekday
    where s.tenant_id = p_tenant_id
      and st.tenant_id = p_tenant_id
      and st.active = true
      and (p_staff_id is null or s.staff_id = p_staff_id)
  ),
  existing_bookings as (
    -- Reservas existentes (pagadas, completadas o pendientes no expiradas)
    select 
      b.staff_id,
      b.starts_at,
      b.ends_at
    from public.bookings b
    where b.tenant_id = p_tenant_id
      and b.status in ('paid', 'completed')
      and b.starts_at >= (v_date_start::timestamp at time zone v_tenant_tz)::timestamptz
      and b.starts_at < (v_date_end::timestamp at time zone v_tenant_tz)::timestamptz
    
    union all
    
    -- Pendientes no expirados (holds)
    select 
      b.staff_id,
      b.starts_at,
      b.ends_at
    from public.bookings b
    where b.tenant_id = p_tenant_id
      and b.status = 'pending'
      and (b.expires_at is null or b.expires_at > now())
      and b.starts_at >= (v_date_start::timestamp at time zone v_tenant_tz)::timestamptz
      and b.starts_at < (v_date_end::timestamp at time zone v_tenant_tz)::timestamptz
  ),
  time_slots as (
    -- Generar slots de tiempo para cada día y staff
    select 
      ss.staff_id,
      ss.staff_name,
      (ds.day::timestamp + ss.start_time)::timestamptz at time zone v_tenant_tz as slot_start_tz,
      (ds.day::timestamp + ss.end_time)::timestamp at time zone v_tenant_tz as slot_end_tz
    from date_series ds
    cross join staff_schedules ss
    where extract(dow from ds.day) = ss.weekday
  ),
  generated_slots as (
    -- Generar slots de la duración del servicio dentro de cada ventana
    select 
      ts.staff_id,
      ts.staff_name,
      generate_series(
        ts.slot_start_tz,
        ts.slot_end_tz - v_service_duration,
        '15 minutes'::interval -- Intervalo mínimo entre slots (configurable)
      )::timestamptz as slot_start,
      (generate_series(
        ts.slot_start_tz,
        ts.slot_end_tz - v_service_duration,
        '15 minutes'::interval
      ) + v_service_duration)::timestamptz as slot_end
    from time_slots ts
    where ts.slot_start_tz >= now() -- Solo slots futuros
  )
  select 
    gs.slot_start,
    gs.slot_end,
    gs.staff_id,
    gs.staff_name
  from generated_slots gs
  where not exists (
    -- Excluir slots que solapan con reservas existentes
    select 1
    from existing_bookings eb
    where eb.staff_id = gs.staff_id
      and (
        (gs.slot_start < eb.ends_at and gs.slot_end > eb.starts_at)
      )
  )
  order by gs.slot_start, gs.staff_name;
end;
$$;


ALTER FUNCTION "public"."get_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_date" "date", "p_days_ahead" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_date" "date", "p_days_ahead" integer) IS 'Calcula slots disponibles para un servicio, considerando horarios del staff, reservas existentes y holds no expirados. Respeta timezone del tenant y valida que los slots no estén en el pasado.';



CREATE OR REPLACE FUNCTION "public"."get_conversation_members"("p_conversation_id" "uuid") RETURNS TABLE("user_id" "uuid", "role" "text", "joined_at" timestamp with time zone, "display_name" "text", "profile_photo_url" "text", "tenant_role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verificar que el usuario es miembro de esta conversación
  IF NOT EXISTS (
    SELECT 1 FROM public.team_conversation_members
    WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Obtener tenant_id de la conversación
  SELECT tenant_id INTO v_tenant_id
  FROM public.team_conversations
  WHERE id = p_conversation_id;

  -- Retornar todos los miembros de la conversación con información del perfil
  RETURN QUERY
  SELECT
    tcm.user_id,
    tcm.role,
    tcm.joined_at,
    public.get_user_display_name(auth.uid(), tcm.user_id, v_tenant_id) AS display_name,
    public.get_user_profile_photo(tcm.user_id, v_tenant_id) AS profile_photo_url,
    m.role AS tenant_role
  FROM public.team_conversation_members tcm
  LEFT JOIN public.memberships m
    ON m.user_id = tcm.user_id
    AND m.tenant_id = v_tenant_id
  WHERE tcm.conversation_id = p_conversation_id
  ORDER BY tcm.joined_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_conversation_members"("p_conversation_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_conversation_members"("p_conversation_id" "uuid") IS 'Obtiene todos los miembros de una conversación si el usuario actual es miembro de ella.';



CREATE OR REPLACE FUNCTION "public"."get_conversation_messages_paginated"("p_conversation_id" "uuid", "p_limit" integer DEFAULT 50, "p_before_timestamp" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_timestamp" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("id" "uuid", "conversation_id" "uuid", "sender_id" "uuid", "body" "text", "created_at" timestamp with time zone, "edited_at" timestamp with time zone, "deleted_at" timestamp with time zone, "author_name" "text", "author_avatar" "text", "has_more_before" boolean, "has_more_after" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_has_more_before BOOLEAN;
  v_has_more_after BOOLEAN;
  v_oldest_timestamp TIMESTAMPTZ;
  v_newest_timestamp TIMESTAMPTZ;
BEGIN
  -- Obtener rango de mensajes a retornar
  IF p_before_timestamp IS NOT NULL THEN
    -- Cargar mensajes ANTERIORES a un timestamp (scroll hacia arriba)
    SELECT MIN(tm.created_at), MAX(tm.created_at)
    INTO v_oldest_timestamp, v_newest_timestamp
    FROM (
      SELECT created_at
      FROM team_messages
      WHERE conversation_id = p_conversation_id
        AND created_at < p_before_timestamp
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT p_limit
    ) tm;
  ELSIF p_after_timestamp IS NOT NULL THEN
    -- Cargar mensajes POSTERIORES a un timestamp (nuevos mensajes)
    SELECT MIN(tm.created_at), MAX(tm.created_at)
    INTO v_oldest_timestamp, v_newest_timestamp
    FROM (
      SELECT created_at
      FROM team_messages
      WHERE conversation_id = p_conversation_id
        AND created_at > p_after_timestamp
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT p_limit
    ) tm;
  ELSE
    -- Cargar mensajes más recientes (primera carga)
    SELECT MIN(tm.created_at), MAX(tm.created_at)
    INTO v_oldest_timestamp, v_newest_timestamp
    FROM (
      SELECT created_at
      FROM team_messages
      WHERE conversation_id = p_conversation_id
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT p_limit
    ) tm;
  END IF;

  -- Verificar si hay más mensajes anteriores
  SELECT EXISTS(
    SELECT 1 FROM team_messages
    WHERE conversation_id = p_conversation_id
      AND created_at < COALESCE(v_oldest_timestamp, NOW())
      AND deleted_at IS NULL
  ) INTO v_has_more_before;

  -- Verificar si hay más mensajes posteriores
  SELECT EXISTS(
    SELECT 1 FROM team_messages
    WHERE conversation_id = p_conversation_id
      AND created_at > COALESCE(v_newest_timestamp, '1970-01-01'::TIMESTAMPTZ)
      AND deleted_at IS NULL
  ) INTO v_has_more_after;

  -- Retornar mensajes con información del autor
  RETURN QUERY
  SELECT 
    tm.id,
    tm.conversation_id,
    tm.sender_id,
    tm.body,
    tm.created_at,
    tm.edited_at,
    tm.deleted_at,
    -- Autor
    COALESCE(u.full_name, u.email, 'Usuario desconocido') as author_name,
    u.raw_user_meta_data->>'avatar_url' as author_avatar,
    -- Paginación
    v_has_more_before,
    v_has_more_after
  FROM team_messages tm
  LEFT JOIN auth.users u ON tm.sender_id = u.id
  WHERE tm.conversation_id = p_conversation_id
    AND tm.created_at >= COALESCE(v_oldest_timestamp, '1970-01-01'::TIMESTAMPTZ)
    AND tm.created_at <= COALESCE(v_newest_timestamp, NOW())
    AND tm.deleted_at IS NULL
  ORDER BY tm.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_conversation_messages_paginated"("p_conversation_id" "uuid", "p_limit" integer, "p_before_timestamp" timestamp with time zone, "p_after_timestamp" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_conversation_messages_paginated"("p_conversation_id" "uuid", "p_limit" integer, "p_before_timestamp" timestamp with time zone, "p_after_timestamp" timestamp with time zone) IS 'Obtiene mensajes de una conversación con paginación infinita.
Soporta scroll hacia arriba (before) y detección de nuevos mensajes (after).
Incluye información del autor y flags de paginación.';



CREATE OR REPLACE FUNCTION "public"."get_conversation_stats"("p_conversation_id" "uuid") RETURNS TABLE("total_messages" bigint, "total_participants" integer, "messages_today" integer, "messages_this_week" integer, "most_active_user_id" "uuid", "most_active_user_name" "text", "avg_response_time_minutes" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH message_stats AS (
    SELECT 
      COUNT(*) as total_msgs,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) as msgs_today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW())) as msgs_week,
      COUNT(DISTINCT sender_id) as participants
    FROM team_messages
    WHERE conversation_id = p_conversation_id
      AND deleted_at IS NULL
  ),
  user_activity AS (
    SELECT 
      tm.sender_id as user_id,
      COUNT(*) as msg_count,
      u.raw_user_meta_data->>'full_name' as full_name
    FROM team_messages tm
    LEFT JOIN auth.users u ON tm.sender_id = u.id
    WHERE tm.conversation_id = p_conversation_id
      AND tm.deleted_at IS NULL
    GROUP BY tm.sender_id, u.raw_user_meta_data->>'full_name'
    ORDER BY msg_count DESC
    LIMIT 1
  )
  SELECT 
    ms.total_msgs,
    ms.participants,
    ms.msgs_today::INT,
    ms.msgs_week::INT,
    ua.user_id,
    ua.full_name,
    0::INT -- TODO: Calcular tiempo promedio de respuesta
  FROM message_stats ms
  CROSS JOIN user_activity ua;
END;
$$;


ALTER FUNCTION "public"."get_conversation_stats"("p_conversation_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_conversation_stats"("p_conversation_id" "uuid") IS 'Retorna estadísticas de una conversación.
Incluye: total mensajes, participantes, mensajes recientes, usuario más activo.';



CREATE OR REPLACE FUNCTION "public"."get_dashboard_kpis"("p_tenant_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_result JSON;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_seven_days_ago TIMESTAMPTZ;
  v_thirty_days_ago TIMESTAMPTZ;
  
  -- KPIs básicos
  v_bookings_today INT;
  v_revenue_today BIGINT;
  v_active_services INT;
  v_active_staff INT;
  
  -- KPIs históricos
  v_total_bookings_7d INT;
  v_total_bookings_30d INT;
  v_revenue_7d BIGINT;
  v_revenue_30d BIGINT;
  v_no_shows_7d INT;
  
  -- Arrays de series temporales
  v_bookings_last_7_days INT[];
  v_bookings_last_30_days INT[];
  
  -- Tickets medios
  v_avg_ticket_today BIGINT;
  v_avg_ticket_7d BIGINT;
  v_avg_ticket_30d BIGINT;
  
  -- Ocupación
  v_occupancy_today_percent INT;
  v_occupancy_7d_percent INT;
  v_occupancy_30d_percent INT;
  
BEGIN
  -- Calcular rangos de fechas usando la zona horaria del tenant
  SELECT 
    date_trunc('day', NOW() AT TIME ZONE COALESCE(timezone, 'Europe/Madrid')) AT TIME ZONE COALESCE(timezone, 'Europe/Madrid'),
    date_trunc('day', NOW() AT TIME ZONE COALESCE(timezone, 'Europe/Madrid')) AT TIME ZONE COALESCE(timezone, 'Europe/Madrid') + INTERVAL '1 day',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '30 days'
  INTO v_today_start, v_today_end, v_seven_days_ago, v_thirty_days_ago
  FROM tenants WHERE id = p_tenant_id;

  -- ======================
  -- 1. KPIs BÁSICOS DE HOY
  -- ======================
  
  -- Reservas de hoy (todos los estados menos cancelled)
  SELECT COUNT(*)
  INTO v_bookings_today
  FROM bookings
  WHERE tenant_id = p_tenant_id
    AND starts_at >= v_today_start
    AND starts_at < v_today_end
    AND status != 'cancelled';

  -- Ingresos de hoy (solo confirmed, completed, paid)
  SELECT COALESCE(SUM(s.price_cents), 0)
  INTO v_revenue_today
  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_today_start
    AND b.starts_at < v_today_end
    AND b.status IN ('confirmed', 'completed', 'paid');

  -- Servicios activos
  SELECT COUNT(*)
  INTO v_active_services
  FROM services
  WHERE tenant_id = p_tenant_id
    AND active = true;

  -- Staff activo
  SELECT COUNT(*)
  INTO v_active_staff
  FROM staff
  WHERE tenant_id = p_tenant_id
    AND active = true;

  -- ======================
  -- 2. KPIs ÚLTIMOS 7 DÍAS
  -- ======================
  
  -- Total de reservas últimos 7 días
  SELECT COUNT(*)
  INTO v_total_bookings_7d
  FROM bookings
  WHERE tenant_id = p_tenant_id
    AND starts_at >= v_seven_days_ago
    AND status != 'cancelled';

  -- Ingresos últimos 7 días
  SELECT COALESCE(SUM(s.price_cents), 0)
  INTO v_revenue_7d
  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_seven_days_ago
    AND b.status IN ('confirmed', 'completed', 'paid');

  -- No-shows últimos 7 días
  SELECT COUNT(*)
  INTO v_no_shows_7d
  FROM bookings
  WHERE tenant_id = p_tenant_id
    AND starts_at >= v_seven_days_ago
    AND status = 'no_show';

  -- Serie temporal: Reservas por día (últimos 7 días)
  WITH RECURSIVE date_series AS (
    SELECT v_seven_days_ago::DATE + i AS date
    FROM generate_series(0, 6) AS i
  )
  SELECT ARRAY_AGG(COALESCE(b.count, 0) ORDER BY ds.date)
  INTO v_bookings_last_7_days
  FROM date_series ds
  LEFT JOIN (
    SELECT starts_at::DATE as booking_date, COUNT(*)::INT as count
    FROM bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_seven_days_ago
      AND status != 'cancelled'
    GROUP BY booking_date
  ) b ON ds.date = b.booking_date;

  -- Ticket medio últimos 7 días (solo reservas completadas)
  SELECT CASE 
    WHEN COUNT(*) > 0 THEN (SUM(s.price_cents) / COUNT(*))::BIGINT
    ELSE 0
  END
  INTO v_avg_ticket_7d
  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_seven_days_ago
    AND b.status IN ('confirmed', 'completed', 'paid');

  -- ======================
  -- 3. KPIs ÚLTIMOS 30 DÍAS
  -- ======================
  
  -- Total de reservas últimos 30 días
  SELECT COUNT(*)
  INTO v_total_bookings_30d
  FROM bookings
  WHERE tenant_id = p_tenant_id
    AND starts_at >= v_thirty_days_ago
    AND status != 'cancelled';

  -- Ingresos últimos 30 días
  SELECT COALESCE(SUM(s.price_cents), 0)
  INTO v_revenue_30d
  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_thirty_days_ago
    AND b.status IN ('confirmed', 'completed', 'paid');

  -- Serie temporal: Reservas por día (últimos 30 días)
  WITH RECURSIVE date_series AS (
    SELECT v_thirty_days_ago::DATE + i AS date
    FROM generate_series(0, 29) AS i
  )
  SELECT ARRAY_AGG(COALESCE(b.count, 0) ORDER BY ds.date)
  INTO v_bookings_last_30_days
  FROM date_series ds
  LEFT JOIN (
    SELECT starts_at::DATE as booking_date, COUNT(*)::INT as count
    FROM bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_thirty_days_ago
      AND status != 'cancelled'
    GROUP BY booking_date
  ) b ON ds.date = b.booking_date;

  -- Ticket medio últimos 30 días
  SELECT CASE 
    WHEN COUNT(*) > 0 THEN (SUM(s.price_cents) / COUNT(*))::BIGINT
    ELSE 0
  END
  INTO v_avg_ticket_30d
  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_thirty_days_ago
    AND b.status IN ('confirmed', 'completed', 'paid');

  -- Ticket medio hoy
  SELECT CASE 
    WHEN COUNT(*) > 0 THEN (SUM(s.price_cents) / COUNT(*))::BIGINT
    ELSE 0
  END
  INTO v_avg_ticket_today
  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_today_start
    AND b.starts_at < v_today_end
    AND b.status IN ('confirmed', 'completed', 'paid');

  -- ======================
  -- 4. OCUPACIÓN (basada en horarios reales del staff)
  -- ======================
  
  -- Ocupación hoy
  WITH today_schedules AS (
    SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600) AS total_hours
    FROM staff_schedules ss
    INNER JOIN staff st ON ss.staff_id = st.id
    WHERE st.tenant_id = p_tenant_id
      AND st.active = true
      AND ss.is_active = true
      AND ss.day_of_week = EXTRACT(DOW FROM v_today_start)::INT
  ),
  today_bookings AS (
    SELECT COUNT(*)::INT as booked_slots
    FROM bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_today_start
      AND starts_at < v_today_end
      AND status IN ('confirmed', 'completed', 'paid')
  )
  SELECT CASE 
    WHEN ts.total_hours > 0 THEN 
      LEAST(ROUND((tb.booked_slots::NUMERIC / (ts.total_hours * 2)) * 100), 100)::INT
    ELSE 0
  END
  INTO v_occupancy_today_percent
  FROM today_schedules ts, today_bookings tb;

  -- Ocupación últimos 7 días (promedio)
  WITH period_schedules AS (
    SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600) AS total_hours
    FROM staff_schedules ss
    INNER JOIN staff st ON ss.staff_id = st.id
    WHERE st.tenant_id = p_tenant_id
      AND st.active = true
      AND ss.is_active = true
  ),
  period_bookings AS (
    SELECT COUNT(*)::INT as booked_slots
    FROM bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_seven_days_ago
      AND status IN ('confirmed', 'completed', 'paid')
  )
  SELECT CASE 
    WHEN ps.total_hours > 0 THEN 
      LEAST(ROUND((pb.booked_slots::NUMERIC / (ps.total_hours * 2)) * 100), 100)::INT
    ELSE 0
  END
  INTO v_occupancy_7d_percent
  FROM period_schedules ps, period_bookings pb;

  -- Ocupación últimos 30 días (promedio)
  WITH period_bookings_30d AS (
    SELECT COUNT(*)::INT as booked_slots
    FROM bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_thirty_days_ago
      AND status IN ('confirmed', 'completed', 'paid')
  ),
  avg_daily_capacity AS (
    SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600 * 2) as daily_slots
    FROM staff_schedules ss
    INNER JOIN staff st ON ss.staff_id = st.id
    WHERE st.tenant_id = p_tenant_id
      AND st.active = true
      AND ss.is_active = true
    GROUP BY ss.day_of_week
    ORDER BY ss.day_of_week
    LIMIT 1
  )
  SELECT CASE 
    WHEN adc.daily_slots > 0 THEN 
      LEAST(ROUND((pb.booked_slots::NUMERIC / (adc.daily_slots * 30)) * 100), 100)::INT
    ELSE 0
  END
  INTO v_occupancy_30d_percent
  FROM period_bookings_30d pb, avg_daily_capacity adc;

  -- ======================
  -- 5. CONSTRUIR RESULTADO JSON
  -- ======================
  
  SELECT json_build_object(
    'bookingsToday', v_bookings_today,
    'revenueToday', v_revenue_today,
    'activeServices', v_active_services,
    'activeStaff', v_active_staff,
    'bookingsLast7Days', v_bookings_last_7_days,
    'totalBookingsLast7Days', v_total_bookings_7d,
    'revenueLast7Days', v_revenue_7d,
    'noShowsLast7Days', v_no_shows_7d,
    'avgTicketLast7Days', v_avg_ticket_7d,
    'bookingsLast30DaysByDay', v_bookings_last_30_days,
    'totalBookingsLast30Days', v_total_bookings_30d,
    'revenueLast30Days', v_revenue_30d,
    'avgTicketToday', v_avg_ticket_today,
    'avgTicketLast30Days', v_avg_ticket_30d,
    'occupancyTodayPercent', COALESCE(v_occupancy_today_percent, 0),
    'occupancyLast7DaysPercent', COALESCE(v_occupancy_7d_percent, 0),
    'occupancyLast30DaysPercent', COALESCE(v_occupancy_30d_percent, 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_dashboard_kpis"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_dashboard_kpis"("p_tenant_id" "uuid") IS 'Retorna todos los KPIs del dashboard en un solo objeto JSON. 
Optimiza el rendimiento consolidando 11 queries en una sola llamada.
Incluye: reservas, ingresos, ocupación, tickets medios, series temporales.';



CREATE OR REPLACE FUNCTION "public"."get_filtered_bookings"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_status" "text" DEFAULT NULL::"text") RETURNS SETOF "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT row_to_json(b.*)::jsonb
    FROM bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= p_start_date
      AND b.ends_at   <= p_end_date
      AND (p_staff_id IS NULL OR b.staff_id = p_staff_id)
      AND (p_status IS NULL OR b.status = p_status)
    ORDER BY b.starts_at;
END;
$$;


ALTER FUNCTION "public"."get_filtered_bookings"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_staff_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_metrics_range"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("metric_date" "date", "total_bookings" integer, "revenue_cents" bigint, "occupancy_percent" integer, "avg_ticket_cents" bigint, "no_show_bookings" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.metric_date,
    dm.total_bookings,
    dm.revenue_cents,
    dm.occupancy_percent,
    dm.avg_ticket_cents,
    dm.no_show_bookings
  FROM daily_metrics dm
  WHERE dm.tenant_id = p_tenant_id
    AND dm.metric_date >= p_start_date
    AND dm.metric_date <= p_end_date
  ORDER BY dm.metric_date DESC;
END;
$$;


ALTER FUNCTION "public"."get_metrics_range"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_metrics_range"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date") IS 'Retorna métricas diarias para un rango de fechas desde la tabla materializada.
Carga instantánea para gráficos históricos del dashboard.';



CREATE OR REPLACE FUNCTION "public"."get_or_create_direct_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_user_b_name TEXT;
BEGIN
  -- Verificar que ambos usuarios pertenecen al tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = p_tenant_id AND user_id = p_user_a
  ) THEN
    RAISE EXCEPTION 'Usuario A no pertenece al tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = p_tenant_id AND user_id = p_user_b
  ) THEN
    RAISE EXCEPTION 'Usuario B no pertenece al tenant';
  END IF;

  -- Buscar conversación existente
  SELECT tc.id INTO v_conversation_id
  FROM public.team_conversations tc
  WHERE tc.tenant_id = p_tenant_id
    AND tc.type = 'direct'
    AND EXISTS (
      SELECT 1 FROM public.team_conversation_members tcm1
      WHERE tcm1.conversation_id = tc.id AND tcm1.user_id = p_user_a
    )
    AND EXISTS (
      SELECT 1 FROM public.team_conversation_members tcm2
      WHERE tcm2.conversation_id = tc.id AND tcm2.user_id = p_user_b
    )
    AND (
      SELECT COUNT(*) FROM public.team_conversation_members tcm3
      WHERE tcm3.conversation_id = tc.id
    ) = 2
  LIMIT 1;

  -- Si no existe, crearla
  IF v_conversation_id IS NULL THEN
    -- Obtener nombre del usuario B para el nombre de la conversación
    SELECT COALESCE(p.full_name, u.email, 'Usuario')
    INTO v_user_b_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = p_user_b;

    -- Crear conversación
    INSERT INTO public.team_conversations (
      tenant_id,
      type,
      name,
      created_by,
      is_default
    )
    VALUES (
      p_tenant_id,
      'direct',
      v_user_b_name,
      p_user_a,
      false
    )
    RETURNING id INTO v_conversation_id;

    -- Agregar ambos usuarios
    INSERT INTO public.team_conversation_members (conversation_id, user_id, role)
    VALUES 
      (v_conversation_id, p_user_a, 'member'),
      (v_conversation_id, p_user_b, 'member')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_direct_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_or_create_direct_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") IS 'Obtiene o crea una conversación directa entre dos usuarios específicos.';



CREATE OR REPLACE FUNCTION "public"."get_org_features"("p_org_id" "uuid") RETURNS TABLE("feature_key" "text", "enabled" boolean, "quota_limit" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'platform'
    AS $$
declare
  v_plan_id uuid;
begin
  -- Obtener plan de la org
  select plan_id into v_plan_id
  from platform.org_plans
  where org_id = p_org_id and billing_state = 'active';

  -- Combinar: overrides > plan_features > default
  return query
  with plan_features_data as (
    select 
      f.key as feature_key,
      pf.enabled,
      pf.quota_limit
    from platform.plan_features pf
    join platform.features f on f.id = pf.feature_id
    where pf.plan_id = v_plan_id and pf.enabled = true
  ),
  overrides_data as (
    select 
      ofo.feature_key,
      ofo.enabled,
      ofo.quota_limit,
      ofo.expires_at
    from platform.org_feature_overrides ofo
    where ofo.org_id = p_org_id
      and (ofo.expires_at is null or ofo.expires_at > now())
  )
  select 
    coalesce(o.feature_key, p.feature_key) as feature_key,
    coalesce(o.enabled, p.enabled, f.default_enabled) as enabled,
    coalesce(o.quota_limit, p.quota_limit, '{}'::jsonb) as quota_limit
  from platform.features f
  left join plan_features_data p on p.feature_key = f.key
  left join overrides_data o on o.feature_key = f.key
  where coalesce(o.enabled, p.enabled, f.default_enabled) = true;
end;
$$;


ALTER FUNCTION "public"."get_org_features"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_plan_info"("p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'platform'
    AS $$
declare
  v_result jsonb;
  v_plan_id uuid;
  v_billing_state text;
  v_plan_key text;
  v_plan_name text;
begin
  -- Obtener plan de la org
  select plan_id, billing_state
  into v_plan_id, v_billing_state
  from platform.org_plans
  where org_id = p_org_id;

  if v_plan_id is not null then
    -- Obtener info del plan
    select key, name
    into v_plan_key, v_plan_name
    from platform.plans
    where id = v_plan_id;

    v_result := jsonb_build_object(
      'key', v_plan_key,
      'name', v_plan_name,
      'billing_state', v_billing_state
    );
  else
    v_result := null;
  end if;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_org_plan_info"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_overlap_error_message"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_staff_name text;
  v_message text;
begin
  -- Obtener nombre del staff
  select display_name into v_staff_name
  from public.staff
  where id = p_staff_id
    and tenant_id = p_tenant_id;
  
  if v_staff_name is null then
    v_staff_name := 'barbero';
  end if;
  
  -- Construir mensaje de error
  v_message := format(
    'El intervalo seleccionado para %s ya está ocupado. Por favor, elige otro horario.',
    v_staff_name
  );
  
  return v_message;
end;
$$;


ALTER FUNCTION "public"."get_overlap_error_message"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_overlap_error_message"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) IS 'Genera un mensaje de error amigable para solapes de slots. Incluye el nombre del staff.';



CREATE OR REPLACE FUNCTION "public"."get_public_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_day" "date") RETURNS TABLE("staff_id" "uuid", "slot_start" timestamp with time zone, "slot_end" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_duration_min integer;
BEGIN
  -- Leer duración del servicio
  SELECT duration_min INTO v_duration_min
  FROM public.services
  WHERE id = p_service_id AND tenant_id = p_tenant_id AND active = true;

  IF v_duration_min IS NULL OR v_duration_min <= 0 THEN
    RAISE EXCEPTION 'Servicio inválido o inactivo';
  END IF;

  RETURN QUERY
  WITH sched AS (
    SELECT ss.staff_id, ss.start_time, ss.end_time
    FROM public.staff_schedules ss
    WHERE ss.tenant_id = p_tenant_id
      AND ss.is_active = true
      AND ss.day_of_week = EXTRACT(DOW FROM p_day)::int
  ),
  -- Generar slots cada 15 minutos dentro de la franja operativa del staff
  slots AS (
    SELECT
      s.staff_id,
      -- construir un timestamptz a partir de p_day + start_time
      (make_timestamptz(EXTRACT(year FROM p_day)::int, EXTRACT(month FROM p_day)::int, EXTRACT(day FROM p_day)::int,
                        EXTRACT(hour FROM s.start_time)::int, EXTRACT(minute FROM s.start_time)::int, 0, 'UTC') + (gs.n || ' minutes')::interval) AS slot_start,
      v_duration_min AS duration_min
    FROM sched s
    CROSS JOIN LATERAL generate_series(0,
      GREATEST(0,
        (EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60)::int - v_duration_min
      ),
      15
    ) AS gs(n)
  ),
  slots_with_end AS (
    SELECT staff_id, slot_start, slot_start + (duration_min || ' minutes')::interval AS slot_end
    FROM slots
  ),
  -- Bookings que bloquean (mismo día, mismo staff)
  busy_bookings AS (
    SELECT b.staff_id, tstzrange(b.starts_at, b.ends_at, '[)') AS r
    FROM public.bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.staff_id IS NOT NULL
      AND b.starts_at::date = p_day
      AND b.status NOT IN ('cancelled','no_show')
  ),
  -- Bloqueos del staff (mismo día)
  busy_blockings AS (
    SELECT sb.staff_id, tstzrange(sb.start_at, sb.end_at, '[)') AS r
    FROM public.staff_blockings sb
    WHERE sb.tenant_id = p_tenant_id
      AND sb.start_at::date <= p_day
      AND sb.end_at::date >= p_day
  )
  SELECT sw.staff_id, sw.slot_start, sw.slot_end
  FROM slots_with_end sw
  WHERE NOT EXISTS (
    SELECT 1 FROM busy_bookings bb
    WHERE bb.staff_id = sw.staff_id
      AND tstzrange(sw.slot_start, sw.slot_end, '[)') && bb.r
  )
  AND NOT EXISTS (
    SELECT 1 FROM busy_blockings bl
    WHERE bl.staff_id = sw.staff_id
      AND tstzrange(sw.slot_start, sw.slot_end, '[)') && bl.r
  )
  ORDER BY sw.staff_id, sw.slot_start;
END;
$$;


ALTER FUNCTION "public"."get_public_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_day" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_day" "date") IS 'Disponibilidad por staff para un servicio y día (excluye bookings y blockings). SECURITY DEFINER.';



CREATE OR REPLACE FUNCTION "public"."get_public_daily_staff_windows"("p_tenant_id" "uuid", "p_day" "date") RETURNS TABLE("staff_id" "uuid", "start_time" time without time zone, "end_time" time without time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ss.staff_id, ss.start_time, ss.end_time
  FROM public.staff_schedules ss
  WHERE ss.tenant_id = p_tenant_id
    AND ss.is_active = true
    AND ss.day_of_week = EXTRACT(DOW FROM p_day)::int
$$;


ALTER FUNCTION "public"."get_public_daily_staff_windows"("p_tenant_id" "uuid", "p_day" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_daily_staff_windows"("p_tenant_id" "uuid", "p_day" "date") IS 'Ventanas operativas por staff para un día (sin restar citas). SECURITY DEFINER.';



CREATE OR REPLACE FUNCTION "public"."get_public_services"("p_tenant_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "duration_min" integer, "price_cents" integer, "stripe_price_id" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT s.id, s.name, s.duration_min, s.price_cents, s.stripe_price_id
  FROM public.services s
  WHERE s.tenant_id = p_tenant_id
    AND s.active = true
  ORDER BY s.name;
$$;


ALTER FUNCTION "public"."get_public_services"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_services"("p_tenant_id" "uuid") IS 'Lista servicios activos para el tenant (para portal público). SECURITY DEFINER.';



CREATE OR REPLACE FUNCTION "public"."get_public_services_with_slots"("p_tenant_id" "uuid", "p_day" "date") RETURNS TABLE("service_id" "uuid", "service_name" "text", "duration_min" integer, "price_cents" integer, "stripe_price_id" "text", "slots" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH srv AS (
    SELECT id, name, duration_min, price_cents, stripe_price_id
    FROM public.services
    WHERE tenant_id = p_tenant_id
      AND active = true
    ORDER BY name
  ),
  agg AS (
    SELECT
      s.id AS service_id,
      s.name AS service_name,
      s.duration_min,
      s.price_cents,
      s.stripe_price_id,
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object(
            'staff_id', a.staff_id,
            'slot_start', a.slot_start,
            'slot_end', a.slot_end
          ) ORDER BY a.staff_id, a.slot_start)
          FROM public.get_public_available_slots(p_tenant_id, s.id, p_day) a
        ),
        '[]'::jsonb
      ) AS slots
    FROM srv s
  )
  SELECT service_id, service_name, duration_min, price_cents, stripe_price_id, slots
  FROM agg
  ORDER BY service_name;
END;
$$;


ALTER FUNCTION "public"."get_public_services_with_slots"("p_tenant_id" "uuid", "p_day" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_services_with_slots"("p_tenant_id" "uuid", "p_day" "date") IS 'Devuelve servicios activos con sus slots disponibles por staff para un día. SECURITY DEFINER.';



CREATE OR REPLACE FUNCTION "public"."get_service_categories"("p_tenant_id" "uuid") RETURNS TABLE("category" "text", "service_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(s.category, 'Sin categoría') as category,
    COUNT(*)::INT as service_count
  FROM services s
  WHERE s.tenant_id = p_tenant_id
    AND s.active = true
  GROUP BY s.category
  ORDER BY service_count DESC, category ASC;
END;
$$;


ALTER FUNCTION "public"."get_service_categories"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_service_categories"("p_tenant_id" "uuid") IS 'Retorna categorías únicas de servicios con contador.
Optimiza el dropdown de categorías sin necesidad de cargar todos los servicios.';



CREATE OR REPLACE FUNCTION "public"."get_service_price_range"("p_tenant_id" "uuid") RETURNS TABLE("min_price_cents" integer, "max_price_cents" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    MIN(s.price_cents)::INT as min_price_cents,
    MAX(s.price_cents)::INT as max_price_cents
  FROM services s
  WHERE s.tenant_id = p_tenant_id
    AND s.active = true;
END;
$$;


ALTER FUNCTION "public"."get_service_price_range"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_service_price_range"("p_tenant_id" "uuid") IS 'Retorna rango de precios (mínimo y máximo) de servicios activos.
Útil para configurar el slider de filtro de precio dinámicamente.';



CREATE OR REPLACE FUNCTION "public"."get_services_filtered"("p_tenant_id" "uuid", "p_status" "text" DEFAULT 'all'::"text", "p_category" "text" DEFAULT NULL::"text", "p_min_price" integer DEFAULT NULL::integer, "p_max_price" integer DEFAULT NULL::integer, "p_has_buffer" boolean DEFAULT NULL::boolean, "p_stripe_synced" boolean DEFAULT NULL::boolean, "p_search_term" "text" DEFAULT NULL::"text", "p_sort_by" "text" DEFAULT 'name'::"text", "p_sort_direction" "text" DEFAULT 'ASC'::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "tenant_id" "uuid", "name" "text", "category" "text", "duration_min" integer, "price_cents" integer, "buffer_min" integer, "active" boolean, "stripe_product_id" "text", "stripe_price_id" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_count" bigint, "total_pages" integer, "avg_price_cents" numeric, "avg_duration_min" numeric, "total_active" integer, "total_inactive" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_total_count BIGINT;
  v_avg_price NUMERIC;
  v_avg_duration NUMERIC;
  v_total_active INT;
  v_total_inactive INT;
BEGIN
  -- Calcular estadísticas agregadas (se ejecuta una vez)
  SELECT 
    COUNT(*),
    ROUND(AVG(CASE WHEN active THEN s.price_cents END), 2),
    ROUND(AVG(CASE WHEN active THEN s.duration_min END), 2),
    COUNT(*) FILTER (WHERE active = true),
    COUNT(*) FILTER (WHERE active = false)
  INTO v_total_count, v_avg_price, v_avg_duration, v_total_active, v_total_inactive
  FROM services s
  WHERE s.tenant_id = p_tenant_id
    -- Aplicar filtros para el count
    AND (p_status = 'all' OR (p_status = 'active' AND active = true) OR (p_status = 'inactive' AND active = false))
    AND (p_category IS NULL OR s.category = p_category)
    AND (p_min_price IS NULL OR s.price_cents >= p_min_price)
    AND (p_max_price IS NULL OR s.price_cents <= p_max_price)
    AND (p_has_buffer IS NULL OR (p_has_buffer = true AND s.buffer_min > 0) OR (p_has_buffer = false AND (s.buffer_min IS NULL OR s.buffer_min = 0)))
    AND (p_stripe_synced IS NULL OR (p_stripe_synced = true AND s.stripe_product_id IS NOT NULL) OR (p_stripe_synced = false AND s.stripe_product_id IS NULL))
    AND (p_search_term IS NULL OR s.name ILIKE '%' || p_search_term || '%' OR s.category ILIKE '%' || p_search_term || '%');

  -- Retornar servicios filtrados, ordenados y paginados
  RETURN QUERY
  SELECT 
    s.id,
    s.tenant_id,
    s.name,
    s.category,
    s.duration_min,
    s.price_cents,
    s.buffer_min,
    s.active,
    s.stripe_product_id,
    s.stripe_price_id,
    s.created_at,
    s.updated_at,
    -- Metadatos
    v_total_count,
    CEIL(v_total_count::NUMERIC / p_limit)::INT,
    -- Estadísticas
    v_avg_price,
    v_avg_duration,
    v_total_active,
    v_total_inactive
  FROM services s
  WHERE s.tenant_id = p_tenant_id
    -- Filtros de estado
    AND (p_status = 'all' OR (p_status = 'active' AND active = true) OR (p_status = 'inactive' AND active = false))
    -- Filtro de categoría
    AND (p_category IS NULL OR s.category = p_category)
    -- Filtro de rango de precio
    AND (p_min_price IS NULL OR s.price_cents >= p_min_price)
    AND (p_max_price IS NULL OR s.price_cents <= p_max_price)
    -- Filtro de buffer
    AND (p_has_buffer IS NULL OR (p_has_buffer = true AND s.buffer_min > 0) OR (p_has_buffer = false AND (s.buffer_min IS NULL OR s.buffer_min = 0)))
    -- Filtro de sincronización con Stripe
    AND (p_stripe_synced IS NULL OR (p_stripe_synced = true AND s.stripe_product_id IS NOT NULL) OR (p_stripe_synced = false AND s.stripe_product_id IS NULL))
    -- Búsqueda de texto
    AND (p_search_term IS NULL OR s.name ILIKE '%' || p_search_term || '%' OR s.category ILIKE '%' || p_search_term || '%')
  ORDER BY 
    CASE WHEN p_sort_by = 'name' AND p_sort_direction = 'ASC' THEN s.name END ASC,
    CASE WHEN p_sort_by = 'name' AND p_sort_direction = 'DESC' THEN s.name END DESC,
    CASE WHEN p_sort_by = 'price' AND p_sort_direction = 'ASC' THEN s.price_cents END ASC,
    CASE WHEN p_sort_by = 'price' AND p_sort_direction = 'DESC' THEN s.price_cents END DESC,
    CASE WHEN p_sort_by = 'duration' AND p_sort_direction = 'ASC' THEN s.duration_min END ASC,
    CASE WHEN p_sort_by = 'duration' AND p_sort_direction = 'DESC' THEN s.duration_min END DESC,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_direction = 'ASC' THEN s.created_at END ASC,
    CASE WHEN p_sort_by = 'created_at' AND p_sort_direction = 'DESC' THEN s.created_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_services_filtered"("p_tenant_id" "uuid", "p_status" "text", "p_category" "text", "p_min_price" integer, "p_max_price" integer, "p_has_buffer" boolean, "p_stripe_synced" boolean, "p_search_term" "text", "p_sort_by" "text", "p_sort_direction" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_services_filtered"("p_tenant_id" "uuid", "p_status" "text", "p_category" "text", "p_min_price" integer, "p_max_price" integer, "p_has_buffer" boolean, "p_stripe_synced" boolean, "p_search_term" "text", "p_sort_by" "text", "p_sort_direction" "text", "p_limit" integer, "p_offset" integer) IS 'Filtra, ordena y pagina servicios en la base de datos.
Incluye estadísticas agregadas (precio medio, duración media, totales por estado).
Soporta múltiples filtros: estado, categoría, precio, buffer, Stripe, búsqueda.
Optimiza rendimiento evitando cargar todos los servicios en el frontend.';



CREATE OR REPLACE FUNCTION "public"."get_services_without_price_id"("p_tenant_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "price_cents" integer, "duration_min" integer, "active" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
begin
  return query
  select 
    s.id,
    s.name,
    s.price_cents,
    s.duration_min,
    s.active
  from public.services s
  where s.tenant_id = p_tenant_id
    and (s.stripe_price_id is null or s.stripe_price_id = '')
    and s.active = true
  order by s.name;
end;
$$;


ALTER FUNCTION "public"."get_services_without_price_id"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_services_without_price_id"("p_tenant_id" "uuid") IS 'Retorna servicios activos de un tenant que no tienen stripe_price_id. Útil para identificar servicios que necesitan sincronización con Stripe.';



CREATE OR REPLACE FUNCTION "public"."get_staff_availability"("p_staff_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("date" "date", "available_slots" integer, "booked_slots" integer, "blocked_slots" integer, "occupancy_percent" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date::DATE,
      p_end_date::DATE,
      '1 day'::INTERVAL
    )::DATE as date
  ),
  daily_schedules AS (
    SELECT 
      ds.date,
      COALESCE(SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800), 0)::INT as total_slots
    FROM date_series ds
    LEFT JOIN staff_schedules ss ON ss.staff_id = p_staff_id 
      AND ss.day_of_week = EXTRACT(DOW FROM ds.date)::INT
      AND ss.is_active = true
    GROUP BY ds.date
  ),
  daily_bookings AS (
    SELECT 
      b.starts_at::DATE as date,
      COUNT(*)::INT as booked_count
    FROM bookings b
    WHERE b.staff_id = p_staff_id
      AND b.starts_at >= p_start_date
      AND b.starts_at < p_end_date
      AND b.status IN ('confirmed', 'completed', 'paid')
    GROUP BY b.starts_at::DATE
  ),
  daily_blockings AS (
    SELECT 
      sb.start_at::DATE as date,
      COUNT(*)::INT as blocked_count
    FROM staff_blockings sb
    WHERE sb.staff_id = p_staff_id
      AND sb.start_at >= p_start_date
      AND sb.end_at <= p_end_date
    GROUP BY sb.start_at::DATE
  )
  SELECT 
    dsch.date,
    dsch.total_slots as available_slots,
    COALESCE(db.booked_count, 0) as booked_slots,
    COALESCE(dbl.blocked_count, 0) as blocked_slots,
    CASE 
      WHEN dsch.total_slots > 0 THEN LEAST(ROUND((COALESCE(db.booked_count, 0)::NUMERIC / dsch.total_slots) * 100), 100)::INT
      ELSE 0
    END as occupancy_percent
  FROM daily_schedules dsch
  LEFT JOIN daily_bookings db ON dsch.date = db.date
  LEFT JOIN daily_blockings dbl ON dsch.date = dbl.date
  ORDER BY dsch.date;
END;
$$;


ALTER FUNCTION "public"."get_staff_availability"("p_staff_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_staff_availability"("p_staff_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) IS 'Calcula disponibilidad de un staff member por día en un rango de fechas.
Incluye slots disponibles, reservados, bloqueados y % de ocupación.
Útil para vista de calendario y planificación.';



CREATE OR REPLACE FUNCTION "public"."get_staff_schedule"("p_staff_id" "uuid", "p_include_inactive" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "staff_id" "uuid", "day_of_week" integer, "start_time" time without time zone, "end_time" time without time zone, "is_active" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id,
    ss.staff_id,
    ss.day_of_week,
    ss.start_time,
    ss.end_time,
    ss.is_active
  FROM staff_schedules ss
  WHERE ss.staff_id = p_staff_id
    AND (p_include_inactive OR ss.is_active = true)
  ORDER BY ss.day_of_week, ss.start_time;
END;
$$;


ALTER FUNCTION "public"."get_staff_schedule"("p_staff_id" "uuid", "p_include_inactive" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_staff_schedule"("p_staff_id" "uuid", "p_include_inactive" boolean) IS 'Retorna horarios de trabajo de un staff member.
Útil para edición de horarios sin cargar todos los datos del staff.';



CREATE OR REPLACE FUNCTION "public"."get_staff_with_stats"("p_tenant_id" "uuid", "p_include_inactive" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "tenant_id" "uuid", "name" "text", "display_name" "text", "active" boolean, "user_id" "uuid", "profile_photo_url" "text", "weekly_hours" integer, "provides_services" boolean, "skills" "text"[], "created_at" timestamp with time zone, "bookings_today" integer, "bookings_this_week" integer, "bookings_this_month" integer, "bookings_all_time" integer, "revenue_today" bigint, "revenue_this_week" bigint, "revenue_this_month" bigint, "revenue_all_time" bigint, "occupancy_today_percent" integer, "occupancy_this_week_percent" integer, "no_shows_this_month" integer, "cancellations_this_month" integer, "avg_service_duration_min" integer, "services_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_today_end TIMESTAMPTZ := date_trunc('day', NOW()) + INTERVAL '1 day';
  v_week_start TIMESTAMPTZ := date_trunc('week', NOW());
  v_month_start TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
  RETURN QUERY
  WITH staff_bookings_stats AS (
    SELECT 
      b.staff_id,
      -- Reservas por periodo
      COUNT(*) FILTER (WHERE b.starts_at >= v_today_start AND b.starts_at < v_today_end AND b.status != 'cancelled')::INT as bookings_today,
      COUNT(*) FILTER (WHERE b.starts_at >= v_week_start AND b.status != 'cancelled')::INT as bookings_this_week,
      COUNT(*) FILTER (WHERE b.starts_at >= v_month_start AND b.status != 'cancelled')::INT as bookings_this_month,
      COUNT(*) FILTER (WHERE b.status != 'cancelled')::INT as bookings_all_time,
      
      -- Ingresos por periodo (solo reservas confirmadas/completadas/pagadas)
      COALESCE(SUM(srv.price_cents) FILTER (WHERE b.starts_at >= v_today_start AND b.starts_at < v_today_end AND b.status IN ('confirmed', 'completed', 'paid')), 0)::BIGINT as revenue_today,
      COALESCE(SUM(srv.price_cents) FILTER (WHERE b.starts_at >= v_week_start AND b.status IN ('confirmed', 'completed', 'paid')), 0)::BIGINT as revenue_this_week,
      COALESCE(SUM(srv.price_cents) FILTER (WHERE b.starts_at >= v_month_start AND b.status IN ('confirmed', 'completed', 'paid')), 0)::BIGINT as revenue_this_month,
      COALESCE(SUM(srv.price_cents) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')), 0)::BIGINT as revenue_all_time,
      
      -- Métricas de calidad
      COUNT(*) FILTER (WHERE b.starts_at >= v_month_start AND b.status = 'no_show')::INT as no_shows_this_month,
      COUNT(*) FILTER (WHERE b.starts_at >= v_month_start AND b.status = 'cancelled')::INT as cancellations_this_month,
      
      -- Duración promedio de servicios
      ROUND(AVG(srv.duration_min) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')))::INT as avg_service_duration_min
    FROM bookings b
    LEFT JOIN services srv ON b.service_id = srv.id
    WHERE b.tenant_id = p_tenant_id
    GROUP BY b.staff_id
  ),
  staff_schedules_stats AS (
    SELECT 
      ss.staff_id,
      -- Horas trabajadas hoy
      COALESCE(SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600) FILTER (WHERE ss.day_of_week = EXTRACT(DOW FROM v_today_start)::INT AND ss.is_active), 0) as hours_today,
      -- Horas trabajadas esta semana (promedio diario * 7)
      COALESCE(AVG(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600) FILTER (WHERE ss.is_active) * 7, 0) as hours_this_week
    FROM staff_schedules ss
    WHERE EXISTS (SELECT 1 FROM staff WHERE id = ss.staff_id AND tenant_id = p_tenant_id)
    GROUP BY ss.staff_id
  ),
  staff_services_count AS (
    SELECT
      staff_id,
      COUNT(DISTINCT service_id)::INT as services_count
    FROM staff_services
    WHERE EXISTS (SELECT 1 FROM staff WHERE id = staff_services.staff_id AND tenant_id = p_tenant_id)
    GROUP BY staff_id
  )
  SELECT 
    s.id,
    s.tenant_id,
    s.name,
    s.display_name,
    s.active,
    s.user_id,
    s.profile_photo_url,
    s.weekly_hours,
    s.provides_services,
    s.skills,
    s.created_at,
    
    -- Stats de reservas
    COALESCE(sbs.bookings_today, 0),
    COALESCE(sbs.bookings_this_week, 0),
    COALESCE(sbs.bookings_this_month, 0),
    COALESCE(sbs.bookings_all_time, 0),
    
    -- Stats de ingresos
    COALESCE(sbs.revenue_today, 0),
    COALESCE(sbs.revenue_this_week, 0),
    COALESCE(sbs.revenue_this_month, 0),
    COALESCE(sbs.revenue_all_time, 0),
    
    -- Ocupación (reservas / slots disponibles * 100)
    CASE 
      WHEN sss.hours_today > 0 THEN LEAST(ROUND((sbs.bookings_today::NUMERIC / (sss.hours_today * 2)) * 100), 100)::INT
      ELSE 0
    END as occupancy_today_percent,
    CASE 
      WHEN sss.hours_this_week > 0 THEN LEAST(ROUND((sbs.bookings_this_week::NUMERIC / (sss.hours_this_week * 2)) * 100), 100)::INT
      ELSE 0
    END as occupancy_this_week_percent,
    
    -- Métricas de calidad
    COALESCE(sbs.no_shows_this_month, 0),
    COALESCE(sbs.cancellations_this_month, 0),
    COALESCE(sbs.avg_service_duration_min, 0),
    
    -- Servicios
    COALESCE(ssc.services_count, 0)
    
  FROM staff s
  LEFT JOIN staff_bookings_stats sbs ON s.id = sbs.staff_id
  LEFT JOIN staff_schedules_stats sss ON s.id = sss.staff_id
  LEFT JOIN staff_services_count ssc ON s.id = ssc.staff_id
  WHERE s.tenant_id = p_tenant_id
    AND (p_include_inactive OR s.active = true)
  ORDER BY s.name;
END;
$$;


ALTER FUNCTION "public"."get_staff_with_stats"("p_tenant_id" "uuid", "p_include_inactive" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_staff_with_stats"("p_tenant_id" "uuid", "p_include_inactive" boolean) IS 'Retorna staff con todas sus estadísticas precalculadas.
Incluye: reservas, ingresos, ocupación, métricas de calidad.
Optimiza la carga de la página de staff consolidando múltiples queries.';



CREATE OR REPLACE FUNCTION "public"."get_tenant_info"("p_tenant_id" "uuid") RETURNS TABLE("id" "uuid", "slug" "text", "name" "text", "timezone" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
begin
  return query
  select 
    t.id,
    t.slug,
    t.name,
    coalesce(t.timezone, 'Europe/Madrid') as timezone,
    t.created_at
  from public.tenants t
  where t.id = p_tenant_id;
end;
$$;


ALTER FUNCTION "public"."get_tenant_info"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_tenant_info"("p_tenant_id" "uuid") IS 'Retorna información del tenant, incluyendo timezone. Útil para el frontend.';



CREATE OR REPLACE FUNCTION "public"."get_user_conversations_optimized"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS TABLE("id" "uuid", "tenant_id" "uuid", "type" "text", "name" "text", "last_message_body" "text", "last_message_at" timestamp with time zone, "unread_count" integer, "members_count" integer, "last_read_at" timestamp with time zone, "created_by" "uuid", "viewer_role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.user_has_role_for_tenant(p_tenant_id, null) then
    raise exception 'not_authorized';
  end if;

  -- Ensure all 1:1 conversations exist for this user in this tenant
  perform public.ensure_direct_conversations_for_user(coalesce(p_user_id, auth.uid()), p_tenant_id);

  return query
  with user_memberships as (
    select
      tcm.conversation_id,
      tcm.role as viewer_role,
      tcm.last_read_at
    from public.team_conversation_members tcm
    join public.team_conversations tc
      on tc.id = tcm.conversation_id
    where tc.tenant_id = p_tenant_id
      and tcm.user_id = coalesce(p_user_id, auth.uid())
  ),
  conv_stats as (
    select
      tm.conversation_id,
      max(tm.created_at) as last_message_at,
      (array_agg(tm.body order by tm.created_at desc))[1] as last_message_body
    from public.team_messages tm
    where tm.tenant_id = p_tenant_id
      and tm.deleted_at is null
    group by tm.conversation_id
  ),
  unread_counts as (
    select
      tm.conversation_id,
      count(*)::integer as unread_count
    from public.team_messages tm
    join user_memberships um
      on um.conversation_id = tm.conversation_id
    where tm.tenant_id = p_tenant_id
      and tm.deleted_at is null
      and (um.last_read_at is null or tm.created_at > um.last_read_at)
    group by tm.conversation_id
  ),
  member_counts as (
    select
      conversation_id,
      count(*)::integer as members_count
    from public.team_conversation_members
    group by conversation_id
  )
  select
    tc.id,
    tc.tenant_id,
    tc.type,
    tc.name,
    cs.last_message_body,
    cs.last_message_at,
    coalesce(uc.unread_count, 0) as unread_count,
    coalesce(mc.members_count, 0) as members_count,
    um.last_read_at,
    tc.created_by,
    um.viewer_role
  from public.team_conversations tc
  join user_memberships um
    on um.conversation_id = tc.id
  left join conv_stats cs on cs.conversation_id = tc.id
  left join unread_counts uc on uc.conversation_id = tc.id
  left join member_counts mc on mc.conversation_id = tc.id
  where tc.tenant_id = p_tenant_id
    and coalesce(tc.is_archived, false) = false
  order by coalesce(cs.last_message_at, tc.created_at) desc, tc.name;
end;
$$;


ALTER FUNCTION "public"."get_user_conversations_optimized"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_display_name"("p_viewer_user_id" "uuid", "p_target_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_custom_name TEXT;
  v_profile_name TEXT;
  v_staff_name TEXT;
  v_staff_display_name TEXT;
  v_email TEXT;
BEGIN
  -- 1. Buscar apodo personalizado
  SELECT custom_name INTO v_custom_name
  FROM public.user_display_names
  WHERE viewer_user_id = p_viewer_user_id
    AND target_user_id = p_target_user_id;

  IF v_custom_name IS NOT NULL THEN
    RETURN v_custom_name;
  END IF;

  -- 2. Buscar nombre en profile
  SELECT display_name INTO v_profile_name
  FROM public.profiles
  WHERE user_id = p_target_user_id;

  IF v_profile_name IS NOT NULL AND v_profile_name != '' THEN
    RETURN v_profile_name;
  END IF;

  -- 3. Buscar en staff
  SELECT s.display_name, s.name INTO v_staff_display_name, v_staff_name
  FROM public.staff s
  WHERE s.user_id = p_target_user_id
    AND s.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_staff_display_name IS NOT NULL AND v_staff_display_name != '' THEN
    RETURN v_staff_display_name;
  END IF;

  IF v_staff_name IS NOT NULL AND v_staff_name != '' THEN
    RETURN v_staff_name;
  END IF;

  -- 4. Fallback: email
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_target_user_id;

  IF v_email IS NOT NULL THEN
    RETURN SPLIT_PART(v_email, '@', 1);
  END IF;

  RETURN CONCAT('Usuario ', LEFT(p_target_user_id::text, 8));
END;
$$;


ALTER FUNCTION "public"."get_user_display_name"("p_viewer_user_id" "uuid", "p_target_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_display_name"("p_viewer_user_id" "uuid", "p_target_user_id" "uuid", "p_tenant_id" "uuid") IS 'Obtiene el nombre a mostrar de un usuario según prioridad: apodo > profile > staff > email';



CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_permissions jsonb;
  v_role text;
begin
  -- Obtener el rol del usuario
  select role into v_role
  from memberships
  where user_id = p_user_id and tenant_id = p_tenant_id;
  
  -- Owners y admins tienen todos los permisos
  if v_role in ('owner', 'admin') then
    return '{
      "dashboard": true,
      "agenda": true,
      "clientes": true,
      "servicios": true,
      "staff": true,
      "marketing": true,
      "reportes": true,
      "ajustes": true
    }'::jsonb;
  end if;
  
  -- Para staff, obtener permisos personalizados o usar defaults
  select permissions into v_permissions
  from user_permissions
  where user_id = p_user_id and tenant_id = p_tenant_id;
  
  -- Si no tiene permisos configurados, usar defaults básicos
  if v_permissions is null then
    v_permissions := '{
      "dashboard": true,
      "agenda": true,
      "clientes": true,
      "servicios": false,
      "staff": false,
      "marketing": false,
      "reportes": false,
      "ajustes": false
    }'::jsonb;
  end if;
  
  return v_permissions;
end;
$$;


ALTER FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") IS 'Obtiene los permisos de un usuario. Owners/admins tienen todos los permisos.';



CREATE OR REPLACE FUNCTION "public"."get_user_profile_photo"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_photo TEXT;
  v_staff_photo TEXT;
BEGIN
  -- 1. Buscar en profile
  SELECT profile_photo_url INTO v_profile_photo
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_profile_photo IS NOT NULL AND v_profile_photo != '' THEN
    RETURN v_profile_photo;
  END IF;

  -- 2. Buscar en staff
  SELECT profile_photo_url INTO v_staff_photo
  FROM public.staff
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
  LIMIT 1;

  RETURN v_staff_photo;
END;
$$;


ALTER FUNCTION "public"."get_user_profile_photo"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_profile_photo"("p_user_id" "uuid", "p_tenant_id" "uuid") IS 'Obtiene la foto de perfil de un usuario (profile > staff)';



CREATE OR REPLACE FUNCTION "public"."get_user_role_and_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS TABLE("role" "text", "permissions" "jsonb")
    LANGUAGE "sql" STABLE
    AS $$
  select 
    m.role,
    case 
      -- Si es owner o admin, devolver permisos completos
      when m.role in ('owner', 'admin') then 
        '{"dashboard":true,"agenda":true,"clientes":true,"servicios":true,"staff":true,"marketing":true,"reportes":true,"ajustes":true}'::jsonb
      -- Para otros roles, usar permisos de la tabla o permisos por defecto restrictivos
      else
        coalesce(up.permissions, '{"dashboard":true,"agenda":true,"clientes":true,"servicios":false,"staff":false,"marketing":false,"reportes":false,"ajustes":false}'::jsonb)
    end as permissions
  from public.memberships m
  left join public.user_permissions up
    on up.user_id = m.user_id and up.tenant_id = m.tenant_id
  where m.user_id = p_user_id and m.tenant_id = p_tenant_id
  limit 1;
$$;


ALTER FUNCTION "public"."get_user_role_and_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_role_and_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") IS 'Devuelve el rol y los permisos del usuario para un tenant. Los roles owner/admin reciben automáticamente permisos completos.';



CREATE OR REPLACE FUNCTION "public"."guard_paid_bookings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Permitir operaciones que no sean UPDATE
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Si el nuevo estado o el anterior es 'paid' o 'completed', blindar campos críticos
  IF NEW.status IN ('paid','completed') OR OLD.status IN ('paid','completed') THEN
    -- No permitir cambiar appointment_id, staff_id, starts_at, ends_at
    IF (NEW.appointment_id IS DISTINCT FROM OLD.appointment_id)
       OR (NEW.staff_id IS DISTINCT FROM OLD.staff_id)
       OR (NEW.starts_at IS DISTINCT FROM OLD.starts_at)
       OR (NEW.ends_at IS DISTINCT FROM OLD.ends_at) THEN
      RAISE EXCEPTION 'No se pueden modificar cita, staff u horarios de un booking pagado/completado'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_paid_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_booking_customer_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target uuid;
begin
  target := coalesce(new.customer_id, old.customer_id);
  if target is null then
    return null;
  end if;

  perform public.refresh_customer_stats(target);
  return null;
end;
$$;


ALTER FUNCTION "public"."handle_booking_customer_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_org_id uuid;
  new_tenant_id uuid;
begin
  -- Intentar crear tenant/org si la tabla existe
  -- Primero verificar si existe la tabla tenants
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tenants') then
    begin
      new_tenant_id := gen_random_uuid();
      insert into public.tenants (id, name, slug)
      values (
        new_tenant_id,
        concat('Barbería de ', coalesce(new.raw_user_meta_data->>'name', 'nuevo usuario')),
        'barberia-' || substr(new.id::text, 1, 8)
      )
      on conflict do nothing;
    exception when others then
      -- Si falla, continuar sin crear tenant
      raise notice 'Error al crear tenant para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Intentar crear org si la tabla existe (compatibilidad con esquema antiguo)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orgs') then
    begin
      new_org_id := gen_random_uuid();
      insert into public.orgs (id, name)
      values (new_org_id, concat('Barbería de ', coalesce(new.raw_user_meta_data->>'name', 'nuevo usuario')))
      on conflict do nothing;
    exception when others then
      raise notice 'Error al crear org para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Intentar crear membership si la tabla existe y tenemos tenant_id
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'memberships')
     and new_tenant_id is not null then
    begin
      insert into public.memberships (tenant_id, user_id, role)
      values (new_tenant_id, new.id, 'owner')
      on conflict (tenant_id, user_id) do nothing;
    exception when others then
      raise notice 'Error al crear membership para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Intentar crear org_members si la tabla existe (compatibilidad)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'org_members')
     and new_org_id is not null then
    begin
      insert into public.org_members (org_id, user_id, role)
      values (new_org_id, new.id, 'owner')
      on conflict (org_id, user_id) do nothing;
    exception when others then
      raise notice 'Error al crear org_member para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Intentar crear profile si la tabla existe
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    begin
      insert into public.profiles (user_id, default_org_id)
      values (new.id, coalesce(new_org_id, new_tenant_id))
      on conflict (user_id) do update
      set default_org_id = coalesce(new_org_id, new_tenant_id, profiles.default_org_id);
    exception when others then
      raise notice 'Error al crear profile para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Siempre retornar new, incluso si hubo errores
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Trigger mejorado que crea tenant/org y membership/profile para nuevos usuarios. Maneja errores graciosamente y no falla si las tablas no existen.';



CREATE OR REPLACE FUNCTION "public"."has_feature"("p_org_id" "uuid", "p_feature_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'platform'
    AS $$
declare
  v_enabled boolean;
begin
  select exists (
    select 1
    from public.get_org_features(p_org_id) f
    where f.feature_key = p_feature_key and f.enabled = true
  ) into v_enabled;
  
  return coalesce(v_enabled, false);
end;
$$;


ALTER FUNCTION "public"."has_feature"("p_org_id" "uuid", "p_feature_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_daily_metrics"("p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_days_back" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tenant_id UUID;
  v_date DATE;
  v_count INT := 0;
BEGIN
  -- Si no se especifica tenant, procesar todos
  FOR v_tenant_id IN 
    SELECT id FROM tenants WHERE (p_tenant_id IS NULL OR id = p_tenant_id)
  LOOP
    -- Procesar últimos N días
    FOR v_date IN 
      SELECT generate_series(
        CURRENT_DATE - (p_days_back || ' days')::INTERVAL,
        CURRENT_DATE,
        '1 day'::INTERVAL
      )::DATE
    LOOP
      PERFORM update_daily_metrics(v_tenant_id, v_date);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."initialize_daily_metrics"("p_tenant_id" "uuid", "p_days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."initialize_daily_metrics"("p_tenant_id" "uuid", "p_days_back" integer) IS 'Inicializa daily_metrics con datos históricos.
Ejecutar UNA VEZ después de crear la tabla: SELECT initialize_daily_metrics();';



CREATE OR REPLACE FUNCTION "public"."insert_stripe_event_if_new"("p_event_id" "text", "p_type" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.stripe_events_processed (event_id, event_type)
  VALUES (p_event_id, p_type)
  ON CONFLICT (event_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."insert_stripe_event_if_new"("p_event_id" "text", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_service_sellable"("p_service_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_has_price_id boolean;
begin
  select (stripe_price_id is not null and stripe_price_id != '') into v_has_price_id
  from public.services
  where id = p_service_id
    and active = true;
  
  return coalesce(v_has_price_id, false);
end;
$$;


ALTER FUNCTION "public"."is_service_sellable"("p_service_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_service_sellable"("p_service_id" "uuid") IS 'Verifica si un servicio es vendible (tiene stripe_price_id y está activo). Retorna true si es vendible, false en caso contrario.';



CREATE OR REPLACE FUNCTION "public"."is_slot_in_past"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_tenant_tz text;
  v_now_local timestamptz;
  v_timestamp_local timestamptz;
begin
  -- Obtener timezone del tenant
  select coalesce(timezone, 'Europe/Madrid') into v_tenant_tz
  from public.tenants
  where id = p_tenant_id;
  
  -- Calcular "ahora" en timezone del tenant
  -- Nota: now() retorna UTC, lo convertimos al timezone del tenant para comparar
  v_now_local := now() at time zone 'UTC' at time zone v_tenant_tz;
  
  -- Convertir timestamp a timezone del tenant
  v_timestamp_local := p_timestamp at time zone 'UTC' at time zone v_tenant_tz;
  
  -- Verificar si está en el pasado (comparar en timezone local)
  return v_timestamp_local < v_now_local;
end;
$$;


ALTER FUNCTION "public"."is_slot_in_past"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_slot_in_past"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) IS 'Verifica si un timestamp está en el pasado según el timezone del tenant. Retorna true si está en el pasado, false si está en el futuro. Compara en timezone local del tenant.';



CREATE OR REPLACE FUNCTION "public"."list_tenant_members"("p_tenant_id" "uuid") RETURNS TABLE("user_id" "uuid", "tenant_role" "text", "display_name" "text", "avatar_url" "text", "staff_id" "uuid", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.user_has_role_for_tenant(p_tenant_id, NULL) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    m.role,
    COALESCE(s.display_name, s.name, CONCAT('Usuario ', LEFT(m.user_id::text, 8))) AS display_name,
    s.profile_photo_url,
    s.id,
    COALESCE(s.active, true) AS is_active
  FROM public.memberships m
  LEFT JOIN public.staff s
    ON s.tenant_id = m.tenant_id
   AND s.user_id = m.user_id
  WHERE m.tenant_id = p_tenant_id
  ORDER BY display_name;
END;
$$;


ALTER FUNCTION "public"."list_tenant_members"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."list_tenant_members"("p_tenant_id" "uuid") IS 'Devuelve miembros del tenant (rol + datos de staff) para UI del chat.';



CREATE OR REPLACE FUNCTION "public"."log_event"("p_event_type" "text", "p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_actor_user_id" "uuid" DEFAULT NULL::"uuid", "p_resource_type" "text" DEFAULT NULL::"text", "p_resource_id" "uuid" DEFAULT NULL::"uuid", "p_severity" "text" DEFAULT 'info'::"text", "p_description" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO public.system_events (
        event_type, tenant_id, actor_user_id,
        resource_type, resource_id,
        severity, description, metadata
    )
    VALUES (
        p_event_type, p_tenant_id, p_actor_user_id,
        p_resource_type, p_resource_id,
        p_severity, p_description, p_metadata
    );
END;
$$;


ALTER FUNCTION "public"."log_event"("p_event_type" "text", "p_tenant_id" "uuid", "p_actor_user_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_severity" "text", "p_description" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE team_conversation_members
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid", "p_user_id" "uuid") IS 'Marca conversación como leída actualizando last_read_at en team_conversation_members.
Retorna TRUE si se actualizó correctamente.';



CREATE OR REPLACE FUNCTION "public"."mark_expired_login_requests"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.auth_login_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < now() - interval '15 minutes';
END;
$$;


ALTER FUNCTION "public"."mark_expired_login_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_tenant_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(regexp_replace(NEW.slug, '\s+', '-', 'g'));
    NEW.slug := regexp_replace(NEW.slug, '[^a-z0-9-]', '', 'g');
    NEW.slug := regexp_replace(NEW.slug, '-{2,}', '-', 'g');
    NEW.slug := regexp_replace(NEW.slug, '(^-+)|(-+$)', '', 'g');
  END IF;
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."normalize_tenant_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."profiles_update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provision_tenant_for_user"("p_user_id" "uuid", "p_name" "text", "p_slug" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Solo usuarios autenticados
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Solo usuarios autenticados pueden provisionar tenants' USING ERRCODE = '42501';
  END IF;

  -- Por defecto, exigir que el usuario autenticado sea el mismo que p_user_id
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado: el usuario autenticado no coincide con p_user_id' USING ERRCODE = '42501';
  END IF;

  -- Crear tenant
  INSERT INTO public.tenants (name, slug, created_at)
  VALUES (p_name, p_slug, v_now)
  RETURNING id INTO v_tenant_id;

  -- Crear tenant_settings con defaults
  INSERT INTO public.tenant_settings (tenant_id)
  VALUES (v_tenant_id);

  -- Crear membership como owner
  INSERT INTO public.memberships (tenant_id, user_id, role, created_at)
  VALUES (v_tenant_id, p_user_id, 'owner', v_now)
  ON CONFLICT DO NOTHING;

  -- Opcional: sembrar métrica del día
  BEGIN
    INSERT INTO public.org_metrics_daily (tenant_id, metric_date, created_at, updated_at)
    VALUES (v_tenant_id, current_date, v_now, v_now);
  EXCEPTION WHEN others THEN
    -- No crítico; continuar
    NULL;
  END;

  RETURN v_tenant_id;
END;
$$;


ALTER FUNCTION "public"."provision_tenant_for_user"("p_user_id" "uuid", "p_name" "text", "p_slug" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."provision_tenant_for_user"("p_user_id" "uuid", "p_name" "text", "p_slug" "text") IS 'Provisiona un tenant; permite a platform-admin crear para terceros, o al propio usuario para sí mismo.';



CREATE OR REPLACE FUNCTION "public"."recompute_all_metrics"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_tenant uuid;
    v_date date;
BEGIN
    RAISE NOTICE 'Iniciando recomputación completa de métricas diarias…';

    -- Recorrer todos los tenants
    FOR v_tenant IN
        SELECT id FROM public.tenants
    LOOP
        RAISE NOTICE 'Procesando tenant %', v_tenant;

        -- Recorrer todas las fechas donde existan bookings del tenant
        FOR v_date IN
            SELECT DISTINCT DATE(starts_at)
            FROM public.bookings
            WHERE tenant_id = v_tenant
              AND starts_at IS NOT NULL
            ORDER BY 1
        LOOP
            BEGIN
                PERFORM public.upsert_metrics_for_booking(v_tenant, v_date);
            EXCEPTION WHEN OTHERS THEN
                -- Evita que errores puntuales detengan la recomputación completa.
                RAISE NOTICE 'Advertencia: fallo procesando tenant %, fecha % -> %',
                    v_tenant, v_date, SQLERRM;
            END;
        END LOOP;

    END LOOP;

    RAISE NOTICE 'Recomputación de métricas completada.';
END;
$$;


ALTER FUNCTION "public"."recompute_all_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_customer_stats"("p_customer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  stats record;
begin
  select
    count(*) filter (where b.status in ('completed', 'confirmed')) as visits_count,
    max(case when b.status in ('completed', 'confirmed') then b.starts_at end) as last_booking_at,
    coalesce(sum(case when b.status in ('completed', 'confirmed') then coalesce(s.price_cents, 0) end), 0) as total_spent_cents,
    count(*) filter (where b.status = 'no_show') as no_show_count,
    max(case when b.status = 'no_show' then b.starts_at end) as last_no_show_at
  into stats
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.customer_id = p_customer_id;

  update public.customers c
  set
    visits_count = coalesce(stats.visits_count, 0),
    last_booking_at = stats.last_booking_at,
    total_spent_cents = coalesce(stats.total_spent_cents, 0),
    no_show_count = coalesce(stats.no_show_count, 0),
    last_no_show_at = stats.last_no_show_at
  where c.id = p_customer_id;
end;
$$;


ALTER FUNCTION "public"."refresh_customer_stats"("p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_expired_appointments"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.appointments
    SET status = 'cancelled',
        expires_at = null
    WHERE status = 'hold'
      AND expires_at IS NOT NULL
      AND now() >= expires_at
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."release_expired_appointments"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."release_expired_appointments"() IS 'Cancela appointments en hold expirados (legacy). Retorna el número de holds cancelados.';



CREATE OR REPLACE FUNCTION "public"."release_expired_holds"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_bookings_count int := 0;
  v_appointments_count int := 0;
begin
  -- Actualizar holds expirados en bookings a cancelled
  update public.bookings
  set status = 'cancelled',
      expires_at = null,
      updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();
  
  get diagnostics v_bookings_count = row_count;
  
  -- También limpiar appointments (legacy) si existe
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
      and table_name = 'appointments'
  ) then
    update public.appointments
    set status = 'cancelled',
        expires_at = null,
        updated_at = now()
    where status = 'hold'
      and expires_at is not null
      and expires_at < now();
    
    get diagnostics v_appointments_count = row_count;
  end if;
  
  -- Retornar el total de holds liberados
  return v_bookings_count + v_appointments_count;
end;
$$;


ALTER FUNCTION "public"."release_expired_holds"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."release_expired_holds"() IS 'Libera holds expirados cambiándolos a cancelled. Retorna el número de holds liberados.';



CREATE OR REPLACE FUNCTION "public"."safe_tenant"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
    SELECT app.current_tenant_id();
$$;


ALTER FUNCTION "public"."safe_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_messages"("p_tenant_id" "uuid", "p_search_term" "text", "p_conversation_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "conversation_id" "uuid", "body" "text", "created_at" timestamp with time zone, "author_name" "text", "conversation_name" "text", "relevance" real)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tm.id,
    tm.conversation_id,
    tm.body,
    tm.created_at,
    COALESCE(u.full_name, u.email, 'Usuario') as author_name,
    tc.name as conversation_name,
    ts_rank(to_tsvector('spanish', tm.body), plainto_tsquery('spanish', p_search_term)) as relevance
  FROM team_messages tm
  INNER JOIN team_conversations tc ON tm.conversation_id = tc.id
  LEFT JOIN auth.users u ON tm.sender_id = u.id
  WHERE tc.tenant_id = p_tenant_id
    AND (p_conversation_id IS NULL OR tm.conversation_id = p_conversation_id)
    AND tm.deleted_at IS NULL
    AND to_tsvector('spanish', tm.body) @@ plainto_tsquery('spanish', p_search_term)
  ORDER BY relevance DESC, tm.created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."search_messages"("p_tenant_id" "uuid", "p_search_term" "text", "p_conversation_id" "uuid", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_messages"("p_tenant_id" "uuid", "p_search_term" "text", "p_conversation_id" "uuid", "p_limit" integer) IS 'Búsqueda de texto completo en mensajes del chat.
Soporta búsqueda en todas las conversaciones o una específica.
Retorna resultados ordenados por relevancia.';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_admin_user_access"("p_email" "text") RETURNS TABLE("user_id" "uuid", "email" "text", "email_confirmed" boolean, "is_platform_admin" boolean, "platform_role" "text", "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
DECLARE
  v_user_id uuid;
  v_user_exists boolean;
  v_now timestamptz := now();
BEGIN
  -- Buscar usuario por email
  SELECT u.id, (u.email_confirmed_at IS NOT NULL) INTO v_user_id, v_user_exists
  FROM auth.users u
  WHERE u.email = p_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::uuid as user_id,
      p_email::text as email,
      false as email_confirmed,
      false as is_platform_admin,
      'none'::text as platform_role,
      'Usuario no encontrado. Crea el usuario primero en Supabase Dashboard > Authentication > Users con Auto-confirm activado.'::text as message;
    RETURN;
  END IF;

  -- Confirmar email si no está confirmado (requiere permisos elevados)
  BEGIN
    UPDATE auth.users
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, v_now),
      confirmed_at = COALESCE(confirmed_at, v_now),
      updated_at = v_now
    WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Si no se puede actualizar auth.users directamente, continuar
    RAISE NOTICE 'No se pudo actualizar auth.users directamente. El usuario debe estar confirmado manualmente.';
  END;

  -- Asegurar que esté en platform.platform_users como admin
  INSERT INTO platform.platform_users (id, email, name, role, active)
  VALUES (
    v_user_id,
    p_email,
    COALESCE(split_part(p_email, '@', 1), 'Admin'),
    'admin',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, platform.platform_users.name),
    role = 'admin',
    active = true;

  -- También actualizar por email si el ID cambió
  UPDATE platform.platform_users pu
  SET 
    id = v_user_id,
    role = 'admin',
    active = true
  WHERE pu.email = p_email AND pu.id != v_user_id;

  -- Crear/actualizar perfil en public.profiles si la tabla existe
  -- Usar EXECUTE para evitar ambigüedad con la columna user_id de retorno
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    BEGIN
      EXECUTE 'INSERT INTO public.profiles (user_id, created_at) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING'
        USING v_user_id, v_now;
    EXCEPTION WHEN OTHERS THEN
      -- Si hay conflicto o error, ignorar silenciosamente
      NULL;
    END;
  END IF;

  -- Retornar estado final
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    (u.email_confirmed_at IS NOT NULL) as email_confirmed,
    EXISTS(SELECT 1 FROM platform.platform_users pu WHERE pu.id = u.id AND pu.active = true) as is_platform_admin,
    COALESCE(pu.role, 'none')::text as platform_role,
    'Usuario configurado correctamente como platform admin.'::text as message
  FROM auth.users u
  LEFT JOIN platform.platform_users pu ON pu.id = u.id
  WHERE u.id = v_user_id;
END;
$_$;


ALTER FUNCTION "public"."setup_admin_user_access"("p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."setup_admin_user_access"("p_email" "text") IS 'Configura un usuario existente como platform admin con acceso completo.
Requiere que el usuario ya exista en auth.users (creado manualmente o por magic link).';



CREATE OR REPLACE FUNCTION "public"."team_conversations_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."team_conversations_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_messages_bump_conversation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.team_conversations
    SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."team_messages_bump_conversation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_messages_set_edited_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    NEW.edited_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."team_messages_set_edited_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."to_tenant_timezone"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_tenant_tz text;
begin
  -- Obtener timezone del tenant
  select coalesce(timezone, 'Europe/Madrid') into v_tenant_tz
  from public.tenants
  where id = p_tenant_id;
  
  -- Convertir a timezone del tenant
  -- Nota: p_timestamp ya está en UTC (timestamptz), lo convertimos al timezone del tenant
  return (p_timestamp at time zone 'UTC') at time zone v_tenant_tz;
end;
$$;


ALTER FUNCTION "public"."to_tenant_timezone"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."to_tenant_timezone"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) IS 'Convierte un timestamp UTC a timezone del tenant. Retorna el timestamp en timezone del tenant.';



CREATE OR REPLACE FUNCTION "public"."trg_bookings_update_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant uuid;
  v_old_date date;
  v_new_date date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tenant := NEW.tenant_id;
    v_new_date := NEW.starts_at::date;
    PERFORM public.upsert_metrics_for_booking(v_tenant, v_new_date);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    v_old_date := OLD.starts_at::date;
    v_new_date := NEW.starts_at::date;
    PERFORM public.upsert_metrics_for_booking(v_tenant, v_old_date);
    IF v_new_date <> v_old_date THEN
      PERFORM public.upsert_metrics_for_booking(v_tenant, v_new_date);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_tenant := OLD.tenant_id;
    v_old_date := OLD.starts_at::date;
    PERFORM public.upsert_metrics_for_booking(v_tenant, v_old_date);
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trg_bookings_update_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_daily_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Actualizar métricas para el día de la reserva (NEW)
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM update_daily_metrics(NEW.tenant_id, NEW.starts_at::DATE);
  END IF;
  
  -- Si se movió la reserva a otra fecha, actualizar el día anterior también
  IF TG_OP = 'UPDATE' AND OLD.starts_at::DATE != NEW.starts_at::DATE THEN
    PERFORM update_daily_metrics(OLD.tenant_id, OLD.starts_at::DATE);
  END IF;
  
  -- Si se eliminó, actualizar el día de la reserva eliminada
  IF TG_OP = 'DELETE' THEN
    PERFORM update_daily_metrics(OLD.tenant_id, OLD.starts_at::DATE);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trigger_update_daily_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_booking_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    -- Solo actualiza si hay un cambio en el estado
    UPDATE bookings SET status = NEW.status WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_booking_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_messages_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_messages_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_customers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_metrics"("p_tenant_id" "uuid", "p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_timezone TEXT;
BEGIN
  -- Obtener timezone del tenant
  SELECT timezone INTO v_timezone
  FROM tenants WHERE id = p_tenant_id;
  
  v_timezone := COALESCE(v_timezone, 'Europe/Madrid');
  
  -- Calcular inicio y fin del día en la zona horaria del tenant
  v_day_start := (p_date::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone;
  v_day_end := v_day_start + INTERVAL '1 day';

  -- Insertar o actualizar métricas
  INSERT INTO daily_metrics (
    tenant_id,
    metric_date,
    total_bookings,
    confirmed_bookings,
    completed_bookings,
    cancelled_bookings,
    no_show_bookings,
    revenue_cents,
    active_services,
    active_staff,
    new_customers,
    returning_customers,
    available_slots,
    booked_slots,
    occupancy_percent,
    avg_ticket_cents,
    updated_at
  )
  SELECT
    p_tenant_id,
    p_date,
    -- Reservas por estado
    COUNT(*) FILTER (WHERE status != 'cancelled'),
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'completed', 'paid')),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'no_show'),
    -- Ingresos
    COALESCE(SUM(srv.price_cents) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')), 0),
    -- Staff y servicios activos (snapshot del día)
    (SELECT COUNT(*) FROM services WHERE tenant_id = p_tenant_id AND active = true),
    (SELECT COUNT(*) FROM staff WHERE tenant_id = p_tenant_id AND active = true),
    -- Clientes nuevos vs recurrentes
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= v_day_start AND c.created_at < v_day_end),
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at < v_day_start),
    -- Slots disponibles (basado en horarios del staff)
    (
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800), 0)::INT
      FROM staff_schedules ss
      INNER JOIN staff st ON ss.staff_id = st.id
      WHERE st.tenant_id = p_tenant_id
        AND st.active = true
        AND ss.is_active = true
        AND ss.day_of_week = EXTRACT(DOW FROM p_date)::INT
    ),
    -- Slots reservados
    COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')),
    -- Ocupación
    CASE 
      WHEN (
        SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800)
        FROM staff_schedules ss
        INNER JOIN staff st ON ss.staff_id = st.id
        WHERE st.tenant_id = p_tenant_id
          AND st.active = true
          AND ss.is_active = true
          AND ss.day_of_week = EXTRACT(DOW FROM p_date)::INT
      ) > 0 THEN
        LEAST(ROUND((COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid'))::NUMERIC / 
          (SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800)
           FROM staff_schedules ss
           INNER JOIN staff st ON ss.staff_id = st.id
           WHERE st.tenant_id = p_tenant_id AND st.active = true AND ss.is_active = true 
           AND ss.day_of_week = EXTRACT(DOW FROM p_date)::INT)) * 100), 100)::INT
      ELSE 0
    END,
    -- Ticket medio
    CASE 
      WHEN COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')) > 0 THEN
        (SUM(srv.price_cents) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')) / 
         COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')))::BIGINT
      ELSE 0
    END,
    NOW()
  FROM bookings b
  LEFT JOIN services srv ON b.service_id = srv.id
  LEFT JOIN customers c ON b.customer_id = c.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_day_start
    AND b.starts_at < v_day_end
  ON CONFLICT (tenant_id, metric_date)
  DO UPDATE SET
    total_bookings = EXCLUDED.total_bookings,
    confirmed_bookings = EXCLUDED.confirmed_bookings,
    completed_bookings = EXCLUDED.completed_bookings,
    cancelled_bookings = EXCLUDED.cancelled_bookings,
    no_show_bookings = EXCLUDED.no_show_bookings,
    revenue_cents = EXCLUDED.revenue_cents,
    active_services = EXCLUDED.active_services,
    active_staff = EXCLUDED.active_staff,
    new_customers = EXCLUDED.new_customers,
    returning_customers = EXCLUDED.returning_customers,
    available_slots = EXCLUDED.available_slots,
    booked_slots = EXCLUDED.booked_slots,
    occupancy_percent = EXCLUDED.occupancy_percent,
    avg_ticket_cents = EXCLUDED.avg_ticket_cents,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."update_daily_metrics"("p_tenant_id" "uuid", "p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_daily_metrics"("p_tenant_id" "uuid", "p_date" "date") IS 'Recalcula y actualiza métricas diarias para un tenant y fecha específica.
Ejecutada automáticamente por triggers cuando se crean/modifican reservas.';



CREATE OR REPLACE FUNCTION "public"."update_payment_intents_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_payment_intents_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_provides_services_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_staff_provides_services_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tenant_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tenant_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_permissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_user_permissions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_metrics_for_booking"("p_tenant_id" "uuid", "p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total int;
    v_confirmed int;
    v_cancelled int;
    v_no_show int;
    v_active_services int;
    v_active_staff int;
    v_revenue bigint;
BEGIN
    -- Recalcular KPIs desde cero (fórmulas oficiales)
    SELECT 
        COUNT(*) FILTER (WHERE b.status IN ('pending','confirmed','paid','completed')) AS total_bookings,
        COUNT(*) FILTER (WHERE b.status IN ('confirmed','paid','completed')) AS confirmed_bookings,
        COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled_bookings,
        COUNT(*) FILTER (WHERE b.status = 'no_show') AS no_show_bookings,
        (SELECT COUNT(*) FROM public.services s WHERE s.tenant_id = p_tenant_id AND s.active = TRUE) AS active_services,
        (SELECT COUNT(*) FROM public.staff st WHERE st.tenant_id = p_tenant_id AND st.active = TRUE) AS active_staff,
        COALESCE(SUM(p.total_price), 0) AS revenue_cents
    INTO 
        v_total, v_confirmed, v_cancelled, v_no_show,
        v_active_services, v_active_staff, v_revenue
    FROM public.bookings b
    LEFT JOIN public.payments p ON p.booking_id = b.id
    WHERE b.tenant_id = p_tenant_id
      AND DATE(b.starts_at) = p_date;

    -- UPSERT CORRECTO
    INSERT INTO public.org_metrics_daily (
        tenant_id,
        metric_date,
        total_bookings,
        confirmed_bookings,
        cancelled_bookings,
        no_show_bookings,
        active_services,
        active_staff,
        revenue_cents,
        updated_at
    )
    VALUES (
        p_tenant_id,
        p_date,
        v_total,
        v_confirmed,
        v_cancelled,
        v_no_show,
        v_active_services,
        v_active_staff,
        v_revenue,
        now()
    )
    ON CONFLICT (tenant_id, metric_date)
    DO UPDATE SET
        total_bookings = EXCLUDED.total_bookings,
        confirmed_bookings = EXCLUDED.confirmed_bookings,
        cancelled_bookings = EXCLUDED.cancelled_bookings,
        no_show_bookings = EXCLUDED.no_show_bookings,
        active_services = EXCLUDED.active_services,
        active_staff = EXCLUDED.active_staff,
        revenue_cents = EXCLUDED.revenue_cents,
        updated_at = now();

END;
$$;


ALTER FUNCTION "public"."upsert_metrics_for_booking"("p_tenant_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_display_names_update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."user_display_names_update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_role_for_tenant"("target_tenant" "uuid", "allowed_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  has_role boolean;
begin
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = target_tenant
      and (allowed_roles is null or m.role = any(allowed_roles))
  )
  into has_role;

  return has_role;
end;
$$;


ALTER FUNCTION "public"."user_has_role_for_tenant"("target_tenant" "uuid", "allowed_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix_hierarchy_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix_hierarchy_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_level"("name" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION "storage"."get_level"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefix"("name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION "storage"."get_prefix"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefixes"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION "storage"."get_prefixes"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


ALTER FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_insert_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_insert_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_update_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_level_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_level_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."prefixes_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_insert_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."prefixes_insert_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text" NOT NULL,
    "code_challenge_method" "auth"."code_challenge_method" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'stores metadata for pkce logins';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



