-- 0041_tenant_coherence_and_indexes.sql
-- Coherencia de tenant entre bookings y appointments + índices adicionales

-- 1) Trigger para forzar coherencia de tenant en bookings con appointments
CREATE OR REPLACE FUNCTION public.enforce_booking_tenant_matches_appointment()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_bookings_tenant_coherence ON public.bookings;
CREATE TRIGGER trg_bookings_tenant_coherence
BEFORE INSERT OR UPDATE OF appointment_id, tenant_id ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_tenant_matches_appointment();

-- 2) Índice útil para chat: lecturas por tenant y orden cronológico
CREATE INDEX IF NOT EXISTS chat_messages_tenant_created_idx
  ON public.chat_messages (tenant_id, created_at DESC);

-- 3) Intento de VALIDATE de FKs añadidas previamente (si los datos lo permiten)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_appointment_id_fkey;
  EXCEPTION WHEN others THEN
    -- Queda pendiente de backfill, no forzamos
    NULL;
  END;

  BEGIN
    ALTER TABLE public.staff VALIDATE CONSTRAINT staff_user_id_fkey;
  EXCEPTION WHEN others THEN
    -- Queda pendiente de backfill, no forzamos
    NULL;
  END;
END$$;







