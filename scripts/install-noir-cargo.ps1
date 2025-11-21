# Script para instalar OWASP Noir usando Cargo (Rust)
# Esta es la forma más confiable en Windows

Write-Host "=== Instalando OWASP Noir via Cargo ===" -ForegroundColor Cyan
Write-Host ""

# Verificar si Cargo está instalado
$cargoInstalled = Get-Command cargo -ErrorAction SilentlyContinue

if (-not $cargoInstalled) {
    Write-Host "Cargo (Rust) no está instalado." -ForegroundColor Yellow
    Write-Host "Instalando Rust y Cargo..." -ForegroundColor Yellow
    Write-Host ""
    
    # Descargar e instalar rustup (instalador de Rust)
    try {
        $rustupUrl = "https://win.rustup.rs/x86_64"
        $rustupPath = "$env:TEMP\rustup-init.exe"
        
        Write-Host "Descargando Rust installer..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupPath
        
        Write-Host "Instalando Rust (esto puede tomar unos minutos)..." -ForegroundColor Yellow
        Write-Host "NOTA: Acepta las opciones por defecto presionando Enter" -ForegroundColor Cyan
        
        # Ejecutar instalador
        Start-Process -FilePath $rustupPath -ArgumentList "-y" -Wait -NoNewWindow
        
        # Actualizar PATH en sesión actual
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Host "Rust instalado exitosamente" -ForegroundColor Green
        
        # Limpiar
        Remove-Item $rustupPath -Force -ErrorAction SilentlyContinue
        
    } catch {
        Write-Host "Error al instalar Rust: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Por favor, instala Rust manualmente desde: https://rustup.rs/" -ForegroundColor Yellow
        exit 1
    }
}

# Verificar que cargo funciona
Write-Host "Verificando instalación de Cargo..." -ForegroundColor Yellow
cargo --version

Write-Host ""
Write-Host "Instalando OWASP Noir desde crates.io..." -ForegroundColor Yellow
Write-Host "NOTA: Esto compilará Noir desde el código fuente (puede tomar 5-10 minutos)" -ForegroundColor Cyan
Write-Host ""

try {
    # Instalar noir usando cargo
    cargo install noir
    
    Write-Host ""
    Write-Host "OWASP Noir instalado exitosamente" -ForegroundColor Green
    Write-Host ""
    
    # Verificar instalación
    Write-Host "Verificando instalación..." -ForegroundColor Yellow
    noir --version
    
    Write-Host ""
    Write-Host "Instalación completada" -ForegroundColor Green
    Write-Host "Puedes usar 'noir' desde cualquier terminal" -ForegroundColor Green
    
} catch {
    Write-Host "Error al instalar OWASP Noir: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Intenta manualmente: cargo install noir" -ForegroundColor Yellow
    exit 1
}
