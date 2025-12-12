


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "app";


ALTER SCHEMA "app" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE SCHEMA IF NOT EXISTS "platform";


ALTER SCHEMA "platform" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'Esquema público principal. Tablas legacy (users_backup, org_members_backup) eliminadas en migración 0063. Usar auth.users + public.profiles + public.memberships.';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "app"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Solo usar memberships (eliminada compatibilidad con public.users)
  SELECT tenant_id INTO v_tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN v_tenant_id;
END;
$$;


ALTER FUNCTION "app"."current_tenant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "app"."current_tenant_id"() IS 'Retorna el tenant_id del usuario actual basado únicamente en memberships. Ya no consulta public.users (legacy eliminado).';



CREATE OR REPLACE FUNCTION "app"."get_tenant_timezone"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_timezone text;
begin
  select timezone into v_timezone
  from public.tenants
  where id = p_tenant_id;
  
  return coalesce(v_timezone, 'Europe/Madrid');
end;
$$;


ALTER FUNCTION "app"."get_tenant_timezone"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "app"."get_tenant_timezone"("p_tenant_id" "uuid") IS 'Retorna el timezone del tenant. Si no existe, retorna Europe/Madrid por defecto.';



CREATE OR REPLACE FUNCTION "app"."user_has_access_to_tenant"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_has_access boolean;
begin
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
  ) into v_has_access;
  
  return coalesce(v_has_access, false);
end;
$$;


ALTER FUNCTION "app"."user_has_access_to_tenant"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "app"."user_has_access_to_tenant"("p_tenant_id" "uuid") IS 'Verifica si el usuario actual tiene acceso a un tenant específico (cualquier rol).';



CREATE OR REPLACE FUNCTION "app"."user_has_role"("p_tenant_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"(), "p_roles" "text"[] DEFAULT ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_role text;
begin
  select role into v_role
  from public.memberships
  where tenant_id = p_tenant_id
    and user_id = p_user_id;
  
  return v_role = any(p_roles);
end;
$$;


ALTER FUNCTION "app"."user_has_role"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_roles" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "app"."user_has_role"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_roles" "text"[]) IS 'Verifica si un usuario tiene uno de los roles especificados en un tenant. Actualizado para usar memberships.';



CREATE OR REPLACE FUNCTION "platform"."audit_customer_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  IF TG_OP = 'INSERT' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'create',
      'customer',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_customer_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'update',
      'customer',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_customer_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'delete',
      'customer',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL,
      jsonb_build_object('trigger', 'audit_customer_changes')
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "platform"."audit_customer_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."audit_service_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Obtener user_id del contexto (auth.uid())
  v_user_id := auth.uid();
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  IF TG_OP = 'INSERT' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'create',
      'service',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_service_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'update',
      'service',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_service_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'delete',
      'service',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL,
      jsonb_build_object('trigger', 'audit_service_changes')
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "platform"."audit_service_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."audit_staff_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  IF TG_OP = 'INSERT' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'create',
      'staff',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_staff_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'update',
      'staff',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_staff_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'delete',
      'staff',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL,
      jsonb_build_object('trigger', 'audit_staff_changes')
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "platform"."audit_staff_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."is_platform_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM platform.platform_users AS pu
  WHERE pu.auth_user_id = p_user_id
  AND pu.status = 'active';
  RETURN v_count > 0;
END;
$$;


ALTER FUNCTION "platform"."is_platform_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "platform"."log_audit"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid" DEFAULT NULL::"uuid", "p_old_data" "jsonb" DEFAULT NULL::"jsonb", "p_new_data" "jsonb" DEFAULT NULL::"jsonb", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_impersonated_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO platform.audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    metadata,
    impersonated_by
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_data,
    p_new_data,
    p_metadata,
    p_impersonated_by
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "platform"."log_audit"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_metadata" "jsonb", "p_impersonated_by" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "platform"."log_audit"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_metadata" "jsonb", "p_impersonated_by" "uuid") IS 'Función helper para registrar eventos de auditoría. Usar desde triggers o código de aplicación.';



CREATE OR REPLACE FUNCTION "platform"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "platform"."update_updated_at_column"() OWNER TO "postgres";


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

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "platform"."admin_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "auth_session_id" "text" NOT NULL,
    "ip_address" "inet" NOT NULL,
    "user_agent" "text",
    "device_type" "text",
    "browser" "text",
    "os" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "platform"."admin_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text",
    "description" "text",
    "metadata" "jsonb",
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "severity" "text" DEFAULT 'info'::"text",
    "tenant_id" "uuid",
    "impersonated_by" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb"
);


ALTER TABLE "platform"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "platform"."audit_logs" IS 'Sistema de auditoría completo de la plataforma. Registra acciones sobre recursos clave (services, staff, customers, bookings, tenant_settings, impersonaciones, etc.) con diffs old/new. Usado para troubleshooting avanzado y trazabilidad.';



COMMENT ON COLUMN "platform"."audit_logs"."id" IS 'Identificador único del evento de auditoría (UUID).';



COMMENT ON COLUMN "platform"."audit_logs"."user_id" IS 'ID del usuario (auth.users.id) que originó la acción, si aplica. Puede ser NULL para procesos automáticos o integraciones.';



COMMENT ON COLUMN "platform"."audit_logs"."user_email" IS 'Email del usuario en el momento de la acción, capturado como texto para mantener histórico aunque se cambie el email posteriormente.';



COMMENT ON COLUMN "platform"."audit_logs"."action" IS 'Tipo de acción auditada. Ejemplos: insert, update, delete, login, impersonate, update_settings, etc.';



COMMENT ON COLUMN "platform"."audit_logs"."resource_type" IS 'Tipo de recurso afectado por la acción: customers, services, staff, bookings, tenant_settings, etc.';



COMMENT ON COLUMN "platform"."audit_logs"."resource_id" IS 'Identificador del recurso afectado. Se almacena como texto para poder referenciar IDs de distintos tipos.';



COMMENT ON COLUMN "platform"."audit_logs"."description" IS 'Descripción legible de la acción para uso en UI de auditoría (qué ha pasado, sobre qué y por quién).';



COMMENT ON COLUMN "platform"."audit_logs"."metadata" IS 'Metadatos adicionales del evento en formato JSONB (información contextual, headers relevantes, origen, etc.).';



COMMENT ON COLUMN "platform"."audit_logs"."ip_address" IS 'Dirección IP desde la que se originó la acción (cuando aplica).';



COMMENT ON COLUMN "platform"."audit_logs"."created_at" IS 'Fecha y hora en la que se registró el evento de auditoría (timestamptz).';



COMMENT ON COLUMN "platform"."audit_logs"."severity" IS 'Nivel de severidad del evento (info, warning, error, security, etc.). Por defecto: info.';



COMMENT ON COLUMN "platform"."audit_logs"."tenant_id" IS 'Tenant al que aplica el evento de auditoría, si está asociado a una organización concreta. Puede ser NULL para eventos globales de plataforma.';



COMMENT ON COLUMN "platform"."audit_logs"."impersonated_by" IS 'ID del usuario (auth.users.id) que ha iniciado una sesión de impersonación, cuando un usuario actúa en nombre de otro. Permite reconstruir quién hizo realmente la acción.';



COMMENT ON COLUMN "platform"."audit_logs"."old_data" IS 'Snapshot previo del recurso afectado en formato JSONB (antes del cambio). Solo aplica para acciones de tipo update/delete según implementación del trigger.';



COMMENT ON COLUMN "platform"."audit_logs"."new_data" IS 'Snapshot posterior del recurso afectado en formato JSONB (después del cambio). Solo aplica para acciones de tipo insert/update.';



CREATE TABLE IF NOT EXISTS "platform"."platform_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "resource" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "platform"."platform_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "level" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "platform"."platform_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "avatar_url" "text",
    "mfa_enabled" boolean DEFAULT false NOT NULL,
    "mfa_secret" "text",
    "mfa_backup_codes" "text"[],
    "mfa_configured_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "last_login_at" timestamp with time zone,
    "last_login_ip" "inet",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "active" boolean DEFAULT true,
    "role" "text" DEFAULT 'admin'::"text",
    CONSTRAINT "platform_users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'disabled'::"text"])))
);


