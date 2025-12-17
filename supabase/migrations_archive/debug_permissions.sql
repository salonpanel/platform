-- Query de debug para verificar roles y permisos
-- Ejecutar esto en Supabase SQL Editor para ver el problema

-- 1. Ver todos los usuarios con rol 'owner'
SELECT 
  m.user_id,
  m.tenant_id,
  m.role,
  t.name as tenant_name,
  up.permissions
FROM memberships m
LEFT JOIN tenants t ON t.id = m.tenant_id
LEFT JOIN user_permissions up ON up.user_id = m.user_id AND up.tenant_id = m.tenant_id
WHERE m.role = 'owner'
ORDER BY m.created_at DESC;

-- 2. Probar la función RPC con un usuario específico
-- Reemplazar USER_ID y TENANT_ID con valores reales
SELECT * FROM get_user_role_and_permissions(
  'USER_ID'::uuid,  -- Reemplazar con el user_id real
  'TENANT_ID'::uuid -- Reemplazar con el tenant_id real
);

-- 3. Ver si existen registros en user_permissions para owners
-- (No deberían existir, ya que owner tiene todo por defecto)
SELECT 
  up.*,
  m.role
FROM user_permissions up
INNER JOIN memberships m ON m.user_id = up.user_id AND m.tenant_id = up.tenant_id
WHERE m.role = 'owner';
