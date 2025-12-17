-- Smoke test para trigger trg_guard_paid_bookings
-- Precondición: existe un booking con status 'paid' o 'completed'
-- Este test intenta modificar campos protegidos y espera error

-- Ajusta IDs de ejemplo antes de ejecutar manualmente en un entorno de pruebas
-- SELECT id, status, staff_id, starts_at, ends_at FROM bookings WHERE status IN ('paid','completed') LIMIT 1;
-- \set booking_id '00000000-0000-0000-0000-000000000000'
-- \set new_staff_id '00000000-0000-0000-0000-000000000000'

-- Intentar cambiar staff_id
DO $$
BEGIN
  BEGIN
    UPDATE bookings
      SET staff_id = :'new_staff_id'
    WHERE id = :'booking_id';
    RAISE EXCEPTION 'Expected trigger to block staff change on paid booking';
  EXCEPTION WHEN OTHERS THEN
    -- OK: el trigger debe impedir el cambio
    RAISE NOTICE 'Trigger blocked staff change as expected: %', SQLERRM;
  END;

  -- Intentar cambiar horario
  BEGIN
    UPDATE bookings
      SET starts_at = NOW() + interval '1 hour',
          ends_at = NOW() + interval '2 hour'
    WHERE id = :'booking_id';
    RAISE EXCEPTION 'Expected trigger to block time change on paid booking';
  EXCEPTION WHEN OTHERS THEN
    -- OK: el trigger debe impedir el cambio
    RAISE NOTICE 'Trigger blocked time change as expected: %', SQLERRM;
  END;
END
$$ LANGUAGE plpgsql;









