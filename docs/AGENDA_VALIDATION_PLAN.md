# 🔥 PLAN COMPLETO DE VALIDACIÓN - AGENDA OPTIMIZATION

## Estado actual
- ✅ Todas las RPCs creadas en Supabase
- ✅ Todos los índices aplicados
- ✅ Frontend actualizado para usar nuevas RPCs
- ⏳ Validación: PENDIENTE

---

## EJECUCIÓN DEL PLAN COMPLETO

### FASE 1: Validación de RPCs en SQL Editor (Supabase)

Ejecuta cada uno de estos comandos en el SQL Editor de Supabase Dashboard.

#### Test 1.1: check_booking_conflicts (sin conflicto)
```sql
-- Busca un tenant real
WITH tenant_data AS (
  SELECT id FROM tenants LIMIT 1
),
staff_data AS (
  SELECT id FROM staff 
  WHERE tenant_id = (SELECT id FROM tenant_data)
  AND active = true
  LIMIT 1
)
SELECT * FROM public.check_booking_conflicts(
  p_tenant_id := (SELECT id FROM tenant_data),
  p_staff_id := (SELECT id FROM staff_data),
  p_start_at := NOW() + INTERVAL '2 days',
  p_end_at := NOW() + INTERVAL '2 days 1 hour'
);
```

**Esperado:** 
- Sin error
- Devuelve tabla vacía (no hay conflictos) o conflictos si existen

**Resultado:** ✅ / ❌

---

#### Test 1.2: create_booking_with_validation (crear booking válido)
```sql
-- Crear booking con validación
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
SELECT public.create_booking_with_validation(
  p_booking := jsonb_build_object(
    'tenant_id', (SELECT id FROM tenant_data),
    'staff_id', (SELECT id FROM staff_data),
    'customer_id', (SELECT id FROM customer_data),
    'service_id', (SELECT id FROM service_data),
    'starts_at', NOW() + INTERVAL '3 days',
    'ends_at', NOW() + INTERVAL '3 days 1 hour',
    'status', 'confirmed'
  )
);
```

**Esperado:**
- JSONB con `booking_id` y NULL en `error_message` (éxito)
- O JSONB con NULL en `booking_id` y error message (conflicto)

**Resultado:** ✅ / ❌

---

#### Test 1.3: get_filtered_bookings
```sql
-- Obtener bookings filtrados
WITH tenant_data AS (
  SELECT id FROM tenants LIMIT 1
)
SELECT * FROM public.get_filtered_bookings(
  p_tenant_id := (SELECT id FROM tenant_data),
  p_start_date := CURRENT_DATE,
  p_end_date := CURRENT_DATE + INTERVAL '30 days'
);
```

**Esperado:**
- Array de objetos con estructura: `{ id, starts_at, ends_at, customer, staff, service, status }`
- Puede estar vacío si no hay bookings

**Resultado:** ✅ / ❌

---

#### Test 1.4: get_agenda_stats
```sql
-- Obtener stats agregadas
WITH tenant_data AS (
  SELECT id FROM tenants LIMIT 1
)
SELECT public.get_agenda_stats(
  p_tenant_id := (SELECT id FROM tenant_data),
  p_start_date := CURRENT_DATE,
  p_end_date := CURRENT_DATE + INTERVAL '30 days'
);
```

**Esperado:**
- JSONB con estructura: `{ total_bookings, total_minutes, total_amount, by_staff: [...] }`

**Resultado:** ✅ / ❌

---

### FASE 2: Validación en Frontend (Console Browser)

1. **Abre `/app/panel/agenda`**
2. **Abre DevTools (F12 → Console)**
3. **Copia y pega el siguiente código:**

```javascript
(async () => {
  const { getSupabaseBrowser } = await import("@/lib/supabase/browser");
  const supabase = getSupabaseBrowser();

  // Obtener usuario y tenant
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const tenantId = membership.tenant_id;

  console.log("🧪 TEST: get_filtered_bookings");
  const { data: bookings } = await supabase.rpc("get_filtered_bookings", {
    p_tenant_id: tenantId,
    p_start_date: new Date().toISOString().split("T")[0],
    p_end_date: new Date(Date.now() + 604800000).toISOString().split("T")[0],
  });
  console.log("✅ Bookings:", bookings?.length || 0, bookings);

  console.log("🧪 TEST: get_agenda_stats");
  const { data: stats } = await supabase.rpc("get_agenda_stats", {
    p_tenant_id: tenantId,
    p_start_date: new Date().toISOString().split("T")[0],
    p_end_date: new Date(Date.now() + 2592000000).toISOString().split("T")[0],
  });
  console.log("✅ Stats:", stats);

  console.log("🧪 TEST: check_booking_conflicts");
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();

  const { data: conflicts } = await supabase.rpc("check_booking_conflicts", {
    p_tenant_id: tenantId,
    p_staff_id: staff.id,
    p_start_at: new Date(Date.now() + 86400000).toISOString(),
    p_end_at: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  });
  console.log("✅ Conflicts:", conflicts);
})();
```

