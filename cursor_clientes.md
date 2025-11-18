# Resumen de Mejoras en /panel/clientes

## ✅ Completado

### 1. Migración de Base de Datos (`0069_add_customer_segments.sql`)
- ✅ Añadidas columnas a `public.customers`:
  - `tags` (text[]): Etiquetas personalizadas
  - `is_vip` (boolean): Cliente VIP
  - `is_banned` (boolean): Cliente baneado
  - `marketing_opt_in` (boolean): Opt-in marketing
- ✅ RLS respetado (las columnas heredan las políticas existentes)

### 2. Listado de Clientes (`/panel/clientes`)

#### UI y Visualización
- ✅ **Badges de estado**: Muestra badges "VIP" y "Baneado" junto al nombre del cliente
- ✅ **Columna de etiquetas**: Muestra hasta 2 tags en desktop, con indicador "+N" si hay más
- ✅ **Chips de tags en mobile**: Renderizado de tags en las cards móviles
- ✅ **Filtro de segmento**: Dropdown con opciones:
  - Todos
  - Solo VIP (server-side)
  - Baneados (server-side)
  - Marketing opt-in (server-side)
  - Sin contacto (client-side)
- ✅ **Filtros combinados**: Los filtros de actividad, segmento, visitas y búsqueda se combinan correctamente
- ✅ **Debounce de búsqueda**: 300ms de debounce para el campo de búsqueda
- ✅ **Highlight de coincidencias**: Resalta coincidencias en nombre, email y teléfono
- ✅ **Skeletons**: Reemplaza el spinner global con skeletons específicos para tabla/cards

#### Selección y Acciones Masivas
- ✅ **Checkboxes en tabla**: Columna de selección en desktop
- ✅ **Selección en mobile**: Checkboxes en cards móviles
- ✅ **Seleccionar todos**: Checkbox en header para seleccionar todos los visibles
- ✅ **Barra de acciones masivas**: Se muestra cuando hay clientes seleccionados con:
  - Contador: "X clientes seleccionados"
  - Botón "Añadir etiqueta" (abre modal)
  - Botón "Marcar como VIP"
  - Botón "Marcar como baneados"
  - Botón "Limpiar selección"
- ✅ **Modal de etiquetas**: Input para añadir etiqueta a todos los seleccionados
- ✅ **Operaciones masivas**: Implementadas con `.update().in("id", selectedCustomerIds)`
- ✅ **Manejo de tags**: Merge de tags existentes para evitar pérdida de datos

#### Exportación CSV
- ✅ **Endpoint**: `/api/panel/customers/export`
  - Respeta autenticación y tenant_id
  - Soporta impersonación
  - Aplica todos los filtros (activity, segment, order, visitFilter, search)
  - Genera CSV con BOM UTF-8 (compatible con Excel)
  - Campos exportados: nombre, email, teléfono, visitas, última visita, total gastado, no-shows, VIP, baneado, marketing opt-in, etiquetas
- ✅ **Botón de exportación**: En la cabecera del listado, junto a los filtros

#### Real-time y Optimizaciones
- ✅ **Actualizaciones incrementales**: INSERT, UPDATE, DELETE se manejan incrementalmente
- ✅ **Fallback a full reload**: Si algo falla, se recarga la lista completa
- ✅ **Protección contra race conditions**: Flag `abort` en `loadCustomers`
- ✅ **Normalización de datos**: Función `normalizeCustomer` para mapear payloads de real-time

### 3. Ficha Individual (`/panel/clientes/[id]`)

#### Estado del Cliente
- ✅ **Bloque "Estado del cliente"**: Card con switches para:
  - Cliente VIP (`is_vip`)
  - Cliente baneado (`is_banned`)
  - Opt-in marketing (`marketing_opt_in`)
- ✅ **Edición de etiquetas**:
  - Lista de tags existentes con botón de eliminar (X)
  - Input para añadir nueva etiqueta
  - Validación: no permite duplicados
  - Enter para añadir rápidamente
- ✅ **Feedback**: Alertas de éxito/error para todas las operaciones
- ✅ **Estados de carga**: Deshabilitación de controles durante guardado

#### KPIs y Métricas
- ✅ **KPIs de actividad**: Total citas, última visita, próxima cita
- ✅ **KPIs de valor**: Citas totales, completadas, no-shows, € total gastado
- ✅ **Priorización de datos agregados**: Usa `visits_count`, `total_spent_cents`, etc. de la BD cuando están disponibles