ALTER TABLE "platform"."platform_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "platform"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "platform"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "staff_id" "uuid",
    "service_id" "uuid",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "text" NOT NULL,
    "source" "text" DEFAULT 'web'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "slot" "tstzrange" GENERATED ALWAYS AS ("tstzrange"("starts_at", "ends_at", '[)'::"text")) STORED,
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['hold'::"text", 'confirmed'::"text", 'cancelled'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


COMMENT ON TABLE "public"."appointments" IS 'Citas reservadas en la agenda del staff. Controlan solapamientos y bloqueos mediante constraint de rango.';



COMMENT ON COLUMN "public"."appointments"."id" IS 'Identificador único de la cita (UUID).';



COMMENT ON COLUMN "public"."appointments"."tenant_id" IS 'Tenant (barbería/negocio) propietario de la cita.';



COMMENT ON COLUMN "public"."appointments"."customer_id" IS 'Cliente que tiene la cita reservada. Puede ser NULL en algunos holds temporales.';



COMMENT ON COLUMN "public"."appointments"."staff_id" IS 'Miembro del staff que atenderá la cita.';



COMMENT ON COLUMN "public"."appointments"."service_id" IS 'Servicio que se prestará en esta cita.';



COMMENT ON COLUMN "public"."appointments"."starts_at" IS 'Fecha y hora de inicio de la cita (derivable del slot, pero útil para consultas e integraciones).';



COMMENT ON COLUMN "public"."appointments"."ends_at" IS 'Fecha y hora de fin.';



COMMENT ON COLUMN "public"."appointments"."status" IS 'Estado de la cita: hold, confirmed, cancelled, no_show.';



COMMENT ON COLUMN "public"."appointments"."created_at" IS 'Fecha creación.';



COMMENT ON COLUMN "public"."appointments"."expires_at" IS 'Fecha y hora en la que un hold temporal expira si no se confirma la reserva.';



COMMENT ON COLUMN "public"."appointments"."slot" IS 'Rango de tiempo de la cita (tsrange/tstzrange). Se usa para evitar solapamientos por staff.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "tenant_id" "uuid",
    "diff" "jsonb",
    CONSTRAINT "audit_logs_action_check" CHECK (("action" = ANY (ARRAY['insert'::"text", 'update'::"text", 'delete'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Tabla de auditoría de eventos de negocio a nivel de tenant. Registrada por triggers y funciones internas. Estructura simplificada respecto a platform.audit_logs.';



CREATE SEQUENCE IF NOT EXISTS "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."auth_login_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "redirect_path" "text" DEFAULT '/panel'::"text",
    "secret_token" "text" NOT NULL,
    "supabase_access_token" "text",
    "supabase_refresh_token" "text",
    CONSTRAINT "auth_login_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."auth_login_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."auth_login_requests" IS 'Stores login requests for remote approval flow. Tokens are only accessible via service_role.';



COMMENT ON COLUMN "public"."auth_login_requests"."secret_token" IS 'Secret token sent in email link for security verification';



COMMENT ON COLUMN "public"."auth_login_requests"."supabase_access_token" IS 'Access token from Supabase session (only accessible via service_role)';



COMMENT ON COLUMN "public"."auth_login_requests"."supabase_refresh_token" IS 'Refresh token from Supabase session (only accessible via service_role)';



CREATE TABLE IF NOT EXISTS "public"."auth_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event" "text" NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "auth_logs_event_check" CHECK (("event" = ANY (ARRAY['login'::"text", 'logout'::"text"])))
);


ALTER TABLE "public"."auth_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."auth_logs" IS 'Registro de eventos de autenticación (login/logout). RLS habilitado: usuarios ven solo sus propios logs.';



ALTER TABLE "public"."auth_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."auth_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_provider_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "internal_notes" "text",
    "client_message" "text",
    "is_highlighted" boolean DEFAULT false,
    "appointment_id" "uuid",
    "payment_intent_id" "text",
    "slot" "tstzrange" GENERATED ALWAYS AS ("tstzrange"("starts_at", "ends_at", '[)'::"text")) STORED,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_min" integer,
    CONSTRAINT "bookings_check" CHECK (("starts_at" < "ends_at")),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text", 'no_show'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON TABLE "public"."bookings" IS 'Reservas asociadas a citas (appointments), con información de cliente, staff, servicio, estado y pagos.';



COMMENT ON COLUMN "public"."bookings"."id" IS 'ID único de la reserva.';



COMMENT ON COLUMN "public"."bookings"."tenant_id" IS 'Tenant propietario de la reserva.';



COMMENT ON COLUMN "public"."bookings"."customer_id" IS 'Cliente que realiza la reserva.';



COMMENT ON COLUMN "public"."bookings"."staff_id" IS 'Miembro del staff asignado a la reserva.';



COMMENT ON COLUMN "public"."bookings"."service_id" IS 'Servicio reservado.';



COMMENT ON COLUMN "public"."bookings"."starts_at" IS 'Fecha y hora de inicio de la reserva.';



COMMENT ON COLUMN "public"."bookings"."ends_at" IS 'Fecha y hora de fin de la reserva.';



COMMENT ON COLUMN "public"."bookings"."status" IS 'Estado de la reserva: pending, paid, cancelled, no_show, completed.';



COMMENT ON COLUMN "public"."bookings"."expires_at" IS 'Fecha de caducidad de la reserva cuando está en estado pending/hold.';



COMMENT ON COLUMN "public"."bookings"."internal_notes" IS 'Notas internas sobre la cita (solo visible para staff)';



COMMENT ON COLUMN "public"."bookings"."client_message" IS 'Mensaje personalizado para el cliente (se incluirá en SMS/email de confirmación)';



COMMENT ON COLUMN "public"."bookings"."is_highlighted" IS 'Indica si la cita está destacada/marcada como importante';



COMMENT ON COLUMN "public"."bookings"."appointment_id" IS 'Cita (appointment) de origen asociada a esta reserva.';



COMMENT ON COLUMN "public"."bookings"."payment_intent_id" IS 'Intento de pago asociado, si existe.';



COMMENT ON COLUMN "public"."bookings"."slot" IS 'Rango temporal (tsrange) usado para las exclusiones de solapamiento por staff.';



CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_messages" IS 'Mensajes de chat interno entre miembros del staff';



COMMENT ON COLUMN "public"."chat_messages"."recipient_id" IS 'NULL = mensaje grupal (visible para todos los miembros del tenant)';



COMMENT ON COLUMN "public"."chat_messages"."message" IS 'Contenido del mensaje';



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "birth_date" "date",
    "notes" "text",
    "visits_count" integer DEFAULT 0 NOT NULL,
    "last_booking_at" timestamp with time zone,
    "total_spent_cents" bigint DEFAULT 0 NOT NULL,
    "no_show_count" integer DEFAULT 0 NOT NULL,
    "last_no_show_at" timestamp with time zone,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_vip" boolean DEFAULT false NOT NULL,
    "is_banned" boolean DEFAULT false NOT NULL,
    "marketing_opt_in" boolean DEFAULT true NOT NULL,
    "internal_notes" "text",
    "preferred_staff_id" "uuid",
    "preferred_time_of_day" "text",
    "preferred_days" "text"[],
    "last_call_status" "text",
    "last_call_date" timestamp with time zone,
    "next_due_date" timestamp with time zone,
    "call_attempts" integer DEFAULT 0,
    "prefers_whatsapp" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customers_email_format_ck" CHECK ((("email" IS NULL) OR ("email" ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'::"text"))),
    CONSTRAINT "customers_phone_format_ck" CHECK ((("phone" IS NULL) OR ("phone" ~ '^[+0-9 ()-]{6,}$'::"text"))),
    CONSTRAINT "customers_preferred_time_of_day_check" CHECK (("preferred_time_of_day" = ANY (ARRAY['mañana'::"text", 'tarde'::"text", 'noche'::"text", NULL::"text"])))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON TABLE "public"."customers" IS 'Clientes de cada tenant, con información de contacto, preferencias y estado de retención.';



COMMENT ON COLUMN "public"."customers"."id" IS 'ID único del cliente.';



COMMENT ON COLUMN "public"."customers"."tenant_id" IS 'Tenant propietario del registro de cliente.';



COMMENT ON COLUMN "public"."customers"."name" IS 'Nombre del cliente.';



COMMENT ON COLUMN "public"."customers"."email" IS 'Correo electrónico del cliente. Validad por formato y único por tenant en minúsculas.';



COMMENT ON COLUMN "public"."customers"."phone" IS 'Teléfono de contacto del cliente. Validad por formato básico.';



COMMENT ON COLUMN "public"."customers"."birth_date" IS 'Fecha de nacimiento del cliente (opcional, para fidelización y marketing)';



COMMENT ON COLUMN "public"."customers"."notes" IS 'Notas internas sobre el cliente';



COMMENT ON COLUMN "public"."customers"."internal_notes" IS 'Internal notes about customer habits, preferences, etc. Visible to staff and AI agent.';



COMMENT ON COLUMN "public"."customers"."preferred_staff_id" IS 'ID del miembro del staff preferido por el cliente, si lo hay.';



COMMENT ON COLUMN "public"."customers"."preferred_time_of_day" IS 'Franja horaria preferida del cliente (mañana, tarde o noche).';



COMMENT ON COLUMN "public"."customers"."preferred_days" IS 'Array of preferred days of the week';



COMMENT ON COLUMN "public"."customers"."last_call_status" IS 'Estado del último contacto telefónico (por ejemplo: pendiente, contactado, sin respuesta).';



COMMENT ON COLUMN "public"."customers"."next_due_date" IS 'Fecha objetivo para la próxima visita o seguimiento del cliente.';



COMMENT ON COLUMN "public"."customers"."call_attempts" IS 'Number of call attempts made for next appointment';



COMMENT ON COLUMN "public"."customers"."prefers_whatsapp" IS 'Customer prefers WhatsApp over phone calls';



CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "duration_min" integer NOT NULL,
    "price_cents" integer NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "buffer_min" integer DEFAULT 0 NOT NULL,
    "category" "text" DEFAULT 'Otros'::"text" NOT NULL,
    "pricing_levels" "jsonb",
    "deposit_enabled" boolean DEFAULT false,
    "deposit_type" "text",
    "deposit_amount" numeric(10,2),
    "deposit_percent" numeric(5,2),
    "online_payment_required" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "services_deposit_type_check" CHECK (("deposit_type" = ANY (ARRAY['fixed'::"text", 'percent'::"text"]))),
    CONSTRAINT "services_duration_min_check" CHECK (("duration_min" > 0)),
    CONSTRAINT "services_price_cents_check" CHECK (("price_cents" >= 0))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON TABLE "public"."services" IS 'Servicios ofrecidos por cada tenant: corte, barba, combos, etc. Definen duración, precio y configuración de cobro.';



COMMENT ON COLUMN "public"."services"."id" IS 'Identificador único del servicio.';



COMMENT ON COLUMN "public"."services"."tenant_id" IS 'Tenant al que pertenece el servicio.';



COMMENT ON COLUMN "public"."services"."duration_min" IS 'Duración del servicio en minutos.';



COMMENT ON COLUMN "public"."services"."price_cents" IS 'Precio del servicio expresado en céntimos.';



COMMENT ON COLUMN "public"."services"."active" IS 'Indica si el servicio está activo y disponible para reservas.';



COMMENT ON COLUMN "public"."services"."stripe_price_id" IS 'ID de price en Stripe asociado a este servicio cuando se usa cobro online.';



COMMENT ON COLUMN "public"."services"."stripe_product_id" IS 'ID del producto en Stripe. Debe existir para que el servicio sea vendible.';



COMMENT ON COLUMN "public"."services"."deposit_enabled" IS 'Indica si el servicio requiere un adelanto (depósito)';



COMMENT ON COLUMN "public"."services"."deposit_type" IS 'Tipo de depósito: fixed (cantidad fija) o percent (porcentaje sobre el precio).';



COMMENT ON COLUMN "public"."services"."deposit_amount" IS 'Monto fijo del depósito si deposit_type es fixed';



COMMENT ON COLUMN "public"."services"."deposit_percent" IS 'Porcentaje del precio total si deposit_type es percent';



COMMENT ON COLUMN "public"."services"."online_payment_required" IS 'Indica si el pago online es obligatorio para este servicio';



CREATE MATERIALIZED VIEW "public"."daily_dashboard_kpis" AS
 SELECT "b"."tenant_id",
    CURRENT_DATE AS "kpi_date",
    "count"(*) FILTER (WHERE ("b"."status" = ANY (ARRAY['confirmed'::"text", 'completed'::"text", 'paid'::"text"]))) AS "bookings_today",
    "sum"("s"."price_cents") FILTER (WHERE ("b"."status" = ANY (ARRAY['confirmed'::"text", 'completed'::"text", 'paid'::"text"]))) AS "revenue_today",
    "count"(DISTINCT "b"."staff_id") AS "active_staff",
    "count"(DISTINCT "b"."service_id") AS "active_services"
   FROM ("public"."bookings" "b"
     LEFT JOIN "public"."services" "s" ON (("b"."service_id" = "s"."id")))
  WHERE ("b"."starts_at" >= CURRENT_DATE)
  GROUP BY "b"."tenant_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."daily_dashboard_kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "total_bookings" integer DEFAULT 0,
    "confirmed_bookings" integer DEFAULT 0,
    "completed_bookings" integer DEFAULT 0,
    "cancelled_bookings" integer DEFAULT 0,
    "no_show_bookings" integer DEFAULT 0,
    "revenue_cents" bigint DEFAULT 0,
    "active_services" integer DEFAULT 0,
    "active_staff" integer DEFAULT 0,
    "new_customers" integer DEFAULT 0,
    "returning_customers" integer DEFAULT 0,
    "available_slots" integer DEFAULT 0,
    "booked_slots" integer DEFAULT 0,
    "occupancy_percent" integer DEFAULT 0,
    "avg_ticket_cents" bigint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_metrics" IS 'Tabla materializada con métricas diarias precalculadas por tenant.
Actualizada automáticamente mediante triggers.
Permite carga instantánea del dashboard sin recalcular métricas.';



CREATE TABLE IF NOT EXISTS "public"."logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "metadata" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."logs" IS 'Logs operativos generales para depuración, análisis y trazabilidad por tenant.';



CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


COMMENT ON TABLE "public"."memberships" IS 'Asociación entre usuarios y tenants. Define el rol del usuario dentro del tenant. Base del RLS.';



CREATE TABLE IF NOT EXISTS "public"."org_metrics_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "total_bookings" integer DEFAULT 0,
    "confirmed_bookings" integer DEFAULT 0,
    "cancelled_bookings" integer DEFAULT 0,
    "no_show_bookings" integer DEFAULT 0,
    "total_slots_available" integer DEFAULT 0,
    "slots_booked" integer DEFAULT 0,
    "occupancy_rate" numeric(5,2) DEFAULT 0,
    "active_services" integer DEFAULT 0,
    "active_staff" integer DEFAULT 0,
    "revenue_cents" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cron_holds_released" integer DEFAULT 0,
    "webhook_events_total" integer DEFAULT 0,
    "webhook_events_failed" integer DEFAULT 0
);


ALTER TABLE "public"."org_metrics_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_metrics_daily" IS 'Métricas agregadas diarias por tenant: reservas, ingresos, eventos de webhook, etc.';



COMMENT ON COLUMN "public"."org_metrics_daily"."id" IS 'Identificador único del registro de métricas diarias (UUID).';



COMMENT ON COLUMN "public"."org_metrics_daily"."tenant_id" IS 'Tenant al que pertenecen las métricas.';



COMMENT ON COLUMN "public"."org_metrics_daily"."metric_date" IS 'Fecha a la que corresponden las métricas.';



COMMENT ON COLUMN "public"."org_metrics_daily"."cron_holds_released" IS 'Aproximación del número de holds liberados por el cron job. 
       Se calcula contando reservas canceladas con expires_at null en la ventana de tiempo.';



COMMENT ON COLUMN "public"."org_metrics_daily"."webhook_events_total" IS 'Número total de eventos de webhook procesados ese día para el tenant.';



COMMENT ON COLUMN "public"."org_metrics_daily"."webhook_events_failed" IS 'Número de eventos de webhook fallidos ese día para el tenant.';



CREATE TABLE IF NOT EXISTS "public"."payment_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "service_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "status" "text" DEFAULT 'requires_payment'::"text" NOT NULL,
    "payment_provider" "text" DEFAULT 'mock'::"text",
    "payment_provider_id" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "payment_intents_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "payment_intents_status_check" CHECK (("status" = ANY (ARRAY['requires_payment'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."payment_intents" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_intents" IS 'Intenciones de pago creadas antes de un pago final. Controlan expiración, reintentos y estado del flujo de cobro.';



COMMENT ON COLUMN "public"."payment_intents"."id" IS 'Identificador único de la intención de pago (UUID).';



COMMENT ON COLUMN "public"."payment_intents"."tenant_id" IS 'Tenant (barbería/negocio) para el que se creó la intención de pago.';



COMMENT ON COLUMN "public"."payment_intents"."customer_id" IS 'Cliente asociado a la intención de pago.';



COMMENT ON COLUMN "public"."payment_intents"."service_id" IS 'Servicio para el que se está intentando cobrar.';



COMMENT ON COLUMN "public"."payment_intents"."amount_cents" IS 'Importe a cobrar en céntimos. Debe ser mayor que 0.';



COMMENT ON COLUMN "public"."payment_intents"."status" IS 'Estado de la intención de pago: requires_payment, paid, failed, cancelled, etc.';



COMMENT ON COLUMN "public"."payment_intents"."created_at" IS 'Fecha creación.';



COMMENT ON COLUMN "public"."payment_intents"."expires_at" IS 'Fecha y hora límite para completar el pago antes de considerarlo expirado.';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_charge_id" "text",
    "stripe_session_id" "text",
    "service_id" "uuid",
    "tenant_id" "uuid",
    "booking_id" "uuid",
    "customer_name" "text",
    "customer_email" "text",
    "amount" numeric(10,2) NOT NULL,
    "deposit" numeric(10,2),
    "total_price" numeric(10,2),
    "status" "text" NOT NULL,
    "balance_status" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_balance_status_check" CHECK (("balance_status" = ANY (ARRAY['pending'::"text", 'available'::"text", 'paid_out'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'succeeded'::"text", 'refunded'::"text", 'disputed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."payments" IS 'Pagos realizados a través de la plataforma. Se vinculan a reservas, servicios y tenants, y sincronizan con Stripe.';



COMMENT ON COLUMN "public"."payments"."id" IS 'Identificador único del pago (UUID).';



COMMENT ON COLUMN "public"."payments"."stripe_payment_intent_id" IS 'ID del PaymentIntent de Stripe asociado a este pago, si aplica.';



COMMENT ON COLUMN "public"."payments"."stripe_charge_id" IS 'ID del cargo (charge) de Stripe asociado al pago, si aplica.';



COMMENT ON COLUMN "public"."payments"."stripe_session_id" IS 'ID de la sesión de Checkout de Stripe utilizada para iniciar el pago, si aplica.';



COMMENT ON COLUMN "public"."payments"."service_id" IS 'Servicio reservado que originó este pago.';



COMMENT ON COLUMN "public"."payments"."tenant_id" IS 'Tenant (barbería/negocio) al que pertenece este pago.';



COMMENT ON COLUMN "public"."payments"."booking_id" IS 'Reserva asociada a este pago, si existe.';



COMMENT ON COLUMN "public"."payments"."customer_name" IS 'Nombre del cliente en el momento del pago (copia de conveniencia).';



COMMENT ON COLUMN "public"."payments"."customer_email" IS 'Email del cliente en el momento del pago (copia de conveniencia).';



COMMENT ON COLUMN "public"."payments"."amount" IS 'Importe cobrado al cliente (moneda principal del tenant).';



COMMENT ON COLUMN "public"."payments"."deposit" IS 'Parte del importe correspondiente a depósito/no-show protection, si aplica.';



COMMENT ON COLUMN "public"."payments"."total_price" IS 'Precio total del servicio en el momento de la reserva (antes de posibles cambios futuros).';



COMMENT ON COLUMN "public"."payments"."status" IS 'Estado del pago: pending, succeeded, refunded, disputed, failed, etc.';



COMMENT ON COLUMN "public"."payments"."balance_status" IS 'Estado del balance en Stripe: pending, available, paid_out.';



COMMENT ON COLUMN "public"."payments"."metadata" IS 'Metadatos adicionales del pago (JSONB), por ejemplo IDs externos o contexto de la operación.';



COMMENT ON COLUMN "public"."payments"."created_at" IS 'Fecha y hora de creación del registro de pago.';



COMMENT ON COLUMN "public"."payments"."updated_at" IS 'Fecha y hora de la última actualización del registro de pago.';



CREATE TABLE IF NOT EXISTS "public"."platform_users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'support'::"text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "platform_users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'support'::"text"])))
);


ALTER TABLE "public"."platform_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "default_org_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "display_name" "text",
    "profile_photo_url" "text",
    "bio" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'RLS activado: SELECT/UPDATE solo el propio usuario (user_id = auth.uid()).';



COMMENT ON COLUMN "public"."profiles"."display_name" IS 'Nombre personalizado del usuario (sobrescribe el de staff si existe)';



COMMENT ON COLUMN "public"."profiles"."profile_photo_url" IS 'URL de la foto de perfil del usuario';



COMMENT ON COLUMN "public"."profiles"."bio" IS 'Biografía o descripción personal del usuario';



CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "skills" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "display_name" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "profile_photo_url" "text",
    "weekly_hours" integer DEFAULT 40,
    "provides_services" boolean DEFAULT true NOT NULL,
    "color" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bio" "text",
    "role" "text"
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff" IS 'Miembros del staff (barberos) asociados a cada tenant. Se usan para agenda, asignación de servicios y permisos internos.';



COMMENT ON COLUMN "public"."staff"."id" IS 'ID único del miembro del staff.';



COMMENT ON COLUMN "public"."staff"."tenant_id" IS 'Tenant al que pertenece este miembro del staff.';



COMMENT ON COLUMN "public"."staff"."user_id" IS 'Usuario de la tabla auth.users vinculado a este miembro del staff, si existe.';



COMMENT ON COLUMN "public"."staff"."active" IS 'Indica si el staff está activo y visible para reservas.';



COMMENT ON COLUMN "public"."staff"."profile_photo_url" IS 'URL de la foto de perfil del barbero (visible al público)';



COMMENT ON COLUMN "public"."staff"."weekly_hours" IS 'Número de horas semanales de alta del barbero (para configuración con IA de horarios)';



COMMENT ON COLUMN "public"."staff"."provides_services" IS 'Indica si este miembro del staff puede ser asignado a servicios reservables.';



CREATE TABLE IF NOT EXISTS "public"."staff_blockings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "staff_blockings_check" CHECK (("start_at" < "end_at")),
    CONSTRAINT "staff_blockings_type_check" CHECK (("type" = ANY (ARRAY['block'::"text", 'absence'::"text", 'vacation'::"text"])))
);


ALTER TABLE "public"."staff_blockings" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_blockings" IS 'Bloqueos de agenda del staff: ausencias, vacaciones, indisponibilidad puntual.';



COMMENT ON COLUMN "public"."staff_blockings"."type" IS 'Tipo: block (bloqueo/falta de disponibilidad), absence (ausencia) o vacation (vacaciones)';



COMMENT ON COLUMN "public"."staff_blockings"."reason" IS 'Motivo del bloqueo (ej: "Descanso", "Vacaciones", "Enfermedad")';



COMMENT ON COLUMN "public"."staff_blockings"."notes" IS 'Notas adicionales sobre el bloqueo';



CREATE TABLE IF NOT EXISTS "public"."staff_provides_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staff_provides_services" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_provides_services" IS 'Relación muchos-a-muchos entre staff y servicios que puede ofrecer cada profesional.';



COMMENT ON COLUMN "public"."staff_provides_services"."id" IS 'Identificador único de la relación staff-servicio (UUID).';



COMMENT ON COLUMN "public"."staff_provides_services"."tenant_id" IS 'Tenant al que pertenece esta configuración.';



COMMENT ON COLUMN "public"."staff_provides_services"."staff_id" IS 'Profesional que presta el servicio.';



COMMENT ON COLUMN "public"."staff_provides_services"."service_id" IS 'Servicio que el profesional está habilitado para prestar.';



CREATE TABLE IF NOT EXISTS "public"."staff_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "staff_schedules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."staff_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_schedules" IS 'Horarios recurrentes de trabajo del staff por día de la semana. Se combinan con bloqueos y citas.';



COMMENT ON COLUMN "public"."staff_schedules"."id" IS 'Identificador único del tramo horario (UUID).';



COMMENT ON COLUMN "public"."staff_schedules"."tenant_id" IS 'Tenant propietario del horario.';



COMMENT ON COLUMN "public"."staff_schedules"."staff_id" IS 'Profesional al que pertenece este horario.';



COMMENT ON COLUMN "public"."staff_schedules"."day_of_week" IS 'Día de la semana: 0=lunes ... 6=domingo.';



COMMENT ON COLUMN "public"."staff_schedules"."start_time" IS 'Hora de inicio del tramo de trabajo (sin fecha, solo tiempo).';



COMMENT ON COLUMN "public"."staff_schedules"."end_time" IS 'Hora de fin del tramo de trabajo (sin fecha, solo tiempo).';



COMMENT ON COLUMN "public"."staff_schedules"."is_active" IS 'Indica si el tramo horario está actualmente activo para planificación.';



COMMENT ON COLUMN "public"."staff_schedules"."created_at" IS 'Fecha de creación.';



COMMENT ON COLUMN "public"."staff_schedules"."updated_at" IS 'Última actualización.';



CREATE TABLE IF NOT EXISTS "public"."stripe_events_processed" (
    "event_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_type" "text" NOT NULL
);


ALTER TABLE "public"."stripe_events_processed" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_events_processed" IS 'Tabla interna para tracking de eventos de Stripe procesados. NO debe tener RLS (solo accesible vía service_role).';



COMMENT ON COLUMN "public"."stripe_events_processed"."event_id" IS 'ID único del evento de Stripe (primary key).';



COMMENT ON COLUMN "public"."stripe_events_processed"."created_at" IS 'Timestamp de cuándo se procesó el evento.';



COMMENT ON COLUMN "public"."stripe_events_processed"."event_type" IS 'Tipo de evento de Stripe (ej: checkout.session.completed).';



CREATE TABLE IF NOT EXISTS "public"."system_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "tenant_id" "uuid",
    "actor_user_id" "uuid",
    "resource_type" "text",
    "resource_id" "uuid",
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "description" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_conversation_members" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone,
    "notifications_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "team_conversation_members_role_check" CHECK (("role" = ANY (ARRAY['member'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."team_conversation_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_conversation_members" IS 'Participantes de una conversación interna. Controla acceso y visibilidad.';



COMMENT ON COLUMN "public"."team_conversation_members"."role" IS 'Rol dentro de la conversación (member/admin).';



CREATE TABLE IF NOT EXISTS "public"."team_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb",
    CONSTRAINT "team_conversations_type_check" CHECK (("type" = ANY (ARRAY['all'::"text", 'direct'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."team_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_conversations" IS 'Conversaciones internas entre miembros del staff del tenant. Puede ser all, group o direct.';



COMMENT ON COLUMN "public"."team_conversations"."type" IS 'all = canal global, direct = 1:1, group = subconjunto del equipo.';



COMMENT ON COLUMN "public"."team_conversations"."metadata" IS 'JSON libre para flags futuros (p.ej. iconos, color, participantes).';



CREATE TABLE IF NOT EXISTS "public"."team_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "metadata" "jsonb"
);


ALTER TABLE "public"."team_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_messages" IS 'Mensajes dentro de cada conversación de equipo. Incluye timestamps, autores y controles de edición.';



COMMENT ON COLUMN "public"."team_messages"."deleted_at" IS 'Marca de borrado lógico (soft delete).';



CREATE TABLE IF NOT EXISTS "public"."team_messages_archive" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "metadata" "jsonb"
);


ALTER TABLE "public"."team_messages_archive" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_messages_archive" IS 'Tabla de archivo para mensajes antiguos (>90 días).
Mantiene la tabla principal team_messages optimizada.';



COMMENT ON COLUMN "public"."team_messages_archive"."deleted_at" IS 'Marca de borrado lógico (soft delete).';



CREATE TABLE IF NOT EXISTS "public"."tenant_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "no_show_protection_enabled" boolean DEFAULT false,
    "no_show_protection_mode" "text" DEFAULT 'deposit'::"text",
    "no_show_protection_percentage" integer DEFAULT 10,
    "no_show_cancellation_hours" integer DEFAULT 12,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_service_duration" integer DEFAULT 30 NOT NULL,
    "business_open_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "business_close_time" time without time zone DEFAULT '21:00:00'::time without time zone NOT NULL,
    CONSTRAINT "tenant_settings_no_show_cancellation_hours_check" CHECK (("no_show_cancellation_hours" >= 0)),
    CONSTRAINT "tenant_settings_no_show_protection_mode_check" CHECK (("no_show_protection_mode" = ANY (ARRAY['deposit'::"text", 'cancellation'::"text"]))),
    CONSTRAINT "tenant_settings_no_show_protection_percentage_check" CHECK ((("no_show_protection_percentage" >= 0) AND ("no_show_protection_percentage" <= 100)))
);


ALTER TABLE "public"."tenant_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_settings" IS 'Ajustes configurables por tenant: política de cancelaciones y protección frente a no-shows.';



COMMENT ON COLUMN "public"."tenant_settings"."id" IS 'Identificador único del registro de ajustes del tenant.';



COMMENT ON COLUMN "public"."tenant_settings"."tenant_id" IS 'Clave foránea hacia tenants.id.';



COMMENT ON COLUMN "public"."tenant_settings"."no_show_protection_enabled" IS 'Activa/desactiva la protección contra ausencias';



COMMENT ON COLUMN "public"."tenant_settings"."no_show_protection_mode" IS 'Modo de protección frente a no-shows: deposit (depósito) o cancellation (cargo por cancelación).';



COMMENT ON COLUMN "public"."tenant_settings"."no_show_protection_percentage" IS 'Porcentaje del importe del servicio usado como depósito o penalización por no-show.';



COMMENT ON COLUMN "public"."tenant_settings"."no_show_cancellation_hours" IS 'Horas mínimas de antelación para cancelar sin aplicar penalización o no-show.';



COMMENT ON COLUMN "public"."tenant_settings"."updated_at" IS 'Última actualización de la configuración del tenant.';



CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text" NOT NULL,
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text" NOT NULL,
    "logo_url" "text",
    "primary_color" "text" DEFAULT '#4cb3ff'::"text",
    "contact_email" "text",
    "contact_phone" "text",
    "address" "text",
    "portal_url" "text",
    "stripe_account_id" "text",
    "stripe_onboarding_status" "text" DEFAULT 'pending'::"text",
    "stripe_charges_enabled" boolean DEFAULT false,
    "stripe_payouts_enabled" boolean DEFAULT false,
    "public_subdomain" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenants_slug_check" CHECK ((("slug" IS NULL) OR ("slug" ~ '^[a-z0-9-]+$'::"text"))),
    CONSTRAINT "tenants_timezone_check" CHECK ((("timezone" IS NOT NULL) AND ("length"("timezone") > 0) AND ("length"("timezone") <= 50)))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'Organizaciones/barberías dentro del sistema multi-tenant. Cada tenant tiene configuración, staff, clientes y agenda propia.';



COMMENT ON COLUMN "public"."tenants"."id" IS 'Identificador único del tenant.';



COMMENT ON COLUMN "public"."tenants"."slug" IS 'Slug interno único para referencias. Se normaliza por trigger.';



COMMENT ON COLUMN "public"."tenants"."timezone" IS 'Zona horaria del negocio. Se usa para agenda, disponibilidad y reglas de tiempo.';



COMMENT ON COLUMN "public"."tenants"."logo_url" IS 'URL del logo de la barbería';



COMMENT ON COLUMN "public"."tenants"."primary_color" IS 'Color primario de la marca (hex)';



COMMENT ON COLUMN "public"."tenants"."contact_email" IS 'Email de contacto público';



COMMENT ON COLUMN "public"."tenants"."contact_phone" IS 'Teléfono de contacto público';



COMMENT ON COLUMN "public"."tenants"."address" IS 'Dirección física de la barbería';



COMMENT ON COLUMN "public"."tenants"."portal_url" IS 'URL del portal público de reservas (/r/[slug])';



COMMENT ON COLUMN "public"."tenants"."stripe_account_id" IS 'ID de cuenta Stripe Connect asociada al tenant para procesar pagos.';



COMMENT ON COLUMN "public"."tenants"."stripe_onboarding_status" IS 'Estado del onboarding: pending, completed, restricted, disabled';



COMMENT ON COLUMN "public"."tenants"."stripe_charges_enabled" IS 'Indica si la cuenta Stripe puede recibir pagos';



COMMENT ON COLUMN "public"."tenants"."stripe_payouts_enabled" IS 'Indica si la cuenta Stripe puede recibir payouts';



COMMENT ON COLUMN "public"."tenants"."public_subdomain" IS 'Subdominio público del portal de reservas del tenant (por ejemplo: barberia-x.bookfast.es).';



COMMENT ON CONSTRAINT "tenants_timezone_check" ON "public"."tenants" IS 'Valida que timezone no sea null y tenga longitud válida. PostgreSQL valida que sea un timezone válido.';



CREATE TABLE IF NOT EXISTS "public"."user_display_names" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "viewer_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "custom_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_display_names" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_display_names" IS 'Apodos o nombres personalizados que un usuario asigna a otros usuarios dentro del sistema.';



COMMENT ON COLUMN "public"."user_display_names"."custom_name" IS 'Nombre personalizado que viewer_user_id ve para target_user_id';



CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "permissions" "jsonb" DEFAULT '{"staff": false, "agenda": true, "ajustes": false, "clientes": true, "reportes": true, "dashboard": true, "marketing": false, "servicios": true}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_permissions" IS 'Permisos finos por usuario dentro de un tenant, extendiendo la funcionalidad de memberships.';



COMMENT ON COLUMN "public"."user_permissions"."permissions" IS 'Permisos JSON: dashboard, agenda, clientes, servicios, staff, marketing, reportes, ajustes';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'LEGACY: evitar uso. Emplear auth.users + public.profiles + public.memberships. Bloqueado por RLS.';



CREATE OR REPLACE VIEW "public"."vw_booking_overview" AS
 SELECT "b"."id" AS "booking_id",
    "b"."tenant_id",
    "t"."slug" AS "tenant_slug",
    "t"."name" AS "tenant_name",
    "s"."id" AS "service_id",
    "s"."name" AS "service_name",
    "s"."duration_min" AS "service_duration_minutes",
    COALESCE("s"."buffer_min", 5) AS "buffer_minutes",
    "s"."price_cents",
    "s"."deposit_enabled",
    "s"."deposit_amount",
    "s"."deposit_percent",
    "s"."deposit_type",
    "st"."id" AS "staff_id",
    "st"."display_name" AS "staff_name",
    "c"."id" AS "customer_id",
    "c"."name" AS "customer_name",
    "b"."starts_at",
    ("b"."starts_at" + (("s"."duration_min" || ' minutes'::"text"))::interval) AS "booking_end",
    "b"."status" AS "booking_status"
   FROM (((("public"."bookings" "b"
     JOIN "public"."tenants" "t" ON (("t"."id" = "b"."tenant_id")))
     JOIN "public"."services" "s" ON (("s"."id" = "b"."service_id")))
     JOIN "public"."staff" "st" ON (("st"."id" = "b"."staff_id")))
     JOIN "public"."customers" "c" ON (("c"."id" = "b"."customer_id")))
  WHERE ("b"."status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'completed'::"text", 'cancelled'::"text"]));


ALTER VIEW "public"."vw_booking_overview" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."vw_booking_overview_mat" AS
 SELECT "b"."id" AS "booking_id",
    "b"."tenant_id",
    "b"."service_id",
    "b"."staff_id",
    "b"."customer_id",
    "b"."status",
    "b"."starts_at",
    "b"."ends_at",
    "sum"("p"."amount") AS "total_price"
   FROM ("public"."bookings" "b"
     LEFT JOIN "public"."payments" "p" ON (("p"."booking_id" = "b"."id")))
  GROUP BY "b"."id", "b"."tenant_id", "b"."service_id", "b"."staff_id", "b"."customer_id", "b"."status", "b"."starts_at", "b"."ends_at"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."vw_booking_overview_mat" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."vw_customer_summary" AS
 SELECT "bookings"."customer_id",
    "count"(*) AS "total_bookings",
    "sum"("customers"."total_spent_cents") AS "total_spent"
   FROM ("public"."bookings"
     JOIN "public"."customers" ON (("bookings"."customer_id" = "customers"."id")))
  GROUP BY "bookings"."customer_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."vw_customer_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_payments_overview" AS
 SELECT "p"."id" AS "payment_id",
    "p"."tenant_id",
    "t"."slug" AS "tenant_slug",
    "t"."name" AS "tenant_name",
    "p"."created_at" AS "payment_created_at",
    "p"."updated_at" AS "payment_updated_at",
    "p"."status" AS "payment_status",
    "p"."balance_status",
    ("p"."status" = 'succeeded'::"text") AS "is_paid",
    ("p"."status" = 'refunded'::"text") AS "is_refund",
    ("p"."balance_status" = 'pending'::"text") AS "is_payout_pending",
    ("p"."balance_status" = 'available'::"text") AS "is_payout_available",
    ("p"."balance_status" = 'paid_out'::"text") AS "is_payout_completed",
    "p"."total_price" AS "amount_total",
    "p"."deposit" AS "amount_deposit",
    "p"."amount" AS "amount_original",
    "p"."stripe_payment_intent_id",
    "p"."stripe_charge_id",
    "p"."stripe_session_id",
    "b"."id" AS "booking_id",
    "b"."status" AS "booking_status",
    "b"."starts_at" AS "booking_starts_at",
    "b"."updated_at" AS "booking_updated_at",
    ("b"."status" = 'completed'::"text") AS "is_booking_completed",
    "st"."id" AS "staff_id",
    "st"."display_name" AS "staff_name",
    "c"."id" AS "customer_id",
    "c"."name" AS "customer_name",
    "c"."phone" AS "customer_phone",
    "c"."email" AS "customer_email",
    "s"."id" AS "service_id",
    "s"."name" AS "service_name",
    "s"."category" AS "service_category",
    "s"."duration_min" AS "service_duration",
    "s"."price_cents" AS "service_price_cents",
        CASE
            WHEN ("p"."status" = 'succeeded'::"text") THEN 'income'::"text"
            WHEN ("p"."status" = 'refunded'::"text") THEN 'refund'::"text"
            WHEN ("p"."status" = 'pending'::"text") THEN 'awaiting_payment'::"text"
            WHEN ("p"."status" = 'failed'::"text") THEN 'failed_payment'::"text"
            ELSE 'other'::"text"
        END AS "revenue_category"
   FROM ((((("public"."payments" "p"
     LEFT JOIN "public"."tenants" "t" ON (("t"."id" = "p"."tenant_id")))
     LEFT JOIN "public"."bookings" "b" ON (("b"."id" = "p"."booking_id")))
     LEFT JOIN "public"."staff" "st" ON (("st"."id" = "b"."staff_id")))
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "b"."customer_id")))
     LEFT JOIN "public"."services" "s" ON (("s"."id" = "b"."service_id")));


ALTER VIEW "public"."vw_payments_overview" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_staff_slots" AS
 WITH "base" AS (
         SELECT "s"."id" AS "staff_id",
            "s"."tenant_id",
            "s"."display_name",
            "ss"."day_of_week",
            "ss"."start_time",
            "ss"."end_time",
            COALESCE("ts"."default_service_duration", 30) AS "slot_minutes"
           FROM (("public"."staff" "s"
             JOIN "public"."staff_schedules" "ss" ON ((("ss"."staff_id" = "s"."id") AND ("ss"."tenant_id" = "s"."tenant_id"))))
             LEFT JOIN "public"."tenant_settings" "ts" ON (("ts"."tenant_id" = "s"."tenant_id")))
          WHERE (("s"."active" = true) AND ("ss"."is_active" = true))
        ), "expanded" AS (
         SELECT "b"."staff_id",
            "b"."tenant_id",
            "b"."display_name",
            "b"."day_of_week",
            "tr"."slot_start",
            "tr"."slot_end"
           FROM ("base" "b"
             CROSS JOIN LATERAL "public"."generate_time_range"("b"."start_time", "b"."end_time", "b"."slot_minutes") "tr"("slot_start", "slot_end"))
        ), "blockings" AS (
         SELECT "sb"."staff_id",
            "sb"."tenant_id",
            ("sb"."start_at")::"date" AS "block_date",
            ("sb"."start_at")::time without time zone AS "block_start",
            ("sb"."end_at")::time without time zone AS "block_end"
           FROM "public"."staff_blockings" "sb"
        )
 SELECT "staff_id",
    "tenant_id",
    "display_name",
    "day_of_week",
    "slot_start",
    "slot_end",
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM "blockings" "bl"
              WHERE (("bl"."staff_id" = "e"."staff_id") AND ("bl"."tenant_id" = "e"."tenant_id") AND ("bl"."block_start" <= "e"."slot_end") AND ("bl"."block_end" >= "e"."slot_start")))) THEN false
            ELSE true
        END AS "is_available"
   FROM "expanded" "e"
  ORDER BY "staff_id", "day_of_week", "slot_start";


