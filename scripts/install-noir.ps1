# Script para instalar OWASP Noir en Windows
# Este script descarga e instala OWASP Noir para análisis de seguridad

Write-Host "=== Instalando OWASP Noir ===" -ForegroundColor Cyan

# Verificar si Noir ya está instalado
$noirInstalled = Get-Command noir -ErrorAction SilentlyContinue

if ($noirInstalled) {
    Write-Host "OWASP Noir ya está instalado" -ForegroundColor Green
    noir --version
    exit 0
}

# Detectar arquitectura del sistema
$arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { "i686" }
Write-Host "Arquitectura detectada: $arch" -ForegroundColor Yellow

# Obtener la última versión de Noir desde GitHub
Write-Host "Obteniendo la última versión de OWASP Noir..." -ForegroundColor Yellow

try {
    $latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/owasp-noir/noir/releases/latest"
    $version = $latestRelease.tag_name
    Write-Host "Última versión: $version" -ForegroundColor Green
    
    # Construir URL de descarga para Windows
    $downloadUrl = "https://github.com/owasp-noir/noir/releases/download/$version/noir-$version-$arch-pc-windows-msvc.zip"
    $zipFile = Join-Path $env:TEMP "noir.zip"
    $extractPath = Join-Path $env:TEMP "noir"
    
    Write-Host "Descargando desde: $downloadUrl" -ForegroundColor Yellow
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile
    
    # Extraer el archivo
    Write-Host "Extrayendo archivos..." -ForegroundColor Yellow
    Expand-Archive -Path $zipFile -DestinationPath $extractPath -Force
    
    # Crear directorio para herramientas si no existe
    $toolsDir = Join-Path $HOME ".noir"
    if (-not (Test-Path $toolsDir)) {
        New-Item -ItemType Directory -Path $toolsDir | Out-Null
    }
    
    # Mover el ejecutable
    $noirExe = Join-Path $extractPath "noir.exe"
    $destExe = Join-Path $toolsDir "noir.exe"
    Move-Item -Path $noirExe -Destination $destExe -Force
    
    # Agregar al PATH del usuario si no está
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$toolsDir*") {
        Write-Host "Agregando Noir al PATH del usuario..." -ForegroundColor Yellow
        $newPath = "$userPath;$toolsDir"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        $env:Path = "$env:Path;$toolsDir"
    }
    
    # Limpiar archivos temporales
    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "OWASP Noir instalado exitosamente en: $toolsDir" -ForegroundColor Green
    Write-Host "Ejecuta 'noir --version' para verificar la instalación" -ForegroundColor Green
    Write-Host "Puede que necesites reiniciar tu terminal para que el PATH se actualice" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error al instalar OWASP Noir: $_" -ForegroundColor Red
    Write-Host "Por favor, instala manualmente desde: https://github.com/owasp-noir/noir/releases" -ForegroundColor Yellow
    exit 1
}
