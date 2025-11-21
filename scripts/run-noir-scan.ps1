# Script para ejecutar análisis de seguridad con OWASP Noir
# Detecta endpoints y superficies de ataque en el código fuente

param(
    [string]$BaseUrl = "https://localhost:3000",
    [string]$OutputFormat = "json",
    [switch]$Verbose,
    [switch]$WithTags
)

Write-Host "=== Análisis de Seguridad con OWASP Noir ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que Noir está instalado
$noirCommand = Get-Command noir -ErrorAction SilentlyContinue
if (-not $noirCommand) {
    Write-Host "✗ OWASP Noir no está instalado" -ForegroundColor Red
    Write-Host "Ejecuta: .\scripts\install-noir.ps1" -ForegroundColor Yellow
    exit 1
}

# Directorio del proyecto
$projectDir = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectDir "security-reports"

# Crear directorio de reportes si no existe
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "✓ Directorio de reportes creado: $outputDir" -ForegroundColor Green
}

# Timestamp para el reporte
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$reportFile = Join-Path $outputDir "noir-report_$timestamp.$OutputFormat"

Write-Host "Configuración del análisis:" -ForegroundColor Yellow
Write-Host "  • Directorio: $projectDir" -ForegroundColor White
Write-Host "  • URL Base: $BaseUrl" -ForegroundColor White
Write-Host "  • Formato: $OutputFormat" -ForegroundColor White
Write-Host "  • Reporte: $reportFile" -ForegroundColor White
Write-Host ""

# Construir comando de Noir
$noirArgs = @(
    "-b", $projectDir,
    "-u", $BaseUrl,
    "-f", $OutputFormat
)

if ($WithTags) {
    $noirArgs += "-T"
}

if ($Verbose) {
    $noirArgs += "--verbose"
}

# Ejecutar análisis
Write-Host "Ejecutando análisis de seguridad..." -ForegroundColor Yellow
Write-Host "Comando: noir $($noirArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

try {
    # Ejecutar Noir y capturar salida
    $output = & noir @noirArgs 2>&1
    
    # Guardar reporte
    $output | Out-File -FilePath $reportFile -Encoding UTF8
    
    Write-Host "✓ Análisis completado exitosamente" -ForegroundColor Green
    Write-Host "✓ Reporte guardado en: $reportFile" -ForegroundColor Green
    Write-Host ""
    
    # Mostrar resumen si es JSON
    if ($OutputFormat -eq "json") {
        try {
            $jsonContent = Get-Content $reportFile -Raw | ConvertFrom-Json
            $endpointCount = $jsonContent.endpoints.Count
            
            Write-Host "=== Resumen del Análisis ===" -ForegroundColor Cyan
            Write-Host "Total de endpoints detectados: $endpointCount" -ForegroundColor White
            Write-Host ""
            
            if ($endpointCount -gt 0) {
                Write-Host "Endpoints encontrados:" -ForegroundColor Yellow
                foreach ($endpoint in $jsonContent.endpoints | Select-Object -First 10) {
                    $method = $endpoint.method
                    $url = $endpoint.url
                    $paramCount = $endpoint.params.Count
                    
                    Write-Host "  [$method] $url" -ForegroundColor White
                    if ($paramCount -gt 0) {
                        Write-Host "    Parámetros: $paramCount" -ForegroundColor Gray
                        
                        # Mostrar parámetros con tags de seguridad
                        foreach ($param in $endpoint.params) {
                            $paramName = $param.name
                            $paramType = $param.param_type
                            Write-Host "      - $paramName ($paramType)" -ForegroundColor Gray
                            
                            if ($param.tags -and $param.tags.Count -gt 0) {
                                foreach ($tag in $param.tags) {
                                    Write-Host "        ⚠ $($tag.name): $($tag.description)" -ForegroundColor Red
                                }
                            }
                        }
                    }
                    Write-Host ""
                }
                
                if ($endpointCount -gt 10) {
                    Write-Host "  ... y $($endpointCount - 10) endpoints más" -ForegroundColor Gray
                    Write-Host ""
                }
            }
            
            # Contar vulnerabilidades potenciales
            $vulnerabilities = 0
            foreach ($endpoint in $jsonContent.endpoints) {
                foreach ($param in $endpoint.params) {
                    if ($param.tags -and $param.tags.Count -gt 0) {
                        $vulnerabilities += $param.tags.Count
                    }
                }
            }
            
            if ($vulnerabilities -gt 0) {
                Write-Host "⚠ Vulnerabilidades potenciales detectadas: $vulnerabilities" -ForegroundColor Red
                Write-Host "Revisa el reporte completo para más detalles" -ForegroundColor Yellow
            } else {
                Write-Host "✓ No se detectaron vulnerabilidades obvias" -ForegroundColor Green
            }
            
        } catch {
            Write-Host "⚠ No se pudo parsear el reporte JSON para mostrar resumen" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "Para ver el reporte completo:" -ForegroundColor Cyan
    Write-Host "  code $reportFile" -ForegroundColor White
    
} catch {
    Write-Host "✗ Error al ejecutar el análisis: $_" -ForegroundColor Red
    exit 1
}
