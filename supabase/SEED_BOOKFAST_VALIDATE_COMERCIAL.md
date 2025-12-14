# 📋 Validaciones Adicionales: Demo Comercial BookFast

Este archivo complementa `seed_bookfast_validate.sql` con validaciones específicas para la **versión comercial** del seed.

**Ejecutar DESPUÉS de `seed_bookfast_validate.sql`**

---

## 🎯 Validaciones Críticas Demo Comercial

### 1. Horizonte Temporal (2 años completos)

```sql
-- ✅ Verificar que las reservas cubren 12/12/2024 a 12/12/2026

SELECT 
  MIN(starts_at)::DATE as primera_reserva,
  MAX(starts_at)::DATE as ultima_reserva,
  EXTRACT(DAY FROM (MAX(starts_at) - MIN(starts_at)))::INT as dias_cubiertos,
  CASE 
    WHEN EXTRACT(DAY FROM (MAX(starts_at) - MIN(starts_at))) >= 700 
    THEN '✅ OK - Cobertura de 2 años' 
    ELSE '❌ ERROR - Horizonte insuficiente' 
  END as validacion
FROM public.bookings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';
```

**✅ Resultado esperado:**
- `primera_reserva`: 2024-12-12 (±3 días)
- `ultima_reserva`: 2026-12-12 (±3 días)
- `dias_cubiertos`: 730 ±10

---

### 2. Staff Blockings (Vacaciones/Ausencias)

```sql
-- ✅ Verificar que hay bloqueos realistas de staff

SELECT 
  s.display_name,
  TO_CHAR(sb.start_time, 'DD/MM/YYYY') as inicio,
  TO_CHAR(sb.end_time, 'DD/MM/YYYY') as fin,
  EXTRACT(DAY FROM (sb.end_time - sb.start_time))::INT as dias,
  sb.reason
FROM public.staff_blockings sb
JOIN public.staff s ON s.id = sb.staff_id
WHERE sb.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND sb.is_active = true
ORDER BY sb.start_time;
```

**✅ Resultado esperado: 6 filas**
- Josep: Vacaciones verano 2025 (15 días)
- Josep: Formación Nov 2025 (3 días)
- Socio: Vacaciones navidad 2024 (16 días)
- Carlos: Semana Santa 2025 (7 días)
- Javier: Baja médica (5 días)
- David: Vacaciones agosto 2025 (16 días)

---

### 3. Owners Vinculados a Staff (CRÍTICO ⚠️)

```sql
-- ⚠️ CRÍTICO: Verificar que owners aparecen como barberos activos

SELECT 
  s.display_name,
  s.role,
  s.user_id,
  u.email,
  m.role as membership_role,
  CASE 
    WHEN s.user_id IS NOT NULL THEN '✅ Vinculado' 
    ELSE '❌ SIN VINCULAR (no aparecerá en agenda)' 
  END as status
FROM public.staff s
LEFT JOIN auth.users u ON u.id = s.user_id
LEFT JOIN public.memberships m ON m.user_id = s.user_id AND m.tenant_id = s.tenant_id
WHERE s.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND s.id IN ('bf000002-staf-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002')
ORDER BY s.display_name;
```

**✅ Resultado esperado:**
| display_name | role | user_id | membership_role | status |
|--------------|------|---------|-----------------|--------|
| Josep | Owner/Senior | <UUID> | owner | ✅ Vinculado |
| Socio | Owner/Maestro | <UUID> | owner | ✅ Vinculado |

**❌ Si ambos muestran `user_id = NULL`:**
→ **Ejecutar manualmente** los UPDATEs en `seed_bookfast_assign_users.sql`

---

### 4. Distribución Realista de Servicios

```sql
-- ✅ Verificar que la distribución de servicios es comercialmente realista

SELECT 
  sv.category,
  COUNT(b.id) as total_bookings,
  ROUND(COUNT(b.id) * 100.0 / SUM(COUNT(b.id)) OVER (), 1) as percentage
FROM public.bookings b
JOIN public.services sv ON sv.id = b.service_id
WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY sv.category
ORDER BY total_bookings DESC;
```

**✅ Resultado esperado (aprox):**
| category | total_bookings | percentage |
|----------|----------------|------------|
| Corte | 1500-2000 | 50-60% |
| Barba | 500-700 | 18-25% |
| Combo | 400-600 | 15-20% |
| Extras | 100-300 | 5-10% |

**⚠️ Si alguna categoría está <5% o >70%:** Revisar lógica de probabilidad en `generate_bookfast_bookings()`

---

### 5. Estacionalidad (Picos y Valles)

```sql
-- ✅ Verificar que hay estacionalidad realista (valles en verano/navidad)

SELECT 
  EXTRACT(MONTH FROM starts_at) as mes,
  TO_CHAR(TO_DATE(EXTRACT(MONTH FROM starts_at)::TEXT, 'MM'), 'Month') as mes_nombre,
  COUNT(*) as bookings,
  ROUND(AVG(COUNT(*)) OVER (), 0) as media,
  CASE 
    WHEN COUNT(*) < AVG(COUNT(*)) OVER () * 0.8 THEN '📉 Valle (esperado en ago/dic)'
    WHEN COUNT(*) > AVG(COUNT(*)) OVER () * 1.2 THEN '📈 Pico'
    ELSE '➡️ Normal'
  END as tipo
FROM public.bookings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY mes
ORDER BY mes;
```

**✅ Resultado esperado:**
| mes | mes_nombre | bookings | tipo |
|-----|------------|----------|------|
| 1 | January | ~200 | ➡️ Normal |
| ... | ... | ... | ... |
| **8** | **August** | **~120-150** | **📉 Valle** |
| ... | ... | ... | ... |
| **12** | **December** | **~130-160** | **📉 Valle** |

