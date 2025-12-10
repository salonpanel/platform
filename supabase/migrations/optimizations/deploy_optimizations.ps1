# =====================================================
# SCRIPT DE DESPLIEGUE DE OPTIMIZACIONES
# =====================================================
# PowerShell script para ejecutar todas las migraciones de optimización
# Uso: .\deploy_optimizations.ps1
# =====================================================

param(
    [string]$SupabaseUrl = $env:SUPABASE_URL,
    [string]$SupabaseKey = $env:SUPABASE_SERVICE_KEY,
    [switch]$SkipValidation,
    [switch]$SkipBackup,
    [switch]$DryRun
)

# Colores para output
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Step { param($Message) Write-Host "`n▶ $Message" -ForegroundColor Blue -BackgroundColor Black }

# Banner
Write-Host @"

═══════════════════════════════════════════════════════
    🚀 OPTIMIZACIÓN DE BASE DE DATOS - BOOKFAST
═══════════════════════════════════════════════════════

"@ -ForegroundColor Cyan

# Verificar prerrequisitos
Write-Step "Verificando prerrequisitos..."

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Error "psql no está instalado o no está en el PATH"
    Write-Info "Instala PostgreSQL client tools: https://www.postgresql.org/download/"
    exit 1
}

if (-not $SupabaseUrl) {
    Write-Error "Variable SUPABASE_URL no está definida"
    Write-Info "Ejecuta: `$env:SUPABASE_URL = 'tu-url'"
    exit 1
}

Write-Success "Prerrequisitos verificados"

# Directorio de migraciones
$MigrationsDir = Join-Path $PSScriptRoot ""
$BackupDir = Join-Path $PSScriptRoot ".." ".." "backups"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# Función para ejecutar SQL
function Invoke-SqlFile {
    param(
        [string]$FilePath,
        [string]$Description
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Error "Archivo no encontrado: $FilePath"
        return $false
    }
    
    Write-Info "Ejecutando: $Description"
    
    if ($DryRun) {
        Write-Warning "DRY RUN - No se ejecutará el script"
        return $true
    }
    
    try {
        $output = psql $SupabaseUrl -f $FilePath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$Description - Completado"
            return $true
        } else {
            Write-Error "$Description - Falló"
            Write-Host $output -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Error "Error ejecutando $FilePath : $_"
        return $false
    }
}

