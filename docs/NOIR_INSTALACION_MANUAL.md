# 🚀 Instalación Manual de OWASP Noir

Si el script automático no funciona, puedes instalar OWASP Noir manualmente siguiendo estos pasos:

## Opción 1: Instalación Manual en Windows

### Paso 1: Descargar OWASP Noir

1. Ve a la página de releases: https://github.com/owasp-noir/noir/releases/latest

2. Descarga el archivo para Windows:
   - Para sistemas de 64 bits: `noir-vX.X.X-x86_64-pc-windows-msvc.zip`
   - Para sistemas de 32 bits: `noir-vX.X.X-i686-pc-windows-msvc.zip`

### Paso 2: Extraer el Archivo

1. Extrae el archivo ZIP descargado
2. Encontrarás el ejecutable `noir.exe`

### Paso 3: Mover a una Ubicación Permanente

```powershell
# Crear directorio para herramientas
New-Item -ItemType Directory -Path "$HOME\.noir" -Force

# Mover el ejecutable (ajusta la ruta según donde descargaste)
Move-Item -Path "C:\Users\TuUsuario\Downloads\noir.exe" -Destination "$HOME\.noir\noir.exe"
```

### Paso 4: Agregar al PATH

```powershell
# Obtener PATH actual
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

# Agregar directorio de Noir
$noirPath = "$HOME\.noir"
$newPath = "$currentPath;$noirPath"

# Actualizar PATH
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")

# Actualizar PATH en sesión actual
$env:Path = "$env:Path;$noirPath"
```

### Paso 5: Verificar Instalación

```powershell
# Reinicia tu terminal y ejecuta:
noir --version
```

## Opción 2: Usando Chocolatey (Recomendado para Windows)

Si tienes Chocolatey instalado:

```powershell
# Nota: Actualmente Noir no está en Chocolatey, usa instalación manual
```

## Opción 3: Usando WSL (Windows Subsystem for Linux)

Si tienes WSL instalado:

```bash
# Descargar para Linux
wget https://github.com/owasp-noir/noir/releases/latest/download/noir-vX.X.X-x86_64-unknown-linux-gnu.tar.gz

# Extraer
tar -xzf noir-*.tar.gz

# Mover a /usr/local/bin
sudo mv noir /usr/local/bin/

# Verificar
noir --version
```

## Opción 4: Compilar desde Código Fuente

Si tienes Rust instalado:

```powershell
# Instalar Rust si no lo tienes
# https://rustup.rs/

# Clonar repositorio
git clone https://github.com/owasp-noir/noir.git
cd noir

# Compilar
cargo build --release

# El ejecutable estará en target/release/noir.exe
# Muévelo a $HOME\.noir\noir.exe
```

## Verificación Post-Instalación

Después de instalar, verifica que funciona:

```powershell
# Verificar versión
noir --version

# Ayuda
noir --help

# Probar análisis en el proyecto
cd "c:\Users\Josep Calafat\Desktop\demo pia buena\platform"
noir -b . -u http://localhost:3000
```

## Solución de Problemas

### "noir no se reconoce como comando"

1. Verifica que `noir.exe` está en `$HOME\.noir\`
2. Verifica que el PATH incluye ese directorio:
   ```powershell
   $env:Path -split ';' | Select-String ".noir"
   ```
3. Reinicia tu terminal
4. Si aún no funciona, ejecuta directamente:
   ```powershell
   & "$HOME\.noir\noir.exe" --version
   ```

### Error de descarga

Si la descarga falla:
1. Descarga manualmente desde GitHub
2. Verifica tu conexión a internet
3. Verifica que no hay firewall bloqueando

### Error de permisos

Si hay error de permisos:
```powershell
# Ejecutar PowerShell como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Alternativa: Usar sin Instalar

Puedes usar Noir sin instalarlo en el PATH:

```powershell
# Ejecutar directamente
& "C:\ruta\a\noir.exe" -b . -u http://localhost:3000

# O crear un alias en tu perfil de PowerShell
Set-Alias -Name noir -Value "C:\ruta\a\noir.exe"
```

## Siguiente Paso

Una vez instalado, ejecuta tu primer análisis:

```bash
npm run security:scan
```

O manualmente:

```powershell
noir -b . -u http://localhost:3000 -f json -T > security-reports/primer-analisis.json
```

---

**¿Necesitas ayuda?** Consulta la [documentación completa](./OWASP_NOIR.md)
