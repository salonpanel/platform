-- ============================================================================
-- BookFast AI — Base de seguridad (Fase 0)
-- ============================================================================
-- Crea las tablas de fundación para el asistente: sesiones, mensajes, audit log,
-- eventos de seguridad, uso mensual (budget), kill switches, y tablas outbound
-- (WhatsApp).
--
-- Todo con RLS estricta por tenant_id. Audit log append-only (sin UPDATE/DELETE
-- vía RLS; solo el service_role puede tocar). Índices optimizados para las
-- consultas más comunes. Triggers de updated_at donde aplica.
--
-- Refs: PROPUESTA_ASISTENTE_IA.md, PLAN_SEGURIDAD_IA.md, CASOS_USO_ASISTENTE_IA.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: trigger updated_at (crea solo si no existe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Sesiones de conversación
-- ---------------------------------------------------------------------------
-- Una sesión agrupa un hilo de conversación con el asistente para un usuario
-- concreto dentro de un tenant. Permite listar conversaciones previas y
-- asociar mensajes, audit, uso.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asistente_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            text,
  system_prompt_version text NOT NULL DEFAULT 'v0',
  status           text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','archived','closed')),
  last_message_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asistente_sessions_tenant_user_updated
  ON public.asistente_sessions (tenant_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_asistente_sessions_tenant_status
  ON public.asistente_sessions (tenant_id, status);

DROP TRIGGER IF EXISTS trg_asistente_sessions_updated_at ON public.asistente_sessions;
CREATE TRIGGER trg_asistente_sessions_updated_at
  BEFORE UPDATE ON public.asistente_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.asistente_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asistente_sessions_select ON public.asistente_sessions;
CREATE POLICY asistente_sessions_select ON public.asistente_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_sessions.tenant_id
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS asistente_sessions_insert ON public.asistente_sessions;
CREATE POLICY asistente_sessions_insert ON public.asistente_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_sessions.tenant_id
    )
  );

DROP POLICY IF EXISTS asistente_sessions_update ON public.asistente_sessions;
CREATE POLICY asistente_sessions_update ON public.asistente_sessions
  FOR UPDATE USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_sessions.tenant_id
    )
  );

-- No DELETE por RLS: borrado conversacional se hace con status='archived'
-- (evita pérdida de audit trail).


-- ---------------------------------------------------------------------------
-- 2) Mensajes
-- ---------------------------------------------------------------------------
-- Cada mensaje (usuario, asistente, tool) de una sesión. Guardamos el contenido
-- completo (versión reciente) para mostrar historia; el campo content_redacted
-- opcional se usa para PII scrubbing a largo plazo (>90 días) si es necesario.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asistente_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.asistente_sessions(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role            text NOT NULL
                    CHECK (role IN ('user','assistant','system','tool')),
  content         text,
  content_redacted boolean NOT NULL DEFAULT false,
  tool_name       text,
  tool_input      jsonb,
  tool_output     jsonb,
  tokens_input    integer,
  tokens_output   integer,
  model           text,
  finish_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asistente_messages_session_created
  ON public.asistente_messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_asistente_messages_tenant_created
  ON public.asistente_messages (tenant_id, created_at DESC);

ALTER TABLE public.asistente_messages ENABLE ROW LEVEL SECURITY;

-- Solo el usuario dueño de la sesión (y miembro del tenant) puede leer sus
-- mensajes. Los inserts los hace el backend con service_role; RLS deja un
-- hueco controlado para que clientes autenticados también puedan insertar
-- sus propios mensajes "user" durante desarrollo, pero el endpoint siempre
-- va por service_role para no exponer superficie.
DROP POLICY IF EXISTS asistente_messages_select ON public.asistente_messages;
CREATE POLICY asistente_messages_select ON public.asistente_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.asistente_sessions s
      WHERE s.id = asistente_messages.session_id
        AND s.user_id = auth.uid()
        AND s.tenant_id = asistente_messages.tenant_id
    )
  );

-- No exponemos INSERT/UPDATE/DELETE por RLS a usuarios normales.
-- El endpoint /api/asistente/chat usa service_role para escribir.


