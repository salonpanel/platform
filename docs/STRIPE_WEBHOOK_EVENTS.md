# Eventos de Stripe Webhooks - Configuración Completa

## Resumen

Este documento lista **todos los eventos de Stripe** que debes activar en tu configuración de webhooks para que tu plataforma BookFast funcione correctamente en todos los escenarios.

---

## 📋 Eventos por Categoría

### 1. **PAGOS DE PRODUCTOS/SERVICIOS** (Checkout y Payment Intents)

#### ✅ `checkout.session.completed`
**Estado actual**: ✅ Ya implementado  
**Cuándo se dispara**: Cuando un cliente completa un pago exitoso  
**Por qué lo necesitas**:
- Confirmar reservas después del pago
- Actualizar estado de `payment_intents` a `paid`
- Actualizar estado de `bookings` de `pending` a `paid`
- Procesar pagos de depósitos o pagos completos de servicios

**Implementación actual**: Ya manejado en `app/api/webhooks/stripe/route.ts`

---

#### ⚠️ `checkout.session.async_payment_succeeded`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un pago asíncrono (como transferencia bancaria) se completa exitosamente  
**Por qué lo necesitas**:
- Algunos métodos de pago (transferencias, giros postales) pueden tardar días
- Necesitas confirmar la reserva cuando el pago finalmente se complete
- Similar a `checkout.session.completed` pero para pagos asíncronos

**Acción requerida**: Implementar handler similar a `checkout.session.completed`

---

#### ⚠️ `checkout.session.async_payment_failed`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un pago asíncrono falla  
**Por qué lo necesitas**:
- Liberar el slot reservado si el pago falla
- Notificar al cliente que debe intentar otro método de pago
- Actualizar estado de `payment_intents` a `failed`

**Acción requerida**: Implementar handler para liberar reservas fallidas

---

#### ⚠️ `payment_intent.succeeded`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un PaymentIntent se completa exitosamente  
**Por qué lo necesitas**:
- Confirmar pagos que no pasan por Checkout Session
- Backup para confirmar pagos si `checkout.session.completed` falla
- Útil para pagos directos con Payment Intents API

**Acción requerida**: Implementar handler de respaldo para confirmar pagos

---

#### ⚠️ `payment_intent.payment_failed`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un PaymentIntent falla  
**Por qué lo necesitas**:
- Liberar slots reservados cuando el pago falla
- Actualizar estado de `payment_intents` a `failed`
- Notificar al cliente sobre el fallo

**Acción requerida**: Implementar handler para manejar fallos de pago

---

#### ⚠️ `payment_intent.canceled`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un PaymentIntent se cancela  
**Por qué lo necesitas**:
- Liberar reservas cuando el cliente cancela antes de pagar
- Actualizar estado de `payment_intents` a `cancelled`
- Limpiar recursos asociados

**Acción requerida**: Implementar handler para cancelaciones

---

### 2. **REEMBOLSOS Y CANCELACIONES**

#### ⚠️ `charge.refunded`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se procesa un reembolso completo o parcial  
**Por qué lo necesitas**:
- Cuando una barbería cancela una cita pagada, necesitas reembolsar
- Actualizar estado de bookings a `cancelled` y registrar el reembolso
- Mantener historial de reembolsos para contabilidad
- Manejar políticas de cancelación (reembolso completo/parcial según horas de antelación)

**Acción requerida**: Implementar handler para procesar reembolsos

---

#### ⚠️ `charge.refund.updated`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se actualiza el estado de un reembolso  
**Por qué lo necesitas**:
- Reembolsos pueden fallar (tarjeta cancelada, cuenta cerrada, etc.)
- Necesitas saber si el reembolso se completó o falló
- Actualizar el estado en tu base de datos

**Acción requerida**: Implementar handler para actualizar estado de reembolsos

---

### 3. **SUSCRIPCIONES DE BARBERÍAS A LA PLATAFORMA**

