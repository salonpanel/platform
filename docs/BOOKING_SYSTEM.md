# Sistema de Reservas - Documentación Técnica

## Arquitectura

### Modelo de Datos

#### Tablas principales

1. **tenants**: Organizaciones (barberías) multi-tenant
   - `id` (UUID): Identificador único
   - `slug` (text): Slug único para URLs públicas
   - `name` (text): Nombre del tenant
   - `timezone` (text): Zona horaria del tenant

2. **memberships**: Relación usuario-tenant con roles
   - `tenant_id` (UUID): Referencia a tenants
   - `user_id` (UUID): Referencia a auth.users
   - `role` (text): 'owner', 'admin', 'staff', 'viewer'

3. **services**: Servicios ofrecidos por cada tenant
   - `tenant_id` (UUID): Referencia a tenants
   - `name` (text): Nombre del servicio
   - `duration_min` (int): Duración en minutos
   - `price_cents` (int): Precio en céntimos
   - `active` (boolean): Si el servicio está activo

4. **staff**: Staff (barberos) de cada tenant
   - `tenant_id` (UUID): Referencia a tenants
   - `name` (text): Nombre del barbero
   - `display_name` (text): Nombre para mostrar
   - `active` (boolean): Si el barbero está activo

5. **schedules**: Horarios de trabajo del staff
   - `tenant_id` (UUID): Referencia a tenants
   - `staff_id` (UUID): Referencia a staff
   - `weekday` (int): Día de la semana (0-6, 0=Lunes)
   - `start_time` (time): Hora de inicio
   - `end_time` (time): Hora de fin

6. **customers**: Clientes de cada tenant
   - `tenant_id` (UUID): Referencia a tenants
   - `email` (text): Email del cliente
   - `name` (text): Nombre del cliente
   - `phone` (text): Teléfono del cliente

7. **payment_intents**: Intentos de pago (mock o reales)
   - `tenant_id` (UUID): Referencia a tenants
   - `customer_id` (UUID): Referencia a customers
   - `service_id` (UUID): Referencia a services
   - `amount_cents` (int): Monto en céntimos
   - `status` (text): 'requires_payment', 'paid', 'failed', 'cancelled'
   - `payment_provider` (text): 'mock', 'stripe', etc.
   - `metadata` (jsonb): Datos adicionales (staff_id, starts_at, ends_at)
   - `expires_at` (timestamptz): TTL para intents no pagados

8. **bookings**: Reservas confirmadas
   - `tenant_id` (UUID): Referencia a tenants
   - `customer_id` (UUID): Referencia a customers
   - `staff_id` (UUID): Referencia a staff
   - `service_id` (UUID): Referencia a services
   - `starts_at` (timestamptz): Inicio de la reserva
   - `ends_at` (timestamptz): Fin de la reserva
   - `status` (text): 'pending', 'paid', 'cancelled', 'no_show', 'completed'
   - `payment_intent_id` (UUID): Referencia a payment_intents

9. **logs**: Registro de acciones importantes
   - `tenant_id` (UUID): Referencia a tenants
   - `user_id` (UUID): Referencia a auth.users
   - `action` (text): Acción realizada
   - `resource_type` (text): Tipo de recurso
   - `resource_id` (UUID): ID del recurso
   - `metadata` (jsonb): Datos adicionales

### Políticas RLS

#### Lectura pública
- **services**: Lectura pública de servicios activos
- **schedules**: Lectura pública de horarios de staff activo
- **staff**: Lectura pública de staff activo

#### Escritura restringida
- **memberships**: Solo owners/admins pueden gestionar
- **services**: Solo miembros del tenant pueden gestionar
- **staff**: Solo miembros del tenant pueden gestionar
- **schedules**: Solo miembros del tenant pueden gestionar
- **bookings**: Solo miembros del tenant pueden gestionar
- **payment_intents**: Creación pública (validación en aplicación)
- **logs**: Solo el sistema puede crear logs