ALTER VIEW "public"."vw_staff_slots" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_staff_slots_real" AS
 WITH "real_bookings" AS (
         SELECT "b"."staff_id",
            "b"."tenant_id",
            ("b"."starts_at")::time without time zone AS "booking_start",
            ((("b"."starts_at" + ((COALESCE("s"."duration_min", 30) || ' minutes'::"text"))::interval) + ((COALESCE("s"."buffer_min", 0) || ' minutes'::"text"))::interval))::time without time zone AS "booking_end"
           FROM ("public"."bookings" "b"
             LEFT JOIN "public"."services" "s" ON (("s"."id" = "b"."service_id")))
          WHERE ("b"."status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'completed'::"text"]))
        ), "slots" AS (
         SELECT "s"."staff_id",
            "s"."tenant_id",
            "s"."display_name",
            "s"."day_of_week",
            "s"."slot_start",
            "s"."slot_end",
            "s"."is_available"
           FROM "public"."vw_staff_slots" "s"
        )
 SELECT "staff_id",
    "tenant_id",
    "display_name",
    "day_of_week",
    "slot_start",
    "slot_end",
        CASE
            WHEN ("is_available" = false) THEN false
            WHEN (EXISTS ( SELECT 1
               FROM "real_bookings" "rb"
              WHERE (("rb"."staff_id" = "sl"."staff_id") AND ("rb"."tenant_id" = "sl"."tenant_id") AND ("rb"."booking_start" <= "sl"."slot_end") AND ("rb"."booking_end" >= "sl"."slot_start")))) THEN false
            ELSE true
        END AS "is_free"
   FROM "slots" "sl"
  ORDER BY "staff_id", "day_of_week", "slot_start";


ALTER VIEW "public"."vw_staff_slots_real" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_public_availability" AS
 SELECT "t"."id" AS "tenant_id",
    "t"."slug" AS "tenant_slug",
    "t"."name" AS "tenant_name",
    "st"."staff_id",
    "st"."display_name" AS "staff_name",
    "srv"."id" AS "service_id",
    "srv"."name" AS "service_name",
    "srv"."category" AS "service_category",
    "srv"."duration_min" AS "duration_minutes",
    "srv"."buffer_min" AS "buffer_minutes",
    "srv"."price_cents",
    "srv"."deposit_enabled",
    "srv"."deposit_amount",
    "srv"."deposit_percent",
    "srv"."deposit_type",
    "srv"."online_payment_required",
    "st"."day_of_week",
    "st"."slot_start",
    "st"."slot_end",
    "st"."is_free" AS "is_available",
    ("st"."slot_start" + (("srv"."duration_min" || ' minutes'::"text"))::interval) AS "service_end_time"
   FROM (((("public"."vw_staff_slots_real" "st"
     JOIN "public"."staff" "s" ON ((("s"."id" = "st"."staff_id") AND ("s"."tenant_id" = "st"."tenant_id") AND ("s"."active" = true))))
     JOIN "public"."staff_provides_services" "sps" ON ((("sps"."staff_id" = "s"."id") AND ("sps"."tenant_id" = "s"."tenant_id"))))
     JOIN "public"."services" "srv" ON ((("srv"."id" = "sps"."service_id") AND ("srv"."active" = true) AND ("srv"."tenant_id" = "sps"."tenant_id"))))
     JOIN "public"."tenants" "t" ON (("t"."id" = "st"."tenant_id")))
  WHERE ("st"."is_free" = true)
  ORDER BY "t"."slug", "st"."staff_id", "st"."day_of_week", "st"."slot_start";


ALTER VIEW "public"."vw_public_availability" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_public_services" AS
 SELECT "s"."id" AS "service_id",
    "s"."tenant_id",
    "t"."slug" AS "tenant_slug",
    "s"."name" AS "service_name",
    "s"."category",
    "s"."duration_min" AS "duration_minutes",
    "s"."buffer_min" AS "buffer_minutes",
    "s"."price_cents",
    "s"."pricing_levels",
    "s"."deposit_enabled",
    "s"."deposit_amount",
    "s"."deposit_percent",
    "s"."deposit_type",
    "s"."online_payment_required",
    "s"."stripe_product_id",
    "s"."stripe_price_id",
    "s"."active",
    "s"."created_at",
    "s"."updated_at",
    "ts"."default_service_duration",
    "ts"."business_open_time",
    "ts"."business_close_time"
   FROM (("public"."services" "s"
     JOIN "public"."tenants" "t" ON (("t"."id" = "s"."tenant_id")))
     LEFT JOIN "public"."tenant_settings" "ts" ON (("ts"."tenant_id" = "s"."tenant_id")))
  WHERE ("s"."active" = true);


ALTER VIEW "public"."vw_public_services" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_staff_availability" AS
 WITH "base" AS (
         SELECT "s"."id" AS "staff_id",
            "s"."tenant_id",
            "s"."display_name",
            "ss"."day_of_week",
            "ss"."start_time",
            "ss"."end_time",
            "s"."active",
            "ss"."is_active"
           FROM ("public"."staff" "s"
             JOIN "public"."staff_schedules" "ss" ON ((("ss"."staff_id" = "s"."id") AND ("ss"."tenant_id" = "s"."tenant_id"))))
          WHERE (("s"."active" = true) AND ("ss"."is_active" = true))
        ), "blockings" AS (
         SELECT "sb"."staff_id",
            "sb"."tenant_id",
            ("sb"."start_at")::"date" AS "block_date",
            ("sb"."start_at")::time without time zone AS "block_start",
            ("sb"."end_at")::time without time zone AS "block_end"
           FROM "public"."staff_blockings" "sb"
        )
 SELECT "b"."staff_id",
    "b"."tenant_id",
    "b"."display_name",
    "b"."day_of_week",
    "b"."start_time" AS "schedule_start",
    "b"."end_time" AS "schedule_end",
    "bl"."block_date",
    "bl"."block_start",
    "bl"."block_end",
    "b"."active",
    "b"."is_active"
   FROM ("base" "b"
     LEFT JOIN "blockings" "bl" ON ((("bl"."staff_id" = "b"."staff_id") AND ("bl"."tenant_id" = "b"."tenant_id"))))
  ORDER BY "b"."staff_id", "b"."day_of_week", "b"."start_time";


ALTER VIEW "public"."vw_staff_availability" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_staff_overview" AS
 WITH "service_counts" AS (
         SELECT "sps"."staff_id",
            "count"(*) AS "services_count"
           FROM "public"."staff_provides_services" "sps"
          GROUP BY "sps"."staff_id"
        ), "upcoming_bookings" AS (
         SELECT "b"."staff_id",
            "count"(*) AS "upcoming_count"
           FROM "public"."bookings" "b"
          WHERE (("b"."starts_at" >= "now"()) AND ("b"."status" = ANY (ARRAY['pending'::"text", 'paid'::"text"])))
          GROUP BY "b"."staff_id"
        ), "revenue_stats" AS (
         SELECT "b"."staff_id",
            COALESCE("sum"("p"."total_price"), (0)::numeric) AS "total_revenue"
           FROM ("public"."payments" "p"
             JOIN "public"."bookings" "b" ON (("b"."id" = "p"."booking_id")))
          WHERE ("p"."status" = 'succeeded'::"text")
          GROUP BY "b"."staff_id"
        ), "last_booking" AS (
         SELECT "b"."staff_id",
            "max"("b"."starts_at") AS "last_booking_at"
           FROM "public"."bookings" "b"
          GROUP BY "b"."staff_id"
        )
 SELECT "s"."id" AS "staff_id",
    "s"."tenant_id",
    "t"."name" AS "tenant_name",
    "s"."display_name",
    "s"."user_id",
    "s"."provides_services",
    "s"."active",
    "s"."bio",
    COALESCE("sc"."services_count", (0)::bigint) AS "services_count",
    COALESCE("ub"."upcoming_count", (0)::bigint) AS "upcoming_bookings_count",
    COALESCE("rs"."total_revenue", (0)::numeric) AS "total_revenue",
    "lb"."last_booking_at",
    "s"."created_at",
    "s"."updated_at"
   FROM ((((("public"."staff" "s"
     LEFT JOIN "public"."tenants" "t" ON (("t"."id" = "s"."tenant_id")))
     LEFT JOIN "service_counts" "sc" ON (("sc"."staff_id" = "s"."id")))
     LEFT JOIN "upcoming_bookings" "ub" ON (("ub"."staff_id" = "s"."id")))
     LEFT JOIN "revenue_stats" "rs" ON (("rs"."staff_id" = "s"."id")))
     LEFT JOIN "last_booking" "lb" ON (("lb"."staff_id" = "s"."id")));


ALTER VIEW "public"."vw_staff_overview" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."vw_staff_overview_mat" AS
 SELECT "s"."id" AS "staff_id",
    "s"."tenant_id",
    "count"("b"."id") AS "total_bookings",
    "sum"("p"."amount") AS "total_revenue"
   FROM (("public"."staff" "s"
     LEFT JOIN "public"."bookings" "b" ON (("b"."staff_id" = "s"."id")))
     LEFT JOIN "public"."payments" "p" ON (("p"."booking_id" = "b"."id")))
  GROUP BY "s"."id", "s"."tenant_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."vw_staff_overview_mat" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_tenant_business_rules" AS
 SELECT "t"."id" AS "tenant_id",
    "t"."slug" AS "tenant_slug",
    "t"."name" AS "tenant_name",
    "t"."timezone",
    COALESCE("ts"."business_open_time", '10:00:00'::time without time zone) AS "business_open_time",
    COALESCE("ts"."business_close_time", '20:00:00'::time without time zone) AS "business_close_time",
    "ts"."no_show_cancellation_hours",
    "ts"."no_show_protection_mode",
    "ts"."no_show_protection_percentage",
    "ts"."default_service_duration",
    true AS "is_config_complete"
   FROM ("public"."tenants" "t"
     LEFT JOIN "public"."tenant_settings" "ts" ON (("ts"."tenant_id" = "t"."id")));


ALTER VIEW "public"."vw_tenant_business_rules" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



CREATE MATERIALIZED VIEW "public"."vw_customer_summary_mat" AS
 SELECT "c"."id" AS "customer_id",
    "c"."tenant_id",
    "c"."name" AS "customer_name",
    "c"."phone" AS "customer_phone",
    "count"("b"."id") AS "total_bookings",
    "sum"("p"."amount") AS "total_spent"
   FROM (("public"."customers" "c"
     LEFT JOIN "public"."bookings" "b" ON (("b"."customer_id" = "c"."id")))
     LEFT JOIN "public"."payments" "p" ON (("p"."booking_id" = "b"."id")))
  GROUP BY "c"."id", "c"."tenant_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."vw_customer_summary_mat" OWNER TO "postgres";


ALTER TABLE ONLY "platform"."admin_sessions"
    ADD CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_permissions"
    ADD CONSTRAINT "platform_permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "platform"."platform_permissions"
    ADD CONSTRAINT "platform_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_roles"
    ADD CONSTRAINT "platform_roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "platform"."platform_roles"
    ADD CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_users"
    ADD CONSTRAINT "platform_users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "platform"."platform_users"
    ADD CONSTRAINT "platform_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "platform"."platform_users"
    ADD CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "platform"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_no_overlap" EXCLUDE USING "gist" ("tenant_id" WITH =, "staff_id" WITH =, "slot" WITH &&) WHERE (("status" = 'confirmed'::"text"));



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_login_requests"
    ADD CONSTRAINT "auth_login_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_logs"
    ADD CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_payment_intent_unique" UNIQUE ("payment_intent_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_tenant_id_staff_id_starts_at_key" UNIQUE ("tenant_id", "staff_id", "starts_at");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_unique_appointment" UNIQUE ("appointment_id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_tenant_id_metric_date_key" UNIQUE ("tenant_id", "metric_date");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "excl_staff_overlap_bookings" EXCLUDE USING "gist" ("tenant_id" WITH =, "staff_id" WITH =, "slot" WITH &&) WHERE (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text"])));



COMMENT ON CONSTRAINT "excl_staff_overlap_bookings" ON "public"."bookings" IS 'Prohíbe solapes de tiempo para un mismo tenant_id + staff_id en estados pending o paid. Usa EXCLUDE con GIST. Incluye tenant_id para aislamiento multi-tenant.';



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."org_metrics_daily"
    ADD CONSTRAINT "org_metrics_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_metrics_daily"
    ADD CONSTRAINT "org_metrics_daily_tenant_id_metric_date_key" UNIQUE ("tenant_id", "metric_date");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "orgs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."platform_users"
    ADD CONSTRAINT "platform_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."platform_users"
    ADD CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_blockings"
    ADD CONSTRAINT "staff_blockings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_provides_services"
    ADD CONSTRAINT "staff_provides_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_provides_services"
    ADD CONSTRAINT "staff_provides_services_tenant_id_staff_id_service_id_key" UNIQUE ("tenant_id", "staff_id", "service_id");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_unique_interval" UNIQUE ("tenant_id", "staff_id", "day_of_week", "start_time", "end_time");



ALTER TABLE ONLY "public"."stripe_events_processed"
    ADD CONSTRAINT "stripe_events_processed_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."system_events"
    ADD CONSTRAINT "system_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_conversation_members"
    ADD CONSTRAINT "team_conversation_members_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."team_conversations"
    ADD CONSTRAINT "team_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_messages_archive"
    ADD CONSTRAINT "team_messages_archive_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_messages"
    ADD CONSTRAINT "team_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "unique_email_per_tenant" UNIQUE ("tenant_id", "email");



ALTER TABLE ONLY "public"."user_display_names"
    ADD CONSTRAINT "user_display_names_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_display_names"
    ADD CONSTRAINT "user_display_names_viewer_user_id_target_user_id_key" UNIQUE ("viewer_user_id", "target_user_id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey1" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_logs_action" ON "platform"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "platform"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_impersonated_by" ON "platform"."audit_logs" USING "btree" ("impersonated_by");



CREATE INDEX "idx_audit_logs_resource" ON "platform"."audit_logs" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "idx_audit_logs_tenant_id" ON "platform"."audit_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_audit_logs_user_id" ON "platform"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_platform_users_auth_user_id" ON "platform"."platform_users" USING "btree" ("auth_user_id");



CREATE INDEX "idx_platform_users_email" ON "platform"."platform_users" USING "btree" ("email");



CREATE INDEX "appointments_tenant_starts_idx" ON "public"."appointments" USING "btree" ("tenant_id", "starts_at");



CREATE INDEX "bookings_appointment_id_idx" ON "public"."bookings" USING "btree" ("appointment_id");



CREATE INDEX "bookings_tenant_id_customer_id_idx" ON "public"."bookings" USING "btree" ("tenant_id", "customer_id");



CREATE INDEX "bookings_tenant_id_starts_at_status_idx" ON "public"."bookings" USING "btree" ("tenant_id", "starts_at", "status");



CREATE INDEX "bookings_tenant_starts_idx" ON "public"."bookings" USING "btree" ("tenant_id", "starts_at");



CREATE INDEX "chat_messages_tenant_created_idx" ON "public"."chat_messages" USING "btree" ("tenant_id", "created_at" DESC);



CREATE UNIQUE INDEX "customers_tenant_email_lower_uniq" ON "public"."customers" USING "btree" ("tenant_id", "lower"("email")) WHERE (("email" IS NOT NULL) AND ("email" <> ''::"text"));



CREATE INDEX "customers_tenant_name_email_idx" ON "public"."customers" USING "btree" ("tenant_id", "lower"("name"), "lower"("email"));



CREATE INDEX "idx_appointments_customer_id" ON "public"."appointments" USING "btree" ("customer_id");



CREATE INDEX "idx_appointments_hold_expires" ON "public"."appointments" USING "btree" ("expires_at") WHERE (("status" = 'hold'::"text") AND ("expires_at" IS NOT NULL));



CREATE INDEX "idx_appt_hold_exp" ON "public"."appointments" USING "btree" ("expires_at") WHERE ("status" = 'hold'::"text");



CREATE INDEX "idx_auth_login_requests_created_at" ON "public"."auth_login_requests" USING "btree" ("created_at");



CREATE INDEX "idx_auth_login_requests_email" ON "public"."auth_login_requests" USING "btree" ("email");



CREATE INDEX "idx_auth_login_requests_secret_token" ON "public"."auth_login_requests" USING "btree" ("secret_token");



CREATE INDEX "idx_auth_login_requests_status" ON "public"."auth_login_requests" USING "btree" ("status");



CREATE INDEX "idx_auth_logs_user_created_at" ON "public"."auth_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_blockings_staff_dates" ON "public"."staff_blockings" USING "btree" ("staff_id", "start_at", "end_at");



COMMENT ON INDEX "public"."idx_blockings_staff_dates" IS 'Índice para bloqueos de un staff member en un rango de fechas.
Optimiza vista de calendario y disponibilidad.';



CREATE INDEX "idx_blockings_tenant_dates" ON "public"."staff_blockings" USING "btree" ("tenant_id", "start_at" DESC);



COMMENT ON INDEX "public"."idx_blockings_tenant_dates" IS 'Índice para todos los bloqueos de un tenant.
Útil para vista administrativa de bloqueos.';



CREATE INDEX "idx_bookings_customer_tenant" ON "public"."bookings" USING "btree" ("customer_id", "tenant_id", "starts_at" DESC) WHERE ("customer_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_bookings_customer_tenant" IS 'Índice para historial de reservas de un cliente.
Optimiza página de detalle del cliente.';



CREATE INDEX "idx_bookings_customer_time" ON "public"."bookings" USING "btree" ("customer_id", "starts_at", "ends_at");



CREATE INDEX "idx_bookings_hold_expires" ON "public"."bookings" USING "btree" ("tenant_id", "starts_at", "expires_at") WHERE (("status" = 'pending'::"text") AND ("expires_at" IS NOT NULL));



CREATE INDEX "idx_bookings_revenue" ON "public"."bookings" USING "btree" ("tenant_id", "starts_at" DESC) INCLUDE ("service_id", "status") WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'completed'::"text", 'paid'::"text"]));



COMMENT ON INDEX "public"."idx_bookings_revenue" IS 'Índice covering para cálculos de ingresos.
Incluye service_id y status para evitar accesos adicionales a la tabla.';



CREATE INDEX "idx_bookings_service_date" ON "public"."bookings" USING "btree" ("service_id", "starts_at" DESC) WHERE (("service_id" IS NOT NULL) AND ("status" = ANY (ARRAY['confirmed'::"text", 'completed'::"text", 'paid'::"text"])));



COMMENT ON INDEX "public"."idx_bookings_service_date" IS 'Índice para análisis de servicios más populares.
Solo incluye reservas completadas/confirmadas.';



CREATE INDEX "idx_bookings_staff_date" ON "public"."bookings" USING "btree" ("staff_id", "starts_at" DESC) WHERE (("staff_id" IS NOT NULL) AND ("status" <> 'cancelled'::"text"));



COMMENT ON INDEX "public"."idx_bookings_staff_date" IS 'Índice para búsquedas de reservas por staff member y fecha.
Optimiza vista de agenda por empleado.';



CREATE INDEX "idx_bookings_staff_id" ON "public"."bookings" USING "btree" ("staff_id");



CREATE INDEX "idx_bookings_staff_slot_gist" ON "public"."bookings" USING "gist" ("tenant_id", "staff_id", "slot");



CREATE INDEX "idx_bookings_tenant_date_status" ON "public"."bookings" USING "btree" ("tenant_id", "starts_at" DESC, "status") WHERE ("status" <> 'cancelled'::"text");



COMMENT ON INDEX "public"."idx_bookings_tenant_date_status" IS 'Índice principal para búsquedas de reservas por tenant, fecha y estado.
Excluye reservas canceladas para optimizar queries comunes.';



CREATE INDEX "idx_bookings_tenant_staff_status" ON "public"."bookings" USING "btree" ("tenant_id", "staff_id", "status");



CREATE INDEX "idx_bookings_tenant_staff_time" ON "public"."bookings" USING "btree" ("tenant_id", "staff_id", "starts_at", "status") WHERE ("status" = ANY (ARRAY['paid'::"text", 'completed'::"text", 'pending'::"text"]));



CREATE INDEX "idx_bookings_tenant_starts_staff_status" ON "public"."bookings" USING "btree" ("tenant_id", "starts_at", "staff_id", "status");



CREATE INDEX "idx_bookings_tenant_starts_status" ON "public"."bookings" USING "btree" ("tenant_id", "starts_at", "status");



CREATE INDEX "idx_chat_messages_created_at" ON "public"."chat_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chat_messages_recipient_id" ON "public"."chat_messages" USING "btree" ("recipient_id");



CREATE INDEX "idx_chat_messages_sender_id" ON "public"."chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_chat_messages_tenant_id" ON "public"."chat_messages" USING "btree" ("tenant_id");



CREATE INDEX "idx_chat_messages_tenant_recipient" ON "public"."chat_messages" USING "btree" ("tenant_id", "recipient_id");



CREATE INDEX "idx_conversation_members_unread" ON "public"."team_conversation_members" USING "btree" ("user_id", "conversation_id") WHERE ("last_read_at" IS NULL);



COMMENT ON INDEX "public"."idx_conversation_members_unread" IS 'Índice para conversaciones no leídas por usuario.
Optimiza contador de notificaciones del chat.';



CREATE INDEX "idx_conversations_tenant" ON "public"."team_conversations" USING "btree" ("tenant_id", "updated_at" DESC);



COMMENT ON INDEX "public"."idx_conversations_tenant" IS 'Índice para listado de conversaciones ordenadas por actividad.
Optimiza carga de sidebar del chat.';



CREATE INDEX "idx_customers_last_call_status" ON "public"."customers" USING "btree" ("last_call_status") WHERE ("last_call_status" IS NOT NULL);



CREATE INDEX "idx_customers_name_trgm" ON "public"."customers" USING "gin" ("name" "public"."gin_trgm_ops");



COMMENT ON INDEX "public"."idx_customers_name_trgm" IS 'Índice trigram para búsqueda fuzzy de clientes por nombre.
Requiere extensión pg_trgm.';



CREATE INDEX "idx_customers_next_due_date" ON "public"."customers" USING "btree" ("next_due_date") WHERE ("next_due_date" IS NOT NULL);



CREATE INDEX "idx_customers_preferred_staff" ON "public"."customers" USING "btree" ("preferred_staff_id") WHERE ("preferred_staff_id" IS NOT NULL);



CREATE INDEX "idx_customers_tenant_email" ON "public"."customers" USING "btree" ("tenant_id", "email") WHERE ("email" IS NOT NULL);



COMMENT ON INDEX "public"."idx_customers_tenant_email" IS 'Índice para búsqueda de clientes por email.
Optimiza detección de duplicados.';



CREATE INDEX "idx_customers_tenant_phone" ON "public"."customers" USING "btree" ("tenant_id", "phone") WHERE ("phone" IS NOT NULL);



COMMENT ON INDEX "public"."idx_customers_tenant_phone" IS 'Índice para búsqueda de clientes por teléfono.
Útil para identificación rápida en llamadas.';



CREATE INDEX "idx_daily_metrics_date" ON "public"."daily_metrics" USING "btree" ("metric_date" DESC);



CREATE INDEX "idx_daily_metrics_tenant_date" ON "public"."daily_metrics" USING "btree" ("tenant_id", "metric_date" DESC);



CREATE INDEX "idx_memberships_tenant_role" ON "public"."memberships" USING "btree" ("tenant_id", "role");



COMMENT ON INDEX "public"."idx_memberships_tenant_role" IS 'Índice para miembros de un tenant agrupados por rol.
Optimiza gestión de equipo.';



CREATE INDEX "idx_memberships_user" ON "public"."memberships" USING "btree" ("user_id", "tenant_id");



COMMENT ON INDEX "public"."idx_memberships_user" IS 'Índice para membresías de un usuario.
Optimiza autenticación multi-tenant.';



CREATE INDEX "idx_messages_archive_conversation" ON "public"."team_messages_archive" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_archive_sender" ON "public"."team_messages_archive" USING "btree" ("sender_id", "created_at" DESC);



CREATE INDEX "idx_messages_body_search" ON "public"."team_messages" USING "gin" ("to_tsvector"('"spanish"'::"regconfig", "body")) WHERE ("deleted_at" IS NULL);



COMMENT ON INDEX "public"."idx_messages_body_search" IS 'Índice para búsqueda de texto completo en mensajes.
Usa diccionario español para mejor tokenización.';



CREATE INDEX "idx_messages_conversation_created" ON "public"."team_messages" USING "btree" ("conversation_id", "created_at" DESC);



COMMENT ON INDEX "public"."idx_messages_conversation_created" IS 'Índice para carga de mensajes de una conversación ordenados por fecha.
Optimiza paginación de mensajes.';



CREATE INDEX "idx_messages_sender_tenant" ON "public"."team_messages" USING "btree" ("sender_id", "tenant_id", "created_at" DESC);



COMMENT ON INDEX "public"."idx_messages_sender_tenant" IS 'Índice para mensajes enviados por un usuario.
Optimiza búsqueda de historial de mensajes por remitente.';



CREATE INDEX "idx_org_metrics_date" ON "public"."org_metrics_daily" USING "btree" ("metric_date" DESC);



CREATE INDEX "idx_org_metrics_webhook_events" ON "public"."org_metrics_daily" USING "btree" ("webhook_events_total", "webhook_events_failed");



CREATE INDEX "idx_payments_balance_status" ON "public"."payments" USING "btree" ("balance_status");



CREATE INDEX "idx_payments_booking" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "idx_payments_created" ON "public"."payments" USING "btree" ("created_at");



CREATE INDEX "idx_payments_service" ON "public"."payments" USING "btree" ("service_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_payments_stripe_charge" ON "public"."payments" USING "btree" ("stripe_charge_id");



CREATE INDEX "idx_payments_stripe_pi" ON "public"."payments" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "idx_payments_tenant" ON "public"."payments" USING "btree" ("tenant_id");



CREATE INDEX "idx_platform_users_email" ON "public"."platform_users" USING "btree" ("email");



CREATE INDEX "idx_schedules_staff_active" ON "public"."staff_schedules" USING "btree" ("staff_id", "day_of_week", "is_active") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."idx_schedules_staff_active" IS 'Índice para horarios activos de un staff member.
Optimiza cálculos de disponibilidad y ocupación.';



CREATE INDEX "idx_services_missing_price_id" ON "public"."services" USING "btree" ("tenant_id", "active") WHERE (("stripe_price_id" IS NULL) AND ("active" = true));



CREATE INDEX "idx_services_stripe" ON "public"."services" USING "btree" ("tenant_id", "stripe_product_id") WHERE ("stripe_product_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_services_stripe" IS 'Índice para servicios sincronizados con Stripe.
Optimiza verificación de estado de sincronización.';



CREATE INDEX "idx_services_stripe_price_id" ON "public"."services" USING "btree" ("stripe_price_id") WHERE ("stripe_price_id" IS NOT NULL);



CREATE INDEX "idx_services_tenant" ON "public"."services" USING "btree" ("tenant_id");



CREATE INDEX "idx_services_tenant_active" ON "public"."services" USING "btree" ("tenant_id", "active");



CREATE INDEX "idx_services_tenant_active_category" ON "public"."services" USING "btree" ("tenant_id", "active", "category", "name");



COMMENT ON INDEX "public"."idx_services_tenant_active_category" IS 'Índice para búsquedas de servicios con filtros comunes.
Soporta ordenamiento por nombre.';



CREATE INDEX "idx_services_tenant_price" ON "public"."services" USING "btree" ("tenant_id", "price_cents") WHERE ("active" = true);



COMMENT ON INDEX "public"."idx_services_tenant_price" IS 'Índice para búsquedas y filtros por rango de precio.
Solo incluye servicios activos.';



CREATE INDEX "idx_staff_blockings_date_range" ON "public"."staff_blockings" USING "btree" ("start_at", "end_at");



CREATE INDEX "idx_staff_blockings_tenant_staff_date" ON "public"."staff_blockings" USING "btree" ("tenant_id", "staff_id", "start_at");



CREATE INDEX "idx_staff_blockings_tenant_staff_time" ON "public"."staff_blockings" USING "btree" ("tenant_id", "staff_id", "start_at", "end_at");



CREATE INDEX "idx_staff_provides_services_active" ON "public"."staff" USING "btree" ("tenant_id", "provides_services", "active") WHERE (("provides_services" = true) AND ("active" = true));



CREATE INDEX "idx_staff_provides_services_composite" ON "public"."staff_provides_services" USING "btree" ("tenant_id", "staff_id", "service_id");



CREATE INDEX "idx_staff_provides_services_tenant_service" ON "public"."staff_provides_services" USING "btree" ("tenant_id", "service_id");



CREATE INDEX "idx_staff_provides_services_tenant_staff" ON "public"."staff_provides_services" USING "btree" ("tenant_id", "staff_id");



CREATE INDEX "idx_staff_schedules_day" ON "public"."staff_schedules" USING "btree" ("day_of_week");



CREATE INDEX "idx_staff_schedules_staff_id" ON "public"."staff_schedules" USING "btree" ("staff_id");



CREATE INDEX "idx_staff_schedules_tenant_id" ON "public"."staff_schedules" USING "btree" ("tenant_id");



CREATE INDEX "idx_staff_schedules_tenant_staff_day" ON "public"."staff_schedules" USING "btree" ("tenant_id", "staff_id", "day_of_week");



CREATE INDEX "idx_staff_tenant_active" ON "public"."staff" USING "btree" ("tenant_id", "active", "name") WHERE ("active" = true);



COMMENT ON INDEX "public"."idx_staff_tenant_active" IS 'Índice para listados de staff activo ordenado por nombre.
Usado en dropdowns y vistas de selección.';



CREATE INDEX "idx_staff_tenant_user" ON "public"."staff" USING "btree" ("tenant_id", "user_id");



CREATE INDEX "idx_staff_user" ON "public"."staff" USING "btree" ("user_id", "tenant_id") WHERE ("user_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_staff_user" IS 'Índice para encontrar staff asociado a un usuario.
Optimiza autenticación y gestión de permisos.';



CREATE INDEX "idx_stripe_events_created" ON "public"."stripe_events_processed" USING "btree" ("created_at");



CREATE INDEX "idx_stripe_events_processed_type_created" ON "public"."stripe_events_processed" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_stripe_events_type" ON "public"."stripe_events_processed" USING "btree" ("event_type");



CREATE INDEX "idx_system_events_severity" ON "public"."system_events" USING "btree" ("severity");



CREATE INDEX "idx_system_events_tenant" ON "public"."system_events" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_system_events_type" ON "public"."system_events" USING "btree" ("event_type");



CREATE INDEX "idx_team_conversation_members_conversation" ON "public"."team_conversation_members" USING "btree" ("conversation_id");



CREATE INDEX "idx_team_conversation_members_read" ON "public"."team_conversation_members" USING "btree" ("conversation_id", "last_read_at");



CREATE INDEX "idx_team_conversation_members_user" ON "public"."team_conversation_members" USING "btree" ("user_id");



CREATE INDEX "idx_team_conversations_tenant" ON "public"."team_conversations" USING "btree" ("tenant_id");



CREATE INDEX "idx_team_conversations_type" ON "public"."team_conversations" USING "btree" ("tenant_id", "type");



CREATE INDEX "idx_team_messages_conversation_created_at" ON "public"."team_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_team_messages_sender" ON "public"."team_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_team_messages_tenant_created_at" ON "public"."team_messages" USING "btree" ("tenant_id", "created_at");



CREATE INDEX "idx_tenant_id" ON "public"."bookings" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenants_stripe_account" ON "public"."tenants" USING "btree" ("stripe_account_id") WHERE ("stripe_account_id" IS NOT NULL);



CREATE INDEX "idx_tenants_timezone" ON "public"."tenants" USING "btree" ("timezone") WHERE ("timezone" IS NOT NULL);



CREATE INDEX "idx_user_display_names_target" ON "public"."user_display_names" USING "btree" ("target_user_id");



CREATE INDEX "idx_user_display_names_viewer" ON "public"."user_display_names" USING "btree" ("viewer_user_id");



CREATE INDEX "idx_user_permissions_tenant_id" ON "public"."user_permissions" USING "btree" ("tenant_id");



CREATE INDEX "idx_user_permissions_user_id" ON "public"."user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_user_permissions_user_tenant" ON "public"."user_permissions" USING "btree" ("user_id", "tenant_id");



CREATE INDEX "logs_action_created_at_idx" ON "public"."logs" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "logs_resource_type_resource_id_idx" ON "public"."logs" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "logs_tenant_id_created_at_idx" ON "public"."logs" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "logs_user_id_created_at_idx" ON "public"."logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "payment_intents_status_expires_at_idx" ON "public"."payment_intents" USING "btree" ("status", "expires_at") WHERE ("status" = 'requires_payment'::"text");



CREATE INDEX "payment_intents_tenant_id_customer_id_idx" ON "public"."payment_intents" USING "btree" ("tenant_id", "customer_id");



CREATE INDEX "payment_intents_tenant_id_service_id_idx" ON "public"."payment_intents" USING "btree" ("tenant_id", "service_id");



CREATE INDEX "payment_intents_tenant_id_status_idx" ON "public"."payment_intents" USING "btree" ("tenant_id", "status");



CREATE INDEX "staff_blockings_tenant_staff_time_idx" ON "public"."staff_blockings" USING "btree" ("tenant_id", "staff_id", "start_at", "end_at");



CREATE INDEX "team_messages_archive_conversation_id_created_at_idx" ON "public"."team_messages_archive" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "team_messages_archive_conversation_id_created_at_idx1" ON "public"."team_messages_archive" USING "btree" ("conversation_id", "created_at" DESC);



COMMENT ON INDEX "public"."team_messages_archive_conversation_id_created_at_idx1" IS 'Índice para carga de mensajes de una conversación ordenados por fecha.
Optimiza paginación de mensajes.';



CREATE INDEX "team_messages_archive_sender_id_idx" ON "public"."team_messages_archive" USING "btree" ("sender_id");



CREATE INDEX "team_messages_archive_sender_id_tenant_id_created_at_idx" ON "public"."team_messages_archive" USING "btree" ("sender_id", "tenant_id", "created_at" DESC);



COMMENT ON INDEX "public"."team_messages_archive_sender_id_tenant_id_created_at_idx" IS 'Índice para mensajes enviados por un usuario.
Optimiza búsqueda de historial de mensajes por remitente.';



CREATE INDEX "team_messages_archive_tenant_id_created_at_idx" ON "public"."team_messages_archive" USING "btree" ("tenant_id", "created_at");



CREATE UNIQUE INDEX "tenants_public_subdomain_unique_idx" ON "public"."tenants" USING "btree" ("public_subdomain") WHERE ("public_subdomain" IS NOT NULL);



CREATE UNIQUE INDEX "tenants_slug_lower_uniq" ON "public"."tenants" USING "btree" ("lower"("slug"));



CREATE UNIQUE INDEX "uq_team_conversations_default_all" ON "public"."team_conversations" USING "btree" ("tenant_id") WHERE (("type" = 'all'::"text") AND ("is_default" = true));



CREATE OR REPLACE TRIGGER "update_platform_users_updated_at" BEFORE UPDATE ON "platform"."platform_users" FOR EACH ROW EXECUTE FUNCTION "platform"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "bookings_set_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "chat_messages_updated_at" BEFORE UPDATE ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_messages_updated_at"();



CREATE OR REPLACE TRIGGER "customers_set_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payment_intents_updated_at" BEFORE UPDATE ON "public"."payment_intents" FOR EACH ROW EXECUTE FUNCTION "public"."update_payment_intents_updated_at"();



CREATE OR REPLACE TRIGGER "payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_payments_updated_at"();



CREATE OR REPLACE TRIGGER "services_set_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "staff_set_updated_at" BEFORE UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tenants_set_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_audit_bookings" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_services" AFTER INSERT OR DELETE OR UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_audit_tenant_settings" AFTER INSERT OR DELETE OR UPDATE ON "public"."tenant_settings" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_bookings_customer_stats" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_booking_customer_stats"();



CREATE OR REPLACE TRIGGER "trg_bookings_metrics" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."trg_bookings_update_metrics"();



CREATE OR REPLACE TRIGGER "trg_bookings_tenant_coherence" BEFORE INSERT OR UPDATE OF "appointment_id", "tenant_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_booking_tenant_matches_appointment"();



CREATE OR REPLACE TRIGGER "trg_bookings_update_metrics" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_daily_metrics"();



COMMENT ON TRIGGER "trg_bookings_update_metrics" ON "public"."bookings" IS 'Actualiza automáticamente daily_metrics cuando se crean/modifican/eliminan reservas.';



CREATE OR REPLACE TRIGGER "trg_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_customers_updated_at"();



CREATE OR REPLACE TRIGGER "trg_guard_paid_bookings" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."guard_paid_bookings"();



CREATE OR REPLACE TRIGGER "trg_normalize_tenant_slug" BEFORE INSERT OR UPDATE OF "slug" ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_tenant_slug"();



CREATE OR REPLACE TRIGGER "trg_payments_tenant_coherence" BEFORE INSERT OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_payment_tenant_matches_booking"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_team_conversations_touch" BEFORE UPDATE ON "public"."team_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."team_conversations_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_team_messages_bump_conversation" AFTER INSERT ON "public"."team_messages" FOR EACH ROW EXECUTE FUNCTION "public"."team_messages_bump_conversation"();



CREATE OR REPLACE TRIGGER "trg_team_messages_set_edited_at" BEFORE UPDATE ON "public"."team_messages" FOR EACH ROW EXECUTE FUNCTION "public"."team_messages_set_edited_at"();



CREATE OR REPLACE TRIGGER "trg_user_display_names_updated_at" BEFORE UPDATE ON "public"."user_display_names" FOR EACH ROW EXECUTE FUNCTION "public"."user_display_names_update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_audit_customer_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "platform"."audit_customer_changes"();



CREATE OR REPLACE TRIGGER "trigger_audit_service_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "platform"."audit_service_changes"();



CREATE OR REPLACE TRIGGER "trigger_audit_staff_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "platform"."audit_staff_changes"();



CREATE OR REPLACE TRIGGER "trigger_staff_provides_services_updated_at" BEFORE UPDATE ON "public"."staff_provides_services" FOR EACH ROW EXECUTE FUNCTION "public"."update_staff_provides_services_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_tenant_settings_updated_at" BEFORE UPDATE ON "public"."tenant_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_tenant_settings_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_permissions_updated_at" BEFORE UPDATE ON "public"."user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_permissions_updated_at"();



ALTER TABLE ONLY "platform"."admin_sessions"
    ADD CONSTRAINT "admin_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."platform_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."platform_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_users"
    ADD CONSTRAINT "platform_users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."platform_users"
    ADD CONSTRAINT "platform_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "platform"."platform_users"("id");



ALTER TABLE ONLY "platform"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "platform"."platform_permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform"."platform_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."user_roles"
    ADD CONSTRAINT "user_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "platform"."platform_users"("id");



ALTER TABLE ONLY "platform"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform"."platform_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."platform_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_org_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auth_logs"
    ADD CONSTRAINT "auth_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_org_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_preferred_staff_id_fkey" FOREIGN KEY ("preferred_staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "fk_appointments_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "fk_customer" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."staff_provides_services"
    ADD CONSTRAINT "fk_service" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "fk_service" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."staff_provides_services"
    ADD CONSTRAINT "fk_staff_services" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "fk_staff_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_metrics_daily"
    ADD CONSTRAINT "org_metrics_daily_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_users"
    ADD CONSTRAINT "platform_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_default_org_id_fkey" FOREIGN KEY ("default_org_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_org_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_blockings"
    ADD CONSTRAINT "staff_blockings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_blockings"
    ADD CONSTRAINT "staff_blockings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_blockings"
    ADD CONSTRAINT "staff_blockings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_org_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_provides_services"
    ADD CONSTRAINT "staff_provides_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_provides_services"
    ADD CONSTRAINT "staff_provides_services_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_provides_services"
    ADD CONSTRAINT "staff_provides_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."team_conversation_members"
    ADD CONSTRAINT "team_conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."team_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_conversation_members"
    ADD CONSTRAINT "team_conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_conversations"
    ADD CONSTRAINT "team_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_conversations"
    ADD CONSTRAINT "team_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_messages"
    ADD CONSTRAINT "team_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."team_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_messages"
    ADD CONSTRAINT "team_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_messages"
    ADD CONSTRAINT "team_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_display_names"
    ADD CONSTRAINT "user_display_names_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_display_names"
    ADD CONSTRAINT "user_display_names_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "platform"."admin_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_sessions_select" ON "platform"."admin_sessions" FOR SELECT USING ("platform"."is_platform_admin"("auth"."uid"()));



ALTER TABLE "platform"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_select" ON "platform"."audit_logs" FOR SELECT USING ("platform"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "audit_logs_select_tenant_members" ON "platform"."audit_logs" FOR SELECT USING ((("tenant_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."tenant_id" = "audit_logs"."tenant_id") AND ("memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "platform"."platform_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_permissions_select" ON "platform"."platform_permissions" FOR SELECT USING ("platform"."is_platform_admin"("auth"."uid"()));



ALTER TABLE "platform"."platform_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_roles_select" ON "platform"."platform_roles" FOR SELECT USING ("platform"."is_platform_admin"("auth"."uid"()));



ALTER TABLE "platform"."platform_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_users_select" ON "platform"."platform_users" FOR SELECT USING ("platform"."is_platform_admin"("auth"."uid"()));



ALTER TABLE "platform"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_permissions_select" ON "platform"."role_permissions" FOR SELECT USING ("platform"."is_platform_admin"("auth"."uid"()));



ALTER TABLE "platform"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_select" ON "platform"."user_roles" FOR SELECT USING ("platform"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all platform users" ON "public"."platform_users" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."platform_users" "platform_users_1"
  WHERE (("platform_users_1"."id" = "auth"."uid"()) AND ("platform_users_1"."role" = 'admin'::"text")))));



CREATE POLICY "Anyone can create login requests" ON "public"."auth_login_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Members can delete own messages" ON "public"."chat_messages" FOR DELETE TO "authenticated" USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "Members can send chat messages" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."tenant_id" = "chat_messages"."tenant_id") AND ("memberships"."user_id" = "auth"."uid"())))) AND ("sender_id" = "auth"."uid"()) AND (("recipient_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."tenant_id" = "chat_messages"."tenant_id") AND ("memberships"."user_id" = "chat_messages"."recipient_id")))))));



CREATE POLICY "Members can update own messages" ON "public"."chat_messages" FOR UPDATE TO "authenticated" USING (("sender_id" = "auth"."uid"())) WITH CHECK (("sender_id" = "auth"."uid"()));



CREATE POLICY "Members can view chat messages" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."tenant_id" = "chat_messages"."tenant_id") AND ("memberships"."user_id" = "auth"."uid"())))) AND (("recipient_id" IS NULL) OR ("sender_id" = "auth"."uid"()) OR ("recipient_id" = "auth"."uid"()))));



