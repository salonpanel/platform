-- Script para diagnosticar problemas completos de autenticación
-- UID del usuario: db57dbd2-9a8c-4050-b77f-e2236300f448

-- 1) Verificar estado completo del usuario
SELECT 
    id,
    email,
    email_confirmed_at,
    phone_confirmed_at,
    last_sign_in_at,
    created_at,
    updated_at,
    email_change_sent_at,
    phone,
    raw_user_meta_data
FROM auth.users 
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 2) Verificar si el usuario tiene factores MFA configurados
SELECT 
    id,
    user_id,
    friendly_name,
    factor_type,
    status,
    created_at,
    updated_at
FROM auth.mfa_factors 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 3) Verificar si hay sesiones recientes (última hora)
SELECT 
    id,
    user_id,
    created_at,
    expires_at,
    user_agent
FROM auth.sessions 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
  AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC;

-- 4) Verificar refresh tokens activos
SELECT 
    COUNT(*) as refresh_tokens_count
FROM auth.refresh_tokens 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
  AND revoked_at IS NULL
  AND expires_at > now();

-- 5) Verificar membresía del usuario para asegurar acceso
SELECT 
    m.tenant_id,
    m.user_id,
    m.role,
    t.name as tenant_name,
    t.slug as tenant_slug
FROM public.memberships m
JOIN public.tenants t ON m.tenant_id = t.id
WHERE m.user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 6) Verificar si hay algún problema con la configuración del tenant
SELECT 
    id,
    name,
    slug,
    contact_email,
    primary_color,
    created_at
FROM public.tenants 
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
