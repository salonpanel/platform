-- Script para forzar recreación completa de sesión y tokens
-- UID del usuario: db57dbd2-9a8c-4050-b77f-e2236300f448

-- 1) Eliminar TODAS las sesiones del usuario
DELETE FROM auth.sessions 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 2) Eliminar TODOS los refresh tokens del usuario
DELETE FROM auth.refresh_tokens 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 3) Eliminar factores MFA antiguos (si existen)
DELETE FROM auth.mfa_factors 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 4) Resetear completamente el estado del usuario
UPDATE auth.users 
SET 
    last_sign_in_at = null,
    email_confirmed_at = now(),
    phone_confirmed_at = null,
    updated_at = now(),
    raw_user_meta_data = jsonb_build_object('force_reauth', true)
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 5) Verificar que el usuario tenga membresía activa
INSERT INTO public.memberships (tenant_id, user_id, role)
SELECT 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'db57dbd2-9a8c-4050-b77f-e2236300f448',
    'owner'
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = 'owner',
    updated_at = now();

-- Verificación final
SELECT 
    'LIMPIEZA COMPLETADA' as status,
    'Sesiones eliminadas: ' || (SELECT COUNT(*) FROM auth.sessions WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448') as sessions,
    'Refresh tokens eliminados: ' || (SELECT COUNT(*) FROM auth.refresh_tokens WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448' AND revoked_at IS NULL) as refresh_tokens,
    'Email confirmado: ' || CASE WHEN (SELECT email_confirmed_at FROM auth.users WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448') IS NOT NULL THEN 'SI' ELSE 'NO' END as email_confirmed,
    'Membresía activa: ' || CASE WHEN EXISTS (SELECT 1 FROM public.memberships WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448') THEN 'SI' ELSE 'NO' END as membership;