## 📝 Limitaciones y Notas

### Filtro "Sin contacto"
- **Implementación**: Client-side (no server-side)
- **Razón**: Requiere evaluar `email` y `phone` en memoria. Podría optimizarse con una columna calculada o función en BD si se necesita server-side.

### Búsqueda de texto
- **Implementación**: Client-side (después de cargar desde BD)
- **Razón**: Para mantener la simplicidad y evitar complejidad en queries. Si la lista crece mucho (>1000 clientes), considerar mover a server-side con `ilike` en Supabase.

### Ordenación
- **Server-side**: Por `last_booking_at` (recientes) o `total_spent_cents` (mayor gasto)
- **Fallback**: `created_at` si no hay `last_booking_at`

### Tags
- **Límite de visualización**: 2 tags en desktop, resto con "+N"
- **Sin límite en BD**: El array `tags` no tiene restricción de tamaño
- **Validación**: No se valida formato (pueden contener espacios, caracteres especiales, etc.)

### Exportación CSV
- **Filtro "sin contacto"**: Se aplica client-side en el endpoint (después de cargar desde BD)
- **Búsqueda**: Se aplica client-side en el endpoint
- **Encoding**: UTF-8 con BOM para compatibilidad con Excel

### Real-time
- **Canal**: `rt-customers` con filtro `tenant_id=eq.${tenantId}`
- **Eventos**: INSERT, UPDATE, DELETE
- **Fallback**: Si el payload no tiene `eventType` o falla la actualización incremental, se recarga la lista completa

## 🔄 Próximas Mejoras Sugeridas

1. **Validación de tags**: Añadir formato permitido (solo letras, números, guiones)
2. **Límite de tags**: Establecer máximo de tags por cliente
3. **Búsqueda server-side**: Mover búsqueda de texto a Supabase con `ilike` para mejor rendimiento
4. **Filtro "sin contacto" server-side**: Crear columna calculada o función en BD
5. **Paginación**: Si la lista crece mucho, añadir paginación server-side
6. **Exportación avanzada**: Permitir seleccionar campos a exportar
7. **Historial de cambios**: Log de cambios en flags VIP/baneado (auditoría)

## 📁 Archivos Modificados/Creados

### Nuevos
- `supabase/migrations/0069_add_customer_segments.sql`
- `app/api/panel/customers/export/route.ts`
- `cursor_clientes.md` (este archivo)

### Modificados
- `app/panel/clientes/page.tsx`
- `app/panel/clientes/[id]/page.tsx`

## 🧪 Testing Recomendado

1. **Crear cliente**: Verificar que se crea sin tags/flags
2. **Añadir tags**: Verificar que se guardan y muestran correctamente
3. **Marcar VIP/baneado**: Verificar que los badges aparecen en el listado
4. **Filtros**: Probar todas las combinaciones de filtros
5. **Acciones masivas**: Seleccionar múltiples clientes y aplicar acciones
6. **Exportación**: Exportar con diferentes filtros y verificar el CSV
7. **Real-time**: Abrir dos pestañas y verificar que los cambios se sincronizan
8. **Ficha individual**: Editar flags y tags, verificar que se guardan

---

## 🚀 Iteración 2: Valor del Cliente, Paginación y Auditoría

### ✅ Completado

#### 1. Valor del Cliente en Ficha (`/panel/clientes/[id]`)

##### KPIs Mejorados
- ✅ **Visitas totales**: Usa `visits_count` de la BD
- ✅ **Última visita**: Formateada con timezone del tenant usando `formatInTimeZone`
- ✅ **Importe total**: `total_spent_cents / 100` formateado en €
- ✅ **Ticket medio**: Calculado como `total_spent_cents / visits_count / 100`
- ✅ **No-shows**: Usa `no_show_count` de la BD
- ✅ **Próxima cita**: Formateada con timezone del tenant
- ✅ **Layout responsive**: Grid 2×2 / 3×2 según tamaño de pantalla

##### Clasificación Visual de Valor
- ✅ **Cliente PREMIUM**: `visits_count >= 5` y `total_spent_cents >= 30000` (≥ 300 €)
  - Badge dorado (tono amarillo/ámbar)
- ✅ **Cliente FRECUENTE**: `visits_count >= 3` y `total_spent_cents < 30000`
  - Badge verde suave
