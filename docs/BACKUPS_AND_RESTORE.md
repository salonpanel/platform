# Backups y Restauración - Runbook

## Política de Backups

### Frecuencia de Backups

- **Backups automáticos**: Diarios a las 2:00 AM UTC
- **Retención**: 30 días
- **Backups manuales**: Antes de migraciones importantes o cambios críticos

### Método de Backups

1. **Supabase Dashboard**: Backups automáticos diarios
2. **Backups manuales**: Via CLI de Supabase o Dashboard
3. **Exportaciones SQL**: Para migraciones o restauraciones específicas

## Crear Backup Manual

### Desde Supabase Dashboard

1. Ir a Supabase Dashboard → Project → Database → Backups
2. Click en "Create Backup"
3. Esperar a que se complete el backup
4. Descargar backup si es necesario

### Desde Supabase CLI

```bash
# Crear backup completo de la base de datos
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

# Crear backup de un schema específico
supabase db dump --schema public -f backup_public_$(date +%Y%m%d_%H%M%S).sql

# Crear backup de datos solamente (sin estructura)
supabase db dump --data-only -f backup_data_$(date +%Y%m%d_%H%M%S).sql
```

## Restaurar Backup

### Desde Supabase Dashboard

1. Ir a Supabase Dashboard → Project → Database → Backups
2. Seleccionar backup a restaurar
3. Click en "Restore"
4. Confirmar restauración
5. Esperar a que se complete la restauración

### Desde Supabase CLI

```bash
# Restaurar backup completo
supabase db reset --db-url postgresql://user:password@host:port/database < backup_20241112_020000.sql

# Restaurar backup de un schema específico
supabase db reset --schema public --db-url postgresql://user:password@host:port/database < backup_public_20241112_020000.sql
```

## Checklist de Restauración

### Pre-Restauración

- [ ] Verificar que el backup existe y es válido
- [ ] Verificar que el entorno de destino es el correcto (staging/production)
- [ ] Notificar a los usuarios si es necesario
- [ ] Hacer backup del estado actual (por si acaso)
- [ ] Verificar que hay suficiente espacio en disco
- [ ] Verificar que no hay conexiones activas críticas

### Restauración

- [ ] Pausar cron jobs si es necesario
- [ ] Pausar webhooks si es necesario
- [ ] Ejecutar restauración
- [ ] Verificar que la restauración se completó correctamente
- [ ] Verificar que las migraciones están aplicadas
- [ ] Verificar que las políticas RLS están activas
- [ ] Verificar que los índices están creados

### Post-Restauración

- [ ] Verificar conectividad de la base de datos
- [ ] Verificar que los endpoints funcionan correctamente
- [ ] Verificar que las métricas se están calculando
- [ ] Verificar que los cron jobs funcionan
- [ ] Verificar que los webhooks funcionan
- [ ] Reanudar cron jobs si se pausaron
- [ ] Reanudar webhooks si se pausaron
- [ ] Verificar logs de errores
- [ ] Notificar a los usuarios si es necesario

## Restauración en Staging

### Proceso

1. **Crear backup de producción**:
   ```bash
   supabase db dump -f backup_production_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Restaurar en staging**:
   ```bash
   supabase db reset --db-url $STAGING_DB_URL < backup_production_20241112_020000.sql
   ```

3. **Aplicar migraciones pendientes**:
   ```bash
   supabase migration up --db-url $STAGING_DB_URL
   ```

4. **Verificar restauración**:
   ```bash
   # Verificar que los datos están correctos
   supabase db dump --db-url $STAGING_DB_URL --schema public | head -100
   ```

## Restauración Parcial

### Restaurar solo una tabla

```bash
# Exportar tabla específica
supabase db dump --table tenants -f backup_tenants_$(date +%Y%m%d_%H%M%S).sql

# Restaurar tabla específica
psql $DATABASE_URL < backup_tenants_20241112_020000.sql
```

### Restaurar solo datos (sin estructura)

```bash
# Exportar solo datos
supabase db dump --data-only -f backup_data_$(date +%Y%m%d_%H%M%S).sql

