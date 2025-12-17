# 📘 BOOKFAST — ARQUITECTURA DE PAGOS COMPLETA (Stripe Connect Standard)

**Versión final para implementación en producción**

**100% alineada con ley española y modelo fiscal de Comunidad de Bienes**

---

## 🧩 1. Objetivo general del sistema de pagos

BookFast debe permitir a cada barbería:

- ✅ Cobrar reservas de clientes finales
- ✅ Cobrar productos completos o adelantos (depósitos)
- ✅ Definir, desde su panel de gestión, si un servicio requiere:
  - Pago total obligatorio
  - Pago parcial (adelanto)
  - Pago opcional
  - Sin pago online

### Requisitos adicionales:

- **El dinero nunca pasa por nosotros (BookFast)**
- Cada barbería cobra directamente a través de su propia cuenta Stripe
- BookFast solo cobra su suscripción mensual sin tocar dinero de terceros
- El panel de BookFast debe mostrar:
  - Pagos pendientes (retenidos por Stripe)
  - Pagos disponibles
  - Pagos ingresados
  - Devoluciones
  - Disputas
  - Próximos payouts programados

Todo esto **sin asumir responsabilidades fiscales de marketplace**.

---

## 🧱 2. Modelo jurídico y técnico elegido

BookFast funcionará como:

**✔️ Plataforma SaaS + Stripe Connect Standard (Payments + Payouts automáticos)**

### Interpretación correcta:

- Cada barbería es **merchant de sus propias ventas**
- BookFast **no recauda dinero de terceros**
- BookFast **no intermedia fondos**, solo provee el software
- Los clientes pagan **directamente a la barbería**
- Stripe paga **directamente al barbero** a su cuenta bancaria

### Esto evita:

- ❌ IVA sobre ventas que no son vuestras
- ❌ Responsabilidad en disputas
- ❌ Obligaciones de PSD2 / blanqueo de capitales
- ❌ Gestión de fondos de terceros
- ❌ Problemas legales para una Comunidad de Bienes

---

## 🧬 3. Flujo completo de Stripe Connect Standard

El sistema funciona en **4 bloques principales**:

1. **Onboarding del barbero a Stripe**
2. **Configuración del servicio (pago total o adelanto)**
3. **Cobro de la reserva del cliente final**
4. **Visualización del monedero (sin tocar dinero)**

---

## 🟦 4. BLOQUE 1 — Onboarding del barbero a Stripe

Este proceso se desencadena desde:

**`pro.bookfast.es/panel/pagos`**

### 4.1. Requisitos previos

En la tabla `tenants` o `barbershops` guardamos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID interno del tenant |
| `business_name` | TEXT | Nombre del negocio |
| `owner_name` | TEXT | Nombre del propietario |
| `email` | TEXT | Email del propietario |
| `stripe_account_id` | TEXT | ID de cuenta Stripe (vacío inicialmente) |
| `stripe_onboarding_status` | TEXT | Estado: `"pending"`, `"completed"`, `"restricted"`, `"disabled"` |

### 4.2. Flujo técnico

#### Paso A — El barbero pulsa: "Conectar Stripe"

**Frontend llama a:**

```
POST /api/payments/stripe/connect
```

#### Paso B — Backend

**Si el barbero no tiene cuenta Stripe:**

```typescript
// Crear cuenta Stripe Standard
const account = await stripe.accounts.create({
  type: "standard",
  email: ownerEmail
});
// → devuelve stripe_account_id
```

**Guardar ID en Supabase:**

```sql
UPDATE tenants 
SET stripe_account_id = :stripe_account_id
WHERE id = :tenant_id;
```

**Crear account_link:**

```typescript
const accountLink = await stripe.accountLinks.create({
  account: stripe_account_id,
  refresh_url: "https://pro.bookfast.es/panel/pagos",
  return_url: "https://pro.bookfast.es/panel/pagos/completado",
  type: "account_onboarding"
});
```

**Devolver la URL al frontend** para redirigir al barbero.

#### Paso C — El barbero es redirigido a Stripe

Stripe pide:

- Datos del negocio
- Datos personales
- Cuenta bancaria
- Verificación de identidad (KYC)

#### Paso D — Stripe regresa al `return_url`

**Actualizar estado:**

```typescript
const account = await stripe.accounts.retrieve(stripe_account_id);
// → status: charges_enabled, payouts_enabled
```

**Guardar en Supabase:**

```sql
UPDATE tenants 
SET stripe_onboarding_status = 'completed'
WHERE id = :tenant_id;
```

---