CREATE POLICY "Owners and admins can manage permissions" ON "public"."user_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."tenant_id" = "user_permissions"."tenant_id") AND ("memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Owners and admins can view all permissions in their tenant" ON "public"."user_permissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."tenant_id" = "user_permissions"."tenant_id") AND ("memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Platform users can view their own data" ON "public"."platform_users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can cancel own pending requests" ON "public"."auth_login_requests" FOR UPDATE USING ((("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text") AND ("status" = 'pending'::"text"))) WITH CHECK ((("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text") AND ("status" = 'cancelled'::"text") AND ("supabase_access_token" IS NULL) AND ("supabase_refresh_token" IS NULL)));



CREATE POLICY "Users can read own login requests without tokens" ON "public"."auth_login_requests" FOR SELECT USING ((("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text") AND ("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'expired'::"text", 'cancelled'::"text"]))));



CREATE POLICY "Users can view their own permissions" ON "public"."user_permissions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_delete_admin_owner" ON "public"."appointments" FOR DELETE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "appointments_insert_staff_admin_owner" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



CREATE POLICY "appointments_select_tenant_members" ON "public"."appointments" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "appointments_update_staff_admin_owner" ON "public"."appointments" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_login_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_delete_admin_owner" ON "public"."bookings" FOR DELETE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "bookings_insert_staff_admin_owner" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



CREATE POLICY "bookings_rls_policy" ON "public"."bookings" FOR SELECT USING (("tenant_id" = "app"."current_tenant_id"()));



CREATE POLICY "bookings_select_tenant_members" ON "public"."bookings" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "bookings_update_staff_admin_owner" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_messages_delete_admin_owner" ON "public"."chat_messages" FOR DELETE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "chat_messages_insert_staff_admin_owner" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



CREATE POLICY "chat_messages_select_tenant_members" ON "public"."chat_messages" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "chat_messages_update_staff_admin_owner" ON "public"."chat_messages" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_delete_admin_owner" ON "public"."customers" FOR DELETE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "customers_insert_staff_admin_owner" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



CREATE POLICY "customers_select_tenant_members" ON "public"."customers" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "customers_update_staff_admin_owner" ON "public"."customers" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



CREATE POLICY "deny_all_stripe_events_processed" ON "public"."stripe_events_processed" USING (false) WITH CHECK (false);



CREATE POLICY "insert_own_memberships" ON "public"."memberships" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_metrics_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_metrics_daily_select_tenant_members" ON "public"."org_metrics_daily" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



ALTER TABLE "public"."payment_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_intents_public_insert" ON "public"."payment_intents" FOR INSERT WITH CHECK (true);



CREATE POLICY "payment_intents_select_tenant_members" ON "public"."payment_intents" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "payment_intents_service_role_all" ON "public"."payment_intents" USING (((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK (((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "payment_intents_tenant_select" ON "public"."payment_intents" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_service_role_all" ON "public"."payments" USING (((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK (((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "payments_tenant_members_select" ON "public"."payments" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



ALTER TABLE "public"."platform_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_self" ON "public"."profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "public_read_services_active" ON "public"."services" FOR SELECT USING (("active" = true));



CREATE POLICY "select_own_memberships" ON "public"."memberships" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_delete_admin_owner" ON "public"."services" FOR DELETE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "services_insert_admin_owner" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "services_select_members" ON "public"."services" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "services_update_admin_owner" ON "public"."services" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_blockings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_blockings_delete_admin_owner" ON "public"."staff_blockings" FOR DELETE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "staff_blockings_insert_staff_admin_owner" ON "public"."staff_blockings" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



CREATE POLICY "staff_blockings_select_members" ON "public"."staff_blockings" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "staff_blockings_update_staff_admin_owner" ON "public"."staff_blockings" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text"]));



CREATE POLICY "staff_delete_admin_owner" ON "public"."staff" FOR DELETE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "staff_insert_admin_owner" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



ALTER TABLE "public"."staff_provides_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_schedules_admin_write" ON "public"."staff_schedules" TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "staff_schedules_select_members" ON "public"."staff_schedules" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "staff_select_tenant_members" ON "public"."staff" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "staff_update_admin_owner" ON "public"."staff" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



ALTER TABLE "public"."stripe_events_processed" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_events_insert_service_role" ON "public"."system_events" FOR INSERT WITH CHECK ((((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'role'::"text") = 'service_role'::"text") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "system_events_select_tenant" ON "public"."system_events" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" IN ( SELECT "memberships"."tenant_id"
   FROM "public"."memberships"
  WHERE ("memberships"."user_id" = "auth"."uid"())))));



CREATE POLICY "system_insert_audit_logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "system_insert_auth_logs" ON "public"."auth_logs" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."team_conversation_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_conversation_members_delete_admins" ON "public"."team_conversation_members" FOR DELETE TO "authenticated" USING ((("user_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversations" "tc"
  WHERE (("tc"."id" = "team_conversation_members"."conversation_id") AND (("tc"."created_by" = "auth"."uid"()) OR "public"."user_has_role_for_tenant"("tc"."tenant_id", ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "team_conversation_members_insert_admins" ON "public"."team_conversation_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversations" "tc"
  WHERE (("tc"."id" = "team_conversation_members"."conversation_id") AND (("tc"."created_by" = "auth"."uid"()) OR "public"."user_has_role_for_tenant"("tc"."tenant_id", ARRAY['owner'::"text", 'admin'::"text"]))))) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversation_members" "self"
  WHERE (("self"."conversation_id" = "self"."conversation_id") AND ("self"."user_id" = "auth"."uid"()))))));



CREATE POLICY "team_conversation_members_insert_self" ON "public"."team_conversation_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversations" "tc"
  WHERE (("tc"."id" = "team_conversation_members"."conversation_id") AND "public"."user_has_role_for_tenant"("tc"."tenant_id", NULL::"text"[]))))));



