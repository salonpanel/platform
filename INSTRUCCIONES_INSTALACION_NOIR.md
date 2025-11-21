# 🚀 Instalación de OWASP Noir - Guía Completa

## ⚠️ Problema Encontrado

Los binarios precompilados de Windows **no están disponibles** en los releases recientes de OWASP Noir en GitHub.

## ✅ Soluciones Disponibles

### Opción 1: Instalar con Cargo (RECOMENDADO) ⭐

Esta es la forma más confiable y oficial de instalar OWASP Noir en Windows.

#### Paso 1: Ejecutar el script de instalación

```powershell
.\scripts\install-noir-cargo.ps1
```

Este script:
1. Instala Rust y Cargo si no los tienes
2. Compila e instala OWASP Noir desde el código fuente
3. Configura todo automáticamente

**Tiempo estimado**: 10-15 minutos (la primera vez)

#### Paso 2: Verificar instalación

```powershell
noir --version
```

---

### Opción 2: Instalación Manual de Rust + Noir

Si prefieres hacerlo manualmente:

#### 1. Instalar Rust

```powershell
# Descargar e instalar Rust
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "$env:TEMP\rustup-init.exe"
Start-Process -FilePath "$env:TEMP\rustup-init.exe" -Wait

# Reiniciar terminal y verificar
cargo --version
```

O descarga desde: https://rustup.rs/

#### 2. Instalar OWASP Noir

```powershell
cargo install noir
```

Esto compilará Noir desde el código fuente (toma 5-10 minutos).

#### 3. Verificar

```powershell
noir --version
```

---

### Opción 3: Usar WSL (Windows Subsystem for Linux)

Si tienes WSL instalado:

```bash
# En WSL (Ubuntu/Debian)
wget https://github.com/owasp-noir/noir/releases/latest/download/noir-v0.25.1-x86_64-unknown-linux-gnu.tar.gz
tar -xzf noir-*.tar.gz
sudo mv noir /usr/local/bin/
noir --version
```

---

### Opción 4: Usar Docker

```bash
# Crear alias para usar Noir con Docker
docker run --rm -v ${PWD}:/target ghcr.io/owasp-noir/noir:latest -b /target
```

---

## 🎯 Recomendación

**Usa la Opción 1** (Cargo) porque:
- ✅ Es el método oficial recomendado
- ✅ Siempre tendrás la última versión
- ✅ Funciona en todos los sistemas
- ✅ El script lo hace todo automáticamente

## 📝 Después de Instalar

Una vez instalado, ejecuta:

```bash
cd "c:\Users\Josep Calafat\Desktop\demo pia buena\platform"
npm run security:scan
```

---

## ⏱️ Tiempos Estimados

| Método | Primera Instalación | Actualizaciones |
|--------|---------------------|-----------------|
| Cargo (Opción 1) | 10-15 min | 5-10 min |
| Manual Rust + Cargo | 15-20 min | 5-10 min |
| WSL | 2-5 min | 1-2 min |
| Docker | 5-10 min | 1-2 min |

---

## 🆘 Solución de Problemas

### Error: "cargo no se reconoce"

Reinicia tu terminal después de instalar Rust.

### Error de compilación

Asegúrate de tener:
- Windows 10/11 actualizado
- Visual Studio Build Tools (se instala con Rust)

### Instalación muy lenta

Es normal. Noir se está compilando desde el código fuente.

---

## 🚀 Ejecutar Instalación AHORA

```powershell
# Opción más fácil - ejecuta este comando:
.\scripts\install-noir-cargo.ps1
```

Luego toma un café ☕ mientras se instala (10-15 minutos).

---

**¿Listo para instalar?** Ejecuta el comando de arriba y espera a que termine.
