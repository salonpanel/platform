# ☑️ CHECKLIST: Seed BookFast Demo

## 📋 Lista de Verificación Paso a Paso

Marca cada paso a medida que lo completes:

---

## 🔧 FASE 1: Preparación

- [ ] **1.1** Leer `SEED_BOOKFAST_README.md` completo
- [ ] **1.2** Leer `SEED_BOOKFAST_SUMMARY.md` para overview rápido
- [ ] **1.3** Abrir Supabase Cloud Dashboard
- [ ] **1.4** Abrir SQL Editor en nueva pestaña
- [ ] **1.5** Verificar que no existe tenant `bookfast`:
  ```sql
  SELECT * FROM public.tenants WHERE slug = 'bookfast';
  ```
  ✅ Debe retornar 0 filas

---

## 🏗️ FASE 2: Crear Estructura Base

- [ ] **2.1** Abrir archivo `supabase/seed_bookfast_demo.sql`
- [ ] **2.2** Copiar TODO el contenido
- [ ] **2.3** Pegar en SQL Editor de Supabase
- [ ] **2.4** Click en "RUN" o ejecutar
- [ ] **2.5** Verificar mensaje de éxito (COMMIT)
- [ ] **2.6** Validar tenant creado:
  ```sql
  SELECT * FROM public.tenants 
  WHERE id = 'bf000000-0000-0000-0000-000000000001';
  ```
  ✅ Debe retornar 1 fila con name = 'BookFast Barbería'

- [ ] **2.7** Validar servicios:
  ```sql
  SELECT COUNT(*) FROM public.services 
  WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';
  ```
  ✅ Debe retornar 8

- [ ] **2.8** Validar staff:
  ```sql
  SELECT COUNT(*) FROM public.staff 
  WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';
  ```
  ✅ Debe retornar 4

- [ ] **2.9** Validar clientes:
  ```sql
  SELECT COUNT(*) FROM public.customers 
  WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';
  ```
  ✅ Debe retornar 30

---

## 👥 FASE 3: Asignar Usuarios Owners

- [ ] **3.1** Abrir archivo `supabase/seed_bookfast_assign_users.sql`
- [ ] **3.2** Ejecutar query para ver usuarios existentes:
  ```sql
  SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data->>'full_name' as full_name
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 20;
  ```

- [ ] **3.3** Copiar tu user ID (columna `id`)
- [ ] **3.4** Copiar user ID de tu socio (si aplica)
- [ ] **3.5** En el archivo, buscar el bloque comentado `DO $$`
- [ ] **3.6** Descomentar el bloque (quitar `/*` y `*/`)
- [ ] **3.7** Reemplazar `REEMPLAZAR_CON_TU_USER_ID` con tu UUID real
- [ ] **3.8** Reemplazar `REEMPLAZAR_CON_SOCIO_USER_ID` con el UUID de tu socio
- [ ] **3.9** Copiar el bloque editado completo
- [ ] **3.10** Pegar en SQL Editor
- [ ] **3.11** Ejecutar
- [ ] **3.12** Verificar mensajes de NOTICE (deben aparecer 3-4 notices)
- [ ] **3.13** Validar memberships:
  ```sql
  SELECT 
    m.role,
    u.email,
    t.name as tenant_name
  FROM public.memberships m
  JOIN auth.users u ON u.id = m.user_id
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.tenant_id = 'bf000000-0000-0000-0000-000000000001';
  ```
  ✅ Debe retornar 1 o 2 filas con role = 'owner'

- [ ] **3.14** Validar contexto multi-tenant:
  ```sql
  SELECT app.current_tenant_id();
  ```
  ✅ Debe retornar `bf000000-0000-0000-0000-000000000001`

---

## 📅 FASE 4: Generar Reservas

- [ ] **4.1** Abrir archivo `supabase/seed_bookfast_bookings.sql`
- [ ] **4.2** Copiar TODO el contenido
- [ ] **4.3** Pegar en SQL Editor
- [ ] **4.4** Ejecutar
- [ ] **4.5** Esperar 30-60 segundos (proceso puede ser lento)
- [ ] **4.6** Verificar mensaje final con count de reservas creadas
- [ ] **4.7** Validar reservas creadas:
  ```sql
  SELECT COUNT(*) FROM public.bookings 
  WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';
  ```
  ✅ Debe retornar 500-800

- [ ] **4.8** Validar distribución por estado:
  ```sql
  SELECT status, COUNT(*) 
  FROM public.bookings 
  WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  GROUP BY status;
  ```
  ✅ Debe mostrar completed, confirmed, cancelled, no_show

- [ ] **4.9** Validar clientes VIP actualizados:
  ```sql
  SELECT COUNT(*) FROM public.customers 
  WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001' 
    AND is_vip = true;
  ```
  ✅ Debe retornar 3-8

---

## ✅ FASE 5: Validación Completa

- [ ] **5.1** Abrir archivo `supabase/seed_bookfast_validate.sql`
- [ ] **5.2** Copiar TODO el contenido
- [ ] **5.3** Pegar en SQL Editor
- [ ] **5.4** Ejecutar
- [ ] **5.5** Revisar output de cada sección:

### Sección 1: Estructura Básica
- [ ] Tenant: 1 fila ✅
- [ ] Tenant Settings: 1 fila ✅

### Sección 2: Usuarios y Permisos
- [ ] Memberships: 1-2 filas con role='owner' ✅
- [ ] Permisos: permisos completos ✅
- [ ] app.current_tenant_id(): retorna UUID correcto ✅

