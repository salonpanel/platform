# 🧪 GUÍA PASO A PASO - VALIDACIÓN AGENDA

## ESTRUCTURA DE LA VALIDACIÓN

```
FASE 1: SQL Tests (Supabase Editor) ━━━━━━ 15 minutos
         └─ Verifica cada RPC individualmente
         
FASE 2: Console Tests (Browser) ━━━━━━━━━━ 10 minutos
         └─ Valida integración Supabase JS
         
FASE 3: End-to-End (Interfaz UI) ━━━━━━━━ 20 minutos
         └─ Prueba flujos reales de usuario
         
FASE 4: Performance Benchmark ━━━━━━━━━━━ 10 minutos
         └─ Mide velocidad de ejecución
```

**Tiempo total estimado: 55 minutos**

---

## FASE 1: SQL Tests (15 minutos)

### Paso 1.1: Abre Supabase Dashboard

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Haz clic en **SQL Editor** (lado izquierdo)
4. Crea una nueva query vacía

### Paso 1.2: Test check_booking_conflicts

**Copia y pega este código:**

```sql
-- ✅ TEST 1.2: check_booking_conflicts
-- Objetivo: Verificar que detecta conflictos

WITH tenant_data AS (
  SELECT id FROM tenants LIMIT 1
),
staff_data AS (
  SELECT id FROM staff 
  WHERE tenant_id = (SELECT id FROM tenant_data)
  AND active = true
  LIMIT 1
)
SELECT 
  'check_booking_conflicts' as test_name,
  COUNT(*) as conflict_count,
  jsonb_agg(row_to_json(t)) as conflicts
FROM (
  SELECT * FROM public.check_booking_conflicts(
    (SELECT id FROM tenant_data),
    (SELECT id FROM staff_data),
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days 1 hour',
    NULL
  )
) t;
```

**Ejecuta:** Presiona Ctrl+Enter o botón Run

**Esperado:**
```
test_name                | conflict_count | conflicts
check_booking_conflicts  | 0 o más        | [...]
```

**Resultado:** ✅ / ❌

---

### Paso 1.3: Test create_booking_with_validation

**Copia y pega este código:**

```sql
-- ✅ TEST 1.3: create_booking_with_validation
-- Objetivo: Crear un booking con validación

WITH tenant_data AS (
  SELECT id FROM tenants LIMIT 1
),
staff_data AS (
  SELECT id FROM staff 
  WHERE tenant_id = (SELECT id FROM tenant_data)
  AND active = true
  LIMIT 1
),
customer_data AS (
  SELECT id FROM customers
  WHERE tenant_id = (SELECT id FROM tenant_data)
  LIMIT 1
),
service_data AS (
  SELECT id FROM services
  WHERE tenant_id = (SELECT id FROM tenant_data)
  AND active = true
  LIMIT 1
)
SELECT 
  'create_booking_with_validation' as test_name,
  booking,
  error_message
FROM public.create_booking_with_validation(
  jsonb_build_object(
    'tenant_id', (SELECT id FROM tenant_data)::text,
    'staff_id', (SELECT id FROM staff_data)::text,
    'customer_id', (SELECT id FROM customer_data)::text,
    'service_id', (SELECT id FROM service_data)::text,
    'starts_at', (NOW() + INTERVAL '3 days')::text,
    'ends_at', (NOW() + INTERVAL '3 days 1 hour')::text,
    'status', 'confirmed'
  )
);
```

**Ejecuta:** Ctrl+Enter

**Esperado:**
```
test_name                        | booking          | error_message
create_booking_with_validation   | {...booking...}  | (null)
```

o (si hay conflicto):

```
test_name                        | booking | error_message
create_booking_with_validation   | (null)  | Conflicto detectado: el horario no está disponible
```

**Resultado:** ✅ / ❌

---

### Paso 1.4: Test get_filtered_bookings

**Copia y pega este código:**

```sql
-- ✅ TEST 1.4: get_filtered_bookings
-- Objetivo: Obtener bookings filtrados

WITH tenant_data AS (
  SELECT id FROM tenants LIMIT 1
)
SELECT 
  'get_filtered_bookings' as test_name,
  COUNT(*) as booking_count,
  jsonb_agg(booking_row) as sample_bookings
FROM (
  SELECT row_to_json(row)::jsonb as booking_row
  FROM (
    SELECT * FROM public.get_filtered_bookings(
      (SELECT id FROM tenant_data),
      CURRENT_DATE::timestamptz,
      (CURRENT_DATE + INTERVAL '7 days')::timestamptz,
      NULL,
      NULL
    )
    LIMIT 3
  ) AS row
) t;
```

**Ejecuta:** Ctrl+Enter

**Esperado:**
```
test_name             | booking_count | sample_bookings
get_filtered_bookings | 0 o más       | [...]
```

**Resultado:** ✅ / ❌

---

### Paso 1.5: Test get_agenda_stats

**Copia y pega este código:**

