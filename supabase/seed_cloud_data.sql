-- ============================================
-- SEED SCRIPT: Cloud Data Import
-- ============================================
-- Este script contiene los INSERT statements
-- para todos los datos del Cloud
-- (usuarios, tenants, customers, etc.)
-- 
-- Uso: psql -U postgres -h localhost -p 54322 -d postgres -f supabase/seed_cloud_data.sql
-- O: Copiar el contenido de supabase/cloud_data_dump.sql (lineas 30+)
-- ============================================

-- Desabilitar triggers temporalmente para evitar conflictos de FK
SET session_replication_role = replica;

-- Aquí irian todos los INSERTs del cloud_data_dump.sql
-- Por ahora, placeholder para estructura correcta
-- Los datos reales están en supabase/cloud_data_dump.sql (lineas 30 en adelante)

-- Reabilitar triggers
SET session_replication_role = default;

-- Script completado
SELECT 'Cloud data import script ready. Extract INSERT statements from cloud_data_dump.sql (line 30+) and append here.';
