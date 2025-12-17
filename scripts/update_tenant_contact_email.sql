-- Script para actualizar el email de contacto del tenant Book Fast
-- ID del tenant: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- UID del usuario: db57dbd2-9a8c-4050-b77f-e2236300f448

-- 1) Actualizar el email de contacto del tenant (tabla pública)
UPDATE public.tenants 
SET contact_email = 'josepcalafataloy@gmail.com'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' 
  AND name = 'Book Fast'
  AND slug = 'barberia-demo';

-- 2) Actualizar el email del usuario en auth.users
UPDATE auth.users 
SET email = 'josepcalafataloy@gmail.com'
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- Verificación de los cambios
-- 1) Verificar tenant actualizado
SELECT 
    id,
    name,
    slug,
    contact_email,
    contact_phone,
    primary_color,
    created_at
FROM public.tenants 
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 2) Verificar usuario actualizado
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at
FROM auth.users 
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- Si quieres ver todos los tenants para verificar:
-- SELECT * FROM public.tenants ORDER BY created_at;
