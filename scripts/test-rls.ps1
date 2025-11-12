# Script para ejecutar tests RLS (PowerShell)
# Uso: .\scripts\test-rls.ps1

Write-Host "🔍 Ejecutando tests RLS..." -ForegroundColor Cyan

# Verificar que las variables de entorno estén configuradas
if (-not $env:NEXT_PUBLIC_SUPABASE_URL) {
    Write-Host "❌ NEXT_PUBLIC_SUPABASE_URL no está configurado" -ForegroundColor Red
    exit 1
}

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "❌ SUPABASE_SERVICE_ROLE_KEY no está configurado" -ForegroundColor Red
    exit 1
}

# Ejecutar tests RLS
npm test -- tests/rls-executable.test.ts

Write-Host "✅ Tests RLS completados" -ForegroundColor Green

