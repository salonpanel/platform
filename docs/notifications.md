# Sistema de Notificaciones - Documentación

**Fecha**: 2024-12-XX  
**Estado**: MVP lógico (simulación)

---

## 📋 Resumen

El sistema de notificaciones permite enviar confirmaciones de citas por SMS y/o Email a los clientes. Actualmente está implementado como MVP lógico que solo registra las notificaciones en logs.

---

## 🎯 Funcionalidad Actual (MVP)

### Envío de Confirmaciones

Cuando se crea o confirma una cita, se llama a `sendBookingConfirmation()` que:

1. **Simula el envío** de SMS y/o Email
2. **Registra en logs** (si la tabla `notification_logs` existe)
3. **No rompe el flujo** si hay errores (solo warnings en consola)

### Ejemplo de Uso

```typescript
import { sendBookingConfirmation } from '@/lib/notifications';

await sendBookingConfirmation(supabase, {
  bookingId: booking.id,
  customerName: booking.customer.name,
  customerEmail: booking.customer.email,
  customerPhone: booking.customer.phone,
  serviceName: booking.service.name,
  startsAt: booking.starts_at,
  endsAt: booking.ends_at,
  staffName: booking.staff.name,
  clientMessage: booking.client_message,
  tenantTimezone: tenant.timezone,
});
```

---

## 🔮 Integración con Proveedor Real

### SMS: Twilio

Para integrar Twilio:

1. **Instalar SDK**:
   ```bash
   npm install twilio
   ```

2. **Configurar variables de entorno**:
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

3. **Actualizar `lib/notifications.ts`**:
   ```typescript
   import twilio from 'twilio';

   const client = twilio(
     process.env.TWILIO_ACCOUNT_SID,
     process.env.TWILIO_AUTH_TOKEN
   );

   // En sendBookingConfirmation:
   if (data.customerPhone) {
     const result = await client.messages.create({
       body: fullMessage,
       from: process.env.TWILIO_PHONE_NUMBER,
       to: data.customerPhone,
     });
     
     logs.push({
       booking_id: data.bookingId,
       notification_type: 'sms',
       recipient: data.customerPhone,
       message: fullMessage,
       status: result.status === 'sent' ? 'sent' : 'failed',
       error: result.errorMessage,
     });
   }
   ```

### Email: SendGrid

Para integrar SendGrid:

1. **Instalar SDK**:
   ```bash
   npm install @sendgrid/mail
   ```

2. **Configurar variable de entorno**:
   ```env
   SENDGRID_API_KEY=your_api_key
   ```

3. **Actualizar `lib/notifications.ts`**:
   ```typescript
   import sgMail from '@sendgrid/mail';

   sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

   // En sendBookingConfirmation:
   if (data.customerEmail) {
     const msg = {
       to: data.customerEmail,
       from: 'noreply@tuempresa.com',
       subject: 'Confirmación de cita',
       text: fullMessage,
       html: `<p>${fullMessage.replace(/\n/g, '<br>')}</p>`,
     };
     
     try {
       await sgMail.send(msg);
       logs.push({
         booking_id: data.bookingId,
         notification_type: 'email',
         recipient: data.customerEmail,
         message: fullMessage,
         status: 'sent',
       });
     } catch (error: any) {
       logs.push({
         booking_id: data.bookingId,
         notification_type: 'email',
         recipient: data.customerEmail,
         message: fullMessage,
         status: 'failed',
         error: error.message,
       });
     }
   }
   ```

---

## 📊 Tabla de Logs (Opcional)

Si quieres persistir los logs, puedes crear la tabla `notification_logs`:

```sql
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('sms', 'email')),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notification_logs_booking ON public.notification_logs(booking_id);
CREATE INDEX idx_notification_logs_status ON public.notification_logs(status, created_at DESC);
```

---

## 🚀 Mejoras Futuras

- [ ] Integración real con Twilio (SMS)
- [ ] Integración real con SendGrid (Email)
- [ ] Plantillas HTML para emails
- [ ] Recordatorios automáticos (1 día antes, 1 hora antes)
- [ ] Notificaciones de cancelación
- [ ] Notificaciones de cambio de cita
- [ ] Cola de envío (para evitar sobrecarga)
- [ ] Reintentos automáticos en caso de fallo
- [ ] Dashboard de notificaciones enviadas

---

## 📝 Notas

- El sistema actual no rompe el flujo de creación de citas si falla el envío
- Los logs son opcionales y no críticos para el funcionamiento
- En producción, considerar implementar una cola de mensajes para envíos masivos
- Respetar normativas de protección de datos (GDPR) al enviar comunicaciones








