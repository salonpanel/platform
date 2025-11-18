-- 0033_add_booking_notes_and_staff_blockings.sql
-- Añadir campos de notas a bookings y crear tabla staff_blockings para indisponibilidades/ausencias

-- 1) Añadir campos de notas a bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_message TEXT,
  ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.bookings.internal_notes IS 'Notas internas sobre la cita (solo visible para staff)';
COMMENT ON COLUMN public.bookings.client_message IS 'Mensaje personalizado para el cliente (se incluirá en SMS/email de confirmación)';
COMMENT ON COLUMN public.bookings.is_highlighted IS 'Indica si la cita está destacada/marcada como importante';

-- 2) Crear tabla staff_blockings para indisponibilidades y ausencias
CREATE TABLE IF NOT EXISTS public.staff_blockings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('block', 'absence', 'vacation')),
  reason TEXT, -- Motivo (ej: "Descanso", "Vacaciones", "Enfermedad")
  notes TEXT, -- Notas adicionales
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (start_at < end_at)
);

CREATE INDEX idx_staff_blockings_tenant_staff_date ON public.staff_blockings(tenant_id, staff_id, start_at);
CREATE INDEX idx_staff_blockings_date_range ON public.staff_blockings(start_at, end_at);

-- RLS: Habilitar RLS en staff_blockings
ALTER TABLE public.staff_blockings ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios del tenant pueden leer los blockings
DROP POLICY IF EXISTS staff_blockings_read ON public.staff_blockings;
CREATE POLICY staff_blockings_read ON public.staff_blockings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.tenant_id = staff_blockings.tenant_id
      AND memberships.user_id = auth.uid()
    )
  );

-- Política: Solo owners/admins/managers pueden crear/modificar/eliminar blockings
DROP POLICY IF EXISTS staff_blockings_write ON public.staff_blockings;
CREATE POLICY staff_blockings_write ON public.staff_blockings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.tenant_id = staff_blockings.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin', 'manager')
    )
  );

COMMENT ON TABLE public.staff_blockings IS 'Bloqueos de disponibilidad del staff (indisponibilidades temporales o ausencias)';
COMMENT ON COLUMN public.staff_blockings.type IS 'Tipo: block (bloqueo/falta de disponibilidad), absence (ausencia) o vacation (vacaciones)';
COMMENT ON COLUMN public.staff_blockings.reason IS 'Motivo del bloqueo (ej: "Descanso", "Vacaciones", "Enfermedad")';
COMMENT ON COLUMN public.staff_blockings.notes IS 'Notas adicionales sobre el bloqueo';