---

### 6. Ocupación por Día de Semana

```sql
-- ✅ Verificar que hay más actividad viernes/sábado

SELECT 
  EXTRACT(DOW FROM starts_at) as dow,
  CASE EXTRACT(DOW FROM starts_at)
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miércoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sábado'
  END as dia_semana,
  COUNT(*) as bookings,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM public.bookings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY dow
ORDER BY dow;
```

**✅ Resultado esperado:**
| dow | dia_semana | bookings | percentage |
|-----|------------|----------|------------|
| 0 | Domingo | ~200-300 | 8-10% |
| 1 | Lunes | ~300-400 | 12-14% |
| 5 | **Viernes** | **~500-600** | **18-20%** |
| 6 | **Sábado** | **~550-650** | **20-22%** |

---

### 7. VIPs con Métricas Reales

```sql
-- ✅ Verificar que VIPs tienen estadísticas significativas

SELECT 
  name,
  visits_count,
  ROUND(total_spent_cents / 100.0, 2) as total_spent_eur,
  is_vip,
  tags
FROM public.customers
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND is_vip = true
ORDER BY visits_count DESC
LIMIT 10;
```

**✅ Resultado esperado:**
- Top VIP: `visits_count` >= 15, `total_spent_eur` >= €300
- 40-60 clientes totales con `is_vip = true`
- Tags incluyen: `['vip', 'puntual']`, `['vip', 'mensual']`

---

### 8. Verificar Que HOY Tiene Reservas

```sql
-- ⚠️ DEMO CRÍTICO: Verificar que la fecha actual tiene reservas visibles

SELECT 
  COUNT(*) as reservas_hoy,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ OK - Agenda visible hoy'
    ELSE '⚠️ WARNING - Hoy sin reservas (demo vacía)'
  END as validacion
FROM public.bookings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND starts_at::DATE = CURRENT_DATE;
```

**✅ Resultado esperado:** `reservas_hoy` >= 3

**⚠️ Si `reservas_hoy = 0`:**  
→ Revisar si CURRENT_DATE está dentro del rango 2024-12-12 a 2026-12-12  
→ Considerar ajustar `v_start_date` en `seed_bookfast_bookings.sql`

---

### 9. Próximos 7 Días (Agenda Demo-Ready)

```sql
-- ✅ Verificar que próxima semana está poblada para demos

SELECT 
  starts_at::DATE as fecha,
  COUNT(*) as reservas,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅'
    WHEN COUNT(*) >= 2 THEN '⚠️'
    ELSE '❌'
  END as demo_ready
FROM public.bookings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND starts_at >= CURRENT_DATE
  AND starts_at < CURRENT_DATE + INTERVAL '7 days'
GROUP BY fecha
ORDER BY fecha;
```

**✅ Resultado esperado:**  
7 filas, cada una con `reservas` >= 5 y `demo_ready` = '✅'

---

## 🚨 Troubleshooting

### ❌ Horizonte temporal insuficiente (<700 días)
**Causa:** Función `generate_bookfast_bookings()` no completó 2 años  
**Solución:**  
```sql
-- Verificar fecha inicio
SELECT 'Fecha inicio debe ser 2024-12-12' as nota;
-- Si diferente, editar seed_bookfast_bookings.sql línea:
-- v_start_date := '2024-12-12'::DATE;
```

### ❌ Owners con `user_id = NULL`
**Causa:** No se ejecutó correctamente `seed_bookfast_assign_users.sql`  
**Solución:**  
```sql
-- Ejecutar manualmente:
UPDATE public.staff
SET user_id = 'TU_USER_ID_AQUI'
WHERE id = 'bf000002-staf-0000-0000-000000000001';

UPDATE public.staff
SET user_id = 'SOCIO_USER_ID_AQUI'
WHERE id = 'bf000002-staf-0000-0000-000000000002';
```

### ⚠️ Reservas HOY = 0 (agenda vacía)
**Causa:** `CURRENT_DATE` fuera del rango del seed  
**Opciones:**  
1. Re-ejecutar seed con `v_start_date := CURRENT_DATE - INTERVAL '6 months'`
2. Ajustar fecha del sistema para demos
3. Navegar en UI a fechas con datos (2025-06-15 por ejemplo)

### 📉 Estacionalidad no visible
**Causa:** Probabilidades no aplicadas correctamente  
**Solución:**  
```sql
-- Verificar código en seed_bookfast_bookings.sql:
-- IF v_month = 8 OR v_month = 12 THEN
--   v_base_probability := v_base_probability - 0.20;
-- END IF;
```

---

## ✅ Checklist Final Demo-Ready

Ejecutar TODAS estas queries antes de mostrar demo:

- [ ] **Horizonte 2 años:** >= 700 días cubiertos
- [ ] **Staff blockings:** 6 registros activos
- [ ] **Owners vinculados:** Josep y Socio con `user_id != NULL`
- [ ] **Servicios:** Corte ~55%, Barba ~22%, Combo ~18%, Extras ~5%
- [ ] **Estacionalidad:** Agosto y Diciembre con ~25% menos reservas
- [ ] **Viernes/Sábado:** 20%+ cada uno del total
- [ ] **VIPs:** 40-60 clientes, top 10 con >15 visitas
- [ ] **Reservas HOY:** >= 3 visibles
- [ ] **Próximos 7 días:** Cada día >= 5 reservas

**🎯 Si todos ✅ → Demo lista para presentación comercial**

---

**Documento creado por:** GitHub Copilot  
**Versión:** Demo Comercial 2024  
**Actualización:** Diciembre 2024
