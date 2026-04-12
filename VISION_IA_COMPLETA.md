# 🤖 VISIÓN IA — BookFast Pro
## "La primera plataforma de barberías con IA real en el núcleo"

---

## LOS TRES MUNDOS DEL PRODUCTO

```
┌─────────────────────────────────────────────────────────┐
│  bookfast.es          → Landing comercial               │
│  (página de ventas, precios, casos de éxito)            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  pro.bookfast.es      → Panel de Profesionales          │
│  (la barbería gestiona todo desde aquí)                 │
│                                                         │
│  + IA integrada para el barbero y el dueño              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  admin.bookfast.es    → Panel de BookFast               │
│  (nosotros gestionamos todos los tenants)               │
│                                                         │
│  + IA para gestión de la plataforma                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  {barberia}.bookfast.es → Portal Público                │
│  (el cliente final reserva aquí)                        │
│                                                         │
│  + Chatbot IA para reservar por conversación            │
└─────────────────────────────────────────────────────────┘
```

---

## CAPAS DE IA EN EL PRODUCTO

### 🧠 Capa 1 — Asistente del Barbero (pro.bookfast.es)
El barbero/dueño tiene un asistente siempre disponible en el panel.

**Casos de uso:**
- "¿Cuándo tengo el próximo hueco libre para un corte de 45 min?"
- "¿Qué días de la semana que viene están más libres?"
- "Redacta un mensaje de recordatorio para mis clientes de mañana"
- "¿Cuál es el servicio que más ingresos me ha dado este mes?"
- "¿Tengo algún cliente que lleva más de 2 meses sin venir?"
- "Crea una oferta para el próximo jueves que está flojo"

**Tecnología:** Claude API (Anthropic) con contexto del tenant (agenda, clientes, métricas)

---

### 📊 Capa 2 — Predicciones e Insights
La IA analiza los datos históricos para predecir y recomendar.

**Casos de uso:**
- **Predicción de demanda**: "El próximo viernes se prevé alta demanda basado en el patrón de las últimas 8 semanas"
- **Detección de clientes en riesgo**: "Carlos Martínez no viene desde hace 73 días — patrón de abandono"
- **Optimización de agenda**: "Activar descuento del 20% en martes y miércoles que están al 40% de ocupación"
- **Previsión de ingresos**: "A este ritmo, cerrarás el mes con ~€3.200 (vs €2.800 el mes pasado)"
- **Staffing inteligente**: "Los viernes de 17:00 a 20:00 hay lista de espera — considera añadir un barbero"

**Tecnología:** Análisis en Supabase (funciones SQL + materialized views) + Claude para narrativa

---

### 💬 Capa 3 — Comunicación IA con el Cliente
La IA gestiona la relación con el cliente de forma automatizada.

**A. Recordatorios inteligentes (ya tenemos base con Resend):**
- Recordatorio 24h antes personalizado: *"Hola Carlos, mañana tienes tu corte con Paco a las 11:00h en Barbería Roma. ¿Confirmas?"*
- Seguimiento post-visita: *"¿Cómo quedaste con el corte? Deja tu valoración y llévate un 10% de descuento"*
- Reactivación: *"¡Te echamos de menos! Han pasado 2 meses. Reserva esta semana y tienes 15% de dto"*

**B. Chatbot de reservas (portal público {barberia}.bookfast.es):**
En lugar del formulario tradicional, el cliente puede reservar por conversación:
- *"Quiero cortarme el pelo este sábado"*
- IA: *"¡Perfecto! El sábado tienes disponibilidad con Paco a las 10:00, 11:30 y 16:00. ¿Cuál te va mejor?"*
- *"Las 11:30 con Paco"*
- IA: *"Reservado ✅ Te confirmo: sábado 19 de abril a las 11:30 con Paco. Corte clásico - 18€. Te llega confirmación por email."*

**C. Integración WhatsApp Business (fase avanzada):**
- El cliente escribe al WhatsApp de la barbería
- La IA responde, gestiona la reserva, envía recordatorios
- El barbero solo interviene si la IA no puede resolver

**Tecnología:** Claude API + Twilio WhatsApp API + Supabase para contexto

---

### 🎛️ Capa 4 — Admin IA (admin.bookfast.es)
Nosotros gestionamos cientos de barberías con ayuda de IA.

**Casos de uso:**
- "¿Qué tenants llevan más de 7 días sin abrir el panel?" → lista de en riesgo de churn
- "Genera el informe mensual de la plataforma"
- "¿Qué barbería tiene la peor tasa de no-shows este mes?"
- "Envía un email a todos los tenants del plan Starter que llevan más de 3 meses activos"
- **Onboarding automático**: cuando se da de alta una barbería, la IA le guía paso a paso

---

## STACK TECNOLÓGICO IA

```
Claude API (Anthropic)     → Razonamiento, generación de texto, análisis
Vercel AI SDK              → Streaming de respuestas en Next.js
Supabase (context)         → Datos en tiempo real del tenant
Resend                     → Emails automatizados
Twilio                     → SMS + WhatsApp Business (fase avanzada)
Upstash                    → Rate limiting de llamadas IA
```

---

## ORDEN DE IMPLEMENTACIÓN IA

```
FASE 0 (base técnica):
  → API route /api/ai/chat con Claude
  → Sistema de contexto: qué datos del tenant le pasamos a la IA
  → Rate limiting para evitar costes descontrolados

FASE 1 (quick wins):
  → Asistente del barbero (chat flotante en el panel)
  → Redacción automática de mensajes de recordatorio
  → Insights automáticos en el Dashboard

FASE 2 (diferenciación):
  → Chatbot de reservas en portal público
  → Predicción de demanda semanal
  → Detección de clientes en riesgo

FASE 3 (automatización completa):
  → WhatsApp Business integration
  → Onboarding IA para nuevas barberías
  → Admin IA para gestión de plataforma
```

---

## ORDEN GLOBAL DE CONSTRUCCIÓN

La IA necesita datos para ser útil. Por eso el orden es:
1. Construir el producto base completo (secciones 1-9 del panel)
2. Añadir IA sobre la base de datos real
3. Expandir la IA a más puntos de contacto

Sin embargo, el **Asistente del Barbero** y la **redacción de mensajes** se pueden añadir 
desde el primer día sin necesidad de datos históricos.

---

*Visión establecida: Abril 2026*
