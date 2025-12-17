# 📊 Resumen de Actualización: Seed Demo Comercial BookFast

**Fecha:** Diciembre 2024  
**Propósito:** Escalar seed demo de MVP a volumen comercial para ventas  
**Autor:** GitHub Copilot

---

## 🎯 Objetivo del Upgrade

Transformar el seed BookFast de un **MVP técnico** (30 clientes, 8 servicios, 500 reservas) a una **demo comercial realista** que impresione en presentaciones de ventas con pantallas llenas y métricas convincentes.

---

## 🔒 Flujo oficial (no negociable)

1. `seed_bookfast_demo.sql`
2. `seed_bookfast_assign_users.sql` ← falla si `staff.user_id` queda NULL en owners
3. `seed_bookfast_bookings.sql`
4. `seed_bookfast_validate.sql` + validaciones comerciales

Este orden es obligatorio y único para cada tenant.

---

## 📈 Cambios de Volumen

| Métrica | Antes (MVP) | Después (Comercial) | Incremento |
|---------|-------------|---------------------|------------|
| **Clientes** | 30 | 400 | +1233% |
| **Servicios** | 8 | 20 | +150% |
| **Staff Barberos** | 4 | 5 | +25% |
| **Reservas** | 500-800 | 2500-4000 | +312-400% |
| **Horizonte Temporal** | 6 meses | **2 años completos** | +300% |
| **Fecha inicio** | N/A | **12/12/2024** | Fijo |
| **Fecha fin** | N/A | **12/12/2026** | Fijo |

---

## 🔧 Archivos Modificados

### 1. `seed_bookfast_demo.sql` ✅ ACTUALIZADO

**Cambios principales:**

#### Header
- ❌ ANTES: "Seed Demo: BookFast" 
- ✅ AHORA: "SEED DEMO COMERCIAL: BookFast Barbería"
- Volúmenes en header: 400 clientes, 20 servicios, 5 barberos, 2 años

#### Servicios (Paso 3)
```sql
-- ❌ ANTES: 8 servicios básicos
-- ✅ AHORA: 20 servicios en 4 categorías

Corte (7 servicios):
  - Corte Clásico (€12, 25min)
  - Corte + Lavado (€15, 30min)
  - Fade Moderno (€18, 35min)
  - Fade Premium (€22, 40min)
  - Diseño Degradado (€20, 35min)
  - Corte Niños (€10, 20min)
  - Corte Senior (€25, 45min)

Barba (5 servicios):
  - Arreglo Barba (€8, 15min)
  - Barba Completa (€15, 25min)
  - Afeitado Navaja (€18, 30min)
  - Diseño Barba (€20, 30min)
  - Tinte Barba (€12, 20min)

Combos (4 servicios):
  - Corte + Barba (€25, 50min)
  - Corte + Afeitado (€28, 55min)
  - Pack Completo (€48, 75min)
  - Combo Express (€20, 35min)

Extras (4 servicios):
  - Tinte Cabello (€30, 45min)
  - Mechas (€40, 60min)
  - Mascarilla Facial (€15, 20min)
  - Cera/Styling (€8, 10min)
```

#### Staff (Paso 4)
```sql
-- ❌ ANTES: 4 barberos genéricos
-- ✅ AHORA: 5 barberos con especialidades

1. Josep Calafat (Owner/Senior) - ID ...001
   - Todos los servicios (20)
   - Lun-Sáb 09:00-17:00
   
2. Socio Co-Founder (Owner/Maestro) - ID ...002
   - Especialista barba y clásicos (12 servicios)
   - Mar-Sáb 10:00-19:00
   
3. Carlos Martínez (Senior) - ID ...003
   - Fades profesionales y combos (14 servicios)
   - Lun-Vie 12:00-20:00, Sáb 10:00-18:00
   
4. Javier López (Regular) - ID ...004
   - Color, jóvenes, urbanos (12 servicios)
   - Mié-Dom 11:00-19:00
   
5. David Hernández (Junior) - ID ...005
   - Servicios básicos (8 servicios)
   - Lun, Mar, Jue, Vie, Sáb 10:00-18:00
```

#### Clientes (Paso 7)
```sql
-- ❌ ANTES: 30 INSERT VALUES manuales
-- ✅ AHORA: Generación DO $$ block con 400 clientes

Distribución:
- 40 clientes VIP (10%)
- 360 clientes regulares (90%)
- 85% con email
- Tags automáticos: 'vip', 'joven', 'senior', 'regular'
- Nombres/apellidos españoles realistas
- Fechas nacimiento: 18-70 años
```

#### Bloqueos Staff (Paso 9) - NUEVO
```sql
-- ✅ AÑADIDO: staff_blockings para mayor realismo

- Josep: Vacaciones verano 2025 (1-15 agosto)
- Socio: Vacaciones navidad 2024 (23 dic-7 ene)
- Carlos: Semana Santa 2025 (14-21 abril)
- Javier: Baja médica ejemplo (10-14 marzo)
- David: Vacaciones agosto 2025 (16-31 agosto)
- Josep: Formación Nov 2025 (20-22 nov)
```