### Sección 3: Servicios
- [ ] Total: 8 servicios ✅
- [ ] Distribución por categoría correcta ✅

### Sección 4: Staff
- [ ] Total: 4 barberos ✅
- [ ] Días de trabajo: Carlos 6, otros 5 ✅
- [ ] Servicios por barbero: distribuidos correctamente ✅

### Sección 5: Clientes
- [ ] Total: 30 clientes ✅
- [ ] VIPs: 3-8 ✅
- [ ] Tags: distribuidos ✅

### Sección 6: Reservas
- [ ] Total: 500-800 ✅
- [ ] Distribución por estado: realista ✅
- [ ] Distribución temporal: uniforme ✅

### Sección 7: Integridad
- [ ] Sin solapamientos ✅
- [ ] Reservas dentro de horarios ✅
- [ ] Foreign keys válidas ✅

### Sección 8: Métricas
- [ ] Ingresos totales: 15K-25K EUR ✅
- [ ] Ticket medio: 20-30 EUR ✅
- [ ] Tasa no-show: 2-5% ✅

### Sección 9: Resumen Final
- [ ] Todos los componentes con ✅ ✅

---

## 🎨 FASE 6: Testing en Aplicación

- [ ] **6.1** Hacer login en la aplicación
- [ ] **6.2** Verificar que aparece "BookFast Barbería" en selector de tenants
- [ ] **6.3** Seleccionar BookFast como tenant activo
- [ ] **6.4** Navegar a `/panel/dashboard`
- [ ] **6.5** Verificar KPIs poblados:
  - [ ] Reservas hoy
  - [ ] Ingresos hoy
  - [ ] Servicios activos
  - [ ] Staff activo
  - [ ] Gráficos con datos

- [ ] **6.6** Navegar a `/panel/agenda`
- [ ] **6.7** Verificar vista de agenda:
  - [ ] Aparecen los 4 barberos
  - [ ] Hay reservas distribuidas
  - [ ] Estados visuales correctos
  - [ ] Sin solapamientos visibles

- [ ] **6.8** Navegar a `/panel/clientes`
- [ ] **6.9** Verificar lista de clientes:
  - [ ] Aparecen ~30 clientes
  - [ ] Algunos marcados como VIP
  - [ ] Tags visibles
  - [ ] Estadísticas de visitas

- [ ] **6.10** Navegar a `/panel/servicios`
- [ ] **6.11** Verificar lista de servicios:
  - [ ] Aparecen 8 servicios
  - [ ] Categorías correctas
  - [ ] Precios visibles

- [ ] **6.12** Navegar a `/panel/staff`
- [ ] **6.13** Verificar lista de staff:
  - [ ] Aparecen 4 barberos
  - [ ] Horarios configurados
  - [ ] Servicios asignados

---

## 🧪 FASE 7: Testing Funcional

- [ ] **7.1** Intentar crear nueva reserva:
  - [ ] Seleccionar servicio
  - [ ] Seleccionar barbero
  - [ ] Seleccionar slot disponible
  - [ ] Validar que no solapa

- [ ] **7.2** Ver detalles de cliente VIP:
  - [ ] Historial de visitas visible
  - [ ] Total gastado calculado
  - [ ] Tags aplicados

- [ ] **7.3** Filtrar agenda por barbero:
  - [ ] Filtro funciona
  - [ ] Solo muestra reservas de ese barbero

- [ ] **7.4** Ver métricas en dashboard:
  - [ ] Gráficos de últimos 30 días con datos
  - [ ] Ocupación calculada
  - [ ] Comparativas con períodos anteriores

---

## 📊 FASE 8: Verificación Final

- [ ] **8.1** Sin errores en consola del navegador
- [ ] **8.2** Sin errores en logs de Supabase
- [ ] **8.3** RLS funcionando correctamente
- [ ] **8.4** Todas las queries retornan datos
- [ ] **8.5** Performance aceptable (<2s por página)
- [ ] **8.6** Datos coherentes en todas las vistas

---

## 🎯 COMPLETADO

Si marcaste todos los checkboxes anteriores, ¡felicitaciones! 🎉

Tu tenant de demo **BookFast** está completamente funcional y listo para:

✅ Testing interno  
✅ Demos comerciales  
✅ Desarrollo de features  
✅ Validación de producto  

---

## 📝 Notas Adicionales

Espacio para tus notas durante la ejecución:

```
Fecha de ejecución: _____________________

User ID 1 (tu usuario): _____________________

User ID 2 (socio): _____________________

Total reservas generadas: _____________________

Ingresos totales: _____________________

Problemas encontrados:
_____________________________________________________
_____________________________________________________
_____________________________________________________

Soluciones aplicadas:
_____________________________________________________
_____________________________________________________
_____________________________________________________
```

---

## 🔄 Re-ejecución

Si necesitas volver a ejecutar el seed:

- [ ] **R.1** Ejecutar script de limpieza (ver README sección "Limpieza")
- [ ] **R.2** Volver a FASE 2
- [ ] **R.3** Seguir checklist completo nuevamente

---

## 📞 Soporte

Si algún paso falla:

1. ✅ Revisar logs de ejecución en SQL Editor
2. ✅ Consultar sección de Troubleshooting en `SEED_BOOKFAST_README.md`
3. ✅ Verificar que ejecutaste los scripts en orden correcto
4. ✅ Validar que los user IDs son correctos en FASE 3

---

**Última actualización**: 12 Diciembre 2025  
**Versión del checklist**: 1.0