### Funciones SQL

1. **get_available_slots**: Calcula slots disponibles para un servicio
   - Parámetros: `p_tenant_id`, `p_service_id`, `p_staff_id` (opcional), `p_date`, `p_days_ahead`
   - Retorna: Array de slots con `slot_start`, `slot_end`, `staff_id`, `staff_name`
   - Considera: Horarios del staff, reservas existentes, holds no expirados, buffers

2. **app.current_tenant_id()**: Obtiene el tenant_id del usuario logado
   - Retorna: UUID del tenant del usuario actual
   - Usa: `memberships` para obtener el tenant del usuario

3. **app.user_has_role()**: Verifica si un usuario tiene un rol en un tenant
   - Parámetros: `p_tenant_id`, `p_user_id`, `p_roles`
   - Retorna: Boolean

4. **public.create_log()**: Crea un log de acción
   - Parámetros: `p_tenant_id`, `p_user_id`, `p_action`, `p_resource_type`, `p_resource_id`, `p_metadata`, `p_ip_address`, `p_user_agent`
   - Retorna: UUID del log creado

## Endpoints API

### GET /api/availability

Obtiene slots disponibles para un servicio.

**Query params:**
- `tenant` (string): UUID o slug del tenant (requerido)
- `service_id` (string): UUID del servicio (requerido)
- `staff_id` (string): UUID del staff (opcional)
- `date` (string): Fecha de inicio (YYYY-MM-DD, opcional, default: hoy)
- `days_ahead` (string): Días hacia adelante (opcional, default: 30)

**Response:**
```json
{
  "slots": [
    {
      "slot_start": "2024-01-15T10:00:00Z",
      "slot_end": "2024-01-15T10:30:00Z",
      "staff_id": "uuid",
      "staff_name": "Juan"
    }
  ],
  "count": 1
}
```

### POST /api/checkout/intent

Crea un payment_intent (mock) para una reserva.

**Body:**
```json
{
  "tenant_id": "uuid",
  "service_id": "uuid",
  "staff_id": "uuid", // opcional
  "starts_at": "2024-01-15T10:00:00Z",
  "customer_email": "cliente@example.com", // opcional si hay customer_id
  "customer_name": "Cliente", // opcional si hay customer_id
  "customer_phone": "+34600000000", // opcional
  "customer_id": "uuid" // opcional
}
```

**Response:**
```json
{
  "payment_intent_id": "uuid",
  "status": "requires_payment",
  "amount_cents": 1500,
  "expires_at": "2024-01-15T10:15:00Z"
}
```

### POST /api/checkout/confirm

Confirma un payment_intent (mock) y crea el booking.

**Body:**
```json
{
  "payment_intent_id": "uuid",
  "mock_payment": true // opcional, default: true
}
```

**Response:**
```json
{
  "booking_id": "uuid",
  "status": "paid",
  "starts_at": "2024-01-15T10:00:00Z",
  "ends_at": "2024-01-15T10:30:00Z",
  "payment_intent_id": "uuid"
}
```

## Componente BookingWidget

### Uso

```tsx
import { BookingWidget } from '@/app/components/BookingWidget';

export default function ReservePage() {
  const services = [
    {
      id: 'uuid',
      name: 'Corte Básico',
      duration_min: 30,
      price_cents: 1500,
    },
  ];

  return (
    <BookingWidget
      tenantId="uuid"
      services={services}
      onBookingComplete={(bookingId) => {
        console.log('Reserva completada:', bookingId);
      }}
    />
  );
}
```

### Props

- `tenantId` (string): UUID o slug del tenant
- `services` (Service[]): Array de servicios disponibles
- `onBookingComplete` (function): Callback cuando se completa una reserva

### Flujo

