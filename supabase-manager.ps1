# Script PowerShell para gestionar Supabase en WSL2
# Ejecutar desde PowerShell en Windows

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('install', 'start', 'stop', 'status', 'reset', 'test', 'help')]
    [string]$Command = 'help'
)

$WSL_DISTRO = "Ubuntu-24.04"
$PROJECT_PATH = "/mnt/c/Users/Josep Calafat/Documents/GitHub/platform"

function Show-Help {
    Write-Host @"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Supabase Manager para WSL2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USO:
  .\supabase-manager.ps1 <comando>

COMANDOS DISPONIBLES:
  install    - Instalar Supabase CLI en Ubuntu WSL2
  start      - Iniciar Supabase localmente
  stop       - Detener Supabase
  status     - Ver estado de Supabase
  reset      - Reiniciar Supabase (borra datos)
  test       - Probar conexión a Supabase
  help       - Mostrar esta ayuda

EJEMPLOS:
  .\supabase-manager.ps1 install
  .\supabase-manager.ps1 start
  .\supabase-manager.ps1 status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@ -ForegroundColor Cyan
}

function Install-SupabaseCLI {
    Write-Host "🔧 Instalando Supabase CLI en Ubuntu WSL2..." -ForegroundColor Yellow
    Write-Host ""
    
    $installScript = @"
cd '$PROJECT_PATH' && chmod +x scripts/install-supabase-cli.sh && ./scripts/install-supabase-cli.sh
"@
    
    wsl -d $WSL_DISTRO -- bash -c $installScript
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Instalación completada!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Error durante la instalación" -ForegroundColor Red
        exit 1
    }
}

function Start-Supabase {
    Write-Host "🚀 Iniciando Supabase..." -ForegroundColor Yellow
    Write-Host "⏱️  Esto puede tardar varios minutos la primera vez" -ForegroundColor Cyan
    Write-Host ""
    
    $startCmd = "cd '$PROJECT_PATH' && npm run supabase:start"
    wsl -d $WSL_DISTRO -- bash -c $startCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Supabase iniciado correctamente!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📍 URLs importantes:" -ForegroundColor Cyan
        Write-Host "   Studio:  http://127.0.0.1:54323" -ForegroundColor White
        Write-Host "   API:     http://127.0.0.1:54321" -ForegroundColor White
        Write-Host "   Email:   http://127.0.0.1:54324" -ForegroundColor White
        Write-Host ""
        Write-Host "📝 Siguiente paso:" -ForegroundColor Cyan
        Write-Host "   1. Copia las keys del output anterior" -ForegroundColor White
        Write-Host "   2. Pégalas en .env.local" -ForegroundColor White
        Write-Host "   3. Ejecuta: npm run dev" -ForegroundColor White
        Write-Host ""
    }
}

function Stop-Supabase {
    Write-Host "🛑 Deteniendo Supabase..." -ForegroundColor Yellow
    
    $stopCmd = "cd '$PROJECT_PATH' && npm run supabase:stop"
    wsl -d $WSL_DISTRO -- bash -c $stopCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Supabase detenido" -ForegroundColor Green
    }
}

function Get-SupabaseStatus {
    Write-Host "📊 Estado de Supabase:" -ForegroundColor Cyan
    Write-Host ""
    
    $statusCmd = "cd '$PROJECT_PATH' && npm run supabase:status"
    wsl -d $WSL_DISTRO -- bash -c $statusCmd
}

function Reset-Supabase {
    Write-Host "⚠️  ADVERTENCIA: Esto borrará todos los datos locales!" -ForegroundColor Red
    $confirmation = Read-Host "¿Estás seguro? (escribe 'si' para continuar)"
    
    if ($confirmation -eq 'si') {
        Write-Host "🔄 Reiniciando Supabase..." -ForegroundColor Yellow
        
        $resetCmd = "cd '$PROJECT_PATH' && npm run supabase:reset"
        wsl -d $WSL_DISTRO -- bash -c $resetCmd
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Supabase reiniciado con éxito" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ Operación cancelada" -ForegroundColor Yellow
    }
}

function Test-SupabaseConnection {
    Write-Host "🧪 Probando conexión a Supabase..." -ForegroundColor Yellow
    Write-Host ""
    
    $testCmd = "cd '$PROJECT_PATH' && npm run test:supabase-connection"
    wsl -d $WSL_DISTRO -- bash -c $testCmd
}

# Ejecutar comando
switch ($Command) {
    'install' { Install-SupabaseCLI }
    'start'   { Start-Supabase }
    'stop'    { Stop-Supabase }
    'status'  { Get-SupabaseStatus }
    'reset'   { Reset-Supabase }
    'test'    { Test-SupabaseConnection }
    'help'    { Show-Help }
    default   { Show-Help }
}
