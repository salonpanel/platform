# Script para inicializar Git y subir cambios
# Uso: .\scripts\setup-git.ps1

Write-Host "🔍 Verificando estado de Git..." -ForegroundColor Cyan

# Verificar si git está inicializado
if (Test-Path .git) {
    Write-Host "✅ Git ya está inicializado" -ForegroundColor Green
} else {
    Write-Host "📦 Inicializando Git..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git inicializado" -ForegroundColor Green
}

# Verificar si hay un remote configurado
$remote = git remote get-url origin 2>$null
if ($remote) {
    Write-Host "✅ Remote 'origin' configurado: $remote" -ForegroundColor Green
} else {
    Write-Host "⚠️  No hay remote 'origin' configurado" -ForegroundColor Yellow
    Write-Host "   Ejecuta: git remote add origin <URL_DEL_REPOSITORIO>" -ForegroundColor Yellow
}

# Añadir todos los archivos
Write-Host "📝 Añadiendo archivos..." -ForegroundColor Cyan
git add -A

# Verificar estado
$status = git status --short
if ($status) {
    Write-Host "📋 Archivos a committear:" -ForegroundColor Cyan
    Write-Host $status -ForegroundColor Gray
    
    # Hacer commit
    Write-Host "💾 Haciendo commit..." -ForegroundColor Cyan
    git commit -m "feat: P1 completado - Timezone por tenant y RLS tests suite completa

- P1.2: Timezone por tenant completo
  - Migración SQL para timezone en tenants
  - Endpoints API para obtener/actualizar timezone
  - UI actualizada (agenda, booking widget, reserve client, admin panel)
  - Validación de slots pasados en frontend
  - Gestión de timezone desde admin panel

- P1: RLS tests suite completa
  - Tests ejecutables con Jest (rls-executable.test.ts)
  - Tests SQL directos (rls-sql-test.sql)
  - Script de validación RLS (rls-validation.ts)
  - Configuración Jest y setup
  - Scripts de ejecución (bash y PowerShell)
  - Documentación completa

- Mejoras adicionales
  - ReserveClient actualizado para usar tenant_id
  - ReservePage actualizado para resolver tenant por UUID o slug
  - Admin panel con gestión de timezone
  - Scripts npm para ejecutar tests
  - Documentación de tests y ejecución"
    
    Write-Host "✅ Commit realizado" -ForegroundColor Green
    
    # Intentar hacer push
    if ($remote) {
        Write-Host "🚀 Subiendo cambios a GitHub..." -ForegroundColor Cyan
        git push -u origin main
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Cambios subidos a GitHub" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Error al subir cambios. Verifica la configuración del remote." -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  No se puede hacer push sin remote configurado" -ForegroundColor Yellow
        Write-Host "   Ejecuta: git remote add origin <URL_DEL_REPOSITORIO>" -ForegroundColor Yellow
        Write-Host "   Luego: git push -u origin main" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ No hay cambios para committear" -ForegroundColor Green
}

Write-Host "`n📋 Resumen:" -ForegroundColor Cyan
Write-Host "  - Git inicializado: $(if (Test-Path .git) { 'Sí' } else { 'No' })" -ForegroundColor Gray
Write-Host "  - Remote configurado: $(if ($remote) { 'Sí' } else { 'No' })" -ForegroundColor Gray
Write-Host "  - Archivos commiteados: $(if ($status) { 'Sí' } else { 'No' })" -ForegroundColor Gray