- ✅ **Cliente NUEVO / OCASIONAL**: Resto de casos
  - Badge gris neutro
- ✅ **Badge en header**: Muestra la clasificación junto al nombre del cliente

#### 2. Timeline e Internacionalización

##### Formato de Fechas
- ✅ **Unificación con timezone**: Todas las fechas de reservas usan `formatInTimeZone` con timezone del tenant
- ✅ **Formato consistente**: `"EEEE d 'de' MMMM · HH:mm"` con locale español
- ✅ **Aplicado en**:
  - `CustomerBookingsTimeline` (componente reutilizable)
  - Modal de historial
  - Ficha individual (próximas/pasadas citas)
  - KPIs de última visita y próxima cita

##### Mejoras Visuales del Timeline
- ✅ **Badge de estado**: Ya existía `StatusBadge`, ahora con mejor integración
- ✅ **Diferencia visual para no-shows**:
  - Borde punteado (`border-dashed`)
  - Fondo ámbar suave (`bg-amber-500/5`)
  - Icono de advertencia "⚠️ No-show" junto al badge

#### 3. Paginación Server-Side

##### Implementación
- ✅ **Paginación en BD**: Usa `.range(from, to)` en queries Supabase
- ✅ **Tamaño de página**: 20 clientes por página (`PAGE_SIZE = 20`)
- ✅ **Filtros server-side mantenidos**:
  - Filtro de actividad (`activityFilter`)
  - Filtro de segmento (`segmentFilter`)
  - Orden (`sortOption`)
- ✅ **Filtros client-side** (sobre página cargada):
  - Filtro de visitas (`visitFilter`)
  - Búsqueda de texto (`searchTerm`)
  - Filtro "sin contacto" (`segmentFilter === "no_contact"`)

##### UI de Paginación
- ✅ **Controles**: Botones "Anterior" y "Siguiente"
- ✅ **Indicador**: "Página X de Y" con cálculo de total de páginas
- ✅ **Contador**: "Mostrando N - M de X clientes"
- ✅ **Reset automático**: La página se resetea a 1 cuando cambian los filtros server-side
- ✅ **Estados deshabilitados**: Botones deshabilitados cuando no hay más páginas o está cargando

##### Compatibilidad con Exportación
- ✅ **CSV sin paginación**: El endpoint `/api/panel/customers/export` exporta todos los clientes que cumplen los filtros (sin `.range()`)
- ✅ **Filtros aplicados**: Respeta todos los filtros server-side y client-side

#### 4. Detección de Duplicados

##### Regla de Duplicidad
- ✅ **Criterio**: Dos clientes son "posibles duplicados" si comparten:
  - Mismo email (no nulo), o
  - Mismo teléfono (no nulo)

##### Visualización en Listado
- ✅ **Badge "Duplicado posible"**: 
  - Color ámbar (`border-amber-500/30`, `bg-amber-500/10`)
  - Icono `AlertTriangle`
  - Tooltip explicativo: "Comparte email/teléfono con otro cliente. Revisa antes de usar para campañas."
- ✅ **Ubicación**: Junto al nombre del cliente (desktop y mobile)

##### Sección en Ficha Individual
- ✅ **Card "Posibles duplicados"**: Se muestra solo si hay duplicados detectados
- ✅ **Información mostrada**:
  - Nombre del cliente duplicado
  - Email (si existe)
  - Teléfono (si existe)
  - Visitas totales
- ✅ **Acción**: Botón "Ver ficha" que navega a `/panel/clientes/[id]` del duplicado
- ✅ **Carga**: Se carga automáticamente al abrir la ficha del cliente

##### Limitaciones
- ⚠️ **Detección client-side**: Solo detecta duplicados entre clientes cargados en la página actual (no todos los del tenant)
- ⚠️ **Sin merge**: No hay funcionalidad de merge en esta iteración (solo visualización)

#### 5. Auditoría de Cambios Sensibles

##### Función Helper
- ✅ **`logAudit`**: Función helper para registrar eventos en `platform.audit_logs`
- ✅ **Uso de RPC**: Llama a `platform.log_audit` usando `.schema("platform").rpc()`
- ✅ **Manejo de errores**: No falla la operación principal si falla la auditoría (solo log de advertencia)

##### Eventos Auditados