```sql
-- ✅ TEST 1.5: get_agenda_stats
-- Objetivo: Obtener stats agregadas

WITH tenant_data AS (
  SELECT id FROM tenants LIMIT 1
)
SELECT 
  'get_agenda_stats' as test_name,
  public.get_agenda_stats(
    (SELECT id FROM tenant_data),
    CURRENT_DATE::timestamptz,
    (CURRENT_DATE + INTERVAL '30 days')::timestamptz
  ) as stats;
```

**Ejecuta:** Ctrl+Enter

**Esperado:**
```
test_name        | stats
get_agenda_stats | {"total_bookings": 5, "total_minutes": 300, ...}
```

**Resultado:** ✅ / ❌

---

### Checklist FASE 1
- [ ] Test 1.2: check_booking_conflicts ✅
- [ ] Test 1.3: create_booking_with_validation ✅
- [ ] Test 1.4: get_filtered_bookings ✅
- [ ] Test 1.5: get_agenda_stats ✅

**Si todos están ✅, continúa a FASE 2**

---

## FASE 2: Console Tests (10 minutos)

### Paso 2.1: Abre la página Agenda

1. En tu navegador, ve a `/app/panel/agenda`
2. Presiona **F12** para abrir DevTools
3. Haz clic en pestaña **Console**

### Paso 2.2: Ejecuta el script de validación

**Copia este código completo:**

```javascript
(async () => {
  console.log("🧪 INICIANDO VALIDACIÓN FASE 2...\n");

  try {
    const { getSupabaseBrowser } = await import("@/lib/supabase/browser");
    const supabase = getSupabaseBrowser();

    // Obtener usuario y tenant
    const { data: { user } } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const tenantId = membership?.tenant_id;
    if (!tenantId) throw new Error("Tenant not found");

    console.log("✅ Usuario y tenant verificados\n");

    // TEST 1: get_filtered_bookings
    console.log("━".repeat(60));
    console.log("TEST 1: get_filtered_bookings");
    console.log("━".repeat(60));
    const { data: bookings, error: bError } = await supabase.rpc(
      "get_filtered_bookings",
      {
        p_tenant_id: tenantId,
        p_start_date: new Date().toISOString().split("T")[0],
        p_end_date: new Date(Date.now() + 604800000)
          .toISOString()
          .split("T")[0],
      }
    );
    if (bError) throw bError;
    console.log(`✅ SUCCESS: ${bookings?.length || 0} bookings obtenidos`);
    if (bookings?.length > 0) console.log("Sample:", bookings[0]);
    console.log();

    // TEST 2: get_agenda_stats
    console.log("━".repeat(60));
    console.log("TEST 2: get_agenda_stats");
    console.log("━".repeat(60));
    const { data: stats, error: sError } = await supabase.rpc(
      "get_agenda_stats",
      {
        p_tenant_id: tenantId,
        p_start_date: new Date().toISOString().split("T")[0],
        p_end_date: new Date(Date.now() + 2592000000)
          .toISOString()
          .split("T")[0],
      }
    );
    if (sError) throw sError;
    console.log("✅ SUCCESS: Stats obtenidas");
    console.log(JSON.stringify(stats, null, 2));
    console.log();

    // TEST 3: check_booking_conflicts
    console.log("━".repeat(60));
    console.log("TEST 3: check_booking_conflicts");
    console.log("━".repeat(60));
    const { data: staffList } = await supabase
      .from("staff")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .limit(1);

    if (staffList?.length > 0) {
      const { data: conflicts, error: cError } = await supabase.rpc(
        "check_booking_conflicts",
        {
          p_tenant_id: tenantId,
          p_staff_id: staffList[0].id,
          p_start_at: new Date(Date.now() + 86400000).toISOString(),
          p_end_at: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        }
      );
      if (cError) throw cError;
      console.log(`✅ SUCCESS: ${conflicts?.length || 0} conflictos detectados`);
      console.log(JSON.stringify(conflicts, null, 2));
    }
    console.log();

    console.log("━".repeat(60));
    console.log("✅ FASE 2 COMPLETADA EXITOSAMENTE");
    console.log("━".repeat(60));
  } catch (error) {
    console.error("❌ ERROR:", error);
  }
})();
```

**Pégalo en la consola y presiona Enter**

### Paso 2.3: Observa los resultados

Deberías ver:
- ✅ get_filtered_bookings: N bookings
- ✅ get_agenda_stats: JSON con stats
- ✅ check_booking_conflicts: conflictos detectados

**Si ves errores:**
- Revisa que estés en `/app/panel/agenda`
- Revisa que hayas iniciado sesión
- Revisa la pestaña **Network** en DevTools para ver llamadas

### Checklist FASE 2
- [ ] get_filtered_bookings funcionando ✅
- [ ] get_agenda_stats funcionando ✅
- [ ] check_booking_conflicts funcionando ✅

**Si todos están ✅, continúa a FASE 3**

---

## FASE 3: End-to-End (20 minutos)

### Paso 3.1: Crear un booking

