-- Script para forzar reset completo de sesión del usuario
-- UID del usuario: db57dbd2-9a8c-4050-b77f-e2236300f448

-- 1) Eliminar todas las sesiones activas del usuario
DELETE FROM auth.sessions 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- 2) Eliminar todos los tokens de verificación
DELETE FROM auth.mfa_challenges 
WHERE factor_id IN (
  SELECT id FROM auth.mfa_factors 
  WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
);

-- 3) Resetear timestamp de último login para forzar nueva autenticación
UPDATE auth.users 
SET 
    last_sign_in_at = null,
    email_confirmed_at = now(),
    updated_at = now()
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';

-- Verificación
SELECT 
    'Sesiones activas: ' || COUNT(*) as status
FROM auth.sessions 
WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'

UNION ALL

SELECT 
    'Tokens pendientes: ' || COUNT(*) as status
FROM auth.mfa_challenges 
WHERE factor_id IN (
  SELECT id FROM auth.mfa_factors 
  WHERE user_id = 'db57dbd2-9a8c-4050-b77f-e2236300f448'
)

UNION ALL

SELECT 
    'Email confirmado: ' || CASE WHEN email_confirmed_at IS NOT NULL THEN 'SI' ELSE 'NO' END as status
FROM auth.users 
WHERE id = 'db57dbd2-9a8c-4050-b77f-e2236300f448';