CREATE POLICY "team_conversation_members_select" ON "public"."team_conversation_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "team_conversation_members_update_admins" ON "public"."team_conversation_members" FOR UPDATE TO "authenticated" USING ((("user_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversations" "tc"
  WHERE (("tc"."id" = "team_conversation_members"."conversation_id") AND (("tc"."created_by" = "auth"."uid"()) OR "public"."user_has_role_for_tenant"("tc"."tenant_id", ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK ((("user_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversations" "tc"
  WHERE (("tc"."id" = "team_conversation_members"."conversation_id") AND (("tc"."created_by" = "auth"."uid"()) OR "public"."user_has_role_for_tenant"("tc"."tenant_id", ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "team_conversation_members_update_self" ON "public"."team_conversation_members" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."team_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_conversations_delete_admins" ON "public"."team_conversations" FOR DELETE TO "authenticated" USING (("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "team_conversations_insert_members" ON "public"."team_conversations" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "team_conversations_select_members" ON "public"."team_conversations" FOR SELECT TO "authenticated" USING (("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversation_members" "tcm"
  WHERE (("tcm"."conversation_id" = "team_conversations"."id") AND ("tcm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "team_conversations_update_admins" ON "public"."team_conversations" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."team_conversation_members" "tcm"
  WHERE (("tcm"."conversation_id" = "team_conversations"."id") AND ("tcm"."user_id" = "auth"."uid"())))) AND (("created_by" = "auth"."uid"()) OR "public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"])))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."team_conversation_members" "tcm"
  WHERE (("tcm"."conversation_id" = "team_conversations"."id") AND ("tcm"."user_id" = "auth"."uid"())))) AND (("created_by" = "auth"."uid"()) OR "public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]))));



ALTER TABLE "public"."team_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_messages_delete_author" ON "public"."team_messages" FOR DELETE TO "authenticated" USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "team_messages_insert_members" ON "public"."team_messages" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]) AND ("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversation_members" "tcm"
  WHERE (("tcm"."conversation_id" = "team_messages"."conversation_id") AND ("tcm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "team_messages_select_members" ON "public"."team_messages" FOR SELECT TO "authenticated" USING (("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversation_members" "tcm"
  WHERE (("tcm"."conversation_id" = "team_messages"."conversation_id") AND ("tcm"."user_id" = "auth"."uid"())))) AND ("deleted_at" IS NULL)));



CREATE POLICY "team_messages_update_author" ON "public"."team_messages" FOR UPDATE TO "authenticated" USING ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversation_members" "tcm"
  WHERE (("tcm"."conversation_id" = "team_messages"."conversation_id") AND ("tcm"."user_id" = "auth"."uid"())))))) WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_conversation_members" "tcm"
  WHERE (("tcm"."conversation_id" = "team_messages"."conversation_id") AND ("tcm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "tenant_manage_staff_services" ON "public"."staff_provides_services" USING ((EXISTS ( SELECT 1
   FROM "public"."memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."tenant_id" = "staff_provides_services"."tenant_id") AND ("m"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."tenant_id" = "staff_provides_services"."tenant_id") AND ("m"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "tenant_read_logs" ON "public"."logs" FOR SELECT USING ((("tenant_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."tenant_id" = "logs"."tenant_id"))))));



