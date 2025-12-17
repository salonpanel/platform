-- 0080_fix_function_search_path.sql
-- Corregir warnings de "Function Search Path Mutable" añadiendo SET search_path a todas las funciones

-- ============================================================================
-- FUNCIONES DE TRIGGERS Y HELPERS SIMPLES
-- ============================================================================

-- normalize_tenant_slug
CREATE OR REPLACE FUNCTION public.normalize_tenant_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(regexp_replace(NEW.slug, '\s+', '-', 'g'));
    NEW.slug := regexp_replace(NEW.slug, '[^a-z0-9-]', '', 'g');
    NEW.slug := regexp_replace(NEW.slug, '-{2,}', '-', 'g');
    NEW.slug := regexp_replace(NEW.slug, '(^-+)|(-+$)', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

-- trg_bookings_update_metrics
CREATE OR REPLACE FUNCTION public.trg_bookings_update_metrics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

-- insert_stripe_event_if_new
CREATE OR REPLACE FUNCTION public.insert_stripe_event_if_new(
  p_event_id text,
  p_type text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stripe_events_processed (event_id, event_type)
  VALUES (p_event_id, p_type)
  ON CONFLICT (event_id) DO NOTHING;
END;
$$;

-- update_chat_messages_updated_at
CREATE OR REPLACE FUNCTION public.update_chat_messages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- profiles_update_updated_at
CREATE OR REPLACE FUNCTION public.profiles_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- update_tenant_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_tenant_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- guard_paid_bookings
CREATE OR REPLACE FUNCTION public.guard_paid_bookings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

-- team_messages_set_edited_at
CREATE OR REPLACE FUNCTION public.team_messages_set_edited_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    NEW.edited_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- team_messages_bump_conversation
CREATE OR REPLACE FUNCTION public.team_messages_bump_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_conversations
    SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- update_payments_updated_at
CREATE OR REPLACE FUNCTION public.update_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- team_conversations_touch_updated_at
CREATE OR REPLACE FUNCTION public.team_conversations_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- enforce_booking_tenant_matches_appointment
CREATE OR REPLACE FUNCTION public.enforce_booking_tenant_matches_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

-- user_display_names_update_updated_at
CREATE OR REPLACE FUNCTION public.user_display_names_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- build_row_diff
CREATE OR REPLACE FUNCTION public.build_row_diff(old_row jsonb, new_row jsonb)
RETURNS jsonb
LANGUAGE sql
SET search_path = public
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'old', old_row,
    'new', new_row
  );
$$;

-- audit_trigger
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

-- ============================================================================
-- FUNCIONES CON SECURITY DEFINER
-- ============================================================================

-- provision_tenant_for_user
CREATE OR REPLACE FUNCTION public.provision_tenant_for_user(
  p_user_id uuid,
  p_name text,
  p_slug text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
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

-- get_public_available_slots
CREATE OR REPLACE FUNCTION public.get_public_available_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_day date
) RETURNS TABLE (
  staff_id uuid,
  slot_start timestamptz,
  slot_end timestamptz
)
LANGUAGE plpgsql
SET search_path = public
STABLE
SECURITY DEFINER
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

-- calculate_org_metrics_daily
create or replace function public.calculate_org_metrics_daily(
  p_tenant_id uuid,
  p_metric_date date default current_date
)
returns void
language plpgsql
SET search_path = public
security definer
as $$
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

-- get_public_services
CREATE OR REPLACE FUNCTION public.get_public_services(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  duration_min integer,
  price_cents integer,
  stripe_price_id text
) LANGUAGE sql
SET search_path = public
STABLE
SECURITY DEFINER
AS $$
  SELECT s.id, s.name, s.duration_min, s.price_cents, s.stripe_price_id
  FROM public.services s
  WHERE s.tenant_id = p_tenant_id
    AND s.active = true
  ORDER BY s.name;
$$;

-- mark_expired_login_requests
CREATE OR REPLACE FUNCTION public.mark_expired_login_requests()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.auth_login_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < now() - interval '15 minutes';
END;
$$;

-- check_platform_admin
create or replace function public.check_platform_admin(p_user_id uuid)
returns boolean
language plpgsql
SET search_path = public, platform
security definer
stable
as $$
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

-- get_org_plan_info
create or replace function public.get_org_plan_info(p_org_id uuid)
returns jsonb
language plpgsql
SET search_path = public, platform
security definer
stable
as $$
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

-- get_public_daily_staff_windows
CREATE OR REPLACE FUNCTION public.get_public_daily_staff_windows(
  p_tenant_id uuid,
  p_day date
) RETURNS TABLE (
  staff_id uuid,
  start_time time without time zone,
  end_time time without time zone
) LANGUAGE sql
SET search_path = public
STABLE
SECURITY DEFINER
AS $$
  SELECT ss.staff_id, ss.start_time, ss.end_time
  FROM public.staff_schedules ss
  WHERE ss.tenant_id = p_tenant_id
    AND ss.is_active = true
    AND ss.day_of_week = EXTRACT(DOW FROM p_day)::int
$$;

-- app.current_tenant_id
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, app
SECURITY DEFINER
STABLE
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

-- get_org_features
create or replace function public.get_org_features(p_org_id uuid)
returns table (
  feature_key text,
  enabled boolean,
  quota_limit jsonb
)
language plpgsql
SET search_path = public, platform
security definer
stable
as $$
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

-- get_available_slots
create or replace function public.get_available_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_staff_id uuid default null,
  p_date date default current_date,
  p_days_ahead int default 30
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  staff_id uuid,
  staff_name text
)
language plpgsql
SET search_path = public
stable
as $$
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

-- create_platform_admin
create or replace function public.create_platform_admin(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role text default 'admin'
)
returns uuid
language plpgsql
SET search_path = public, platform
security definer
as $$
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

-- get_public_services_with_slots
CREATE OR REPLACE FUNCTION public.get_public_services_with_slots(
  p_tenant_id uuid,
  p_day date
) RETURNS TABLE (
  service_id uuid,
  service_name text,
  duration_min integer,
  price_cents integer,
  stripe_price_id text,
  slots jsonb
)
LANGUAGE plpgsql
SET search_path = public
STABLE
SECURITY DEFINER
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

-- has_feature
create or replace function public.has_feature(p_org_id uuid, p_feature_key text)
returns boolean
language plpgsql
SET search_path = public, platform
security definer
stable
as $$
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

-- fn_add_member (legacy, pero mantener por compatibilidad)
CREATE OR REPLACE FUNCTION public.fn_add_member(p_org uuid, p_user uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (p_org, p_user, p_role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;