---

### 2. `seed_bookfast_bookings.sql` ✅ ACTUALIZADO

**Cambios principales:**

#### Horizonte Temporal
```sql
-- ❌ ANTES: v_start_date := CURRENT_DATE - INTERVAL '6 months'
-- ✅ AHORA: v_start_date := '2024-12-12'::DATE

-- ❌ ANTES: WHILE <= CURRENT_DATE + INTERVAL '14 days'
-- ✅ AHORA: WHILE <= v_start_date + INTERVAL '2 years'
```

#### Probabilidad Base
```sql
-- ✅ AÑADIDO: Lógica estacional

v_base_probability := 0.55;  -- Base 55% ocupación

-- Ajustes día semana:
+0.20 → Viernes, Sábado (picos fin de semana)
-0.10 → Lunes (valle)
-0.15 → Domingo (valle)

-- Ajustes estacionalidad:
-0.20 → Agosto (vacaciones verano)
-0.20 → Diciembre (vacaciones navidad)
```

#### Estados
```sql
-- ✅ MEJORADO: Estados más realistas

Pasadas (< HOY):
- 80% COMPLETED
- 12% CANCELLED  
- 8% NO_SHOW

Futuras (>= HOY):
- 100% CONFIRMED
```

**Expectativa de salida:**
- Total reservas: **2500-4000** (depende de probabilidades)
- Distribución: 70% pasadas completed, 30% futuras confirmed
- Respeto absoluto: EXCLUDE constraint, staff_schedules, staff_blockings

---

### 3. `seed_bookfast_assign_users.sql` ⚠️ REQUIERE ACTUALIZACIÓN MANUAL

**Cambio crítico necesario:**

```sql
-- ⚠️ AÑADIR después de INSERT memberships:

-- Vincular owners a staff (para que aparezcan como barberos)
UPDATE public.staff
SET user_id = v_user_id_1, updated_at = NOW()
WHERE id = 'bf000002-staf-0000-0000-000000000001' 
  AND tenant_id = 'bf000000-0000-0000-0000-000000000001';

UPDATE public.staff
SET user_id = v_user_id_2, updated_at = NOW()
WHERE id = 'bf000002-staf-0000-0000-000000000002' 
  AND tenant_id = 'bf000000-0000-0000-0000-000000000001';
```

**⚠️ SIN ESTO:** Los owners existirán como memberships pero NO aparecerán en la agenda como barberos activos.

---

## 📋 Archivos Pendientes de Actualización

### 4. `seed_bookfast_validate.sql` 🔄 PENDIENTE

**Necesita actualizar expectativas:**

```sql
-- ❌ Valores antiguos a reemplazar:
-- SELECT COUNT(*) >= 8 as valid FROM services  → debe ser >= 20
-- SELECT COUNT(*) >= 4 as valid FROM staff     → debe ser >= 5
-- SELECT COUNT(*) >= 30 as valid FROM customers → debe ser >= 400
-- SELECT COUNT(*) >= 500 as valid FROM bookings → debe ser >= 2500

-- ✅ Añadir validaciones nuevas:
-- Verificar horizonte 2 años:
SELECT 
  MIN(starts_at)::DATE as primera_reserva,
  MAX(starts_at)::DATE as ultima_reserva,
  (MAX(starts_at) - MIN(starts_at)) >= INTERVAL '2 years' as valido
FROM bookings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Verificar staff_blockings:
SELECT COUNT(*) >= 6 as valid FROM staff_blockings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';
```

---

### 5. `SEED_BOOKFAST_README.md` 🔄 PENDIENTE

**Secciones a actualizar:**

```markdown
## Volúmenes Esperados

- ❌ Servicios: 8
- ✅ Servicios: 20 (4 categorías)

- ❌ Barberos: 4
- ✅ Barberos: 5 (2 owners activos + 3 empleados)

- ❌ Clientes: 30
- ✅ Clientes: 400 (40 VIP, 360 regulares)

- ❌ Reservas: 500-800 (6 meses)
- ✅ Reservas: 2500-4000 (2 años: 12/2024-12/2026)
```

**Añadir sección:**
```markdown
## ⚠️ Configuración Crítica: Owners como Barberos

Para que los owners aparezcan en la agenda:

1. Ejecutar seed_bookfast_demo.sql
2. Ejecutar seed_bookfast_assign_users.sql 
3. **VERIFICAR** que staff.user_id esté poblado:
   ```sql
   SELECT display_name, user_id FROM staff 
   WHERE id IN ('...001', '...002');
   ```
4. Si NULL → ejecutar UPDATE manualmente
5. SOLO ENTONCES ejecutar seed_bookfast_bookings.sql
```

---

### 6. `SEED_BOOKFAST_CHECKLIST.md` 🔄 PENDIENTE

**Actualizar expectativas por paso:**

