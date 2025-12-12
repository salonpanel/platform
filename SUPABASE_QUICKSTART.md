# 🎯 Quick Start: Supabase en WSL2

## ⚡ Instalación Rápida (Método Automatizado)

Ejecuta este comando desde WSL2 Ubuntu:

```bash
# 1. Navegar al proyecto
cd /mnt/c/Users/Josep\ Calafat/Documents/GitHub/platform

# 2. Dar permisos y ejecutar script
chmod +x scripts/install-supabase-cli.sh
./scripts/install-supabase-cli.sh
```

El script instalará automáticamente Supabase CLI y verificará tu configuración.

---

## 🔧 Instalación Manual (Si prefieres hacerlo paso a paso)

```bash
# En WSL2 Ubuntu:

# 1. Descargar Supabase CLI
wget https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -O /tmp/supabase.tar.gz

# 2. Extraer
tar -xzf /tmp/supabase.tar.gz -C /tmp

# 3. Instalar (necesita sudo)
sudo mv /tmp/supabase /usr/local/bin/supabase
sudo chmod +x /usr/local/bin/supabase

# 4. Verificar
supabase --version

# 5. Limpiar
rm /tmp/supabase.tar.gz
```

---

## 🚀 Primer Uso

### Opción A: Desarrollo Local (Recomendado)

```bash
# 1. Navegar al proyecto (desde WSL2)
cd /mnt/c/Users/Josep\ Calafat/Documents/GitHub/platform

# 2. Iniciar Supabase con Docker
npm run supabase:start

# Esperar ~5-10 minutos la primera vez (descarga imágenes Docker)

# 3. Copiar las credenciales que aparecen
# Buscar líneas como:
#   anon key: eyJhbGci...
#   service_role key: eyJhbGci...

# 4. Crear archivo .env.local
cp .env.example .env.local

# 5. Editar .env.local con las credenciales
code .env.local

# Pegar:
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CLIENT_URL=http://localhost:3000

# 6. Probar conexión
npm run test:supabase-connection

# 7. Iniciar Next.js
npm run dev
```

**URLs importantes:**
- App: http://localhost:3000
- Supabase Studio: http://127.0.0.1:54323
- Email Testing: http://127.0.0.1:54324

### Opción B: Supabase Cloud

```bash
# 1. Crear proyecto en https://supabase.com/dashboard

# 2. Obtener credenciales:
#    Settings → API → Project URL y API Keys

# 3. Configurar .env.local
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>

# 4. Login y vincular
supabase login
supabase link --project-ref <tu-project-ref>

# 5. Push de migraciones
npm run supabase:push
```

---

## 📋 Comandos Esenciales

```bash
# Ver estado
npm run supabase:status

# Iniciar
npm run supabase:start

# Detener
npm run supabase:stop

# Reiniciar (con datos limpios)
npm run supabase:reset

# Ver logs
npm run db:logs

# Abrir Studio
# Navegar a: http://127.0.0.1:54323
```

---

## 🐛 Problemas Comunes

### "Command not found: supabase"

```bash
# Verificar instalación
which supabase

# Si no aparece, reinstalar:
./scripts/install-supabase-cli.sh
```

### "Docker daemon is not running"

1. Abre Docker Desktop en Windows
2. Verifica que esté corriendo
3. Verifica integración WSL2:
   - Docker Desktop → Settings → Resources → WSL Integration
   - Activar Ubuntu-24.04

```bash
# Verificar desde WSL:
docker ps
```

### "Port 54321 is already in use"

```bash
# Detener Supabase
npm run supabase:stop

# Si persiste:
sudo lsof -ti:54321 | xargs kill -9

# Reiniciar
npm run supabase:start
```

### Error "permission denied"

```bash
# Dar permisos al directorio
sudo chown -R $USER:$USER .

# O ejecutar con sudo (no recomendado)
sudo supabase start
```

---

## ✅ Checklist de Verificación

- [ ] WSL2 funcionando (`wsl --version`)
- [ ] Docker Desktop corriendo (`docker ps`)
- [ ] Supabase CLI instalado (`supabase --version`)
- [ ] Proyecto navegable desde WSL (`cd /mnt/c/...`)
- [ ] Supabase iniciado (`npm run supabase:status`)
- [ ] `.env.local` configurado
- [ ] Conexión verificada (`npm run test:supabase-connection`)
- [ ] Next.js corriendo (`npm run dev`)
- [ ] Studio accesible (http://127.0.0.1:54323)

---

## 📚 Documentación Completa

Lee estos archivos para más detalles:

- **[SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md)** - Guía completa de configuración
- **[SUPABASE_WORKFLOW.md](./SUPABASE_WORKFLOW.md)** - Workflow de desarrollo diario
- **[.env.example](./.env.example)** - Variables de entorno necesarias

---

## 🆘 ¿Necesitas Ayuda?

1. Verifica los logs: `npm run db:logs`
2. Revisa el status: `npm run supabase:status`
3. Consulta [Supabase Docs](https://supabase.com/docs)
4. GitHub Issues: [supabase/supabase](https://github.com/supabase/supabase/issues)

---

**¡Listo para desarrollar! 🚀**
