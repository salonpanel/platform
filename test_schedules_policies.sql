-- Script de prueba para ejecutar en Supabase SQL Editor
-- Ejecuta este código paso a paso para encontrar el error

-- PASO 1: Verificar que la función existe
SELECT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'current_tenant_id' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
) AS funcion_existe;

-- PASO 2: Verificar si la tabla schedules existe
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'schedules'
) AS schedules_existe;

-- PASO 3: Intentar crear el índice (si schedules existe)
DO $$
BEGIN
  IF to_regclass('public.schedules') IS NOT NULL THEN
    -- Primero eliminar el índice si existe
    DROP INDEX IF EXISTS idx_schedules_tenant_staff_weekday;
    -- Crear el índice
    CREATE INDEX idx_schedules_tenant_staff_weekday 
      ON public.schedules(tenant_id, staff_id, weekday);
    RAISE NOTICE 'Índice creado correctamente';
  ELSE
    RAISE NOTICE 'Tabla schedules no existe';
  END IF;
END $$;

-- PASO 4: Activar RLS en schedules
DO $$
BEGIN
  IF to_regclass('public.schedules') IS NOT NULL THEN
    ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activado en schedules';
  END IF;
END $$;

-- PASO 5: Crear policy de lectura (sin IF NOT EXISTS)
DO $$
BEGIN
  IF to_regclass('public.schedules') IS NOT NULL THEN
    -- Primero eliminar la policy si existe
    DROP POLICY IF EXISTS "tenant_read_schedules" ON public.schedules;
    
    -- Crear la policy
    CREATE POLICY "tenant_read_schedules" ON public.schedules
      FOR SELECT 
      USING (tenant_id = app.current_tenant_id());
      
    RAISE NOTICE 'Policy de lectura creada';
  END IF;
END $$;

-- PASO 6: Crear policy de escritura
DO $$
BEGIN
  IF to_regclass('public.schedules') IS NOT NULL THEN
    -- Primero eliminar la policy si existe
    DROP POLICY IF EXISTS "tenant_crud_schedules" ON public.schedules;
    
    -- Crear la policy
    CREATE POLICY "tenant_crud_schedules" ON public.schedules
      FOR ALL 
      USING (tenant_id = app.current_tenant_id())
      WITH CHECK (tenant_id = app.current_tenant_id());
      
    RAISE NOTICE 'Policy CRUD creada';
  END IF;
END $$;

-- RESULTADO: Si todos los pasos anteriores funcionan, el problema está resuelto
SELECT 'TODOS LOS PASOS COMPLETADOS' AS resultado;