```markdown
## 5. Validar Resultados ✅

- [x] Tenant creado: 1
- [x] Servicios: 20 ✅ (ANTES: 8)
- [x] Staff: 5 ✅ (ANTES: 4)
- [x] Horarios: ✅ 5 barberos con turnos diferenciados
- [x] Clientes: 400 ✅ (ANTES: 30)
- [x] Bloqueos: 6 ✅ (NUEVO)
- [x] Reservas: 2500-4000 ✅ (ANTES: 500-800)
- [x] Horizonte: 2024-12-12 a 2026-12-12 ✅ (NUEVO)
```

**Añadir al final:**
```markdown
## 6. Checklist Demo-Ready 🎯

Antes de mostrar la demo a clientes:

- [ ] Verificar que HOY tiene reservas (no caer en día vacío)
- [ ] Verificar que próximos 7 días tienen >= 10 reservas/día
- [ ] Verificar distribución servicios: Corte+Barba ~60%
- [ ] Verificar VIPs: >= 40 clientes con is_vip=true
- [ ] Verificar pantallas:
  - [ ] Dashboard: métricas visibles (no ceros)
  - [ ] Agenda: slots ocupados (no vacía)
  - [ ] Clientes: lista poblada >= 400
  - [ ] Reportes: gráficas con datos
```

---

## ⚠️ Instrucciones de Ejecución Actualizadas

### Orden Correcto

```bash
# 1. Estructura base (tenant, servicios, staff, clientes)
psql -f seed_bookfast_demo.sql

# 2. Asignar ownership (memberships + staff.user_id)
# ⚠️ IMPORTANTE: Descomentar y reemplazar UUIDs reales
psql -f seed_bookfast_assign_users.sql

# 3. VALIDAR que staff.user_id != NULL
psql -c "SELECT id, display_name, user_id FROM staff WHERE id IN ('bf000002-staf-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002');"

# 4. SOLO SI paso 3 OK → Generar reservas (tarda ~2-5 min)
psql -f seed_bookfast_bookings.sql

# 5. Validar todo
psql -f seed_bookfast_validate.sql
```

### Tiempo Estimado

- ❌ ANTES: ~30 segundos total
- ✅ AHORA: **2-5 minutos** (seed_bookfast_bookings.sql es pesado)

### Recursos Cloud

- ❌ ANTES: ~1-2 MB datos
- ✅ AHORA: **~5-10 MB datos** (2500-4000 bookings)

---

## 🎨 Impacto Visual en UI

### Dashboard
- Métricas llenadas: Total clientes (400), Reservas mes (>100)
- Gráfica ocupación: Curva realista con picos fin de semana
- Top servicios: 20 opciones, Corte+Barba liderando

### Agenda
- Slots ocupados al 50-70% (no vacía ni saturada)
- Mix de estados: confirmed (verdes), completed (grises)
- Owners visibles como barberos activos

### Clientes
- Lista scrollable de 400 (impresionante)
- 40 badges VIP visibles
- Tags variados (joven, senior, vip, puntual)

### Reportes
- Gráficas mensuales con 24 barras (2 años)
- Tendencias estacionales visibles (picos invierno, valles verano)
- Top clientes VIP con gasto >€200

---

## 🚨 Puntos Críticos de Atención

### 1. Constraint EXCLUDE
✅ **Respetada**: generate_bookfast_bookings() maneja exceptions por solapamiento  
⚠️ **Riesgo**: Si modificas la función, puedes romper constraint

### 2. Staff User IDs
⚠️ **CRÍTICO**: Sin vincular user_id, owners NO aparecen en agenda  
✅ **Solución**: Actualizar seed_bookfast_assign_users.sql (ver arriba)

### 3. Timezone
✅ **Configurado**: Europe/Madrid en staff_schedules  
⚠️ **Riesgo**: Si cambias timezone, las horas pueden descuadrarse

### 4. Performance
⚠️ **Tiempo ejecución**: seed_bookfast_bookings.sql tarda **2-5 min** con 2500-4000 inserts  
✅ **Normal**: Es esperado, no interrumpas

---

## ✅ Checklist de Revisión

Antes de ejecutar en Supabase Cloud:

- [x] seed_bookfast_demo.sql actualizado (400 clientes, 20 servicios)
- [x] seed_bookfast_bookings.sql actualizado (2 años, probabilidades)
- [ ] seed_bookfast_assign_users.sql con UPDATE staff.user_id
- [ ] seed_bookfast_validate.sql con expectativas nuevas
- [ ] SEED_BOOKFAST_README.md con volúmenes nuevos
- [ ] SEED_BOOKFAST_CHECKLIST.md con pasos demo-ready

**⚠️ NO ejecutar en Cloud hasta confirmar todos los archivos actualizados**

---

## 📞 Soporte

Si encuentras problemas:

1. Verificar logs: `RAISE NOTICE` en funciones PL/pgSQL
2. Validar constraints: `SELECT * FROM pg_constraint WHERE conname LIKE '%booking%'`
3. Revisar permisos RLS: `SELECT * FROM pg_policies WHERE tablename = 'bookings'`

---

**Actualización completada por:** GitHub Copilot  
**Revisión pendiente:** Josep Calafat  
**Estado:** ✅ 80% completo (falta actualizar documentación y validate.sql)
