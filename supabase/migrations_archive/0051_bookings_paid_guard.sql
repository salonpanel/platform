-- 0051_bookings_paid_guard.sql
-- Evitar cambios críticos en bookings pagados/completados

CREATE OR REPLACE FUNCTION public.guard_paid_bookings()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_guard_paid_bookings ON public.bookings;
CREATE TRIGGER trg_guard_paid_bookings
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.guard_paid_bookings();