# Función para crear backup
function New-DatabaseBackup {
    Write-Step "Creando backup de la base de datos..."
    
    if ($SkipBackup) {
        Write-Warning "Backup omitido (flag -SkipBackup)"
        return $true
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $BackupDir "backup_pre_optimization_$timestamp.sql"
    
    Write-Info "Guardando backup en: $backupFile"
    
    if ($DryRun) {
        Write-Warning "DRY RUN - No se creará backup"
        return $true
    }
    
    try {
        pg_dump $SupabaseUrl -f $backupFile 2>&1 | Out-Null
        
        if (Test-Path $backupFile) {
            $size = (Get-Item $backupFile).Length / 1MB
            Write-Success "Backup creado exitosamente ($([math]::Round($size, 2)) MB)"
            return $true
        } else {
            Write-Error "No se pudo crear el backup"
            return $false
        }
    } catch {
        Write-Error "Error creando backup: $_"
        return $false
    }
}

# INICIO DEL PROCESO
Write-Host ""
$startTime = Get-Date

# Paso 1: Pre-validación
if (-not $SkipValidation) {
    Write-Step "PASO 1: Pre-validación"
    
    $preValidation = Join-Path $MigrationsDir "000_pre_validation.sql"
    
    if (-not (Invoke-SqlFile -FilePath $preValidation -Description "Pre-validación del sistema")) {
        Write-Error "La pre-validación falló. Revisa los errores antes de continuar."
        
        $continue = Read-Host "¿Deseas continuar de todas formas? (s/N)"
        if ($continue -ne "s" -and $continue -ne "S") {
            exit 1
        }
    }
} else {
    Write-Warning "Pre-validación omitida (flag -SkipValidation)"
}

# Paso 2: Backup
Write-Step "PASO 2: Backup de la base de datos"

if (-not (New-DatabaseBackup)) {
    Write-Error "No se pudo crear el backup"
    
    $continue = Read-Host "¿Deseas continuar sin backup? (s/N)"
    if ($continue -ne "s" -and $continue -ne "S") {
        exit 1
    }
}

# Paso 3: Confirmar despliegue
if (-not $DryRun) {
    Write-Host ""
    Write-Warning "═══════════════════════════════════════════════════════"
    Write-Warning "  ADVERTENCIA: Se van a ejecutar las optimizaciones"
    Write-Warning "  Esto modificará la estructura de la base de datos"
    Write-Warning "═══════════════════════════════════════════════════════"
    Write-Host ""
    
    $confirm = Read-Host "¿Deseas continuar? (s/N)"
    if ($confirm -ne "s" -and $confirm -ne "S") {
        Write-Info "Despliegue cancelado por el usuario"
        exit 0
    }
}

# Paso 4: Ejecutar migraciones
Write-Step "PASO 3: Ejecutando migraciones de optimización"

$migrations = @(
    @{ File = "005_indexes_composite.sql"; Description = "Creando índices compuestos" },
    @{ File = "001_get_dashboard_kpis.sql"; Description = "Creando función get_dashboard_kpis" },
    @{ File = "002_get_services_filtered.sql"; Description = "Creando funciones de servicios" },
    @{ File = "003_get_staff_with_stats.sql"; Description = "Creando funciones de staff" },
    @{ File = "006_chat_optimization.sql"; Description = "Optimizando chat" },
    @{ File = "004_daily_metrics_materialized.sql"; Description = "Creando tabla daily_metrics" }
)

$successCount = 0
$failCount = 0

foreach ($migration in $migrations) {
    $filePath = Join-Path $MigrationsDir $migration.File
    
    if (Invoke-SqlFile -FilePath $filePath -Description $migration.Description) {
        $successCount++
    } else {
        $failCount++
        
        Write-Error "Migración falló: $($migration.File)"
        
        $continue = Read-Host "¿Deseas continuar con las siguientes migraciones? (s/N)"
        if ($continue -ne "s" -and $continue -ne "S") {
            break
        }
    }
}

# Paso 5: Inicializar métricas (opcional)
if ($successCount -gt 0 -and -not $DryRun) {
    Write-Step "PASO 4: Inicialización de métricas"
    
    $initMetrics = Read-Host "¿Deseas inicializar las métricas históricas? (s/N)"
    if ($initMetrics -eq "s" -or $initMetrics -eq "S") {
        Write-Info "Inicializando métricas de los últimos 90 días..."
        Write-Warning "Esto puede tomar varios minutos..."
        
        $initQuery = "SELECT initialize_daily_metrics(NULL, 90);"
        
        try {
            psql $SupabaseUrl -c $initQuery
            Write-Success "Métricas inicializadas correctamente"
        } catch {
            Write-Warning "Error inicializando métricas: $_"
            Write-Info "Puedes ejecutar manualmente: SELECT initialize_daily_metrics();"
        }
    }
}

# Paso 6: Post-validación
if (-not $SkipValidation) {
    Write-Step "PASO 5: Post-validación"
    
    $postValidation = Join-Path $MigrationsDir "999_post_validation.sql"
    
    Invoke-SqlFile -FilePath $postValidation -Description "Post-validación del sistema" | Out-Null
}

# Resumen final
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "              📊 RESUMEN DEL DESPLIEGUE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Migraciones exitosas: " -NoNewline
Write-Host $successCount -ForegroundColor Green
Write-Host "Migraciones fallidas:  " -NoNewline
Write-Host $failCount -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host "Tiempo total:          " -NoNewline
Write-Host "$([math]::Round($duration.TotalSeconds, 2)) segundos" -ForegroundColor Cyan
Write-Host ""

if ($failCount -eq 0) {
    Write-Success "✓ ¡Optimizaciones implementadas exitosamente!"
    Write-Host ""
    Write-Info "PRÓXIMOS PASOS:"
    Write-Info "1. Actualizar el código del frontend para usar las nuevas funciones"
    Write-Info "2. Ejecutar tests de integración"
    Write-Info "3. Monitorear el rendimiento en las próximas 24-48 horas"
    Write-Info "4. Verificar logs de errores en Supabase"
} else {
    Write-Warning "⚠ Algunas migraciones fallaron"
    Write-Info "Revisa los logs y ejecuta las migraciones faltantes manualmente"
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Guardar log
$logFile = Join-Path $BackupDir "deploy_log_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$logContent = @"
Despliegue de Optimizaciones - BookFast
========================================

Fecha: $(Get-Date)
Duración: $($duration.TotalSeconds) segundos
Migraciones exitosas: $successCount
Migraciones fallidas: $failCount

Migraciones ejecutadas:
$($migrations | ForEach-Object { "- $($_.Description)" } | Out-String)
"@

$logContent | Out-File -FilePath $logFile -Encoding UTF8
Write-Info "Log guardado en: $logFile"
