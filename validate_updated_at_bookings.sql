BEGIN;

-- 1. Ver updated_at antes de modificar
SELECT
  id,
  updated_at
FROM public.bookings
WHERE id = '66666666-6666-6666-6666-666666666666';

-- 2. Ejecutar un update que NO cambie nada relevante
UPDATE public.bookings
SET status = status
WHERE id = '66666666-6666-6666-6666-666666666666';

-- 3. Ver updated_at después del update
SELECT
  id,
  updated_at
FROM public.bookings
WHERE id = '66666666-6666-6666-6666-666666666666';

ROLLBACK;