# Restaurar solo datos
psql $DATABASE_URL < backup_data_20241112_020000.sql
```

## Verificación de Backups

### Verificar que el backup es válido

```bash
# Verificar que el backup contiene datos
grep -c "INSERT INTO" backup_20241112_020000.sql

# Verificar que el backup contiene estructura
grep -c "CREATE TABLE" backup_20241112_020000.sql

# Verificar que el backup contiene políticas RLS
grep -c "CREATE POLICY" backup_20241112_020000.sql
```

### Verificar que el backup está completo

```bash
# Listar tablas en el backup
grep "CREATE TABLE" backup_20241112_020000.sql | wc -l

# Verificar que todas las tablas críticas están presentes
grep -E "CREATE TABLE.*(tenants|bookings|services|staff|schedules)" backup_20241112_020000.sql
```

## Política de Retención

### Backups Automáticos

- **Frecuencia**: Diarios
- **Retención**: 30 días
- **Almacenamiento**: Supabase Dashboard (automático)

### Backups Manuales

- **Frecuencia**: Antes de migraciones importantes o cambios críticos
- **Retención**: 90 días (o según necesidad)
- **Almacenamiento**: Local o almacenamiento seguro (S3, etc.)

## Plan de Recuperación de Desastres (DR)

### Escenario 1: Pérdida de datos

1. **Identificar backup más reciente**
2. **Restaurar backup completo**
3. **Aplicar migraciones pendientes**
4. **Verificar que todo funciona correctamente**
5. **Notificar a los usuarios**

### Escenario 2: Corrupción de datos

1. **Identificar tabla(s) afectada(s)**
2. **Restaurar tabla(s) específica(s) desde backup**
3. **Verificar que los datos están correctos**
4. **Verificar que no hay datos duplicados**
5. **Notificar a los usuarios si es necesario**

### Escenario 3: Error en migración

1. **Revertir migración**:
   ```bash
   supabase migration down
   ```

2. **Restaurar backup anterior**:
   ```bash
   supabase db reset < backup_anterior.sql
   ```

3. **Verificar que todo funciona correctamente**
4. **Corregir migración**
5. **Aplicar migración corregida**

## Automatización de Backups

### Script de Backup Automático

```bash
#!/bin/bash
# backup.sh - Script para crear backup automático

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

# Crear directorio de backups si no existe
mkdir -p $BACKUP_DIR

# Crear backup
supabase db dump -f $BACKUP_FILE

# Comprimir backup
gzip $BACKUP_FILE

# Eliminar backups antiguos (más de 30 días)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup creado: $BACKUP_FILE.gz"
```

### Configurar Cron Job

```bash
# Añadir a crontab para ejecutar diariamente a las 2:00 AM
0 2 * * * /path/to/backup.sh
```

## Variables de Entorno para Backups

```env
# Supabase
SUPABASE_DB_URL=postgresql://user:password@host:port/database
SUPABASE_PROJECT_ID=your-project-id

# Backup
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=30
```

## Monitoreo de Backups

### Verificar que los backups se están creando

```bash
# Listar backups recientes
ls -lh backups/ | head -10

# Verificar tamaño de backups
du -sh backups/

# Verificar que los backups no están corruptos
for file in backups/*.sql.gz; do
  gunzip -t $file && echo "$file: OK" || echo "$file: CORRUPTO"
done
```

## Notas

- **Backups automáticos**: Supabase crea backups automáticos diarios
- **Backups manuales**: Crear antes de migraciones importantes
- **Retención**: 30 días para backups automáticos, 90 días para manuales
- **Verificación**: Verificar que los backups son válidos regularmente
- **Restauración**: Probar restauración en staging antes de producción

## Contacto

- **Soporte**: support@example.com
- **Urgencias**: +34 600 000 000
- **Documentación**: Ver `docs/BACKUPS_AND_RESTORE.md`

