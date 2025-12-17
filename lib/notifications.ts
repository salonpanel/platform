/**
 * Utilidades para envío de notificaciones (SMS/Email)
 * 
 * MVP lógico: Por ahora solo registra las notificaciones en una tabla de logs.
 * En el futuro, aquí se integrará un proveedor real como Twilio (SMS) o SendGrid (Email).
 */

interface BookingConfirmationData {
  bookingId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  staffName: string;
  clientMessage?: string;
  tenantTimezone: string;
}

interface NotificationLog {
  booking_id: string;
  notification_type: 'sms' | 'email';
  recipient: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

/**
 * Envía confirmación de cita por SMS y/o Email
 * 
 * @param supabase - Cliente de Supabase
 * @param data - Datos de la cita para la confirmación
 * @returns Promise<void>
 * 
 * NOTA: Por ahora solo simula el envío y registra en notification_logs.
 * Para integrar un proveedor real:
 * 1. SMS: Integrar Twilio (https://www.twilio.com/docs/sms)
 * 2. Email: Integrar SendGrid (https://sendgrid.com/) o similar
 */
export async function sendBookingConfirmation(
  supabase: any,
  data: BookingConfirmationData
): Promise<void> {
  try {
    // Formatear fecha y hora según timezone del tenant
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    
    // Formatear para mostrar al cliente (en su timezone local o del tenant)
    const formattedDate = startsAt.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: data.tenantTimezone,
    });
    
    const formattedStartTime = startsAt.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: data.tenantTimezone,
    });
    
    const formattedEndTime = endsAt.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: data.tenantTimezone,
    });

    // Construir mensaje base
    const baseMessage = `Confirmación de cita:\n\n` +
      `Cliente: ${data.customerName}\n` +
      `Servicio: ${data.serviceName}\n` +
      `Fecha: ${formattedDate}\n` +
      `Hora: ${formattedStartTime} - ${formattedEndTime}\n` +
      `Barbero: ${data.staffName}`;

    // Añadir mensaje personalizado si existe
    const fullMessage = data.clientMessage
      ? `${baseMessage}\n\n${data.clientMessage}`
      : baseMessage;

    // Por ahora, solo registrar en logs (simulación)
    const logs: NotificationLog[] = [];

    // Si hay teléfono, simular envío SMS
    if (data.customerPhone) {
      console.log(`[SIMULACIÓN SMS] Enviando a ${data.customerPhone}:`, fullMessage);
      
      logs.push({
        booking_id: data.bookingId,
        notification_type: 'sms',
        recipient: data.customerPhone,
        message: fullMessage,
        status: 'sent', // En producción, esto vendría del proveedor
      });
    }

    // Si hay email, simular envío Email
    if (data.customerEmail) {
      console.log(`[SIMULACIÓN EMAIL] Enviando a ${data.customerEmail}:`, fullMessage);
      
      logs.push({
        booking_id: data.bookingId,
        notification_type: 'email',
        recipient: data.customerEmail,
        message: fullMessage,
        status: 'sent', // En producción, esto vendría del proveedor
      });
    }

    // Guardar logs en la tabla notification_logs (si existe)
    // Por ahora solo log en consola
    if (logs.length > 0) {
      try {
        // Intentar insertar en notification_logs si la tabla existe
        const { error } = await supabase
          .from('notification_logs')
          .insert(logs);
        
        if (error) {
          // Si la tabla no existe, solo hacer log (no crítico)
          console.warn('Error al guardar logs de notificación (no crítico):', error);
        }
      } catch (err) {
        // Si falla, no romper el flujo
        console.warn('Error al guardar logs de notificación (no crítico):', err);
      }
    }

    // TODO: Cuando se integre proveedor real:
    // 1. Llamar a la API del proveedor (Twilio/SendGrid)
    // 2. Esperar respuesta
    // 3. Actualizar status en notification_logs según resultado
    // 4. Manejar errores y reintentos si es necesario

  } catch (error) {
    console.error('Error al enviar confirmación de cita:', error);
    // No lanzar error para no romper el flujo de creación de cita
  }
}

/**
 * Formatea un mensaje de confirmación de cita personalizado
 * 
 * @param data - Datos de la cita
 * @returns Mensaje formateado
 */
export function formatBookingConfirmationMessage(data: BookingConfirmationData): string {
  const startsAt = new Date(data.startsAt);
  const formattedDate = startsAt.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: data.tenantTimezone,
  });
  
  const formattedStartTime = startsAt.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: data.tenantTimezone,
  });

  return `Hola ${data.customerName}, tu cita está confirmada:\n\n` +
    `📅 ${formattedDate}\n` +
    `🕐 ${formattedStartTime}\n` +
    `✂️ ${data.serviceName}\n` +
    `👤 ${data.staffName}` +
    (data.clientMessage ? `\n\n${data.clientMessage}` : '');
}