-- ---------------------------------------------------------------------------
-- 3) Audit log (append-only)
-- ---------------------------------------------------------------------------
-- Registro inmutable de CADA acción relevante: tool call, intento denegado,
-- bulk op, envío outbound, etc. RLS permite SELECT al owner/admin del tenant;
-- INSERT solo service_role; nada de UPDATE/DELETE (ni siquiera service_role
-- debería, pero no se bloquea a nivel de BD para permitir maintenance).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asistente_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id      uuid REFERENCES public.asistente_sessions(id) ON DELETE SET NULL,
  message_id      uuid REFERENCES public.asistente_messages(id) ON DELETE SET NULL,
  action_type     text NOT NULL,            -- 'tool_call','tool_denied','rate_limited','budget_blocked','killswitch_blocked','bulk_snapshot','confirmation_required','confirmation_granted'
  tool_name       text,
  tool_category   text,                     -- 'READ_LOW','READ_HIGH','WRITE_LOW','WRITE_HIGH','CRITICAL'
  tool_input      jsonb,                    -- redactado si contiene PII
  tool_output_summary jsonb,                -- resumen: row counts, ids afectados
  affected_entity_type text,                -- 'booking','customer', etc.
  affected_entity_ids  uuid[],
  status          text NOT NULL
                    CHECK (status IN ('ok','denied','error','pending_confirmation')),
  reason          text,
  duration_ms     integer,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asistente_audit_tenant_created
  ON public.asistente_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asistente_audit_session
  ON public.asistente_audit_log (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asistente_audit_tenant_status
  ON public.asistente_audit_log (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asistente_audit_tenant_action
  ON public.asistente_audit_log (tenant_id, action_type, created_at DESC);

ALTER TABLE public.asistente_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asistente_audit_select_owners ON public.asistente_audit_log;
CREATE POLICY asistente_audit_select_owners ON public.asistente_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_audit_log.tenant_id
        AND m.role IN ('owner','admin')
    )
  );

-- INSERT/UPDATE/DELETE solo vía service_role (backend). No hay policy permisiva.


-- ---------------------------------------------------------------------------
-- 4) Security events
-- ---------------------------------------------------------------------------
-- Eventos de seguridad: jailbreak attempts, rate-limit hits, cross-tenant
-- attempt, output PII redaction, etc. Diferentes del audit log porque
-- los vigila el admin de plataforma además del owner.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asistente_security_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id    uuid REFERENCES public.asistente_sessions(id) ON DELETE SET NULL,
  event_type    text NOT NULL,  -- 'jailbreak_detected','rate_limit_exceeded','budget_exceeded','killswitch_hit','cross_tenant_attempt','pii_redacted','tool_schema_violation','suspicious_pattern'
  severity      text NOT NULL
                  CHECK (severity IN ('info','warn','error','critical')),
  payload       jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asistente_sec_events_tenant_created
  ON public.asistente_security_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asistente_sec_events_severity
  ON public.asistente_security_events (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asistente_sec_events_type
  ON public.asistente_security_events (event_type, created_at DESC);

ALTER TABLE public.asistente_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asistente_sec_events_select_owners ON public.asistente_security_events;
CREATE POLICY asistente_sec_events_select_owners ON public.asistente_security_events
  FOR SELECT USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_security_events.tenant_id
        AND m.role IN ('owner','admin')
    )
  );


-- ---------------------------------------------------------------------------
-- 5) Uso mensual por tenant (budget tracking)
-- ---------------------------------------------------------------------------
-- Una fila por tenant/mes. Se actualiza tras cada turno.
-- budget_cents_cap y budget_cents_used se calculan en EUR*100 para evitar
-- floats; el bloqueo se hace desde la app, no desde la BD.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asistente_usage_monthly (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_year         integer NOT NULL,
  period_month        integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  tokens_input        bigint NOT NULL DEFAULT 0,
  tokens_output       bigint NOT NULL DEFAULT 0,
  tool_calls_count    integer NOT NULL DEFAULT 0,
  turns_count         integer NOT NULL DEFAULT 0,
  budget_cents_cap    integer NOT NULL DEFAULT 5000,   -- 50€ por defecto
  budget_cents_used   integer NOT NULL DEFAULT 0,
  warn_sent_at        timestamptz,                     -- 80% umbral
  blocked_at          timestamptz,                     -- 100% umbral
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_asistente_usage_tenant_period
  ON public.asistente_usage_monthly (tenant_id, period_year, period_month);

DROP TRIGGER IF EXISTS trg_asistente_usage_updated_at ON public.asistente_usage_monthly;
CREATE TRIGGER trg_asistente_usage_updated_at
  BEFORE UPDATE ON public.asistente_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.asistente_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asistente_usage_select_owners ON public.asistente_usage_monthly;
CREATE POLICY asistente_usage_select_owners ON public.asistente_usage_monthly
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_usage_monthly.tenant_id
        AND m.role IN ('owner','admin')
    )
  );