#### ⚠️ `customer.subscription.created`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando una barbería se suscribe a tu plataforma  
**Por qué lo necesitas**:
- Activar acceso a la plataforma cuando una barbería se suscribe
- Crear registro de suscripción en tu base de datos
- Asignar plan y features según el plan contratado
- Habilitar funcionalidades premium

**Acción requerida**: Implementar sistema de suscripciones para tenants

---

#### ⚠️ `customer.subscription.updated`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando una suscripción se actualiza (cambio de plan, pausa, reactivación)  
**Por qué lo necesitas**:
- Actualizar features cuando cambian de plan (básico → premium)
- Manejar upgrades/downgrades
- Pausar o reactivar acceso según el estado de la suscripción
- Actualizar límites (número de staff, servicios, etc.)

**Acción requerida**: Implementar handler para actualizar planes y features

---

#### ⚠️ `customer.subscription.deleted`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando una suscripción se cancela  
**Por qué lo necesitas**:
- Desactivar acceso a la plataforma
- Mantener datos pero limitar funcionalidades
- Ofrecer período de gracia antes de eliminar datos
- Enviar notificaciones de cancelación

**Acción requerida**: Implementar lógica de desactivación de tenants

---

#### ⚠️ `customer.subscription.trial_will_end`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: 3 días antes de que termine el período de prueba  
**Por qué lo necesitas**:
- Enviar recordatorios a barberías en período de prueba
- Ofrecer descuentos para conversión
- Notificar que deben agregar método de pago

**Acción requerida**: Implementar sistema de notificaciones

---

#### ⚠️ `invoice.payment_succeeded`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se paga exitosamente una factura de suscripción  
**Por qué lo necesitas**:
- Confirmar que la suscripción está activa
- Renovar acceso cuando se paga la factura mensual
- Actualizar fecha de próxima facturación
- Mantener suscripción activa

**Acción requerida**: Implementar handler para renovaciones de suscripción

---

#### ⚠️ `invoice.payment_failed`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando falla el pago de una factura de suscripción  
**Por qué lo necesitas**:
- Notificar a la barbería que el pago falló
- Ofrecer período de gracia antes de desactivar
- Intentar cobro automático (Stripe lo hace 3 veces)
- Desactivar acceso si falla definitivamente

**Acción requerida**: Implementar lógica de manejo de pagos fallidos

---

#### ⚠️ `invoice.upcoming`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: 7 días antes de que se genere una factura  
**Por qué lo necesitas**:
- Enviar recordatorios de pago próximo
- Verificar que el método de pago sigue siendo válido
- Preparar facturación

**Acción requerida**: Implementar sistema de notificaciones proactivas

---

### 4. **SUSCRIPCIONES DE CLIENTES A BARBERÍAS**

#### ⚠️ `customer.subscription.created` (para clientes)
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un cliente se suscribe a una barbería (plan mensual, membresía, etc.)  
**Por qué lo necesitas**:
- Activar beneficios de membresía (descuentos, acceso prioritario)
- Crear registro de suscripción cliente-barbería
- Gestionar planes de membresía de clientes

**Acción requerida**: Implementar sistema de suscripciones cliente-barbería

---

#### ⚠️ `customer.subscription.updated` (para clientes)
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un cliente cambia su plan de membresía  
**Por qué lo necesitas**:
- Actualizar beneficios según el plan
- Manejar upgrades/downgrades de membresías

**Acción requerida**: Implementar handler para actualizar membresías de clientes

---

#### ⚠️ `customer.subscription.deleted` (para clientes)
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un cliente cancela su membresía  
**Por qué lo necesitas**:
- Desactivar beneficios de membresía
- Mantener historial pero sin acceso a descuentos

**Acción requerida**: Implementar handler para cancelar membresías

---

### 5. **PRODUCTOS Y PRECIOS (Sincronización)**

#### ⚠️ `product.created`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se crea un producto en Stripe (desde tu dashboard o API)  
**Por qué lo necesitas**:
- Sincronizar productos creados directamente en Stripe con tu base de datos
- Mantener consistencia entre Stripe y tu plataforma
- Detectar productos creados fuera de tu sistema

**Acción requerida**: Implementar sincronización bidireccional (opcional, pero recomendado)