## 🟧 5. BLOQUE 2 — Configuración del servicio desde BookFast

Cada barbería define sus servicios en:

**`pro.bookfast.es/panel/servicios`**

### 5.1. Campos relevantes en Supabase

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `price` | DECIMAL | Precio total del servicio |
| `deposit_enabled` | BOOLEAN | ¿Requiere adelanto? |
| `deposit_type` | ENUM | Tipo: `"fixed"` o `"percent"` |
| `deposit_amount` | DECIMAL | Valor del adelanto si es `"fixed"` |
| `deposit_percent` | DECIMAL | % del precio total si es porcentaje |
| `online_payment_required` | BOOLEAN | ¿Es obligatorio pagar online? |

### 5.2. Cálculo del adelanto

**Si tipo = `"percent"`:**

```typescript
deposit = price * (deposit_percent / 100);
```

**Si tipo = `"fixed"`:**

```typescript
deposit = deposit_amount;
```

El resto se paga en persona.

---

## 🟥 6. BLOQUE 3 — Cobro de la reserva del cliente final

Cuando un cliente va a reservar:

**`barberia.bookfast.es/servicios/:id/reservar`**

### 6.1. El frontend prepara el payload

Incluye:

- `barbería` (tenant_id)
- `servicio` (service_id)
- `precio` (price)
- `deposit_enabled` (boolean)
- `depósito calculado` (deposit)
- `datos del cliente` (nombre, email)

### 6.2. El backend genera un Checkout Session

#### Caso A — Pago total

```typescript
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  customer_email: email,
  line_items: [
    {
      price_data: {
        currency: "eur",
        product_data: { 
          name: serviceName 
        },
        unit_amount: price * 100, // en céntimos
      },
      quantity: 1,
    }
  ],
  payment_intent_data: {
    on_behalf_of: stripe_account_id,
    transfer_data: {
      destination: stripe_account_id
    }
  },
  success_url: "https://barberia.bookfast.es/reserva/confirmada",
  cancel_url: "https://barberia.bookfast.es/reserva/cancelada"
});
```

#### Caso B — Adelanto

Solo cobramos el depósito:

```typescript
unit_amount: deposit * 100 // en céntimos
```

**En los metadata del payment intent guardamos:**

```typescript
metadata: {
  service_id: serviceId,
  booking_id: bookingId,
  deposit: deposit,
  total_price: price
}
```

### 6.3. ¿Quién recibe el dinero?

**Stripe envía:**

1. El dinero **directamente a la barbería** (cuenta conectada)
2. Stripe retiene el pago **24–48h** como `pending`
3. Luego lo mueve a `available`
4. Y posteriormente a `payouts` (ingreso bancario)

---

## 🟩 7. BLOQUE 4 — Monedero del barbero (sin manejar dinero)

En el panel de la barbería:

**`pro.bookfast.es/panel/monedero`**

Mostramos información usando las APIs de Stripe:

### 7.1. Balance actual (pendiente + disponible)

```typescript
const balance = await stripe.balance.retrieve({ 
  stripeAccount: stripe_account_id 
});
```

**Esto devuelve:**

- `pending`: dinero retenido temporalmente
- `available`: dinero listo para payout

### 7.2. Movimientos

```typescript
const transactions = await stripe.balanceTransactions.list({ 
  stripeAccount: stripe_account_id 
});
```

**Cada movimiento tiene:**

- `tipo` (charge, refund, payout, dispute…)
- `importe` (amount)
- `fee` (comisión de Stripe)
- `fecha` (created)
- `status` (pending, available, paid_out)

### 7.3. Payouts programados

```typescript
const payouts = await stripe.payouts.list({ 
  stripeAccount: stripe_account_id 
});
```

**Muestra:**

- Próximo ingreso
- Estado (`paid`, `pending`, `failed`)
- Fecha
- Cantidad

---

## 🟥 8. Webhooks necesarios

Para sincronizar pagos en tiempo real BookFast habilitará:

### Pagos

- ✅ `checkout.session.completed`
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `charge.succeeded`
- ✅ `charge.refunded`

### Balance

- ✅ `balance.available`

### Disputas

- ✅ `charge.dispute.created`
- ✅ `charge.dispute.closed`

### Suscripción SaaS BookFast → barberías

