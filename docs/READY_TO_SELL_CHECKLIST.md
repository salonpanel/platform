# ✅ Checklist: Ready to Sell

Este documento define los criterios que debe cumplir la plataforma PIA para considerarse "lista para vender" (Ready to Sell).

---

## 🔒 Seguridad

### RLS (Row Level Security)
- [x] Todas las tablas tienen políticas RLS activas
- [x] Los usuarios solo pueden acceder a datos de su tenant
- [x] `payment_intents` solo puede ser creado/actualizado por `service_role`
- [x] Los usuarios normales solo pueden leer `payment_intents` de su tenant
- [x] Funciones helper (`current_tenant_id()`, `user_has_role()`) funcionan correctamente

### Autenticación y Autorización
- [x] Magic Link funciona correctamente
- [x] Roles de tenant (`owner`, `admin`, `manager`, `staff`, `viewer`) están implementados
- [x] Roles de plataforma (`admin`, `support`, `viewer`) están implementados
- [x] Impersonación funciona con logs de auditoría
- [x] Los endpoints de admin verifican permisos antes de ejecutar acciones

### Logs y Auditoría
- [x] `platform.audit_logs` registra cambios importantes
- [x] `platform.impersonations` registra todas las impersonaciones
- [x] `auth_logs` registra intentos de login
- [x] Los logs incluyen IP, user agent y timestamp

### Protección de Endpoints
- [x] Endpoints de cron requieren `INTERNAL_CRON_KEY`
- [x] Endpoints de admin verifican rol de platform admin
- [x] Endpoints de API validan tenant_id y permisos
- [x] Rate limiting implementado donde es necesario

---

## 📊 Escalabilidad

### Base de Datos
- [x] Índices en columnas críticas (`tenant_id`, `user_id`, `created_at`)
- [x] Foreign keys con `on delete cascade` donde corresponde
- [x] Funciones RPC optimizadas (`calculate_org_metrics_daily`)
- [x] Tabla `org_metrics_daily` para métricas agregadas

### Cron Jobs
- [x] Cron job para liberar holds expirados (cada 5 minutos)
- [x] Cron job para calcular métricas diarias (diario a las 2 AM UTC)
- [x] Configuración documentada en `docs/CRON_JOBS.md`
- [x] Endpoints protegidos con `INTERNAL_CRON_KEY`

### Health Checks
- [x] `/api/health` verifica estado de DB y Stripe
- [x] `/api/health/db` verifica conexión a Supabase
- [x] `/api/health/payments` verifica conexión a Stripe
- [x] Respuestas incluyen tiempos de respuesta y errores

### Métricas
- [x] `org_metrics_daily` calcula métricas diarias por tenant
- [x] KPIs simplificados (sin duplicados)
- [x] Métricas incluyen: bookings, ingresos, ocupación, servicios, staff
- [x] Función `calculate_all_org_metrics_daily` para procesar todos los tenants

---

## 🎨 UX/UI

### Panel de Administración (`/admin`)
- [x] Lista de todos los tenants con KPIs básicos
- [x] Vista detallada de tenant con:
  - [x] Cambio de plan
  - [x] Toggle de features
  - [x] Cambio de timezone
  - [x] Métricas diarias (últimos 14 días)
  - [x] Impersonación con motivo
- [x] Wizard de onboarding para crear nuevos tenants
- [x] Mensajes de error claros y accionables
- [x] Estados de carga (spinners, placeholders)

### Panel de Barbería (`/panel`)
- [x] Layout base con sidebar y header
- [x] Navegación: Agenda, Clientes, Servicios, Staff, Ajustes
- [x] Vista de Agenda diaria con:
  - [x] Filtro por fecha
  - [x] Filtro por staff
  - [x] Lista de reservas con detalles
  - [x] Estados visuales (paid, confirmed, hold, cancelled, no_show)
- [x] Dashboard con estadísticas rápidas
- [x] Banner de impersonación visible cuando está activo
- [x] Botón para terminar impersonación
- [x] Gestión de Clientes (`/panel/clientes`):
  - [x] Lista de clientes con búsqueda
  - [x] Crear nuevo cliente (nombre, email, teléfono)
  - [x] Conteo de reservas por cliente
  - [x] Actualización en tiempo real
- [x] Gestión de Servicios (`/panel/servicios`):
  - [x] Lista de servicios con estado (activo/inactivo)
  - [x] Crear nuevo servicio (nombre, duración, precio)
  - [x] Activar/desactivar servicios
  - [x] Integración con Stripe (price_id, product_id)
  - [x] Actualización en tiempo real
- [x] Gestión de Staff (`/panel/staff`):
  - [x] Lista de staff con estado (activo/inactivo)
  - [x] Crear nuevo miembro del staff (nombre, habilidades)
  - [x] Activar/desactivar staff
  - [x] Conteo de reservas por staff
  - [x] Actualización en tiempo real
- [x] Configuración (`/panel/ajustes`):
  - [x] Editar nombre de la barbería
  - [x] Cambiar timezone
  - [x] Ver información del sistema (tenant ID)

### Onboarding
- [x] Wizard de creación de tenant (`/admin/new-tenant`)
- [x] Creación automática de usuario owner
- [x] Envío de magic link al owner
- [x] Asignación de plan inicial (opcional)
- [x] Proceso completo documentado

---

## 🧪 Testing y Calidad

### Tests de RLS
- [x] Tests básicos de RLS ejecutables
- [x] Verificación de aislamiento de datos entre tenants
- [x] Tests de permisos por rol

### Tests de Concurrencia
- [x] Tests de rate limiting
- [x] Tests de overlap de reservas
- [x] Tests de idempotencia de webhooks