---

#### ⚠️ `product.updated`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se actualiza un producto en Stripe  
**Por qué lo necesitas**:
- Sincronizar cambios de nombre, descripción, etc.
- Mantener datos actualizados

**Acción requerida**: Implementar sincronización bidireccional (opcional)

---

#### ⚠️ `product.deleted`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se elimina un producto en Stripe  
**Por qué lo necesitas**:
- Desactivar servicios asociados en tu plataforma
- Prevenir que se vendan productos eliminados

**Acción requerida**: Implementar handler para desactivar servicios

---

#### ⚠️ `price.created`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se crea un precio en Stripe  
**Por qué lo necesitas**:
- Sincronizar nuevos precios con servicios
- Detectar cambios de precio fuera de tu sistema

**Acción requerida**: Implementar sincronización de precios (opcional)

---

#### ⚠️ `price.updated`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se actualiza un precio en Stripe  
**Por qué lo necesitas**:
- Actualizar precios de servicios cuando cambian en Stripe
- Mantener consistencia

**Acción requerida**: Implementar sincronización de precios (opcional)

---

### 6. **DISPUTAS Y CHARGEBACKS**

#### ⚠️ `charge.dispute.created`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando un cliente inicia una disputa/chargeback  
**Por qué lo necesitas**:
- Notificar a la barbería sobre la disputa
- Bloquear acceso a servicios si es necesario
- Preparar documentación para la disputa
- **Crítico**: Las disputas afectan tu cuenta de Stripe

**Acción requerida**: Implementar sistema de alertas y manejo de disputas

---

#### ⚠️ `charge.dispute.updated`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se actualiza el estado de una disputa  
**Por qué lo necesitas**:
- Saber si la disputa se resolvió a tu favor o en contra
- Actualizar estado de bookings según resultado
- Liberar o mantener bloqueos según resultado

**Acción requerida**: Implementar handler para actualizar estado de disputas

---

#### ⚠️ `charge.dispute.closed`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando una disputa se cierra  
**Por qué lo necesitas**:
- Registrar resultado final
- Actualizar historial de disputas
- Aplicar acciones finales según resultado

**Acción requerida**: Implementar handler para cerrar disputas

---

### 7. **CLIENTES (Customers)**

#### ⚠️ `customer.created`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se crea un cliente en Stripe  
**Por qué lo necesitas**:
- Sincronizar clientes creados en Stripe con tu base de datos
- Mantener consistencia entre sistemas
- Útil si creas clientes directamente en Stripe

**Acción requerida**: Implementar sincronización de clientes (opcional)

---

#### ⚠️ `customer.updated`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se actualiza un cliente en Stripe  
**Por qué lo necesitas**:
- Sincronizar cambios de email, nombre, etc.
- Mantener datos actualizados

**Acción requerida**: Implementar sincronización de clientes (opcional)

---

#### ⚠️ `customer.deleted`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se elimina un cliente en Stripe  
**Por qué lo necesitas**:
- Limpiar referencias en tu base de datos
- Mantener consistencia

**Acción requerida**: Implementar handler para limpiar clientes eliminados

---

### 8. **MÉTODOS DE PAGO**

#### ⚠️ `payment_method.attached`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se agrega un método de pago a un cliente  
**Por qué lo necesitas**:
- Guardar métodos de pago para pagos futuros
- Permitir pagos rápidos sin reingresar tarjeta
- Mejorar UX de checkout

**Acción requerida**: Implementar guardado de métodos de pago (opcional, pero mejora UX)

---

#### ⚠️ `payment_method.detached`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se elimina un método de pago  
**Por qué lo necesitas**:
- Limpiar métodos de pago guardados
- Mantener datos actualizados

**Acción requerida**: Implementar limpieza de métodos de pago (opcional)

---

### 9. **TRANSFERENCIAS Y CONNECT (Si usas Stripe Connect)**

Si en el futuro implementas Stripe Connect (para que las barberías reciban pagos directamente):