1. **Seleccionar servicio**: El usuario selecciona un servicio
2. **Seleccionar fecha**: El usuario selecciona una fecha
3. **Seleccionar slot**: El usuario selecciona un slot disponible
4. **Datos del cliente**: El usuario ingresa sus datos de contacto
5. **Procesar pago**: Se crea el payment_intent y se confirma (mock)
6. **Confirmación**: Se muestra la confirmación de la reserva

## Seeds

### Tenant Demo

- **ID**: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- **Slug**: `barberia-demo`
- **Name**: `Barbería Demo`
- **Timezone**: `Europe/Madrid`

### Servicios

1. **Corte Básico**
   - ID: `cccccccc-cccc-cccc-cccc-cccccccccccc`
   - Duración: 30 minutos
   - Precio: 15.00 €

2. **Barba**
   - ID: `dddddddd-dddd-dddd-dddd-dddddddddddd`
   - Duración: 20 minutos
   - Precio: 10.00 €

### Staff

1. **Juan**
   - ID: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
   - Horario: Lunes a Viernes, 9:00-18:00

2. **Pedro**
   - ID: `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee`
   - Horario: Lunes a Viernes, 9:00-18:00

## Migraciones

### 0018_booking_system_complete.sql

- Crea tabla `memberships`
- Crea tabla `payment_intents`
- Crea tabla `logs`
- Ajusta políticas RLS para lectura pública
- Crea funciones helper

### 0019_seed_booking_demo.sql

- Crea tenant demo
- Crea servicios demo
- Crea staff demo
- Crea horarios demo

## Testing

### Casos de prueba

1. **Disponibilidad sin staff**: Verificar que se muestran slots de todos los barberos
2. **Disponibilidad con staff**: Verificar que se muestran solo slots del barbero seleccionado
3. **Slot bloqueado**: Verificar que no se muestran slots ocupados
4. **Buffer**: Verificar que se respetan los buffers entre reservas
5. **RLS**: Verificar que no se puede acceder a datos de otros tenants
6. **Flujo completo**: Verificar que se puede crear una reserva end-to-end

### Ejecutar tests

```bash
# Ejecutar migraciones
supabase migration up

# Verificar seeds
supabase db reset

# Probar endpoints
curl "http://localhost:3000/api/availability?tenant=barberia-demo&service_id=cccccccc-cccc-cccc-cccc-cccccccccccc"
```

## Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Seguridad y Consistencia (P0 - Implementado)

### PR1: Idempotencia Webhook Stripe
- Tabla `stripe_events_processed` para evitar duplicados
- Handler idempotente que retorna 200 si el evento ya fue procesado
- Logging mínimo sin payload sensible

### PR2: TTL de Holds + Limpieza Automática
- Columna `expires_at` en `bookings` y `appointments`
- Función `cleanup_expired_holds()` para limpiar holds expirados
- Endpoint cron `/api/internal/cron/release-holds` (ejecuta cada 5 minutos)
- Rate limit: 50 req/10min por IP (Upstash Redis)

### PR3: Constraint Anti-Solapes
- Constraint EXCLUDE con GIST por `staff_id`
- Prohíbe solapes para estados críticos (`pending`, `paid`)
- Manejo de error 23P01 (exclusion violation) en endpoints
- Función helper `check_staff_availability()` para verificación previa

Ver documentación completa en `docs/PR1_PR2_PR3_IMPLEMENTATION.md`.

## Próximos Pasos

1. **P1 - Operativa y Escalabilidad**:
   - RLS y pruebas end-to-end
   - Migración Stripe (servicios legacy)
   - Timezone por organización

2. **P2 - Plataforma y Soporte**:
   - Super-panel de administración
   - Bootstrap de tenant
   - Observabilidad y correos

3. **Features Futuras**:
   - Integración con Stripe real (reemplazar mock)
   - Recordatorios automáticos (email/SMS)
   - Branding avanzado del portal
   - Vista semanal UI final
   - Tests automatizados (Jest/Vitest)
   - Integración con n8n para WhatsApp/IA

