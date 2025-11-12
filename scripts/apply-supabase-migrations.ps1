# Script para aplicar migraciones de Supabase
# Uso: .\scripts\apply-supabase-migrations.ps1

Write-Host "🔍 Verificando migraciones de Supabase..." -ForegroundColor Cyan

# Verificar si Supabase CLI está instalado
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "⚠️  Supabase CLI no está instalado" -ForegroundColor Yellow
    Write-Host "   Instala con: npm install -g supabase" -ForegroundColor Yellow
    Write-Host "   O usa: npx supabase" -ForegroundColor Yellow
    exit 1
}

# Verificar si hay migraciones pendientes
$migrations = Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" | Sort-Object Name
Write-Host "📋 Migraciones encontradas: $($migrations.Count)" -ForegroundColor Cyan

# Listar migraciones
Write-Host "`n📝 Migraciones:" -ForegroundColor Cyan
foreach ($migration in $migrations) {
    Write-Host "  - $($migration.Name)" -ForegroundColor Gray
}

# Verificar si el proyecto está vinculado
Write-Host "`n🔗 Verificando conexión a Supabase..." -ForegroundColor Cyan
$linked = supabase status 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Proyecto vinculado a Supabase" -ForegroundColor Green
} else {
    Write-Host "⚠️  Proyecto no vinculado" -ForegroundColor Yellow
    Write-Host "   Vincula con: supabase link --project-ref <PROJECT_REF>" -ForegroundColor Yellow
    Write-Host "   O aplica migraciones manualmente desde el dashboard" -ForegroundColor Yellow
}

# Opciones
Write-Host "`n📋 Opciones:" -ForegroundColor Cyan
Write-Host "  1. Aplicar migraciones con Supabase CLI (supabase db push)" -ForegroundColor Gray
Write-Host "  2. Aplicar migraciones manualmente desde dashboard" -ForegroundColor Gray
Write-Host "  3. Ver contenido de migraciones pendientes" -ForegroundColor Gray

# Migración más reciente
$latestMigration = $migrations | Select-Object -Last 1
Write-Host "`n📌 Migración más reciente: $($latestMigration.Name)" -ForegroundColor Cyan

# Instrucciones
Write-Host "`n📖 Instrucciones:" -ForegroundColor Cyan
Write-Host "  Para aplicar migraciones:" -ForegroundColor Gray
Write-Host "    1. Opción A (CLI): supabase db push" -ForegroundColor Gray
Write-Host "    2. Opción B (Dashboard):" -ForegroundColor Gray
Write-Host "       - Ir a Supabase Dashboard > Database > Migrations" -ForegroundColor Gray
Write-Host "       - Copiar contenido de $($latestMigration.Name)" -ForegroundColor Gray
Write-Host "       - Ejecutar en SQL Editor" -ForegroundColor Gray
Write-Host "    3. Opción C (SQL directo):" -ForegroundColor Gray
Write-Host "       - Ir a SQL Editor" -ForegroundColor Gray
Write-Host "       - Copiar contenido de supabase/migrations/$($latestMigration.Name)" -ForegroundColor Gray
Write-Host "       - Ejecutar SQL" -ForegroundColor Gray

# Verificar migración más reciente
Write-Host "`n🔍 Migración más reciente a aplicar:" -ForegroundColor Cyan
Write-Host "  Archivo: $($latestMigration.Name)" -ForegroundColor Gray
Write-Host "  Ruta: $($latestMigration.FullName)" -ForegroundColor Gray

# Mostrar primeras líneas de la migración
Write-Host "`n📄 Primeras líneas de la migración:" -ForegroundColor Cyan
Get-Content $latestMigration.FullName -TotalCount 10 | ForEach-Object {
    Write-Host "  $_" -ForegroundColor Gray
}

Write-Host "`n✅ Script completado" -ForegroundColor Green

