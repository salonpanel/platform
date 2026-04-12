# 🚀 ROADMAP COMPETITIVO - BookFast Pro
**Objetivo**: Plataforma SaaS para barberías y peluquerías que compita con Booksy, Treatwell, Acuity Scheduling.

---

## ✅ ESTADO ACTUAL (Abril 2026)

### Ya construido y funcional:
- Multi-tenancy completo con RLS en Supabase
- Auth OTP / magic links
- Panel admin de plataforma (`/admin`)
- Layout del panel con sidebar y navegación
- Gestión de Clientes (lista, ficha, exportar)
- Gestión de Servicios (CRUD completo)
- Gestión de Staff (CRUD + relación con servicios)
- Agenda día (columnas por barbero, carga bookings)
- Sistema de pagos con Stripe Connect (wallet, payouts)
- Portal de reservas público básico (`/r/[tenantId]`)
- Chat interno del equipo
- Ajustes del tenant (branding, horarios, pagos)
- Sistema de permisos por roles (owner/manager/staff)
- Health checks y cron jobs (release-holds, métricas)

### Bloqueadores arreglados hoy:
- ✅ Build roto (middleware.ts → proxy.ts para Next.js 16)
- ✅ Error TypeScript en AgendaModal.tsx (era log antiguo)

---

## 🔴 FASE 1 — Completar el Core (URGENTE)
> Sin esto no se puede enseñar la plataforma a una barbería real

### 1.1 Agenda PRO — El corazón del producto
**Estado actual**: Vista día funciona básicamente. Faltan funcionalidades críticas.

| Feature | Prioridad | Esfuerzo |
|---|---|---|
| Click en slot vacío → popover "Nueva cita / Bloquear / Ausencia" | 🔴 Alta | 1 día |
| Visualizar staff_blockings (bloques grises en agenda) | 🔴 Alta | 1 día |
| Modal crear bloqueo/ausencia de barbero | 🔴 Alta | 1 día |
| Drag & drop para mover citas | 🟠 Media | 2-3 días |
| Vista semana funcional (con columnas staff) | 🟠 Media | 2 días |
| Resize de citas con drag (cambiar duración) | 🟡 Baja | 2 días |
| Indicador de "ahora" en la agenda | 🟠 Media | 2 horas |
| Colores por barbero personalizables | 🟠 Media | 1 día |

### 1.2 Notificaciones — Esencial para retención de clientes
**Estado actual**: Solo stubs. No envía nada real.

| Feature | Prioridad | Esfuerzo |
|---|---|---|
| Email de confirmación al reservar (Resend ya integrado) | 🔴 Alta | 4 horas |
| Recordatorio por email 24h antes | 🔴 Alta | 4 horas |
| Recordatorio 1h antes | 🟠 Media | 2 horas |
| Email de cancelación | 🔴 Alta | 2 horas |
| SMS con Twilio (confirmación + recordatorio) | 🟠 Media | 1 día |
| Plantillas de email personalizables por tenant | 🟡 Baja | 2 días |

### 1.3 Portal de Reservas — Mejorar UX para el cliente final
**Estado actual**: Funcional pero básico. Sin diseño atractivo.

| Feature | Prioridad | Esfuerzo |
|---|---|---|
| Selección de barbero en el flujo de reserva | 🔴 Alta | 1 día |
| Rediseño visual del portal (más atractivo, moderno) | 🔴 Alta | 2 días |
| Selector de fecha con calendario visual | 🔴 Alta | 1 día |
| Multi-servicio en una reserva | 🟠 Media | 2 días |
| Página de confirmación con resumen | 🔴 Alta | 4 horas |
| Cancelar/modificar cita desde el portal | 🟠 Media | 1 día |
| "Mis citas" mejorado (historial, próximas) | 🟠 Media | 1 día |

### 1.4 Dashboard — KPIs reales para el dueño
**Estado actual**: Existe pero necesita datos reales y mejor presentación.

| Feature | Prioridad | Esfuerzo |
|---|---|---|
| Ingresos del día / semana / mes (real) | 🔴 Alta | 4 horas |
| Citas del día con estado (confirmadas/pendientes/canceladas) | 🔴 Alta | 4 horas |
| Ocupación por barbero (%) | 🟠 Media | 4 horas |
| Top servicios del mes | 🟠 Media | 4 horas |
| Comparativa mes actual vs mes anterior | 🟡 Baja | 1 día |
| Próximas citas en tiempo real | 🔴 Alta | 4 horas |

---

## 🟠 FASE 2 — Features de Retención y Crecimiento
> Necesario para competir con Booksy / Treatwell