-- Solo service_role hace INSERT/UPDATE.


-- ---------------------------------------------------------------------------
-- 6) Kill switches
-- ---------------------------------------------------------------------------
-- Switches que pueden apagar capacidades del asistente rápidamente.
-- scope='global' → lo activa platform admin (una sola fila).
-- scope='tenant' → lo activa el owner (una por tenant).
-- feature_flags: mapa { chat: bool, whatsapp: bool, bulk_writes: bool, ... }
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asistente_kill_switches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope          text NOT NULL CHECK (scope IN ('global','tenant')),
  tenant_id      uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled        boolean NOT NULL DEFAULT true,
  feature_flags  jsonb NOT NULL DEFAULT '{"chat":true,"whatsapp":true,"bulk_writes":true,"refunds":true}'::jsonb,
  reason         text,
  activated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asistente_kill_switches_global_unique
    EXCLUDE USING btree (scope WITH =) WHERE (scope = 'global'),
  CONSTRAINT asistente_kill_switches_tenant_unique
    UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_asistente_killswitch_scope
  ON public.asistente_kill_switches (scope);

DROP TRIGGER IF EXISTS trg_asistente_killswitch_updated_at ON public.asistente_kill_switches;
CREATE TRIGGER trg_asistente_killswitch_updated_at
  BEFORE UPDATE ON public.asistente_kill_switches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.asistente_kill_switches ENABLE ROW LEVEL SECURITY;

-- Owners/admins ven el switch de su tenant y el global (informativo).
DROP POLICY IF EXISTS asistente_killswitch_select ON public.asistente_kill_switches;
CREATE POLICY asistente_killswitch_select ON public.asistente_kill_switches
  FOR SELECT USING (
    scope = 'global'
    OR (
      scope = 'tenant'
      AND EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.user_id = auth.uid()
          AND m.tenant_id = asistente_kill_switches.tenant_id
          AND m.role IN ('owner','admin')
      )
    )
  );

-- UPDATE permitido solo al owner del tenant para su switch.
DROP POLICY IF EXISTS asistente_killswitch_update_tenant ON public.asistente_kill_switches;
CREATE POLICY asistente_killswitch_update_tenant ON public.asistente_kill_switches
  FOR UPDATE USING (
    scope = 'tenant'
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_kill_switches.tenant_id
        AND m.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS asistente_killswitch_insert_tenant ON public.asistente_kill_switches;
CREATE POLICY asistente_killswitch_insert_tenant ON public.asistente_kill_switches
  FOR INSERT WITH CHECK (
    scope = 'tenant'
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_kill_switches.tenant_id
        AND m.role IN ('owner','admin')
    )
  );


-- ---------------------------------------------------------------------------
-- 7) Snapshots de bulk ops (para undo)
-- ---------------------------------------------------------------------------
-- Antes de ejecutar una operación destructiva masiva (cancel_bookings >N,
-- bulk_reassign, etc.), guardamos un snapshot JSON con el estado previo.
-- El owner puede restaurar durante la ventana configurada.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asistente_bulk_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id        uuid REFERENCES public.asistente_sessions(id) ON DELETE SET NULL,
  audit_id          uuid REFERENCES public.asistente_audit_log(id) ON DELETE SET NULL,
  action_type       text NOT NULL,                -- 'cancel_bookings_bulk', etc.
  entity_type       text NOT NULL,                -- 'booking','customer', etc.
  snapshot_data     jsonb NOT NULL,               -- estado previo serializado
  restored_at       timestamptz,
  restored_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at        timestamptz NOT NULL,         -- ventana de undo
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asistente_bulk_snap_tenant_created
  ON public.asistente_bulk_snapshots (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asistente_bulk_snap_expires
  ON public.asistente_bulk_snapshots (expires_at) WHERE restored_at IS NULL;

ALTER TABLE public.asistente_bulk_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asistente_bulk_snap_select_owners ON public.asistente_bulk_snapshots;
CREATE POLICY asistente_bulk_snap_select_owners ON public.asistente_bulk_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = asistente_bulk_snapshots.tenant_id
        AND m.role IN ('owner','admin')
    )
  );


