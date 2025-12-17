# 🚀 PROMPT PARA CURSOR — Implementación Stripe Connect

Este documento contiene prompts específicos para implementar cada componente del sistema de pagos de BookFast con Stripe Connect Standard.

---

## 📋 Componentes a implementar

1. **Onboarding de Stripe Connect**
2. **Checkout con depósitos**
3. **Webhook handlers**
4. **Monedero del barbero**
5. **Actualizaciones en services y payments**

---

## 🟦 1. ONBOARDING STRIPE CONNECT

### Prompt para Cursor:

```
Necesito implementar el sistema de onboarding de Stripe Connect Standard para que las barberías se conecten a Stripe.

Requisitos:
1. Endpoint POST /api/payments/stripe/connect que:
   - Verifique si el tenant ya tiene stripe_account_id
   - Si no existe, cree una cuenta Stripe Standard con stripe.accounts.create()
   - Guarde el stripe_account_id en la tabla tenants
   - Cree un accountLink con tipo "account_onboarding"
   - Devuelva la URL para redirigir al barbero

2. Endpoint GET /api/payments/stripe/status que:
   - Recupere el estado del onboarding desde Stripe
   - Verifique charges_enabled y payouts_enabled
   - Actualice stripe_onboarding_status en tenants
   - Devuelva el estado actual

3. Página /panel/pagos que:
   - Muestre el estado actual del onboarding
   - Tenga un botón "Conectar Stripe" si no está conectado
   - Redirija a la URL de onboarding cuando se pulse
   - Muestre estado "Completado" cuando esté listo

4. Página /panel/pagos/completado que:
   - Verifique el estado del onboarding
   - Actualice la base de datos
   - Muestre mensaje de éxito o error

Usa el documento docs/BOOKFAST_STRIPE_ARCHITECTURE.md como referencia.
```

---

## 🟧 2. CONFIGURACIÓN DE SERVICIOS CON DEPÓSITOS

### Prompt para Cursor:

```
Necesito actualizar el formulario de servicios para permitir configurar depósitos y pagos online.

Requisitos:
1. Migración SQL que agregue a la tabla services:
   - deposit_enabled (BOOLEAN)
   - deposit_type (ENUM: 'fixed' o 'percent')
   - deposit_amount (DECIMAL)
   - deposit_percent (DECIMAL)
   - online_payment_required (BOOLEAN)

2. Actualizar el formulario de creación/edición de servicios en /panel/servicios:
   - Checkbox "Requiere adelanto"
   - Selector de tipo: "Fijo" o "Porcentaje"
   - Campo numérico para monto fijo o porcentaje
   - Checkbox "Pago online obligatorio"
   - Validación: si deposit_type es 'percent', deposit_percent debe estar entre 0 y 100

3. Función helper para calcular el depósito:
   - Si deposit_type = 'percent': deposit = price * (deposit_percent / 100)
   - Si deposit_type = 'fixed': deposit = deposit_amount

Usa el documento docs/BOOKFAST_STRIPE_ARCHITECTURE.md como referencia.
```

---

## 🟥 3. CHECKOUT CON STRIPE CONNECT

### Prompt para Cursor:

```
Necesito implementar el sistema de checkout que cobre directamente a la cuenta Stripe de la barbería usando Stripe Connect Standard.

Requisitos:
1. Endpoint POST /api/payments/checkout/create que:
   - Reciba: service_id, booking_id, customer_email, customer_name
   - Verifique que el tenant tiene stripe_account_id y está completado
   - Obtenga el servicio y calcule el monto (total o depósito según configuración)
   - Cree un checkout session con:
     - mode: "payment"
     - payment_intent_data.on_behalf_of: stripe_account_id
     - payment_intent_data.transfer_data.destination: stripe_account_id
   - Guarde metadata: service_id, booking_id, deposit, total_price
   - Devuelva la URL del checkout

2. Actualizar el flujo de reserva en el frontend:
   - Si online_payment_required es true, redirigir a checkout obligatoriamente
   - Si deposit_enabled es true, mostrar monto del depósito
   - Después del pago exitoso, redirigir a página de confirmación

3. Manejar ambos casos:
   - Pago total: cobrar el precio completo
   - Depósito: cobrar solo el depósito calculado

Usa el documento docs/BOOKFAST_STRIPE_ARCHITECTURE.md como referencia.
```

---

## 🟩 4. MONEDERO DEL BARBERO

### Prompt para Cursor:

```
Necesito crear el panel de monedero donde las barberías vean su balance y movimientos de Stripe sin manejar dinero.

Requisitos:
1. Endpoint GET /api/payments/wallet/balance que:
   - Obtenga el balance desde Stripe usando stripe.balance.retrieve()
   - Use stripeAccount: stripe_account_id del tenant
   - Devuelva: pending, available, y próximos payouts

2. Endpoint GET /api/payments/wallet/transactions que:
   - Liste las transacciones usando stripe.balanceTransactions.list()
   - Incluya: tipo, importe, fee, fecha, status
   - Permita paginación

3. Endpoint GET /api/payments/wallet/payouts que:
   - Liste los payouts usando stripe.payouts.list()
   - Muestre: fecha, cantidad, estado

4. Página /panel/monedero que muestre:
   - Balance pendiente (dinero retenido)
   - Balance disponible (listo para payout)
   - Lista de movimientos recientes
   - Próximos payouts programados
   - Gráfico de ingresos (opcional)

Usa el documento docs/BOOKFAST_STRIPE_ARCHITECTURE.md como referencia.
```

---

## 🟥 5. WEBHOOK HANDLERS

### Prompt para Cursor:

```
Necesito implementar handlers para todos los webhooks de Stripe Connect necesarios.

Requisitos:
1. Actualizar /api/webhooks/stripe/route.ts para manejar:

   a) checkout.session.completed:
      - Obtener payment_intent_id de la sesión
      - Actualizar payment_intents.status = 'paid'
      - Actualizar bookings.status = 'paid'
      - Crear registro en tabla payments

   b) payment_intent.succeeded:
      - Backup para confirmar pagos
      - Actualizar payments.status = 'succeeded'
      - Confirmar booking asociado

   c) payment_intent.payment_failed:
      - Actualizar payments.status = 'failed'
      - Liberar booking si es necesario
      - Notificar al cliente

   d) charge.refunded:
      - Actualizar payments.status = 'refunded'
      - Actualizar bookings.status = 'cancelled'
      - Registrar reembolso

   e) balance.available:
      - Actualizar payments.balance_status = 'available'
      - Notificar al barbero (opcional)

   f) charge.dispute.created:
      - Actualizar payments.status = 'disputed'
      - Notificar al barbero
      - Registrar disputa

   g) charge.dispute.closed:
      - Actualizar estado según resultado
      - Registrar resolución

2. Mantener idempotencia usando stripe_events_processed
3. Guardar todos los pagos en la tabla payments con todos los campos requeridos

Usa el documento docs/BOOKFAST_STRIPE_ARCHITECTURE.md como referencia.
```

---

## 🧠 6. TABLA PAYMENTS Y MIGRACIÓN COMPLETA

### Prompt para Cursor:

```
Necesito crear la migración SQL completa para el sistema de pagos con Stripe Connect.

Requisitos:
1. Crear tabla payments con todos los campos:
   - id, stripe_payment_intent_id, stripe_charge_id, stripe_session_id
   - service_id, barberia_id, booking_id
   - customer_name, customer_email
   - amount, deposit, total_price
   - status, balance_status
   - metadata (JSONB)
   - created_at, updated_at

2. Agregar índices necesarios:
   - barberia_id, service_id, booking_id
   - stripe_payment_intent_id (único)
   - status, balance_status

3. Actualizar tabla tenants:
   - stripe_account_id (TEXT)
   - stripe_onboarding_status (TEXT)

4. Actualizar tabla services:
   - deposit_enabled, deposit_type, deposit_amount, deposit_percent
   - online_payment_required

5. Crear función trigger para updated_at en payments

Usa el documento docs/BOOKFAST_STRIPE_ARCHITECTURE.md como referencia.
```

---

## 📝 7. IMPLEMENTACIÓN COMPLETA (Prompt general)

### Prompt para Cursor:

```
Necesito implementar el sistema completo de pagos con Stripe Connect Standard para BookFast.

Basándome en el documento docs/BOOKFAST_STRIPE_ARCHITECTURE.md, necesito:

1. ✅ Migración SQL completa con todas las tablas y campos
2. ✅ Sistema de onboarding de Stripe Connect
3. ✅ Configuración de servicios con depósitos
4. ✅ Checkout que cobre directamente a la cuenta del barbero
5. ✅ Panel de monedero para visualizar balance
6. ✅ Webhook handlers para todos los eventos necesarios
7. ✅ Integración en el flujo de reservas existente

Prioridades:
- P0: Onboarding y checkout básico
- P1: Webhooks y sincronización de pagos
- P2: Monedero y visualización de balance
- P3: Manejo de disputas y reembolsos

Usa TypeScript, Next.js App Router, y Supabase. Sigue las mejores prácticas de seguridad y manejo de errores.
```

---

## 🔗 Referencias

- Documento principal: `docs/BOOKFAST_STRIPE_ARCHITECTURE.md`
- Webhooks existentes: `docs/STRIPE_WEBHOOK_EVENTS.md`
- Implementación actual: `app/api/webhooks/stripe/route.ts`

---

**Nota:** Estos prompts están diseñados para ser usados uno por uno, en orden, para implementar el sistema de forma incremental y controlada.



