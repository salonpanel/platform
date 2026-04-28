-- Agent Tasks System
-- Tabla principal para comunicación entre Platform y agentes de OpenClaw

CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Tipo y categoría
  type TEXT NOT NULL,
  department TEXT NOT NULL,

  -- Asignación
  assigned_agent TEXT,

  -- Estado y prioridad
  status TEXT DEFAULT 'pendiente',
  priority TEXT DEFAULT 'normal',

  -- Relaciones
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,

  -- Payload y resultado
  payload JSONB,
  result JSONB,
  error_message TEXT,

  -- OpenClaw tracking
  openclaw_session_key TEXT DEFAULT 'agent:main:main',
  openclaw_run_id TEXT,

  -- Reintentos
  retries INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Aprobaciones por Josep
  requires_approval BOOLEAN DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  CONSTRAINT valid_status CHECK (status IN ('pendiente', 'en_proceso', 'completado', 'error', 'aprobado', 'rechazado')),
  CONSTRAINT valid_priority CHECK (priority IN ('baja', 'normal', 'alta', 'critica'))
);

-- Índices para performance
CREATE INDEX idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX idx_agent_tasks_type ON public.agent_tasks(type);
CREATE INDEX idx_agent_tasks_tenant ON public.agent_tasks(tenant_id);
CREATE INDEX idx_agent_tasks_created ON public.agent_tasks(created_at DESC);
CREATE INDEX idx_agent_tasks_assigned_agent ON public.agent_tasks(assigned_agent);

-- Tabla de audit log
CREATE TABLE IF NOT EXISTS public.agent_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  action TEXT NOT NULL,
  details JSONB,

  INDEX idx_agent_task_logs_task ON (task_id),
  INDEX idx_agent_task_logs_created ON (created_at DESC)
);

-- RLS: Enable for multi-tenant security
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_task_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can see all tasks (no filtering needed)
CREATE POLICY admin_access_agent_tasks ON public.agent_tasks
  FOR ALL USING (true);

CREATE POLICY admin_access_agent_task_logs ON public.agent_task_logs
  FOR ALL USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.agent_tasks TO authenticated;
GRANT SELECT, INSERT ON public.agent_task_logs TO authenticated;
