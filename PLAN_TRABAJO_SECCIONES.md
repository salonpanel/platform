# 🗺️ PLAN DE TRABAJO — BookFast Pro
## Orden lógico por dependencias · Diseño Apple · Tecnología punta

---

## Por qué este orden

```
Ajustes ──► Servicios ──► Staff ──► AGENDA (corazón)
                                        │
                         ┌──────────────┘
                         ▼
                     Clientes ──► Dashboard ──► Monedero ──► Marketing
                                                                  │
                                                               Chat (independiente)
```

**Ajustes** define zona horaria, horarios y branding → todo lo demás los necesita.  
**Servicios** define qué se ofrece → Staff y Agenda los necesitan.  
**Staff** define quién trabaja + su agenda semanal → La Agenda los necesita.  
**Agenda** es el corazón → genera los bookings que alimentan Dashboard, Clientes, Monedero, Marketing.

---

## SECCIÓN 1 — AJUSTES ⚙️
> "La barbería bien configurada antes de abrir"

### Estado actual: 🟡 70% (funciona pero incompleto)
- ✅ Nombre del negocio, timezone, color de marca
- ✅ Email y teléfono de contacto
- ✅ Stripe Connect básico
- ❌ Horarios de apertura por día (lunes-domingo) con horas de inicio/fin
- ❌ Días festivos / excepciones de calendario
- ❌ Duración mínima de slot (15/30/45/60 min)
- ❌ Tiempo de buffer entre citas (0/5/10/15 min)
- ❌ Política de cancelación (horas mínimas, % de penalización)
- ❌ Política de no-show (cobro automático sí/no)
- ❌ Logo del negocio (subir imagen)
- ❌ Dirección física + enlace Google Maps
- ❌ Configuración de notificaciones (qué emails enviar y cuándo)
- ❌ Idioma y moneda

### Target: ✅ 100% completo y listo para configurar cualquier barbería española

---

## SECCIÓN 2 — SERVICIOS ✂️
> "El catálogo que el cliente ve y el barbero ejecuta"

### Estado actual: 🟡 75%
- ✅ CRUD completo (crear/editar/eliminar servicios)
- ✅ Nombre, duración, precio, estado activo/inactivo
- ✅ Vista en tarjetas
- ❌ Categorías de servicios (Corte, Color, Tratamiento, Afeitado...)
- ❌ Imagen o icono por servicio
- ❌ Descripción larga para el portal de reservas
- ❌ Precio variable por barbero (el mismo servicio puede costar distinto según barbero)
- ❌ Servicio "online" vs "solo en persona"
- ❌ Orden personalizable (drag para reordenar en el portal)
- ❌ Sincronización automática con Stripe Products

### Target: ✅ Catálogo visual atractivo, con categorías y precios por barbero

---

## SECCIÓN 3 — STAFF (BARBEROS) 💈
> "El equipo que hace que todo funcione"

### Estado actual: 🟡 65%
- ✅ Lista de barberos con foto, nombre, estado activo/inactivo
- ✅ Asignación de servicios que puede realizar cada barbero
- ✅ Modal de edición básico
- ❌ Horario semanal por barbero (qué días y horas trabaja cada uno)
- ❌ Color de barbero en la agenda (personalizable)
- ❌ Foto de perfil (subir imagen)
- ❌ Días libres / vacaciones individuales
- ❌ Tiempo de descanso (comida, pausa)
- ❌ Métricas del barbero (citas del mes, ingresos generados, ocupación %)
- ❌ Invitar al barbero por email para que acceda al panel
- ❌ Historial de citas del barbero

### Target: ✅ Ficha completa por barbero, con horario semanal y métricas

---

## SECCIÓN 4 — AGENDA 📅 ← EL CORAZÓN
> "La herramienta que el barbero usa 8 horas al día"

### Estado actual: 🟠 50% (funciona básicamente, le falta mucho)
- ✅ Vista día con columnas por barbero
- ✅ Carga de bookings del día
- ✅ Colores por estado (confirmado/pendiente/cancelado)
- ✅ Modal básico de detalle de cita
- ❌ Click en slot vacío → opciones (nueva cita / bloquear tiempo / marcar ausencia)
- ❌ Staff blockings visuales (bloques grises/rayados en agenda)
- ❌ Drag & drop para mover citas
- ❌ Resize de citas (cambiar duración arrastrando borde)
- ❌ Vista semana (con misma UX que vista día)
- ❌ Vista mes (resumen de ocupación)
- ❌ Indicador de hora actual (línea roja)
- ❌ Creación rápida de cita desde la agenda
- ❌ Búsqueda de cliente al crear cita (autocomplete)
- ❌ Multi-servicio en una cita
- ❌ Solapamiento visual cuando hay 2 citas al mismo tiempo
- ❌ Notificaciones en tiempo real (nueva cita entra → badge en agenda)
- ❌ Imprimir/exportar agenda del día

### Target: ✅ Agenda al nivel de Booksy Pro — intuitiva, fluida, sin fricciones

---

## SECCIÓN 5 — CLIENTES 👥
> "Conocer a quien viene y fidelizarlo"