CREATE POLICY "tenant_read_staff_services" ON "public"."staff_provides_services" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."tenant_id" = "staff_provides_services"."tenant_id")))));



ALTER TABLE "public"."tenant_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_settings_delete_admin_owner" ON "public"."tenant_settings" FOR DELETE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "tenant_settings_insert_admin_owner" ON "public"."tenant_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



CREATE POLICY "tenant_settings_select_tenant_members" ON "public"."tenant_settings" FOR SELECT USING ("public"."user_has_role_for_tenant"("tenant_id", NULL::"text"[]));



CREATE POLICY "tenant_settings_update_admin_owner" ON "public"."tenant_settings" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("tenant_id", ARRAY['owner'::"text", 'admin'::"text"]));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_select_members" ON "public"."tenants" FOR SELECT USING ("public"."user_has_role_for_tenant"("id", NULL::"text"[]));



CREATE POLICY "tenants_update_admin_owner" ON "public"."tenants" FOR UPDATE TO "authenticated" USING ("public"."user_has_role_for_tenant"("id", ARRAY['owner'::"text", 'admin'::"text"])) WITH CHECK ("public"."user_has_role_for_tenant"("id", ARRAY['owner'::"text", 'admin'::"text"]));



ALTER TABLE "public"."user_display_names" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_display_names_delete" ON "public"."user_display_names" FOR DELETE TO "authenticated" USING (("viewer_user_id" = "auth"."uid"()));



