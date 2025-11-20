-- 0038_bookings_link_to_appointments.sql
-- Enlace opcional de pagos (bookings) con agenda (appointments)

-- 1) Añadir columna opcional appointment_id en bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS appointment_id uuid;

-- 2) Índices útiles
CREATE INDEX IF NOT EXISTS bookings_appointment_id_idx
  ON public.bookings (appointment_id);

-- Opcional: proteger “1 booking por appointment” (permite NULLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'bookings'
      AND c.conname = 'bookings_unique_appointment'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_unique_appointment UNIQUE (appointment_id);
  END IF;
END$$;

-- 3) FK a appointments(id) con estrategia NOT VALID para no romper datos existentes
DO $$
DECLARE
  has_fk boolean := EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'bookings'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'bookings_appointment_id_fkey'
  );
BEGIN
  IF NOT has_fk THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_appointment_id_fkey
      FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) NOT VALID;
  END IF;

  -- Intento de validación (si hay legacy con appointment_id huérfano, se puede validar más tarde)
  BEGIN
    ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_appointment_id_fkey;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END$$;