**Esperado:**
- ✅ Bookings: muestra array de bookings
- ✅ Stats: muestra objeto con stats
- ✅ Conflicts: muestra array (vacío si no hay conflictos)

**Resultado:** ✅ / ❌

---

### FASE 3: Validación End-to-End

#### Test 3.1: Crear una reserva
1. En Agenda, haz clic en **"Nueva reserva"**
2. Completa los campos (cliente, servicio, staff, horario)
3. Haz clic en **"Guardar"**
4. **Esperado:** Booking se crea sin errores

**Resultado:** ✅ / ❌

---

#### Test 3.2: Detectar conflicto
1. En Agenda, intenta crear un booking en el mismo horario/staff
2. **Esperado:** Error del backend diciendo "El horario ya está ocupado"

**Resultado:** ✅ / ❌

---

#### Test 3.3: Mover una reserva
1. En Agenda, selecciona un booking existente
2. Intenta moverlo a otro horario
3. **Esperado:** Se mueve sin problemas si no hay conflicto

**Resultado:** ✅ / ❌

---

#### Test 3.4: Ver stats
1. Observa la barra superior de Agenda (KPIs)
2. **Esperado:** Muestra:
   - Total de bookings
   - Total de minutos
   - Importe total
   - Ocupación por staff

**Resultado:** ✅ / ❌

---

### FASE 4: Performance Validation

Ejecuta en Console:

```javascript
const { getSupabaseBrowser } = await import("@/lib/supabase/browser");
const supabase = getSupabaseBrowser();
const { data: { user } } = await supabase.auth.getUser();
const { data: membership } = await supabase
  .from("memberships")
  .select("tenant_id")
  .eq("user_id", user.id)
  .maybeSingle();
const tenantId = membership.tenant_id;

// 5 iteraciones
const times = [];
for (let i = 0; i < 5; i++) {
  const start = performance.now();
  await supabase.rpc("get_filtered_bookings", {
    p_tenant_id: tenantId,
    p_start_date: new Date().toISOString().split("T")[0],
    p_end_date: new Date(Date.now() + 604800000).toISOString().split("T")[0],
  });
  times.push(performance.now() - start);
}

const avg = times.reduce((a,b) => a+b) / times.length;
console.log(`Average: ${avg.toFixed(2)}ms`, times);
```

**Esperado:**
- ✅ Promedio < 300ms = EXCELENTE
- ✅ Promedio < 500ms = BIEN
- ⚠️ Promedio > 500ms = Revisar índices

**Resultado:** ✅ / ❌ | **Avg time:** ___ ms

---

## CHECKLIST FINAL

- [ ] Test 1.1: check_booking_conflicts SQL ✅
- [ ] Test 1.2: create_booking_with_validation SQL ✅
- [ ] Test 1.3: get_filtered_bookings SQL ✅
- [ ] Test 1.4: get_agenda_stats SQL ✅
- [ ] Test 2: Console validation ✅
- [ ] Test 3.1: Crear reserva ✅
- [ ] Test 3.2: Detectar conflicto ✅
- [ ] Test 3.3: Mover reserva ✅
- [ ] Test 3.4: Ver stats ✅
- [ ] Test 4: Performance < 500ms ✅

---

## RESULTADO FINAL

**Estado:** ⏳ PENDIENTE / ✅ COMPLETADO / ❌ CON ERRORES

**Problemas encontrados:**
(Documenta aquí cualquier error)

**Próximos pasos:**
1. Si todo está ✅: Lanzar a producción
2. Si hay ❌: Revisar logs y errores específicos

---

## Comando para ejecutar tests automáticos

```bash
npm test -- tests/agenda-optimization-validation.test.ts
```
