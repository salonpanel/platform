-- ============================================================================
-- SCHEMA APP - Multi-tenant Context Functions
-- ============================================================================
-- Este schema contiene funciones para gestionar el contexto multi-tenant
-- Permite que las policies RLS accedan al tenant_id actual del usuario
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS "app";

ALTER SCHEMA "app" OWNER TO "postgres";

COMMENT ON SCHEMA "app" IS 'Schema para funciones de contexto multi-tenant (current_tenant_id, etc.)';

-- ============================================================================
-- Función: app.current_tenant_id()
-- ============================================================================
-- Retorna el tenant_id del usuario actual basado en su membership
-- Esta función es CRÍTICA para el sistema RLS multi-tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION "app"."current_tenant_id"() 
RETURNS "uuid"
LANGUAGE "sql" 
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT tenant_id 
  FROM public.memberships 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

ALTER FUNCTION "app"."current_tenant_id"() OWNER TO "postgres";

COMMENT ON FUNCTION "app"."current_tenant_id"() IS 'Retorna el tenant_id del usuario autenticado actual. Usado en policies RLS para multi-tenancy.';

-- Grant necesarios para que las policies puedan usar esta función
GRANT USAGE ON SCHEMA "app" TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "app"."current_tenant_id"() TO "anon", "authenticated", "service_role";
