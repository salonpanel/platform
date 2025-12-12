# Workflow de Desarrollo con Supabase

## 🚀 Inicio Rápido Diario

```bash
# 1. Iniciar Supabase (si usas local)
npm run supabase:start

# 2. Iniciar Next.js
npm run dev
```

Listo para desarrollar en:
- **App**: http://localhost:3000
- **Studio**: http://127.0.0.1:54323
- **Email Testing**: http://127.0.0.1:54324

---

## 📊 Comandos Principales

### Estado y Control

```bash
# Ver estado de Supabase
npm run supabase:status

# Detener Supabase
npm run supabase:stop

# Reiniciar Supabase
npm run supabase:restart

# Ver logs en tiempo real
npm run db:logs
```

### Base de Datos

```bash
# Reset completo (borra datos, aplica migraciones y seed)
npm run supabase:reset

# Aplicar solo migraciones nuevas
npm run supabase:push

# Bajar esquema remoto
npm run supabase:pull
```

### Migraciones

```bash
# Crear nueva migración
npm run supabase:migrate nombre_descriptivo

# Ejemplo: 
npm run supabase:migrate add_user_preferences

# Esto crea: supabase/migrations/20241211_add_user_preferences.sql
```

### TypeScript

```bash
# Generar tipos de TypeScript desde el esquema
npm run supabase:gen-types

# Los tipos se guardan en: types/database.types.ts
```

---

## 🔄 Ciclo de Desarrollo

### 1. Crear una nueva feature con cambios en BD

```bash
# 1. Crear rama
git checkout -b feature/nueva-funcionalidad

# 2. Crear migración
npm run supabase:migrate add_nueva_tabla

# 3. Editar el archivo SQL creado en supabase/migrations/

# 4. Aplicar cambios
npm run supabase:reset

# 5. Verificar en Studio
# Abrir http://127.0.0.1:54323

# 6. Generar tipos
npm run supabase:gen-types

# 7. Desarrollar tu feature en el código

# 8. Commit
git add .
git commit -m "feat: nueva funcionalidad"
```

### 2. Sincronizar con el equipo

```bash
# Obtener cambios del equipo
git pull origin main

# Aplicar nuevas migraciones
npm run supabase:reset

# Generar tipos actualizados
npm run supabase:gen-types
```

### 3. Desplegar a producción

```bash
# 1. Login en Supabase
supabase login

# 2. Link con proyecto remoto
supabase link --project-ref TU_PROJECT_ID

# 3. Push de migraciones
npm run supabase:push

# 4. Verificar en Supabase Dashboard
# https://app.supabase.com/project/TU_PROJECT_ID
```

---

## 🧪 Testing de Base de Datos

### Test de conexión

```bash
# Crear script de prueba
npm run test:supabase-connection
```

### Test de RLS (Row Level Security)

```bash
# Ejecutar tests de seguridad
npm run test:rls
```

### Test de integridad

```bash
# Tests de constraints y overlaps
npm run test:integration
```

---

## 📝 Estructura de Migraciones

Cada migración debe ser:

1. **Idempotente**: Puede ejecutarse múltiples veces sin errores
2. **Incremental**: Solo cambios nuevos
3. **Reversible**: Incluir lógica de rollback cuando sea posible

**Ejemplo de migración bien formada:**

```sql
-- Migration: add_user_preferences
-- Created: 2024-12-11

-- Create table (with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'es',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
  ON user_preferences(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 🔐 Seguridad

### Variables de Entorno

**NUNCA** commitees:
- `.env.local` (está en .gitignore)
- `SUPABASE_SERVICE_ROLE_KEY` en el frontend

**SÍ** commitea:
- `.env.example` (con valores vacíos o de ejemplo)

### Service Role Key

Úsala **SOLO** en:
- API Routes de Next.js (`/app/api/*`)
- Server Components
- Scripts de backend

**NUNCA** en:
- Client Components
- Frontend code
- Código expuesto al navegador

---

## 🎯 Best Practices

### 1. Migraciones

✅ **Hacer:**
- Nombres descriptivos
- Un cambio lógico por migración
- Incluir comentarios
- Usar transacciones cuando sea posible

❌ **Evitar:**
- Modificar migraciones ya aplicadas
- Migraciones enormes
- Borrar datos sin confirmación

### 2. Desarrollo Local

✅ **Hacer:**
- Usar `supabase reset` para tener estado limpio
- Commitear seed data útiles
- Probar RLS policies

❌ **Evitar:**
- Trabajar directo en producción
- Skip de migraciones
- Datos sensibles en seeds

### 3. Sincronización

✅ **Hacer:**
- Pull frecuente de cambios
- Aplicar migraciones antes de desarrollar
- Regenerar tipos después de migraciones

❌ **Evitar:**
- Trabajar con esquema desactualizado
- Ignorar conflictos de migraciones

---

## 🐛 Troubleshooting Común

### Puerto 54321 ocupado

```bash
# Opción 1: Detener Supabase
npm run supabase:stop

# Opción 2: Matar proceso
# Linux/Mac/WSL:
sudo lsof -ti:54321 | xargs kill -9

# Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 54321).OwningProcess | Stop-Process
```

### Migraciones fuera de orden

```bash
# Reset completo
npm run supabase:reset

# Si persiste, borrar volumes
supabase stop --no-backup
docker volume prune
npm run supabase:start
```

### Error de permisos en WSL

```bash
# Cambiar ownership de archivos
sudo chown -R $USER:$USER .
```

### Types desactualizados

```bash
# Regenerar types
npm run supabase:gen-types

# Reiniciar TypeScript server en VS Code
# Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

### Docker no inicia contenedores

```bash
# Verificar Docker
docker ps

# Reiniciar Docker Desktop
# Windows: Abrir Docker Desktop → Settings → Reset → Restart

# Verificar integración WSL
# Docker Desktop → Settings → Resources → WSL Integration
# Activar Ubuntu-24.04
```

---

## 📚 Recursos Útiles

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Integration](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

---

## 🆘 Ayuda

Si encuentras problemas:

1. Verifica logs: `npm run db:logs`
2. Revisa status: `npm run supabase:status`
3. Consulta la documentación oficial
4. Busca en [GitHub Issues](https://github.com/supabase/supabase/issues)