#### ⚠️ `transfer.created`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se crea una transferencia a una cuenta conectada  
**Por qué lo necesitas**:
- Registrar transferencias a barberías
- Mantener historial de pagos

---

#### ⚠️ `transfer.updated`
**Estado actual**: ❌ No implementado  
**Cuándo se dispara**: Cuando se actualiza una transferencia  
**Por qué lo necesitas**:
- Actualizar estado de transferencias
- Manejar reversiones

---

## 📊 Resumen de Eventos por Prioridad

### 🔴 **CRÍTICOS** (Activar inmediatamente)
1. ✅ `checkout.session.completed` - **Ya implementado**
2. ⚠️ `payment_intent.succeeded` - Backup para confirmar pagos
3. ⚠️ `payment_intent.payment_failed` - Manejar fallos de pago
4. ⚠️ `charge.refunded` - Reembolsos cuando se cancelan citas
5. ⚠️ `customer.subscription.created` - Suscripciones de barberías
6. ⚠️ `customer.subscription.updated` - Cambios de plan
7. ⚠️ `customer.subscription.deleted` - Cancelaciones de suscripción
8. ⚠️ `invoice.payment_succeeded` - Renovaciones mensuales
9. ⚠️ `invoice.payment_failed` - Pagos fallidos de suscripción
10. ⚠️ `charge.dispute.created` - Disputas/chargebacks

### 🟡 **IMPORTANTES** (Activar pronto)
11. ⚠️ `checkout.session.async_payment_succeeded` - Pagos asíncronos exitosos
12. ⚠️ `checkout.session.async_payment_failed` - Pagos asíncronos fallidos
13. ⚠️ `payment_intent.canceled` - Cancelaciones de pago
14. ⚠️ `charge.refund.updated` - Estado de reembolsos
15. ⚠️ `customer.subscription.trial_will_end` - Fin de período de prueba
16. ⚠️ `invoice.upcoming` - Recordatorios de facturación

### 🟢 **OPCIONALES** (Activar según necesidad)
17. ⚠️ `product.created/updated/deleted` - Sincronización bidireccional
18. ⚠️ `price.created/updated` - Sincronización de precios
19. ⚠️ `customer.created/updated/deleted` - Sincronización de clientes
20. ⚠️ `payment_method.attached/detached` - Métodos de pago guardados
21. ⚠️ `charge.dispute.updated/closed` - Actualizaciones de disputas

---

## 🚀 Pasos para Configurar

1. **Ir a Stripe Dashboard** → Developers → Webhooks
2. **Crear nuevo endpoint** o editar el existente
3. **URL del endpoint**: `https://tu-dominio.com/api/webhooks/stripe`
4. **Seleccionar eventos** según la lista de arriba
5. **Copiar el Webhook Secret** y agregarlo a `STRIPE_WEBHOOK_SECRET` en tu `.env`
6. **Probar con eventos de prueba** desde Stripe Dashboard

---

## ⚠️ Notas Importantes

1. **Idempotencia**: Tu código ya maneja eventos duplicados con `stripe_events_processed`. ✅
2. **Seguridad**: Siempre verifica la firma del webhook con `STRIPE_WEBHOOK_SECRET`. ✅
3. **Logging**: Mantén logs mínimos sin PII (ya implementado). ✅
4. **Testing**: Usa el modo test de Stripe para probar todos los eventos antes de producción.
5. **Rate Limiting**: Stripe puede enviar muchos eventos. Asegúrate de que tu servidor pueda manejarlos.

---

## 📝 Próximos Pasos de Implementación

1. **Implementar handlers para eventos críticos** (reembolsos, suscripciones, disputas)
2. **Crear tablas en BD** para suscripciones de tenants y clientes
3. **Implementar lógica de planes y features** según suscripción
4. **Crear sistema de notificaciones** para eventos importantes
5. **Implementar sincronización bidireccional** (opcional pero recomendado)

---

## 🔗 Referencias

- [Documentación oficial de Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Lista completa de eventos de Stripe](https://stripe.com/docs/api/events/types)
- [Mejores prácticas de webhooks](https://stripe.com/docs/webhooks/best-practices)