###### En Ficha Individual (`/panel/clientes/[id]`)
- ✅ **Cambio de flags** (`handleFlagUpdate`):
  - `is_vip`
  - `is_banned`
  - `marketing_opt_in`
  - Acción: `"update_flags"`
  - Metadata: `{ field, source: "customer_detail" }`
- ✅ **Añadir tag** (`handleAddTag`):
  - Acción: `"update_tags"`
  - Metadata: `{ action: "add_tag", tag, source: "customer_detail" }`
- ✅ **Eliminar tag** (`handleRemoveTag`):
  - Acción: `"update_tags"`
  - Metadata: `{ action: "remove_tag", tag, source: "customer_detail" }`

###### En Listado (`/panel/clientes`)
- ✅ **Acciones masivas de flags** (`handleBulkFlagUpdate`):
  - Acción: `"bulk_update_flags"`
  - Registra un log por cada cliente afectado
  - Metadata: `{ source: "customer_list", count }`
- ✅ **Añadir tag masivo** (`handleBulkTagSubmit`):
  - Acción: `"update_tags"`
  - Registra un log por cada cliente afectado
  - Metadata: `{ action: "add_tag", tag, source: "customer_list_bulk", count }`

##### Estructura de Logs
- `tenant_id`: ID del tenant
- `user_id`: ID del usuario que realizó la acción
- `action`: `"update_flags"`, `"bulk_update_flags"`, `"update_tags"`
- `resource_type`: `"customer"`
- `resource_id`: ID del cliente afectado
- `old_data`: Estado anterior (JSONB)
- `new_data`: Estado nuevo (JSONB)
- `metadata`: Información adicional (JSONB)

### 📝 Limitaciones y Notas

#### Paginación
- **Búsqueda client-side**: La búsqueda de texto se aplica solo sobre la página actual cargada (no sobre todos los clientes del tenant)
- **Filtro "sin contacto" client-side**: Similar a la búsqueda, solo se aplica sobre la página actual
- **Total de páginas**: Se calcula basado en el `count` de la query, pero puede no ser exacto si hay filtros client-side activos

#### Detección de Duplicados
- **Alcance limitado**: Solo detecta duplicados entre clientes cargados en la página actual (no todos los del tenant)
- **Sin merge**: No hay funcionalidad de merge en esta iteración (solo visualización)
- **Performance**: Con muchos clientes, la detección puede ser lenta (O(n²) en el peor caso)

#### Auditoría
- **No bloqueante**: Si falla la auditoría, la operación principal continúa (solo se registra un warning en consola)
- **Sin retroactividad**: Los cambios realizados antes de esta iteración no tienen logs de auditoría
- **Rendimiento**: Las acciones masivas registran un log por cada cliente afectado (puede ser lento con muchos clientes)

### 📁 Archivos Modificados

#### Modificados
- `app/panel/clientes/page.tsx`:
  - Añadida paginación server-side
  - Añadida detección de duplicados
  - Añadida auditoría para acciones masivas
  - Mejorado `customerStats` para usar `totalCount`
- `app/panel/clientes/[id]/page.tsx`:
  - Añadidos KPIs mejorados (visitas, ticket medio, etc.)
  - Añadida clasificación de valor (PREMIUM, FRECUENTE, NUEVO/OCASIONAL)
  - Añadida sección de duplicados
  - Añadida auditoría para cambios de flags y tags
  - Mejorado formato de fechas con timezone
- `src/components/panel/CustomerBookingsTimeline.tsx`:
  - Mejorada visualización de no-shows (borde punteado, icono)
  - Ya usaba `formatInTimeZone` (sin cambios necesarios)

### 🧪 Testing Recomendado

1. **KPIs y clasificación**: Verificar que los KPIs se calculan correctamente y la clasificación aparece en el header
2. **Paginación**: 
   - Navegar entre páginas
   - Verificar que los filtros se mantienen
   - Verificar que el contador muestra el rango correcto
3. **Detección de duplicados**:
   - Crear clientes con mismo email/teléfono
   - Verificar que aparece el badge en el listado
   - Verificar que aparece la sección en la ficha individual
4. **Auditoría**:
   - Cambiar flags VIP/baneado en ficha individual
   - Añadir/eliminar tags
   - Realizar acciones masivas
   - Verificar en `platform.audit_logs` que se registran los eventos
5. **Timeline**: Verificar que las fechas se muestran con el timezone correcto del tenant
6. **Exportación con paginación**: Verificar que el CSV exporta todos los clientes (no solo la página actual)

