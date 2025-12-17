#!/bin/bash
# Script para ejecutar tests RLS
# Uso: ./scripts/test-rls.sh

set -e

echo "🔍 Ejecutando tests RLS..."

# Verificar que las variables de entorno estén configuradas
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL no está configurado"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY no está configurado"
  exit 1
fi

# Ejecutar tests RLS
npm test -- tests/rls-executable.test.ts

echo "✅ Tests RLS completados"