1. En `/app/panel/agenda`, haz clic en **"Nueva reserva"** (o en un slot vacío)
2. Completa los campos:
   - **Cliente:** Selecciona cualquiera
   - **Servicio:** Selecciona cualquiera
   - **Staff:** Selecciona cualquiera
   - **Fecha/Hora:** Mañana a las 10:00 - 11:00
3. Haz clic en **"Guardar"**

**Esperado:**
- ✅ Booking se crea sin errores
- ✅ Aparece en la agenda
- ✅ Toast dice "Reserva creada correctamente"

**Resultado:** ✅ / ❌

---

### Paso 3.2: Intentar crear un booking duplicado

1. Intenta crear otro booking **en el mismo horario y staff**
2. Haz clic en "Guardar"

**Esperado:**
- ✅ Error del backend: "El horario ya está ocupado..."
- ✅ Booking NO se crea
- ✅ Toast rojo mostrando el error

**Resultado:** ✅ / ❌

---

### Paso 3.3: Mover una reserva

1. Selecciona un booking existente (o crea uno nuevo)
2. Intenta moverlo arrastrando o editando
3. Cambiar a un horario diferente
4. Haz clic en "Guardar"

**Esperado:**
- ✅ Se mueve sin problemas
- ✅ Toast verde: "Cita reprogramada correctamente"

**Resultado:** ✅ / ❌

---

### Paso 3.4: Observar stats

1. Mira la barra superior de la Agenda (KPIs)
2. Deberías ver:
   - Total de bookings
   - Total de minutos
   - Importe total
   - Ocupación por staff

**Esperado:**
- ✅ Stats se muestran correctamente
- ✅ Números coinciden con bookings visibles

**Resultado:** ✅ / ❌

---

### Checklist FASE 3
- [ ] Crear booking exitosamente ✅
- [ ] Detectar conflicto de booking ✅
- [ ] Mover booking exitosamente ✅
- [ ] Ver stats actualizadas ✅

**Si todos están ✅, continúa a FASE 4**

---

## FASE 4: Performance Benchmark (10 minutos)

### Paso 4.1: Abre console nuevamente

1. En `/app/panel/agenda`, presiona **F12**
2. Pestaña **Console**

### Paso 4.2: Ejecuta benchmark

**Copia y pega:**

```javascript
(async () => {
  console.log("⏱️ INICIANDO BENCHMARK DE PERFORMANCE...\n");

  const { getSupabaseBrowser } = await import("@/lib/supabase/browser");
  const supabase = getSupabaseBrowser();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const tenantId = membership?.tenant_id;
  const iterations = 10;
  const times = [];

  console.log(`Ejecutando ${iterations} iteraciones...\n`);

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await supabase.rpc("get_filtered_bookings", {
      p_tenant_id: tenantId,
      p_start_date: new Date().toISOString().split("T")[0],
      p_end_date: new Date(Date.now() + 604800000)
        .toISOString()
        .split("T")[0],
    });
    const time = performance.now() - start;
    times.push(time);
    console.log(`  Iteración ${i + 1}: ${time.toFixed(2)}ms`);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("RESULTADOS:");
  console.log(`  Promedio: ${avg.toFixed(2)}ms`);
  console.log(`  Mínimo:   ${min.toFixed(2)}ms`);
  console.log(`  Máximo:   ${max.toFixed(2)}ms`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (avg < 300) {
    console.log("✅ EXCELENTE: < 300ms");
  } else if (avg < 500) {
    console.log("✅ BIEN: < 500ms");
  } else if (avg < 1000) {
    console.log("⚠️ ACCEPTABLE: < 1000ms");
  } else {
    console.log("❌ LENTO: > 1000ms");
  }
})();
```

### Paso 4.3: Interpreta resultados

| Promedio | Calificación | Acción |
|----------|-------------|--------|
| < 300ms | ✅ EXCELENTE | Go-live directo |
| < 500ms | ✅ BIEN | Go-live con monitoreo |
| < 1000ms | ⚠️ ACEPTABLE | Revisar índices |
| > 1000ms | ❌ LENTO | Investigar |

### Checklist FASE 4
- [ ] Benchmark ejecutado ✅
- [ ] Promedio: _____ ms
- [ ] Calificación: ___________

---

## RESULTADO FINAL

### Todos los tests pasaron? ✅

**Marca todas las casillas:**
- [ ] FASE 1: SQL Tests ✅
- [ ] FASE 2: Console Tests ✅
- [ ] FASE 3: E2E ✅
- [ ] FASE 4: Performance ✅

### ¿Qué sigue?

✅ Si todo pasó:
1. Documenta los resultados en AGENDA_OPTIMIZATION_CHECKLIST.md
2. Avisa al equipo de that everything is ready
3. Procede a Go-Live en producción

❌ Si algo falla:
1. Revisa los logs en Supabase
2. Ejecuta los tests SQL nuevamente
3. Revisa la console para errores JavaScript
4. Reporta el error específico

---

**Tiempo total invertido:** ___ minutos  
**Fecha de ejecución:** ___________  
**Resultado:** ✅ / ❌  
**Responsable:** ___________  