- ✅ `invoice.paid`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.updated`

---

## 🧠 9. ¿Qué guardamos en Supabase de cada pago?

### Tabla `payments`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID interno |
| `stripe_payment_intent_id` | TEXT | ID del Payment Intent |
| `stripe_charge_id` | TEXT | ID del cargo |
| `stripe_session_id` | TEXT | ID de Checkout Session |
| `service_id` | UUID | Servicio reservado |
| `barberia_id` | UUID | Tenant (barbería) |
| `customer_name` | TEXT | Nombre del cliente |
| `customer_email` | TEXT | Email del cliente |
| `amount` | DECIMAL | Monto cobrado |
| `deposit` | DECIMAL | Monto del adelanto |
| `total_price` | DECIMAL | Precio total del servicio |
| `status` | TEXT | `pending`, `succeeded`, `refunded`, `disputed` |
| `balance_status` | TEXT | `pending` → `available` → `paid_out` |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última actualización |

---

## 🟦 10. Flujo final del sistema (resumen ejecutivo)

1. **El barbero conecta Stripe** (cuenta Standard)
2. **Desde su panel configura:**
   - Precio
   - Si quiere depósito
   - Si el pago online es obligatorio
3. **El cliente reserva:**
   - Se genera un checkout
   - Se cobra total o depósito
4. **Stripe recibe el pago** a nombre de la barbería
5. **Stripe retiene el pago** 24–48h
6. **BookFast muestra:**
   - Pendiente
   - Disponible
   - Ingresado
7. **Stripe ingresa el dinero** a la barbería según su payout schedule
8. **BookFast gestiona la suscripción mensual** de la barbería a través de otro Stripe flow independiente

---

## 📋 11. Estructura de tablas en Supabase

### 11.1. Tabla `tenants` (actualización)

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_onboarding_status TEXT DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_account ON tenants(stripe_account_id);
```

### 11.2. Tabla `services` (actualización)

```sql
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_type TEXT CHECK (deposit_type IN ('fixed', 'percent'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_percent DECIMAL(5,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS online_payment_required BOOLEAN DEFAULT false;
```

### 11.3. Tabla `payments` (nueva)

```sql
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  stripe_session_id TEXT,
  service_id UUID REFERENCES services(id),
  barberia_id UUID REFERENCES tenants(id),
  booking_id UUID REFERENCES bookings(id),
  customer_name TEXT,
  customer_email TEXT,
  amount DECIMAL(10,2) NOT NULL,
  deposit DECIMAL(10,2),
  total_price DECIMAL(10,2),
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'refunded', 'disputed', 'failed')),
  balance_status TEXT CHECK (balance_status IN ('pending', 'available', 'paid_out')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_barberia ON payments(barberia_id);
CREATE INDEX IF NOT EXISTS idx_payments_service ON payments(service_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
```

---

## 🔐 12. Variables de entorno requeridas

```env
# Stripe - Cuenta principal de BookFast
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs
NEXT_PUBLIC_APP_URL=https://pro.bookfast.es
NEXT_PUBLIC_CLIENT_URL=https://barberia.bookfast.es
```

---

## 🚀 13. Endpoints API necesarios

### 13.1. Onboarding

- `POST /api/payments/stripe/connect` - Iniciar onboarding
- `GET /api/payments/stripe/status` - Estado del onboarding

### 13.2. Checkout

- `POST /api/payments/checkout/create` - Crear sesión de checkout
- `GET /api/payments/checkout/session/:id` - Obtener sesión

### 13.3. Monedero

- `GET /api/payments/wallet/balance` - Balance actual
- `GET /api/payments/wallet/transactions` - Movimientos
- `GET /api/payments/wallet/payouts` - Payouts programados

### 13.4. Webhooks

- `POST /api/webhooks/stripe` - Handler de webhooks

---

## 📝 14. Próximos pasos de implementación

1. ✅ **Crear migración SQL** para tablas y campos necesarios
2. ✅ **Implementar endpoint de onboarding** (`/api/payments/stripe/connect`)
3. ✅ **Actualizar formulario de servicios** para incluir configuración de depósitos
4. ✅ **Implementar creación de checkout** con Stripe Connect
5. ✅ **Crear panel de monedero** para visualizar balance y movimientos
6. ✅ **Implementar handlers de webhooks** para todos los eventos necesarios
7. ✅ **Actualizar flujo de reservas** para integrar pagos

---

## 📚 15. Referencias

- [Stripe Connect Standard](https://stripe.com/docs/connect/standard-accounts)
- [Stripe Connect Onboarding](https://stripe.com/docs/connect/onboarding)
- [Stripe Connect Payouts](https://stripe.com/docs/connect/payouts)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Balance API](https://stripe.com/docs/api/balance)

---

**Documento creado:** 2024  
**Última actualización:** 2024  
**Versión:** 1.0.0



