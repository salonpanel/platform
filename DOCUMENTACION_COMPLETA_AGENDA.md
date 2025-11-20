# 📋 Documentación Completa de la Página de Agenda

**Ruta**: `/panel/agenda`  
**URL Local**: `http://localhost:3000/panel/agenda`

---

## 📖 ÍNDICE

1. [Descripción General](#descripción-general)
2. [Funcionalidades Principales](#funcionalidades-principales)
3. [Vistas Disponibles](#vistas-disponibles)
4. [Componentes y Modales](#componentes-y-modales)
5. [Código Completo](#código-completo)
6. [Flujos de Usuario](#flujos-de-usuario)
7. [Estados y Filtros](#estados-y-filtros)

---

## 📝 DESCRIPCIÓN GENERAL

La página de agenda es el centro de gestión de citas y reservas del sistema. Permite visualizar, crear, editar y gestionar todas las citas de los clientes, así como gestionar la disponibilidad del personal (staff).

### Características Principales:
- ✅ **4 vistas diferentes**: Día, Semana, Mes, Lista
- ✅ **Gestión completa de citas**: Crear, editar, mover, redimensionar, cancelar
- ✅ **Gestión de bloqueos**: Falta de disponibilidad, ausencias, vacaciones
- ✅ **Detección de conflictos**: Sistema inteligente que previene solapes
- ✅ **Filtros avanzados**: Por estado, pago, empleado, destacados
- ✅ **Drag & Drop**: Arrastrar citas para cambiar horario/empleado
- ✅ **Redimensionamiento**: Cambiar duración de citas arrastrando bordes
- ✅ **Timezone aware**: Respeta la zona horaria del tenant

---

## 🎯 FUNCIONALIDADES PRINCIPALES

### 1. **Visualización de Citas**

#### Vista Día (AgendaCalendarView)
- **Eje vertical**: Muestra horas del día (adaptativo según horarios del staff)
- **Columnas**: Una por cada empleado activo
- **Citas visualizadas como barras**:
  - Color según estado (pendiente, pagado, completado, cancelado, no_show)
  - Muestra: horario, cliente, servicio, precios
  - Línea roja indicando hora actual (si es el día de hoy)
  - Handles para redimensionar (arriba y abajo)
- **Bloqueos visualizados**:
  - Detrás de las citas (z-index menor)
  - Colores según tipo: bloqueo (gris), ausencia (rojo), vacaciones (azul)
- **Slots vacíos clickeables**: Al hacer clic, aparece popover con opciones

#### Vista Semana (WeekView)
- Grid de 7 días (lunes a domingo)
- Timeline de horas (8:00 - 21:00)
- Citas posicionadas según horario
- Click en cita abre panel de detalles

#### Vista Mes (MonthView)
- Calendario mensual completo
- Días con citas destacados
- Muestra hasta 3 citas por día (+ contador si hay más)
- Navegación entre meses
- Click en día cambia a vista día

#### Vista Lista (ListView)
- Tabla ordenada por hora
- Columnas: Hora, Cliente, Servicio, Barbero, Estado, Precio
- Vista responsive (cards en móvil)
- Click en fila abre panel de detalles

### 2. **Creación de Citas**

#### Modal de Nueva Cita (NewBookingModal)
**Acceso:**
- Botón flotante (+)
- Click en slot vacío → "Nueva cita"
- Estado vacío → "Crear reserva manual"

**Funcionalidades:**
- **Pestaña "Cita"**:
  - Selección de cliente (con autocompletado)
    - Busca por nombre, email o teléfono
    - Crea nuevo cliente si no existe
  - Datos del cliente:
    - Nombre (requerido)
    - Teléfono (requerido)
    - Email (requerido)
  - Fecha y hora:
    - Selector de fecha
    - Selector de hora inicio
    - Hora fin calculada automáticamente según servicios
  - Servicios:
    - Añadir múltiples servicios
    - Seleccionar servicio y empleado por servicio
    - Ajustar hora inicio/fin por servicio
    - Precio y descuentos (opciones futuras)
  - Estado de la cita:
    - Pendiente, Pagado, Completado, Cancelado, No se presentó

- **Pestaña "Notas y datos"**:
  - Observaciones de la cita (internas)
  - Observaciones del cliente (se guardan en ficha)
  - Mensaje al cliente (incluido en SMS/email)
  - Plantillas de mensaje (botones rápidos)
  - Checkbox "Marcar como destacado"

**Validaciones:**
- Cliente requerido
- Al menos un servicio
- Email válido si se proporciona
- Fechas válidas
- Hora fin posterior a hora inicio

**Detección de conflictos:**
- Antes de guardar, verifica solapes
- Si hay conflictos, abre `ConflictResolutionModal`

### 3. **Edición de Citas**

**Acceso:**
- Click en cita → Popover → "Modificar"
- Click en cita → Panel de detalles → "Editar"

**Funcionalidades:**
- Mismo modal que creación, pero pre-llenado
- Permite cambiar todos los campos
- Valida conflictos excluyendo la cita actual

### 4. **Movimiento de Citas (Drag & Drop)**

**Funcionalidad:**
- Arrastrar cita para cambiar horario
- Arrastrar entre columnas para cambiar empleado
- Al soltar, muestra modal de confirmación
- Valida conflictos antes de aplicar

**Implementación:**
- `handleBookingMouseDown`: Inicia drag
- `handleMouseMove`: Actualiza posición visual
- `handleMouseUp`: Calcula nueva posición y muestra confirmación
- `BookingMoveConfirmModal`: Confirma cambio

### 5. **Redimensionamiento de Citas**

**Funcionalidad:**
- Handles en borde superior e inferior
- Arrastrar para cambiar duración
- Mantiene hora inicio o fin según handle usado
- Valida conflictos antes de aplicar

**Implementación:**
- `handleBookingResizeStart`: Inicia resize
- `handleMouseMove`: Actualiza altura visual
- `handleMouseUp`: Calcula nueva duración y aplica

### 6. **Cancelación de Citas**

**Acceso:**
- Click en cita → Popover → "Cancelar cita" (solo admins/owners)
- Panel de detalles → "Eliminar cita"

**Funcionalidad:**
- Confirma antes de cancelar
- Cambia estado a "cancelled"
- No elimina de BD, solo cambia estado

### 7. **Gestión de Bloqueos**

#### Modal de Bloqueo (StaffBlockingModal)
**Acceso:**
- Click en slot vacío → "Añadir falta de disponibilidad"
- Click en slot vacío → "Añadir ausencia"

**Tipos de bloqueo:**
1. **Falta de disponibilidad (block)**
   - Motivos sugeridos: Descanso, Reunión, Pausa, Otro
2. **Ausencia (absence)**
   - Motivos sugeridos: Enfermedad, Permiso, Personal, Otro
3. **Vacaciones (vacation)**
   - Motivos sugeridos: Vacaciones, Día libre, Fiesta, Otro

**Campos:**
- Empleado (pre-seleccionado si viene de slot)
- Tipo
- Fecha
- Hora inicio
- Hora fin
- Motivo (requerido)
- Notas (opcional)

**Validaciones:**
- Todos los campos requeridos
- Hora fin posterior a hora inicio
- Detecta conflictos con citas existentes

### 8. **Detección y Resolución de Conflictos**

#### Sistema de Conflictos
**Detección automática:**
- Al crear cita
- Al crear bloqueo
- Al mover cita
- Al redimensionar cita

**Modal de Resolución (ConflictResolutionModal)**
Muestra:
- Lista de conflictos encontrados
- Detalles de cada conflicto (cliente, servicio, horario)
- Nuevo horario propuesto

**Opciones de resolución:**
1. **Cambiar la hora de la nueva cita**
   - Cierra modal y permite editar
2. **Asignar a otro empleado**
   - Cierra modal y permite cambiar empleado
3. **Forzar solape** (solo admins/owners/managers)
   - Guarda a pesar de conflictos
4. **Cancelar**
   - Cancela la operación

### 9. **Filtros**

#### Sidebar de Filtros (AgendaSidebar)
**Filtros disponibles:**

1. **Pagos:**
   - Pagado
   - Sin pagar

2. **Estado de la cita:**
   - Pendiente
   - Confirmada
   - Completada
   - Cancelada

3. **Empleado:**
   - Todos
   - Selección múltiple por empleado

4. **Detalles:**
   - Marcadas como destacadas

**Funcionalidades:**
- Multi-selección en cada categoría
- Chip de "X filtros activos" cuando hay filtros
- Botón "Limpiar todo"
- Saltos rápidos: Hoy, -1 semana, +1 semana
- Mini calendario para seleccionar fecha

### 10. **Panel de Detalles de Cita**

**Acceso:**
- Click en cita (en cualquier vista)

**Información mostrada:**
- Cliente (nombre, teléfono, email)
- Detalles (fecha, horario, servicio, barbero, estado, precio)

**Acciones:**
- Editar cita
- Eliminar cita

**Responsive:**
- Desktop: Modal
- Mobile: Drawer lateral

### 11. **Vista Rápida de Cliente**

**Acceso:**
- Desde modal de nueva cita (si cliente seleccionado)

**Información mostrada:**
- Datos de contacto
- Alergias/Salud (si hay)
- Notas clave
- Métricas (total citas, no shows, cancelaciones, gasto total)
- Próximas citas
- Historial reciente

**Acciones:**
- Crear cita ahora

### 12. **Navegación y Controles**

#### Header (AgendaHeader)
**Controles:**
- Navegación de fechas:
  - Anterior (←)
  - Hoy
  - Siguiente (→)
  - Selector de calendario
- Fecha actual formateada (ej: "Lunes, 15 de enero")
- Rango horario (solo en vista día)
- Selector de vista (Día, Semana, Mes, Lista)
- Acciones:
  - Búsqueda (pendiente)
  - Notificaciones
  - Filtros (móvil)
  - Ajustes

**Adaptación por vista:**
- Día: "Lunes, 15 de enero"
- Semana: "1 Ene - 7 Ene 2024"
- Mes: "Enero 2024"
- Lista: "Lunes, 15 de enero"

### 13. **Notificaciones**

#### Panel de Notificaciones (NotificationsPanel)
**Acceso:**
- Botón de campana en header

**Funcionalidad:**
- Lista de notificaciones (mock data actualmente)
- Tipos: success, error, warning, info
- Indicador de no leídas
- Drawer lateral en móvil

### 14. **Estado Vacío**

#### AgendaEmptyState
**Cuándo se muestra:**
- No hay citas ni bloqueos en el día seleccionado

**Contenido:**
- Ilustración animada
- Mensaje personalizado con fecha
- Botón "Crear reserva manual"
- Botón "Copiar enlace de reservas" (si hay tenantId)
- Enlace completo para copiar

---

## 🎨 VISTAS DISPONIBLES

### Vista Día (day)
**Componente**: `AgendaCalendarView`  
**Características:**
- Timeline vertical con horas
- Columnas por empleado
- Scroll sincronizado entre columnas
- Auto-scroll a hora actual (si es hoy)
- Línea roja indicando hora actual
- Drag & drop funcional
- Redimensionamiento funcional

### Vista Semana (week)
**Componente**: `WeekView`  
**Características:**
- Grid de 7 días
- Timeline de horas (8:00 - 21:00)
- Citas posicionadas proporcionalmente
- Click en cita abre detalles

### Vista Mes (month)
**Componente**: `MonthView`  
**Características:**
- Calendario mensual completo
- Navegación entre meses
- Días con citas destacados
- Muestra hasta 3 citas por día
- Click en día cambia a vista día

### Vista Lista (list)
**Componente**: `ListView`  
**Características:**
- Tabla ordenada por hora
- Vista responsive (cards en móvil)
- Información completa de cada cita
- Click en fila/card abre detalles

---

## 🧩 COMPONENTES Y MODALES

### Componentes Principales

#### 1. AgendaPage (`app/panel/agenda/page.tsx`)
**Archivo principal** que orquesta toda la funcionalidad.

**Estados principales:**
- `tenantId`: ID del tenant actual
- `tenantTimezone`: Zona horaria del tenant
- `selectedDate`: Fecha seleccionada (formato "yyyy-MM-dd")
- `viewMode`: Vista actual ("day" | "week" | "month" | "list")
- `staffList`: Lista de empleados
- `bookings`: Lista de citas del día
- `staffBlockings`: Lista de bloqueos del día
- `staffSchedules`: Horarios operativos del staff
- `filters`: Objeto con filtros activos
- `loading`: Estado de carga
- `error`: Mensaje de error

**Estados de modales:**
- `showNewBookingModal`: Modal de nueva/editar cita
- `showBlockingModal`: Modal de bloqueo
- `showConflictModal`: Modal de resolución de conflictos
- `showBookingDetail`: Panel de detalles
- `showCustomerView`: Vista rápida de cliente
- `notificationsOpen`: Panel de notificaciones
- `sidebarOpen`: Sidebar de filtros (móvil)

**Funciones principales:**
- `loadTenant()`: Carga tenant, staff, servicios, clientes
- `loadBookings()`: Carga citas y bloqueos del día
- `detectConflictsForBooking()`: Detecta conflictos
- `onSave()`: Guarda nueva/edita cita
- `onSaveBlocking()`: Guarda bloqueo
- `onBookingMove()`: Mueve cita (drag & drop)
- `onBookingResize()`: Redimensiona cita
- `onBookingCancel()`: Cancela cita
- `refreshDaySnapshots()`: Recarga datos del día

#### 2. AgendaHeader (`src/components/calendar/AgendaHeader.tsx`)
Header con navegación y controles.

**Props:**
- `selectedDate`: Fecha seleccionada
- `viewMode`: Vista actual
- `onViewModeChange`: Callback para cambiar vista
- `onDateChange`: Callback para cambiar fecha
- `timeRange`: Rango horario (solo día)
- `onNotificationsClick`: Abre notificaciones
- `onSearchClick`: Abre búsqueda
- `onFiltersClick`: Abre filtros
- `onCalendarClick`: Abre selector de fecha

#### 3. AgendaSidebar (`src/components/calendar/AgendaSidebar.tsx`)
Sidebar con filtros y controles.

**Props:**
- `selectedDate`: Fecha seleccionada
- `onDateSelect`: Callback para seleccionar fecha
- `filters`: Objeto con filtros
- `onFiltersChange`: Callback para cambiar filtros
- `staffList`: Lista de empleados
- `onClose`: Cierra sidebar (móvil)

**Secciones:**
- Saltos rápidos (Hoy, ±1 semana)
- Mini calendario
- Filtros (Pagos, Estado, Empleado, Detalles)
- Leyenda de estados
- Botones de acción

#### 4. AgendaCalendarView (`src/components/panel/AgendaCalendarView.tsx`)
Vista principal de día con timeline.

**Props:**
- `bookings`: Lista de citas
- `staffBlockings`: Lista de bloqueos
- `staffList`: Lista de empleados
- `selectedDate`: Fecha seleccionada
- `selectedStaffIds`: IDs de staff visibles (filtros)
- `timezone`: Zona horaria
- `staffSchedules`: Horarios operativos
- Callbacks: `onBookingClick`, `onSlotClick`, `onNewBooking`, `onUnavailability`, `onAbsence`, `onBookingMove`, `onBookingResize`, `onBookingEdit`, `onBookingCancel`, `onBookingSendMessage`

**Funcionalidades:**
- Calcula rango horario según horarios del staff
- Genera slots de tiempo (cada 15 min)
- Sincroniza scroll entre columnas
- Auto-scroll a hora actual
- Renderiza citas y bloqueos
- Maneja drag & drop
- Maneja redimensionamiento
- Muestra popovers de acciones

#### 5. WeekView (`src/components/calendar/WeekView.tsx`)
Vista de semana.

**Props:**
- `bookings`: Lista de citas
- `staffList`: Lista de empleados
- `selectedDate`: Fecha seleccionada
- `timezone`: Zona horaria
- `onBookingClick`: Callback al hacer click en cita

#### 6. MonthView (`src/components/calendar/MonthView.tsx`)
Vista de mes.

**Props:**
- `bookings`: Lista de citas
- `selectedDate`: Fecha seleccionada
- `onDateSelect`: Callback al seleccionar día
- `onBookingClick`: Callback al hacer click en cita
- `timezone`: Zona horaria

#### 7. ListView (`src/components/calendar/ListView.tsx`)
Vista de lista.

**Props:**
- `bookings`: Lista de citas
- `selectedDate`: Fecha seleccionada
- `timezone`: Zona horaria
- `onBookingClick`: Callback al hacer click en cita

### Modales y Paneles

#### 1. NewBookingModal (`src/components/calendar/NewBookingModal.tsx`)
Modal completo para crear/editar citas.

**Props:**
- `isOpen`: Estado de apertura
- `onClose`: Cierra modal
- `onSave`: Guarda cita
- `services`: Lista de servicios
- `staff`: Lista de empleados
- `customers`: Lista de clientes
- `selectedDate`: Fecha pre-seleccionada
- `selectedTime`: Hora pre-seleccionada
- `selectedStaffId`: Empleado pre-seleccionado
- `editingBooking`: Cita a editar (null si es nueva)
- `tenantId`: ID del tenant (para crear clientes)

**Pestañas:**
- "Cita": Datos principales
- "Notas y datos": Notas y mensajes

**Validaciones:**
- Cliente requerido
- Al menos un servicio
- Email válido
- Fechas válidas

#### 2. StaffBlockingModal (`src/components/calendar/StaffBlockingModal.tsx`)
Modal para crear bloqueos/ausencias/vacaciones.

**Props:**
- `isOpen`: Estado de apertura
- `onClose`: Cierra modal
- `onSave`: Guarda bloqueo
- `staff`: Lista de empleados
- `slot`: Slot pre-seleccionado (opcional)

**Campos:**
- Empleado
- Tipo (block/absence/vacation)
- Fecha
- Hora inicio
- Hora fin
- Motivo (con sugerencias)
- Notas (opcional)

#### 3. ConflictResolutionModal (`src/components/calendar/ConflictResolutionModal.tsx`)
Modal para resolver conflictos de horario.

**Props:**
- `isOpen`: Estado de apertura
- `onClose`: Cierra modal
- `conflicts`: Lista de conflictos
- `newBookingStart`: Hora inicio propuesta
- `newBookingEnd`: Hora fin propuesta
- `newBookingStaffId`: Empleado propuesto
- `newBookingStaffName`: Nombre del empleado
- `timezone`: Zona horaria
- `onResolve`: Callback con acción ("change_time" | "change_staff" | "force" | "cancel")
- `userRole`: Rol del usuario (para permisos)

**Muestra:**
- Alerta de conflicto
- Nuevo horario propuesto
- Lista de conflictos con detalles
- Opciones de resolución

#### 4. BookingDetailPanel (`src/components/calendar/BookingDetailPanel.tsx`)
Panel de detalles de cita.

**Props:**
- `booking`: Cita a mostrar
- `isOpen`: Estado de apertura
- `onClose`: Cierra panel
- `onEdit`: Edita cita
- `onDelete`: Elimina cita
- `timezone`: Zona horaria

**Responsive:**
- Desktop: Modal
- Mobile: Drawer lateral

#### 5. CustomerQuickView (`src/components/calendar/CustomerQuickView.tsx`)
Vista rápida de cliente.

**Props:**
- `customer`: Cliente a mostrar
- `onClose`: Cierra vista
- `onCreateBooking`: Crea cita para este cliente
- `stats`: Métricas (opcional)
- `upcomingBookings`: Próximas citas (opcional)
- `pastBookings`: Historial (opcional)

### Popovers

#### 1. AgendaActionPopover (`src/components/calendar/AgendaActionPopover.tsx`)
Popover al hacer click en slot vacío.

**Opciones:**
- Nueva cita
- Añadir falta de disponibilidad
- Añadir ausencia

#### 2. BookingActionPopover (`src/components/calendar/BookingActionPopover.tsx`)
Popover al hacer click en cita.

**Opciones:**
- Modificar
- Enviar mensaje
- Cancelar cita (solo si `canCancel`)

### Componentes Auxiliares

#### 1. FloatingActionButton (`src/components/calendar/FloatingActionButton.tsx`)
Botón flotante para crear cita.

**Props:**
- `onClick`: Callback al hacer click

#### 2. AgendaEmptyState (`src/components/calendar/AgendaEmptyState.tsx`)
Estado vacío cuando no hay citas.

**Props:**
- `selectedDate`: Fecha seleccionada
- `onCreateBooking`: Crea cita
- `bookingLink`: Enlace de reservas (opcional)

#### 3. NotificationsPanel (`src/components/calendar/NotificationsPanel.tsx`)
Panel de notificaciones.

**Props:**
- `isOpen`: Estado de apertura
- `onClose`: Cierra panel
- `notifications`: Lista de notificaciones (opcional)

#### 4. BookingMoveConfirmModal (`src/components/calendar/BookingMoveConfirmModal.tsx`)
Modal de confirmación al mover cita.

**Props:**
- `isOpen`: Estado de apertura
- `onClose`: Cierra modal
- `onConfirm`: Confirma movimiento
- `booking`: Cita a mover
- `newStartTime`: Nueva hora inicio
- `newEndTime`: Nueva hora fin

### Utilidades

#### 1. booking-conflicts.ts (`src/lib/booking-conflicts.ts`)
Utilidades para detectar conflictos.

**Función principal:**
- `detectConflicts()`: Detecta solapes entre citas y bloqueos

**Parámetros:**
- `newStart`: Hora inicio nueva
- `newEnd`: Hora fin nueva
- `staffId`: ID del empleado
- `existingBookings`: Citas existentes
- `existingBlockings`: Bloqueos existentes
- `excludeBookingId`: ID a excluir (edición)
- `excludeBlockingId`: ID a excluir (edición)

**Retorna:**
- Array de conflictos con detalles

---

## 💻 CÓDIGO COMPLETO

### Archivo Principal: `app/panel/agenda/page.tsx`

```1:1123:app/panel/agenda/page.tsx
// Ver archivo completo en: app/panel/agenda/page.tsx
```

**Estructura:**
1. Imports y tipos
2. Estados principales
3. Efectos (carga de datos)
4. Funciones de negocio
5. Renderizado

### Componentes de Vista

#### AgendaCalendarView
```1:1521:src/components/panel/AgendaCalendarView.tsx
// Ver archivo completo en: src/components/panel/AgendaCalendarView.tsx
```

#### WeekView
```1:191:src/components/calendar/WeekView.tsx
// Ver archivo completo en: src/components/calendar/WeekView.tsx
```

#### MonthView
```1:197:src/components/calendar/MonthView.tsx
// Ver archivo completo en: src/components/calendar/MonthView.tsx
```

#### ListView
```1:219:src/components/calendar/ListView.tsx
// Ver archivo completo en: src/components/calendar/ListView.tsx
```

### Modales

#### NewBookingModal
```1:992:src/components/calendar/NewBookingModal.tsx
// Ver archivo completo en: src/components/calendar/NewBookingModal.tsx
```

#### StaffBlockingModal
```1:275:src/components/calendar/StaffBlockingModal.tsx
// Ver archivo completo en: src/components/calendar/StaffBlockingModal.tsx
```

#### ConflictResolutionModal
```1:226:src/components/calendar/ConflictResolutionModal.tsx
// Ver archivo completo en: src/components/calendar/ConflictResolutionModal.tsx
```

#### BookingDetailPanel
```1:315:src/components/calendar/BookingDetailPanel.tsx
// Ver archivo completo en: src/components/calendar/BookingDetailPanel.tsx
```

### Componentes de UI

#### AgendaHeader
```1:234:src/components/calendar/AgendaHeader.tsx
// Ver archivo completo en: src/components/calendar/AgendaHeader.tsx
```

#### AgendaSidebar
```1:320:src/components/calendar/AgendaSidebar.tsx
// Ver archivo completo en: src/components/calendar/AgendaSidebar.tsx
```

#### FloatingActionButton
```1:44:src/components/calendar/FloatingActionButton.tsx
// Ver archivo completo en: src/components/calendar/FloatingActionButton.tsx
```

#### AgendaEmptyState
```1:141:src/components/calendar/AgendaEmptyState.tsx
// Ver archivo completo en: src/components/calendar/AgendaEmptyState.tsx
```

### Popovers

#### AgendaActionPopover
```1:176:src/components/calendar/AgendaActionPopover.tsx
// Ver archivo completo en: src/components/calendar/AgendaActionPopover.tsx
```

#### BookingActionPopover
```1:175:src/components/calendar/BookingActionPopover.tsx
// Ver archivo completo en: src/components/calendar/BookingActionPopover.tsx
```

### Utilidades

#### booking-conflicts.ts
```1:136:src/lib/booking-conflicts.ts
// Ver archivo completo en: src/lib/booking-conflicts.ts
```

---

## 🔄 FLUJOS DE USUARIO

### Flujo 1: Crear Nueva Cita

1. Usuario hace click en:
   - Botón flotante (+)
   - Slot vacío → "Nueva cita"
   - Estado vacío → "Crear reserva manual"

2. Se abre `NewBookingModal`

3. Usuario completa:
   - Cliente (búsqueda o nuevo)
   - Teléfono y email
   - Fecha y hora
   - Servicios (uno o más)
   - Estado
   - Notas (opcional)

4. Al guardar:
   - Valida campos requeridos
   - Detecta conflictos
   - Si hay conflictos → `ConflictResolutionModal`
   - Si no hay conflictos → Guarda y cierra

5. Se actualiza la vista

### Flujo 2: Editar Cita

1. Usuario hace click en cita
2. Aparece `BookingActionPopover`
3. Usuario selecciona "Modificar"
4. Se abre `NewBookingModal` pre-llenado
5. Usuario modifica campos
6. Al guardar:
   - Valida campos
   - Detecta conflictos (excluyendo cita actual)
   - Si hay conflictos → `ConflictResolutionModal`
   - Si no hay conflictos → Actualiza y cierra

### Flujo 3: Mover Cita (Drag & Drop)

1. Usuario arrastra cita
2. Se muestra posición visual mientras arrastra
3. Usuario suelta en nueva posición
4. Se calcula nueva hora/empleado
5. Se abre `BookingMoveConfirmModal`
6. Usuario confirma
7. Se valida conflictos
8. Si hay conflictos → `ConflictResolutionModal`
9. Si no hay conflictos → Se actualiza

### Flujo 4: Redimensionar Cita

1. Usuario arrastra handle (arriba o abajo)
2. Se muestra nueva altura visual
3. Usuario suelta
4. Se calcula nueva duración
5. Se valida conflictos
6. Si hay conflictos → `ConflictResolutionModal`
7. Si no hay conflictos → Se actualiza

### Flujo 5: Crear Bloqueo

1. Usuario hace click en slot vacío
2. Aparece `AgendaActionPopover`
3. Usuario selecciona:
   - "Añadir falta de disponibilidad" → tipo "block"
   - "Añadir ausencia" → tipo "absence"

4. Se abre `StaffBlockingModal` pre-configurado
5. Usuario completa:
   - Empleado (pre-seleccionado)
   - Tipo
   - Fecha y horas
   - Motivo
   - Notas (opcional)

6. Al guardar:
   - Valida campos
   - Detecta conflictos con citas
   - Si hay conflictos → `ConflictResolutionModal`
   - Si no hay conflictos → Guarda y cierra

### Flujo 6: Resolver Conflictos

1. Sistema detecta conflicto
2. Se abre `ConflictResolutionModal`
3. Muestra:
   - Lista de conflictos
   - Nuevo horario propuesto

4. Usuario selecciona:
   - "Cambiar la hora" → Cierra y permite editar
   - "Asignar a otro empleado" → Cierra y permite cambiar
   - "Forzar solape" (solo admins) → Guarda a pesar de conflictos
   - "Cancelar" → Cancela operación

---

## 🎨 ESTADOS Y FILTROS

### Estados de Citas

- **hold**: Reserva temporal (amarillo)
- **pending**: Pendiente de pago (amarillo)
- **paid**: Pagado (verde)
- **completed**: Completado (verde)
- **cancelled**: Cancelado (gris, opacidad reducida)
- **no_show**: No se presentó (rosa)

### Tipos de Bloqueos

- **block**: Falta de disponibilidad (gris)
- **absence**: Ausencia (rojo)
- **vacation**: Vacaciones (azul)

### Filtros Disponibles

1. **Pagos:**
   - Pagado
   - Sin pagar

2. **Estado:**
   - Pendiente
   - Confirmada
   - Completada
   - Cancelada

3. **Empleado:**
   - Todos
   - Selección múltiple

4. **Detalles:**
   - Marcadas como destacadas

### Aplicación de Filtros

Los filtros se aplican en tiempo real:
- Filtran la lista de `bookings` visible
- Filtran el `staffList` visible (si se filtra por empleado)
- Se muestra chip con contador de filtros activos
- Botón "Limpiar todo" resetea todos los filtros

---

## 📊 ESTRUCTURA DE DATOS

### Tipo Booking

```typescript
type Booking = {
  id: string;
  starts_at: string; // ISO string
  ends_at: string; // ISO string
  appointment_id?: string | null;
  status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show";
  customer_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  tenant_id?: string;
  customer?: {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  service?: {
    name: string;
    duration_min: number;
    price_cents: number;
  } | null;
  staff?: {
    id: string;
    name: string;
  } | null;
  internal_notes?: string | null;
  client_message?: string | null;
  is_highlighted?: boolean;
};
```

### Tipo StaffBlocking

```typescript
type StaffBlocking = {
  id: string;
  staff_id: string;
  start_at: string; // ISO string
  end_at: string; // ISO string
  type: "block" | "absence" | "vacation";
  reason: string | null;
  notes: string | null;
};
```

### Tipo Staff

```typescript
type Staff = {
  id: string;
  name: string;
  active: boolean;
};
```

---

## 🔧 CONFIGURACIÓN Y DEPENDENCIAS

### Dependencias Principales

- `@supabase/auth-helpers-nextjs`: Cliente Supabase
- `date-fns`: Manipulación de fechas
- `framer-motion`: Animaciones
- `lucide-react`: Iconos

### Variables de Entorno

- `NEXT_PUBLIC_APP_URL`: URL base de la app (para enlaces de reservas)

### Configuración de Base de Datos

**Tablas utilizadas:**
- `bookings`: Citas
- `staff_blockings`: Bloqueos
- `staff`: Empleados
- `services`: Servicios
- `customers`: Clientes
- `staff_schedules`: Horarios del staff
- `org_settings`: Configuración del tenant (timezone)

**RLS (Row Level Security):**
- Todas las queries respetan RLS
- Filtrado automático por `tenant_id`

---

## 🚀 MEJORAS FUTURAS SUGERIDAS

1. **Persistencia de preferencias:**
   - Guardar vista preferida del usuario
   - Guardar filtros aplicados

2. **Búsqueda avanzada:**
   - Buscar por cliente, servicio, empleado
   - Filtros por rango de fechas

3. **Notificaciones reales:**
   - Integración con Twilio/SendGrid
   - Envío automático de SMS/Email

4. **Pagos integrados:**
   - Integración con Stripe
   - Actualización de estado de pago desde UI

5. **Sistema de horarios:**
   - Configuración de horarios semanales
   - Días libres recurrentes

6. **Reportes:**
   - Métricas de citas
   - Análisis de disponibilidad
   - Reportes de ingresos

---

## 📝 NOTAS TÉCNICAS

### Timezone Handling

- Todas las fechas se almacenan en UTC
- Se convierten a timezone del tenant para mostrar
- Función `toTenantLocalDate()` en `lib/timezone.ts`

### Scroll Sincronizado

- Las columnas de staff y la columna de horas se sincronizan
- Usa `requestAnimationFrame` para mejor rendimiento
- Flag `isScrollingRef` previene bucles infinitos

### Drag & Drop

- Usa eventos nativos del mouse
- Calcula posición relativa al timeline
- Convierte píxeles a minutos (cada 60px = 15 min)
- Valida antes de aplicar cambios

### Redimensionamiento

- Handles en bordes superior e inferior
- Mantiene hora inicio o fin según handle
- Mínimo 15 minutos (60px)

### Detección de Conflictos

- Función `detectConflicts()` en `lib/booking-conflicts.ts`
- Verifica solapes entre rangos de tiempo
- Excluye cita/bloqueo actual si se está editando
- Retorna array de conflictos con detalles

---

## ✅ CHECKLIST DE FUNCIONALIDADES

### Implementado ✅

- [x] Vista Día con timeline
- [x] Vista Semana
- [x] Vista Mes
- [x] Vista Lista
- [x] Crear cita
- [x] Editar cita
- [x] Cancelar cita
- [x] Mover cita (drag & drop)
- [x] Redimensionar cita
- [x] Crear bloqueo
- [x] Detección de conflictos
- [x] Resolución de conflictos
- [x] Filtros avanzados
- [x] Panel de detalles
- [x] Vista rápida de cliente
- [x] Navegación de fechas
- [x] Selector de vista
- [x] Estado vacío mejorado
- [x] Responsive design
- [x] Timezone aware

### Pendiente ⚠️

- [ ] Búsqueda avanzada
- [ ] Notificaciones reales (SMS/Email)
- [ ] Pagos integrados (Stripe)
- [ ] Sistema de horarios semanales
- [ ] Reportes y analytics
- [ ] Persistencia de preferencias
- [ ] Exportar calendario (iCal)

---

**Última actualización**: Diciembre 2024  
**Versión**: 1.0.0





