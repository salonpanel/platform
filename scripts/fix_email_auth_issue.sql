-- Script para diagnosticar y arreglar problemas de autenticación tras cambiar email
-- UID del usuario: db57dbd2-9a8c-4050-b77f-e2236300f448

-- 1) Verificar estado actual del usuario
SELECT 
    id,
    email,
    email_confirmed_at,
    phone,
    created_at,
    updated_at,
    last_sign_in_at,
    email_change_sent_at
FROM auth.users 
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 2) Verificar si hay tokens de verificación pendientes
-- Nota: La estructura de auth.mfa_challenges puede variar, usamos una consulta más simple
SELECT 
    COUNT(*) as tokens_pendientes
FROM auth.mfa_challenges 
WHERE created_at > now() - interval '1 hour'
  AND id IN (
    SELECT id FROM auth.mfa_challenges 
    WHERE factor_id IN (
      SELECT id FROM auth.mfa_factors 
      WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
    )
  );

-- 3) Forzar confirmación del email nuevo (si es necesario)
UPDATE auth.users 
SET 
    email_confirmed_at = now(),
    updated_at = now()
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
  AND email = 'josepcalafataloy@gmail.com';

-- 4) Limpiar tokens antiguos que puedan causar conflictos
DELETE FROM auth.mfa_challenges 
WHERE created_at < now() - interval '30 minutes'
  AND factor_id IN (
    SELECT id FROM auth.mfa_factors 
    WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
  );

-- 5) Verificar membresía del usuario (para asegurar acceso al panel)
SELECT 
    tenant_id,
    user_id,
    role,
    created_at
FROM public.memberships 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- Verificación final del estado
SELECT 
    'Usuario' as tipo,
    id,
    email,
    CASE WHEN email_confirmed_at IS NOT NULL THEN 'CONFIRMED' ELSE 'NOT_CONFIRMED' END as email_status
FROM auth.users 
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'

UNION ALL

SELECT 
    'Tenant' as tipo,
    id as tenant_id,
    contact_email as email,
    'N/A' as email_status
FROM public.tenants 
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