### Validación de Datos
- [x] Validación de timezone (formato IANA)
- [x] Validación de email en creación de usuarios
- [x] Validación de slug de tenant (solo letras minúsculas, números y guiones)
- [x] Validación de roles (enum check en DB)

---

## 📚 Documentación

### Documentación Técnica
- [x] `docs/ENV_SETUP.md` - Variables de entorno
- [x] `docs/CRON_JOBS.md` - Configuración de cron jobs
- [x] `docs/PLATFORM_GOVERNANCE.md` - Gobierno de la plataforma
- [x] `docs/ADMIN_PANEL_GUIDE.md` - Guía de uso del panel admin
- [x] `docs/HARDENING_CHANGES.md` - Cambios de seguridad
- [x] `docs/BOOKING_SYSTEM.md` - Sistema de reservas
- [x] `SUPABASE_MIGRATION_INSTRUCTIONS.md` - Instrucciones de migración

### Documentación de Usuario
- [ ] Guía de uso del panel de barbería (pendiente)
- [ ] Guía de onboarding para nuevos tenants (pendiente)
- [ ] FAQ de problemas comunes (pendiente)

---

## 🚀 Demo Real

### Flujo Completo de Reserva
- [ ] Crear un tenant de prueba
- [ ] Configurar servicios y staff
- [ ] Hacer una reserva desde el widget público
- [ ] Procesar pago con Stripe
- [ ] Ver reserva en el panel de barbería
- [ ] Cancelar o completar reserva
- [ ] Verificar métricas actualizadas

**Tiempo objetivo**: Completar una reserva pagada en menos de 20 segundos

### Flujo de Onboarding
- [ ] Crear nuevo tenant desde `/admin/new-tenant`
- [ ] Owner recibe magic link
- [ ] Owner inicia sesión
- [ ] Owner configura servicios y staff
- [ ] Owner hace primera reserva de prueba

**Tiempo objetivo**: Crear un tenant funcional en menos de 1 minuto

---

## 🔧 Configuración de Producción

### Variables de Entorno
- [x] `NEXT_PUBLIC_SUPABASE_URL` configurado
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurado
- [x] `SUPABASE_SERVICE_ROLE_KEY` configurado
- [x] `STRIPE_SECRET_KEY` configurado
- [x] `STRIPE_WEBHOOK_SECRET` configurado
- [x] `INTERNAL_CRON_KEY` configurado
- [x] `NEXT_PUBLIC_APP_URL` configurado

### Vercel
- [x] Proyecto desplegado en Vercel
- [x] Variables de entorno configuradas
- [x] Cron jobs configurados desde Dashboard
- [x] Dominio personalizado configurado (opcional)

### Supabase
- [x] Todas las migraciones aplicadas
- [x] RLS activado en todas las tablas
- [x] Funciones RPC creadas y probadas
- [x] Triggers funcionando correctamente
- [x] Backups configurados (automático en Supabase)

### Stripe
- [x] Cuenta de Stripe configurada
- [x] Webhooks configurados en Stripe Dashboard
- [x] Productos y precios creados
- [x] Modo test vs producción separados

---

## 📈 Métricas y Monitoreo

### Métricas Disponibles
- [x] Reservas por día (total, confirmadas, canceladas, no show)
- [x] Ingresos por día (revenue_cents)
- [x] Ocupación (slots booked vs disponibles)
- [x] Servicios activos
- [x] Staff activo
- [x] Holds liberados por cron

### Health Checks
- [x] Endpoint `/api/health` funcional
- [x] Verifica DB y Stripe
- [x] Retorna tiempos de respuesta
- [x] Retorna errores si los hay

### Logs
- [x] Logs de autenticación en `auth_logs`
- [x] Logs de auditoría en `platform.audit_logs`
- [x] Logs de impersonación en `platform.impersonations`
- [x] Logs de errores en Vercel Functions

---

## 🎯 Próximos Pasos (Post-MVP)

### Funcionalidades Pendientes
- [ ] Portal del cliente (widget de reservas público)
- [ ] Gestión completa de clientes
- [ ] Gestión completa de servicios
- [ ] Gestión completa de staff
- [ ] Configuración de horarios y disponibilidad
- [ ] Notificaciones (email, SMS)
- [ ] Agentes IA multicanal
- [ ] Sistema de ratings y reviews
- [ ] Programa de fidelización

### Mejoras Técnicas
- [ ] Tests E2E con Playwright
- [ ] Optimización de queries con índices adicionales
- [ ] Cache de métricas para dashboards
- [ ] WebSockets para actualizaciones en tiempo real
- [ ] Internacionalización (i18n)
- [ ] Dark mode

---

## ✅ Criterio Final

La plataforma se considera **"Ready to Sell"** cuando:

1. ✅ Todas las tareas de seguridad están completadas
2. ✅ El panel de administración es completamente funcional
3. ✅ El panel de barbería permite gestionar reservas básicas
4. ✅ El flujo de onboarding funciona end-to-end
5. ✅ Se puede hacer una demo completa en menos de 5 minutos
6. ✅ La documentación está actualizada
7. ✅ Los health checks funcionan
8. ✅ Las métricas se calculan correctamente

**Estado actual**: 🟢 **Casi listo** - Panel de barbería completo. Faltan algunas funcionalidades avanzadas (edición, eliminación) y documentación de usuario.

---

## 📝 Notas

- Este checklist se actualiza continuamente
- Las tareas marcadas con [x] están completadas
- Las tareas marcadas con [ ] están pendientes
- Priorizar tareas marcadas como "Must-have" antes de lanzar

---

**Última actualización**: 2024-11-13