-- ---------------------------------------------------------------------------
-- 8) Plantillas WhatsApp (para outbound aprobado por Meta)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  language          text NOT NULL DEFAULT 'es',
  category          text NOT NULL CHECK (category IN ('utility','marketing','authentication')),
  meta_template_id  text,                          -- id asignado por Meta al aprobar
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','pending','approved','rejected','disabled')),
  body_template     text NOT NULL,                 -- con {{placeholders}}
  variables         jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant_status
  ON public.whatsapp_templates (tenant_id, status);

DROP TRIGGER IF EXISTS trg_whatsapp_templates_updated_at ON public.whatsapp_templates;
CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_templates_select ON public.whatsapp_templates;
CREATE POLICY whatsapp_templates_select ON public.whatsapp_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = whatsapp_templates.tenant_id
    )
  );

DROP POLICY IF EXISTS whatsapp_templates_write_owner ON public.whatsapp_templates;
CREATE POLICY whatsapp_templates_write_owner ON public.whatsapp_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = whatsapp_templates.tenant_id
        AND m.role IN ('owner','admin')
    )
  );


-- ---------------------------------------------------------------------------
-- 9) WhatsApp messages (log outbound + inbound)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  direction           text NOT NULL CHECK (direction IN ('inbound','outbound')),
  customer_id         uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  phone_number        text NOT NULL,
  session_id          uuid REFERENCES public.asistente_sessions(id) ON DELETE SET NULL,
  audit_id            uuid REFERENCES public.asistente_audit_log(id) ON DELETE SET NULL,
  template_id         uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  body                text NOT NULL,
  meta_message_id     text,                        -- id de Meta
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','sent','delivered','read','failed')),
  error_message       text,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_created
  ON public.whatsapp_messages (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_customer
  ON public.whatsapp_messages (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone
  ON public.whatsapp_messages (tenant_id, phone_number, created_at DESC);

DROP TRIGGER IF EXISTS trg_whatsapp_messages_updated_at ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_messages_select ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_select ON public.whatsapp_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = whatsapp_messages.tenant_id
    )
  );

-- INSERT/UPDATE solo vía service_role (backend procesa webhooks y envíos).


-- ---------------------------------------------------------------------------
-- 10) Configuración IA por tenant (columnas en tenants)
-- ---------------------------------------------------------------------------
-- Config rápida por tenant: activa/inactiva, autonomía, flags de capacidades.
-- Usamos columnas simples + jsonb para no saturar la tabla tenants.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asistente_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asistente_autonomy_mode text NOT NULL DEFAULT 'supervised'
    CHECK (asistente_autonomy_mode IN ('supervised','semi','autonomous'));

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asistente_config jsonb NOT NULL DEFAULT '{
    "whatsapp_enabled": false,
    "email_enabled": true,
    "bulk_writes_enabled": false,
    "refunds_enabled": false,
    "require_confirm_above_n": 10,
    "budget_cents_cap": 5000
  }'::jsonb;


-- ---------------------------------------------------------------------------
-- 11) Comentarios de documentación
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.asistente_sessions IS
  'Sesiones de conversación con BookFast AI (un hilo por usuario/tenant).';
COMMENT ON TABLE public.asistente_messages IS
  'Mensajes de cada sesión: user/assistant/tool.';
COMMENT ON TABLE public.asistente_audit_log IS
  'Registro inmutable de cada tool call del asistente. Append-only.';
COMMENT ON TABLE public.asistente_security_events IS
  'Eventos de seguridad: jailbreaks, rate limits, cross-tenant attempts, etc.';
COMMENT ON TABLE public.asistente_usage_monthly IS
  'Agregado mensual por tenant para control de budget y metricas.';
COMMENT ON TABLE public.asistente_kill_switches IS
  'Switches para desactivar IA a nivel global (plataforma) o por tenant (owner).';
COMMENT ON TABLE public.asistente_bulk_snapshots IS
  'Snapshots de estado previos a operaciones masivas, para undo.';
COMMENT ON TABLE public.whatsapp_templates IS
  'Plantillas WhatsApp aprobadas por Meta por tenant.';
COMMENT ON TABLE public.whatsapp_messages IS
  'Log de mensajes WhatsApp (inbound y outbound).';

-- ============================================================================
-- Fin
-- ============================================================================