### Estado actual: 🟡 70%
- ✅ Lista de clientes con búsqueda
- ✅ Ficha individual (próximas + pasadas citas)
- ✅ Crear/editar cliente
- ✅ Exportar a CSV
- ❌ Historial completo de citas con detalles
- ❌ Total gastado por cliente
- ❌ Número de visitas y fecha de última visita
- ❌ Notas internas del barbero sobre el cliente
- ❌ Etiquetas / tags (VIP, cliente problemático, etc.)
- ❌ Foto de perfil del cliente
- ❌ Badge de "cliente frecuente" / "nuevo" / "inactivo"
- ❌ Crear cita directamente desde la ficha del cliente
- ❌ Historial de pagos del cliente

### Target: ✅ CRM ligero al nivel de un barbershop profesional

---

## SECCIÓN 6 — DASHBOARD 📊
> "El resumen del día que el dueño ve al llegar"

### Estado actual: 🟠 55%
- ✅ KPIs básicos (citas hoy, clientes activos, servicios)
- ✅ Próximas citas del día
- ❌ Ingresos del día / semana / mes (datos reales de Stripe)
- ❌ Ocupación % por barbero hoy
- ❌ Gráfico de ingresos últimos 30 días
- ❌ Top 3 servicios más solicitados del mes
- ❌ Top barbero del mes (por ingresos y por nº citas)
- ❌ Citas pendientes de confirmación (requieren acción)
- ❌ Clientes nuevos esta semana
- ❌ Tasa de cancelación / no-show del mes

### Target: ✅ Dashboard ejecutivo que de un vistazo dice todo lo que importa

---

## SECCIÓN 7 — MONEDERO 💳
> "Las finanzas del negocio en tiempo real"

### Estado actual: 🟡 70%
- ✅ Balance disponible en Stripe
- ✅ Lista de transacciones
- ✅ Historial de payouts (transferencias a cuenta bancaria)
- ❌ Solicitar payout manual
- ❌ Filtros por fecha, tipo, estado
- ❌ Resumen mensual de ingresos
- ❌ Desglose por servicio/barbero
- ❌ Comisión de plataforma visible (lo que se queda BookFast)
- ❌ Exportar extracto en PDF

### Target: ✅ Vista financiera clara, como la de Stripe pero adaptada a barbería

---

## SECCIÓN 8 — MARKETING 📣
> "Traer clientes que no vienen y fidelizar los que sí"

### Estado actual: 🔴 20% (solo UI placeholder con datos falsos)
- ❌ Lista de clientes inactivos (sin cita en +60/90 días)
- ❌ Crear campaña de email (asunto + mensaje)
- ❌ Enviar campaña a segmento de clientes
- ❌ Estadísticas de campaña (enviados, abiertos)
- ❌ Plantillas de mensaje predefinidas
- ❌ Programa de fidelización (puntos por visita)
- ❌ Recordatorios automáticos (24h antes de la cita)
- ❌ Email post-visita pidiendo valoración

### Target: ✅ Herramienta de retención básica funcional

---

## SECCIÓN 9 — CHAT 💬
> "El equipo coordinado sin salir de la plataforma"

### Estado actual: 🟢 80%
- ✅ Conversaciones 1:1 y grupales
- ✅ Mensajes en tiempo real
- ✅ Lista de miembros del equipo
- ❌ Notificaciones push en el navegador
- ❌ Indicador de "en línea"
- ❌ Reacciones a mensajes (👍)
- ❌ Compartir cita desde agenda al chat

### Target: ✅ Canal de comunicación interna fiable

---

## CRONOGRAMA DE TRABAJO

| Semana | Sección | Objetivo |
|--------|---------|----------|
| 1 | Ajustes + Servicios | Configuración completa del negocio |
| 2 | Staff | Horario semanal + métricas por barbero |
| 3-4 | Agenda (parte 1) | Crear/editar/mover citas, blockings |
| 5-6 | Agenda (parte 2) | Vista semana, drag&drop, notificaciones |
| 7 | Clientes | CRM completo |
| 8 | Dashboard | KPIs reales |
| 9 | Monedero | Exportación + desglose |
| 10 | Marketing | Campañas reales |
| 11 | Chat | Polish + notificaciones |
| 12 | QA + Portal reservas | Pulido final |

---

## PRINCIPIOS DE DISEÑO (Apple-style)

1. **Simplicidad sobre funcionalidad aparente** — Cada pantalla tiene un objetivo claro
2. **Cero fricciones** — Ninguna acción requiere más de 3 clics
3. **Whitespace generoso** — Respiro visual en cada elemento
4. **Tipografía clara** — Jerarquía de texto: título / subtítulo / dato / etiqueta
5. **Feedback instantáneo** — Cada acción responde visualmente en <200ms
6. **Estados bien definidos** — Loading, empty, error, success: todos diseñados
7. **Mobile-first** — Funciona igual de bien en iPhone que en iMac
8. **Color semántico** — Verde = bien, rojo = problema, azul = acción, gris = neutro

---

*Iniciado: Abril 2026*
