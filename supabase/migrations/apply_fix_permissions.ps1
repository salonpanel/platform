# Script para aplicar la migración 0110_fix_permissions_owner_admin.sql
# Fecha: 2025-12-10
# Fix: Usuarios owner/admin no veían todas las opciones del menú

param(
    [Parameter(Mandatory=$false)]
    [string]$Host = $env:SUPABASE_DB_HOST,
    
    [Parameter(Mandatory=$false)]
    [string]$User = $env:SUPABASE_DB_USER,
    
    [Parameter(Mandatory=$false)]
    [string]$Database = $env:SUPABASE_DB_NAME
)

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  FIX: Permisos para Owner/Admin" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Verificar que psql está instalado
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ ERROR: psql no está instalado o no está en el PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para instalar PostgreSQL client:" -ForegroundColor Yellow
    Write-Host "  1. Windows: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    Write-Host "  2. O usa la terminal de Supabase: https://app.supabase.com" -ForegroundColor Gray
    exit 1
}

# Verificar parámetros
if (-not $Host -or -not $User -or -not $Database) {
    Write-Host "⚠️  Falta información de conexión" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Uso:" -ForegroundColor White
    Write-Host "  .\apply_fix_permissions.ps1 -Host <host> -User <user> -Database <database>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "O define variables de entorno:" -ForegroundColor White
    Write-Host "  `$env:SUPABASE_DB_HOST = 'db.xxx.supabase.co'" -ForegroundColor Gray
    Write-Host "  `$env:SUPABASE_DB_USER = 'postgres'" -ForegroundColor Gray
    Write-Host "  `$env:SUPABASE_DB_NAME = 'postgres'" -ForegroundColor Gray
    exit 1
}

$migrationFile = "0110_fix_permissions_owner_admin.sql"
$migrationPath = Join-Path $PSScriptRoot $migrationFile

if (-not (Test-Path $migrationPath)) {
    Write-Host "❌ ERROR: No se encontró el archivo $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Información de conexión:" -ForegroundColor White
Write-Host "   Host: $Host" -ForegroundColor Gray
Write-Host "   User: $User" -ForegroundColor Gray
Write-Host "   Database: $Database" -ForegroundColor Gray
Write-Host ""

Write-Host "📁 Aplicando migración: $migrationFile" -ForegroundColor White
Write-Host ""

# Ejecutar migración
Write-Host "⏳ Ejecutando SQL..." -ForegroundColor Yellow
$result = psql -h $Host -U $User -d $Database -f $migrationPath 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Migración aplicada correctamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  FIX COMPLETADO" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🔄 Próximos pasos:" -ForegroundColor White
    Write-Host "   1. Refresca la página del panel (Ctrl+Shift+R)" -ForegroundColor Gray
    Write-Host "   2. Verifica que aparecen todas las opciones del menú" -ForegroundColor Gray
    Write-Host "   3. Si no aparecen, cierra sesión y vuelve a entrar" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Error al aplicar la migración:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Gray
    Write-Host ""
    exit 1
}
