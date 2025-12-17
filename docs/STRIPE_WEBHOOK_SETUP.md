# Configuración de Webhooks de Stripe

## ✅ Implementación Completada

El sistema de webhooks de Stripe ha sido refactorizado con una arquitectura modular y robusta.

### Estructura Modular

```
src/lib/
├── stripe.ts                    # Cliente Stripe inicializado
└── stripe-handlers/
    ├── index.ts                 # Dispatcher principal
    ├── types.ts                 # Tipos TypeScript
    ├── checkout.ts              # checkout.session.completed
    ├── payment-intents.ts       # payment_intent.succeeded, payment_intent.payment_failed
    ├── charges.ts               # charge.succeeded, charge.refunded
    ├── balance.ts               # balance.available (Stripe Connect)
    ├── payouts.ts               # payout.paid, payout.failed
    └── disputes.ts              # charge.dispute.created, charge.dispute.closed
```

### Endpoint Principal

- **Ruta**: `/api/webhooks/stripe`
- **Método**: `POST`
- **Validación**: Firma de webhook con `STRIPE_WEBHOOK_SECRET`
- **Idempotencia**: Tabla `stripe_events_processed`
- **Soporte**: Stripe Connect Standard (Accounts v1)

## 🔧 Configuración

### Variables de Entorno

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_IumW21gqZsqahT0zvkQuQoxFeNuuJfSx
```

### Webhook URL en Stripe Dashboard

```
https://pro.bookfast.es/api/webhooks/stripe
```

## 📋 Eventos Soportados

### Pagos
- ✅ `checkout.session.completed` → Crea/actualiza booking + payment record
- ✅ `payment_intent.succeeded` → Marca booking como pagado
- ✅ `payment_intent.payment_failed` → Actualiza booking como fallido
- ✅ `charge.succeeded` → Crea movimiento en payments table
- ✅ `charge.refunded` → Marca payment como reembolsado

### Stripe Connect
- ✅ `balance.available` → Actualiza balance_status a "available"
- ✅ `payout.paid` → Registra movimiento de payout
- ✅ `payout.failed` → Registra error de payout

### Disputas
- ✅ `charge.dispute.created` → Marca payment como disputado
- ✅ `charge.dispute.closed` → Resuelve disputa según resultado

## 🧪 Instrucciones de Prueba

### 1. Configurar Webhook en Stripe Dashboard

1. Ve a [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
2. Click en "Add endpoint"
3. URL: `https://pro.bookfast.es/api/webhooks/stripe`
4. Selecciona los eventos soportados (ver lista arriba)
5. Copia el **Signing secret** y agrégalo a `STRIPE_WEBHOOK_SECRET`

### 2. Probar Eventos desde Stripe Dashboard

1. Ve a **Developers > Webhooks** en Stripe Dashboard
2. Selecciona tu endpoint
3. Click en **"Send test webhook"**
4. Selecciona un evento de la lista (ej: `checkout.session.completed`)
5. Verifica en los logs de Vercel que el evento se procesó correctamente

### 3. Verificar en Base de Datos

```sql
-- Ver eventos procesados
SELECT * FROM stripe_events_processed 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver pagos creados
SELECT * FROM payments 
ORDER BY created_at DESC 
LIMIT 10;
```

### 4. Probar con Checkout Real

1. Crear un servicio en BookFast
2. Hacer una reserva desde el frontend
3. Completar el pago con tarjeta de prueba: `4242 4242 4242 4242`
4. Verificar que:
   - Se creó el registro en `payments`
   - El `booking` se marcó como `paid`
   - El evento aparece en `stripe_events_processed`

## 🔍 Logging

El sistema registra eventos de forma segura (sin PII):

- `stripe:duplicate` - Evento ya procesado (idempotencia)
- `stripe:processed` - Evento procesado exitosamente
- `stripe:handler_error` - Error en handler
- `stripe:unsupported_event` - Evento no soportado (se ignora)
- `stripe:signature_invalid` - Firma inválida

## ⚠️ Notas Importantes

1. **Siempre retorna 200**: Incluso si hay errores, el endpoint retorna 200 para evitar reintentos de Stripe
2. **Idempotencia**: Los eventos se registran antes de procesar para evitar duplicados
3. **Stripe Connect**: El sistema detecta automáticamente si el evento viene de una cuenta conectada
4. **Sin PII en logs**: Los logs no incluyen información sensible (emails, payment IDs completos, etc.)

## 🚀 Próximos Pasos

Para probar en producción:

1. Cambiar `STRIPE_WEBHOOK_SECRET` a la clave de producción
2. Configurar webhook en Stripe Dashboard (modo Live)
3. Verificar que los eventos se procesan correctamente
4. Monitorear logs en Vercel

---

**Última actualización**: 2024
**Versión**: 2.0.0 (Arquitectura Modular)