CREATE POLICY "user_display_names_insert" ON "public"."user_display_names" FOR INSERT TO "authenticated" WITH CHECK (("viewer_user_id" = "auth"."uid"()));



CREATE POLICY "user_display_names_select" ON "public"."user_display_names" FOR SELECT TO "authenticated" USING (("viewer_user_id" = "auth"."uid"()));



CREATE POLICY "user_display_names_update" ON "public"."user_display_names" FOR UPDATE TO "authenticated" USING (("viewer_user_id" = "auth"."uid"())) WITH CHECK (("viewer_user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can manage own profile" ON "public"."profiles" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_view_own_auth_logs" ON "public"."auth_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_view_tenant_audit_logs" ON "public"."audit_logs" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" IN ( SELECT "memberships"."tenant_id"
   FROM "public"."memberships"
  WHERE ("memberships"."user_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auth_login_requests";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";







































GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






























































































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."archive_old_messages"("p_days_old" integer, "p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_old_messages"("p_days_old" integer, "p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_old_messages"("p_days_old" integer, "p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."build_row_diff"("old_row" "jsonb", "new_row" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."build_row_diff"("old_row" "jsonb", "new_row" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_row_diff"("old_row" "jsonb", "new_row" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_all_org_metrics_daily"("p_metric_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_all_org_metrics_daily"("p_metric_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_all_org_metrics_daily"("p_metric_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_org_metrics_daily"("p_tenant_id" "uuid", "p_metric_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_org_metrics_daily"("p_tenant_id" "uuid", "p_metric_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_org_metrics_daily"("p_tenant_id" "uuid", "p_metric_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_total_revenue_per_tenant"("tenant_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_total_revenue_per_tenant"("tenant_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_total_revenue_per_tenant"("tenant_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_admin_user_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_admin_user_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_admin_user_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_booking_conflicts"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_booking_conflicts"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_booking_conflicts"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_booking_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_booking_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_booking_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_customer_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_customer_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_customer_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_database_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_database_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_database_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_metrics_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_metrics_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_metrics_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_orphan_records"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_orphan_records"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_orphan_records"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_platform_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_platform_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_platform_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_slot_availability"("tenant_uuid" "uuid", "slot_start" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."check_slot_availability"("tenant_uuid" "uuid", "slot_start" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_slot_availability"("tenant_uuid" "uuid", "slot_start" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_staff_availability"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."check_staff_availability"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_staff_availability"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_staff_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_staff_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_staff_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_holds"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_holds"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_holds"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_with_validation"("p_booking" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_with_validation"("p_booking" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_with_validation"("p_booking" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_with_validation"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_customer_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_service_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_with_validation"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_customer_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_service_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_with_validation"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_customer_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_service_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_log"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_log"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_log"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_or_update_booking"("p_booking" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_or_update_booking"("p_booking" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_or_update_booking"("p_booking" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_platform_admin"("p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_platform_admin"("p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_platform_admin"("p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_staff_blocking_with_validation"("p_block" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_staff_blocking_with_validation"("p_block" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_staff_blocking_with_validation"("p_block" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_booking_tenant_matches_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_booking_tenant_matches_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_booking_tenant_matches_appointment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_payment_tenant_matches_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_payment_tenant_matches_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_payment_tenant_matches_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_default_team_conversation"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_default_team_conversation"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_default_team_conversation"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_direct_conversations_for_user"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_direct_conversations_for_user"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_direct_conversations_for_user"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_direct_team_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."find_direct_team_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_direct_team_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_add_member"("p_org" "uuid", "p_user" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_add_member"("p_org" "uuid", "p_user" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_add_member"("p_org" "uuid", "p_user" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_time_range"("start_time" time without time zone, "end_time" time without time zone, "slot_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_time_range"("start_time" time without time zone, "end_time" time without time zone, "slot_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_time_range"("start_time" time without time zone, "end_time" time without time zone, "slot_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agenda"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_agenda"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agenda"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_group_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_group_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_group_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_group_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_group_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agenda_grouped"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_group_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agenda_stats"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_staff_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agenda_stats"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_staff_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agenda_stats"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_staff_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_date" "date", "p_days_ahead" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_date" "date", "p_days_ahead" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_date" "date", "p_days_ahead" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_members"("p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_members"("p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_members"("p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_messages_paginated"("p_conversation_id" "uuid", "p_limit" integer, "p_before_timestamp" timestamp with time zone, "p_after_timestamp" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_messages_paginated"("p_conversation_id" "uuid", "p_limit" integer, "p_before_timestamp" timestamp with time zone, "p_after_timestamp" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_messages_paginated"("p_conversation_id" "uuid", "p_limit" integer, "p_before_timestamp" timestamp with time zone, "p_after_timestamp" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_stats"("p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_stats"("p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_stats"("p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_kpis"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_kpis"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_kpis"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filtered_bookings"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_staff_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_filtered_bookings"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_staff_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filtered_bookings"("p_tenant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_staff_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_metrics_range"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_metrics_range"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_metrics_range"("p_tenant_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_direct_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_conversation"("p_tenant_id" "uuid", "p_user_a" "uuid", "p_user_b" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_features"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_features"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_features"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_plan_info"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_plan_info"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_plan_info"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_overlap_error_message"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_overlap_error_message"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_overlap_error_message"("p_tenant_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_day" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_day" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_available_slots"("p_tenant_id" "uuid", "p_service_id" "uuid", "p_day" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_daily_staff_windows"("p_tenant_id" "uuid", "p_day" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_daily_staff_windows"("p_tenant_id" "uuid", "p_day" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_daily_staff_windows"("p_tenant_id" "uuid", "p_day" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_services"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_services"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_services"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_services_with_slots"("p_tenant_id" "uuid", "p_day" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_services_with_slots"("p_tenant_id" "uuid", "p_day" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_services_with_slots"("p_tenant_id" "uuid", "p_day" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_categories"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_categories"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_categories"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_price_range"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_price_range"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_price_range"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_services_filtered"("p_tenant_id" "uuid", "p_status" "text", "p_category" "text", "p_min_price" integer, "p_max_price" integer, "p_has_buffer" boolean, "p_stripe_synced" boolean, "p_search_term" "text", "p_sort_by" "text", "p_sort_direction" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_services_filtered"("p_tenant_id" "uuid", "p_status" "text", "p_category" "text", "p_min_price" integer, "p_max_price" integer, "p_has_buffer" boolean, "p_stripe_synced" boolean, "p_search_term" "text", "p_sort_by" "text", "p_sort_direction" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_services_filtered"("p_tenant_id" "uuid", "p_status" "text", "p_category" "text", "p_min_price" integer, "p_max_price" integer, "p_has_buffer" boolean, "p_stripe_synced" boolean, "p_search_term" "text", "p_sort_by" "text", "p_sort_direction" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_services_without_price_id"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_services_without_price_id"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_services_without_price_id"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_availability"("p_staff_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_availability"("p_staff_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_availability"("p_staff_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_schedule"("p_staff_id" "uuid", "p_include_inactive" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_schedule"("p_staff_id" "uuid", "p_include_inactive" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_schedule"("p_staff_id" "uuid", "p_include_inactive" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_with_stats"("p_tenant_id" "uuid", "p_include_inactive" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_with_stats"("p_tenant_id" "uuid", "p_include_inactive" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_with_stats"("p_tenant_id" "uuid", "p_include_inactive" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_info"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_info"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_info"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_conversations_optimized"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_conversations_optimized"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_conversations_optimized"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_display_name"("p_viewer_user_id" "uuid", "p_target_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("p_viewer_user_id" "uuid", "p_target_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("p_viewer_user_id" "uuid", "p_target_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile_photo"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile_photo"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile_photo"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role_and_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role_and_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role_and_permissions"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_paid_bookings"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_paid_bookings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_paid_bookings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_booking_customer_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_booking_customer_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_booking_customer_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_feature"("p_org_id" "uuid", "p_feature_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_feature"("p_org_id" "uuid", "p_feature_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_feature"("p_org_id" "uuid", "p_feature_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_daily_metrics"("p_tenant_id" "uuid", "p_days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_daily_metrics"("p_tenant_id" "uuid", "p_days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_daily_metrics"("p_tenant_id" "uuid", "p_days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_stripe_event_if_new"("p_event_id" "text", "p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_stripe_event_if_new"("p_event_id" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_stripe_event_if_new"("p_event_id" "text", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_service_sellable"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_service_sellable"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_service_sellable"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_slot_in_past"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."is_slot_in_past"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_slot_in_past"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."list_tenant_members"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_tenant_members"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_tenant_members"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_event"("p_event_type" "text", "p_tenant_id" "uuid", "p_actor_user_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_severity" "text", "p_description" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_event"("p_event_type" "text", "p_tenant_id" "uuid", "p_actor_user_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_severity" "text", "p_description" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_event"("p_event_type" "text", "p_tenant_id" "uuid", "p_actor_user_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_severity" "text", "p_description" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_expired_login_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_expired_login_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_expired_login_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_tenant_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_tenant_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_tenant_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."provision_tenant_for_user"("p_user_id" "uuid", "p_name" "text", "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."provision_tenant_for_user"("p_user_id" "uuid", "p_name" "text", "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provision_tenant_for_user"("p_user_id" "uuid", "p_name" "text", "p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_all_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_all_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_all_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_customer_stats"("p_customer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_customer_stats"("p_customer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_customer_stats"("p_customer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_expired_appointments"() TO "anon";
GRANT ALL ON FUNCTION "public"."release_expired_appointments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_expired_appointments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."release_expired_holds"() TO "anon";
GRANT ALL ON FUNCTION "public"."release_expired_holds"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_expired_holds"() TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."safe_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_messages"("p_tenant_id" "uuid", "p_search_term" "text", "p_conversation_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_messages"("p_tenant_id" "uuid", "p_search_term" "text", "p_conversation_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_messages"("p_tenant_id" "uuid", "p_search_term" "text", "p_conversation_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."setup_admin_user_access"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."setup_admin_user_access"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_admin_user_access"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."team_conversations_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."team_conversations_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_conversations_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."team_messages_bump_conversation"() TO "anon";
GRANT ALL ON FUNCTION "public"."team_messages_bump_conversation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_messages_bump_conversation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."team_messages_set_edited_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."team_messages_set_edited_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_messages_set_edited_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."to_tenant_timezone"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."to_tenant_timezone"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."to_tenant_timezone"("p_tenant_id" "uuid", "p_timestamp" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_bookings_update_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_bookings_update_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_bookings_update_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_daily_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_daily_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_daily_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_booking_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_booking_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_booking_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_customers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_daily_metrics"("p_tenant_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_metrics"("p_tenant_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_metrics"("p_tenant_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_intents_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_intents_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_intents_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_staff_provides_services_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_staff_provides_services_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_staff_provides_services_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tenant_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tenant_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tenant_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_permissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_permissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_permissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_metrics_for_booking"("p_tenant_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_metrics_for_booking"("p_tenant_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_metrics_for_booking"("p_tenant_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_display_names_update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_display_names_update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_display_names_update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_role_for_tenant"("target_tenant" "uuid", "allowed_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role_for_tenant"("target_tenant" "uuid", "allowed_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role_for_tenant"("target_tenant" "uuid", "allowed_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."auth_login_requests" TO "anon";
GRANT ALL ON TABLE "public"."auth_login_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_login_requests" TO "service_role";



GRANT ALL ON TABLE "public"."auth_logs" TO "anon";
GRANT ALL ON TABLE "public"."auth_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auth_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auth_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auth_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."daily_dashboard_kpis" TO "anon";
GRANT ALL ON TABLE "public"."daily_dashboard_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_dashboard_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."daily_metrics" TO "anon";
GRANT ALL ON TABLE "public"."daily_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."logs" TO "anon";
GRANT ALL ON TABLE "public"."logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logs" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."org_metrics_daily" TO "anon";
GRANT ALL ON TABLE "public"."org_metrics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."org_metrics_daily" TO "service_role";



GRANT ALL ON TABLE "public"."payment_intents" TO "anon";
GRANT ALL ON TABLE "public"."payment_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_intents" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."platform_users" TO "anon";
GRANT ALL ON TABLE "public"."platform_users" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_users" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."staff_blockings" TO "anon";
GRANT ALL ON TABLE "public"."staff_blockings" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_blockings" TO "service_role";



GRANT ALL ON TABLE "public"."staff_provides_services" TO "anon";
GRANT ALL ON TABLE "public"."staff_provides_services" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_provides_services" TO "service_role";



GRANT ALL ON TABLE "public"."staff_schedules" TO "anon";
GRANT ALL ON TABLE "public"."staff_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events_processed" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events_processed" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events_processed" TO "service_role";



GRANT ALL ON TABLE "public"."system_events" TO "anon";
GRANT ALL ON TABLE "public"."system_events" TO "authenticated";
GRANT ALL ON TABLE "public"."system_events" TO "service_role";



GRANT ALL ON TABLE "public"."team_conversation_members" TO "anon";
GRANT ALL ON TABLE "public"."team_conversation_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_conversation_members" TO "service_role";



GRANT ALL ON TABLE "public"."team_conversations" TO "anon";
GRANT ALL ON TABLE "public"."team_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."team_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."team_messages" TO "anon";
GRANT ALL ON TABLE "public"."team_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."team_messages" TO "service_role";



GRANT ALL ON TABLE "public"."team_messages_archive" TO "anon";
GRANT ALL ON TABLE "public"."team_messages_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."team_messages_archive" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."user_display_names" TO "anon";
GRANT ALL ON TABLE "public"."user_display_names" TO "authenticated";
GRANT ALL ON TABLE "public"."user_display_names" TO "service_role";



GRANT ALL ON TABLE "public"."user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."vw_booking_overview" TO "anon";
GRANT ALL ON TABLE "public"."vw_booking_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_booking_overview" TO "service_role";



GRANT ALL ON TABLE "public"."vw_booking_overview_mat" TO "anon";
GRANT ALL ON TABLE "public"."vw_booking_overview_mat" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_booking_overview_mat" TO "service_role";



GRANT ALL ON TABLE "public"."vw_customer_summary" TO "anon";
GRANT ALL ON TABLE "public"."vw_customer_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_customer_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vw_payments_overview" TO "anon";
GRANT ALL ON TABLE "public"."vw_payments_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_payments_overview" TO "service_role";



GRANT ALL ON TABLE "public"."vw_staff_slots" TO "anon";
GRANT ALL ON TABLE "public"."vw_staff_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_staff_slots" TO "service_role";



GRANT ALL ON TABLE "public"."vw_staff_slots_real" TO "anon";
GRANT ALL ON TABLE "public"."vw_staff_slots_real" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_staff_slots_real" TO "service_role";



GRANT ALL ON TABLE "public"."vw_public_availability" TO "anon";
GRANT ALL ON TABLE "public"."vw_public_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_public_availability" TO "service_role";



GRANT ALL ON TABLE "public"."vw_public_services" TO "anon";
GRANT ALL ON TABLE "public"."vw_public_services" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_public_services" TO "service_role";



GRANT ALL ON TABLE "public"."vw_staff_availability" TO "anon";
GRANT ALL ON TABLE "public"."vw_staff_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_staff_availability" TO "service_role";



GRANT ALL ON TABLE "public"."vw_staff_overview" TO "anon";
GRANT ALL ON TABLE "public"."vw_staff_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_staff_overview" TO "service_role";



GRANT ALL ON TABLE "public"."vw_staff_overview_mat" TO "anon";
GRANT ALL ON TABLE "public"."vw_staff_overview_mat" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_staff_overview_mat" TO "service_role";



GRANT ALL ON TABLE "public"."vw_tenant_business_rules" TO "anon";
GRANT ALL ON TABLE "public"."vw_tenant_business_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_tenant_business_rules" TO "service_role";









GRANT ALL ON TABLE "public"."vw_customer_summary_mat" TO "anon";
GRANT ALL ON TABLE "public"."vw_customer_summary_mat" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_customer_summary_mat" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































