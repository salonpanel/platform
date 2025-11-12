# Guía de Despliegue - P1 Completado

## 🚀 Despliegue Rápido

### 1. Git - Subir Cambios

```powershell
# Ejecutar script de setup de Git
.\scripts\setup-git.ps1

# O manualmente:
git init
git add -A
git commit -m "feat: P1 completado - Timezone por tenant y RLS tests suite completa"
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```

### 2. Supabase - Aplicar Migraciones

```powershell
# Ver migraciones pendientes
.\scripts\apply-supabase-migrations.ps1

# Opción A: Usar Supabase CLI
supabase link --project-ref <PROJECT_REF>
supabase db push

# Opción B: Desde Dashboard
# 1. Ir a Supabase Dashboard > Database > Migrations
# 2. Copiar contenido de supabase/migrations/0028_p1_timezone_ui_complete.sql
# 3. Ejecutar en SQL Editor
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Configurar Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

### 5. Verificar Despliegue

```bash
# Ejecutar tests
npm run test:rls

# Verificar migraciones
# Ir a Supabase Dashboard > SQL Editor
# Ejecutar: SELECT * FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'timezone';
```

## 📋 Checklist Completo

Ver `DEPLOYMENT_CHECKLIST.md` para el checklist completo de despliegue.

## 🔍 Verificación

### Verificar Timezone

```sql
-- Verificar que timezone existe
SELECT id, name, timezone
FROM public.tenants
LIMIT 10;

-- Verificar funciones helper
SELECT app.get_tenant_timezone('tenant-id');
```

### Verificar Endpoints

```bash
# Probar endpoint de timezone
curl http://localhost:3000/api/tenants/<TENANT_ID>/timezone
```

### Verificar UI

1. Ir a `/panel/agenda` - Verificar que las horas se muestran correctamente
2. Ir a `/r/[orgId]` - Verificar que los slots se muestran correctamente
3. Ir a `/admin/[orgId]` - Verificar que se puede gestionar el timezone

## 📚 Documentación

- `DEPLOYMENT_CHECKLIST.md` - Checklist completo de despliegue
- `docs/P1_RLS_TESTS_COMPLETE.md` - Documentación de tests RLS
- `docs/P1_TIMEZONE_COMPLETE_FINAL.md` - Documentación de timezone
- `docs/TEST_EXECUTION_GUIDE.md` - Guía de ejecución de tests

## 🆘 Troubleshooting

### Error: "Git no inicializado"

```powershell
git init
git add -A
git commit -m "Initial commit"
```

### Error: "Migración no aplicada"

```sql
-- Aplicar migración manualmente
-- Ver contenido de supabase/migrations/0028_p1_timezone_ui_complete.sql
```

### Error: "Timezone no existe"

```sql
-- Aplicar migración manualmente
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Madrid';
```

## ✅ Estado Final

- ✅ P1.2: Timezone por tenant - COMPLETADO
- ✅ P1: RLS tests suite completa - COMPLETADO
- ✅ Documentación completa - COMPLETADO
- ✅ Scripts de ejecución - COMPLETADO

