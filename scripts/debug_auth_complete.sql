-- Script completo para diagnosticar problemas de autenticación
-- UID del usuario: db57dbd2-9a8c-4050-b77f-e2236300f448

-- 1) Estado completo del usuario
SELECT 
    'USUARIO' as tipo,
    id,
    email,
    CASE WHEN email_confirmed_at IS NOT NULL THEN 'CONFIRMED' ELSE 'NOT_CONFIRMED' END as email_status,
    last_sign_in_at,
    created_at,
    updated_at
FROM auth.users 
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'

UNION ALL

-- 2) Sesiones activas (última hora)
SELECT 
    'SESIONES' as tipo,
    COUNT(*)::text as id,
    COUNT(*) || ' sesiones' as email,
    MAX(created_at)::text as email_status,
    MAX(expires_at)::text as last_sign_in_at,
    MIN(created_at)::text as created_at,
    MAX(created_at)::text as updated_at
FROM auth.sessions 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
  AND created_at > now() - interval '1 hour'

UNION ALL

-- 3) Refresh tokens
SELECT 
    'REFRESH_TOKENS' as tipo,
    COUNT(*)::text as id,
    COUNT(*) || ' tokens' as email,
    CASE WHEN COUNT(*) > 0 THEN 'ACTIVE' ELSE 'NONE' END as email_status,
    MAX(expires_at)::text as last_sign_in_at,
    MIN(created_at)::text as created_at,
    MAX(created_at)::text as updated_at
FROM auth.refresh_tokens 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
  AND revoked_at IS NULL
  AND expires_at > now()

UNION ALL

-- 4) Membresía
SELECT 
    'MEMBERSHIP' as tipo,
    m.tenant_id as id,
    m.role as email,
    t.name as email_status,
    m.created_at as last_sign_in_at,
    m.created_at as created_at,
    m.created_at as updated_at
FROM public.memberships m
JOIN public.tenants t ON m.tenant_id = t.id
WHERE m.user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'

UNION ALL

-- 5) Tenant info
SELECT 
    'TENANT' as tipo,
    id,
    name as email,
    contact_email as email_status,
    created_at as last_sign_in_at,
    created_at as created_at,
    updated_at as updated_at
FROM public.tenants 
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

ORDER BY tipo;
