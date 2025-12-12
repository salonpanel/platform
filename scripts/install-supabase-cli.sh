#!/bin/bash

# Script de configuración automática de Supabase CLI para WSL2 Ubuntu
# Este script debe ejecutarse desde WSL2 Ubuntu

set -e  # Salir si hay algún error

echo "🚀 Instalando Supabase CLI en Ubuntu WSL2..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar que estamos en WSL
if ! grep -qi microsoft /proc/version; then
    print_error "Este script debe ejecutarse desde WSL2 Ubuntu"
    exit 1
fi

print_success "Ejecutando desde WSL2"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado o no está en PATH"
    print_warning "Por favor, verifica Docker Desktop y la integración WSL"
    exit 1
fi

print_success "Docker encontrado: $(docker --version)"

# Descargar Supabase CLI
echo ""
echo "📥 Descargando Supabase CLI..."
cd /tmp
wget -q https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -O supabase.tar.gz

if [ $? -eq 0 ]; then
    print_success "Descarga completada"
else
    print_error "Error al descargar Supabase CLI"
    exit 1
fi

# Extraer archivo
echo ""
echo "📦 Extrayendo archivo..."
tar -xzf supabase.tar.gz

if [ $? -eq 0 ]; then
    print_success "Extracción completada"
else
    print_error "Error al extraer el archivo"
    exit 1
fi

# Mover a /usr/local/bin
echo ""
echo "📁 Instalando en /usr/local/bin..."
sudo mv supabase /usr/local/bin/supabase

if [ $? -eq 0 ]; then
    print_success "Archivo movido a /usr/local/bin"
else
    print_error "Error al mover el archivo (¿permisos?)"
    exit 1
fi

# Dar permisos de ejecución
sudo chmod +x /usr/local/bin/supabase

if [ $? -eq 0 ]; then
    print_success "Permisos de ejecución configurados"
else
    print_error "Error al configurar permisos"
    exit 1
fi

# Limpiar archivos temporales
rm -f /tmp/supabase.tar.gz

print_success "Archivos temporales eliminados"

# Verificar instalación
echo ""
echo "🔍 Verificando instalación..."
VERSION=$(supabase --version 2>&1)

if [ $? -eq 0 ]; then
    print_success "Supabase CLI instalado correctamente"
    echo "   Versión: $VERSION"
else
    print_error "Error al verificar la instalación"
    exit 1
fi

# Verificar que Docker está corriendo
echo ""
echo "🐳 Verificando Docker..."
if docker ps &> /dev/null; then
    print_success "Docker está corriendo"
else
    print_error "Docker no está corriendo o no tienes permisos"
    print_warning "Asegúrate de que Docker Desktop esté abierto"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 ¡Instalación completada con éxito!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Siguientes pasos:"
echo ""
echo "  1. Navega a tu proyecto:"
echo "     cd /mnt/c/Users/Josep\ Calafat/Documents/GitHub/platform"
echo ""
echo "  2. Inicia Supabase:"
echo "     npm run supabase:start"
echo ""
echo "  3. Copia las credenciales al archivo .env.local"
echo ""
echo "  4. Ejecuta el servidor de desarrollo:"
echo "     npm run dev"
echo ""
echo "📚 Documentación completa en:"
echo "   - SUPABASE_SETUP_GUIDE.md"
echo "   - SUPABASE_WORKFLOW.md"
echo ""

exit 0