### 2.1 Sistema de Recordatorios Automáticos (Cron)
- Cron que dispara recordatorios 24h y 1h antes automáticamente
- Registro de notificaciones enviadas (para audit)
- Panel de notificaciones enviadas al cliente

### 2.2 Gestión de No-Shows
- Registrar no-shows desde la agenda
- Política de no-show por tenant (cobro automático)
- Estadísticas de no-shows por cliente y por barbero
- Bloqueo automático de clientes con muchos no-shows

### 2.3 Métricas de Rendimiento por Barbero
- Ingresos generados por barbero
- Nº citas y tasa de ocupación por barbero
- Servicios más realizados por barbero
- Rating de clientes por barbero (si se implementan reviews)

### 2.4 Sistema de Fidelización (Loyalty)
- Puntos por visita/gasto
- Canjear puntos por descuentos
- Panel del cliente con sus puntos
- Email automático al acumular puntos

### 2.5 Marketing Mejorado
- Lista de clientes inactivos (+90 días sin cita)
- Campaña de reactivación por email masivo
- Plantillas de mensaje predefinidas
- Estadísticas de campañas (enviados, abiertos, clics)

### 2.6 Gestión de Lista de Espera
- Apuntarse a lista de espera si no hay disponibilidad
- Notificación automática cuando se libera un hueco
- Panel de lista de espera en la agenda

---

## 🟡 FASE 3 — Features Premium para Diferenciarse
> Lo que hace que los clientes paguen el plan más caro

### 3.1 Sistema de Valoraciones y Reseñas
- Email post-cita pidiendo valoración (1-5 estrellas)
- Widget de reseñas en el portal público
- Respuesta del propietario a las reseñas
- Integración opcional con Google Reviews

### 3.2 Tarjetas Regalo (Gift Cards)
- Crear y vender vouchers de regalo
- Aplicar gift card al pagar una cita
- Panel de gift cards (activas, usadas, caducadas)

### 3.3 Paquetes y Bonos
- Paquete "5 cortes por el precio de 4"
- Abono de sesiones prepagadas
- Gestión de sesiones restantes por cliente

### 3.4 Multi-Sede (Multi-Location)
- Una organización con varias sedes
- Barberos asignados a una o varias sedes
- Agenda y métricas por sede
- Cliente puede reservar en cualquier sede

### 3.5 App Móvil / PWA
- Progressive Web App instalable
- Notificaciones push al dispositivo
- Agenda optimizada para móvil (touch-first)
- Acceso offline a la agenda del día

### 3.6 Reporting Avanzado
- Informe mensual en PDF auto-generado
- Comparativas temporales
- Exportación a Excel de datos contables
- Previsión de ingresos basada en citas programadas

### 3.7 Integración con Google Calendar
- Sincronización bidireccional con Google Calendar del barbero
- Citas del barbero bloqueadas automáticamente en la agenda
- Notificaciones en el calendario personal

---

## 📋 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

```
SEMANA 1-2:
  ✓ [DONE] Arreglar build (proxy.ts)
  → Notificaciones email (confirmación + recordatorio 24h)
  → Agenda: popover en slot vacío + staff_blockings visibles
  → Portal reservas: selector de barbero + calendario visual

SEMANA 3-4:
  → Dashboard: KPIs reales
  → Agenda: drag & drop
  → Portal: multi-servicio + cancelación
  → Email recordatorio 1h antes + cancelaciones

SEMANA 5-6:
  → Agenda: vista semana completa
  → No-shows: registro + estadísticas
  → Métricas por barbero
  → SMS básico (Twilio)

SEMANA 7-8:
  → Sistema de fidelización
  → Lista de espera
  → Marketing: reactivación de clientes inactivos
  → Reporting básico

SEMANA 9-12:
  → Valoraciones y reseñas
  → Gift cards y bonos
  → PWA / mobile optimization
  → Multi-sede

SEMANA 13+:
  → Google Calendar sync
  → Reporting avanzado
  → Integraciones externas
```

---

## 🎯 CRITERIO PARA DECIR "LISTO PARA VENDER"

- [ ] La agenda permite gestionar un día completo sin fricciones
- [ ] Los clientes reciben confirmación y recordatorio automático
- [ ] El portal de reservas es atractivo y fácil de usar en móvil
- [ ] El dashboard muestra los KPIs del día en tiempo real
- [ ] Las notificaciones funcionan (email mínimo, SMS deseable)
- [ ] No hay errores en el build ni en el typecheck
- [ ] El flujo completo funciona: reserva online → confirmación → recordatorio → check-in en agenda

---

*Última actualización: Abril 2026*
