# Gobierno de Plataforma y Feature Management

Este documento describe el sistema de gobierno de la plataforma, incluyendo planes, features, auditoría e impersonación.

## 📋 Arquitectura

### Componentes Principales

1. **Planes (Plans)**: Free, Pro, Enterprise
2. **Features**: Módulos funcionales (chat, ratings, ai_agent, analytics, knowledge_base)
3. **Org Plans**: Asignación de plan a cada organización
4. **Feature Overrides**: Excepciones puntuales sin cambiar plan
5. **Audit Logs**: Registro de todas las acciones
6. **Impersonations**: Control de acceso como otra organización

### Resolución de Features

La resolución de features activos para una organización sigue este orden de prioridad:

1. **Overrides** (`platform.org_feature_overrides`) - Máxima prioridad
2. **Plan Features** (`platform.plan_features`) - Según el plan asignado
3. **Default** (`platform.features.default_enabled`) - Valor por defecto

```sql
-- Ejemplo: Verificar si una org tiene un feature
SELECT platform.has_feature('org-id', 'chat');
```

## 🔧 Uso en Backend

### Helpers TypeScript

```typescript
import { hasFeature, getOrgFeatures } from '@/lib/platform-features';

// Verificar feature
const canUseChat = await hasFeature(orgId, 'chat');
if (!canUseChat) {
  return NextResponse.json(
    { error: 'Feature no disponible' },
    { status: 403 }
  );
}

// Obtener todas las features activas
const features = await getOrgFeatures(orgId);
```

### Middleware de Protección

```typescript
import { withFeatureGuard } from '@/lib/middleware-feature-guard';

// Proteger endpoint por feature
export const POST = withFeatureGuard('chat')(async (req: Request) => {
  // Handler solo se ejecuta si el feature está activo
  // ...
});
```

### Verificación Manual

```typescript
import { requireFeature } from '@/lib/middleware-feature-guard';

export async function POST(req: Request) {
  const { org_id } = await req.json();
  
  try {
    await requireFeature(org_id, 'ratings');
    // Continuar con la lógica...
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 403 }
    );
  }
}
```

## 🎛️ Panel de Administración

### Acceso

El panel de administración está disponible en `/admin` y requiere permisos de platform admin.

**Nota**: En producción, debes implementar autenticación específica para platform admins (JWT con claim `role: 'platform_admin'` o tabla de sesiones).

### Funcionalidades

#### Lista de Tenants (`/admin`)

- Ver todas las organizaciones
- Filtrar por plan, estado, features activos
- Acceso rápido a gestión individual

#### Ficha de Tenant (`/admin/[orgId]`)

1. **Cambio de Plan**
   - Seleccionar plan (Free, Pro, Enterprise)
   - Cambio inmediato aplica `plan_features` automáticamente
   - Registro en `audit_logs`

2. **Gestión de Features**
   - Toggle individual de cada feature
   - Overrides temporales o permanentes
   - Visualización de estado (plan vs override)

3. **Impersonación**
   - Acceder como otra organización
   - Requiere motivo (registrado en logs)
   - Sesión con expiración automática
   - Marca visual en UI durante impersonación

## 🔐 Seguridad

### Autenticación de Platform Admins

```typescript
// Middleware para proteger /admin
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    // Verificar JWT con claim platform_admin
    // O verificar en tabla platform.platform_users
    const isPlatformAdmin = await verifyPlatformAdmin(req);
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }
}
```

### Impersonación Segura

1. **Requisitos**:
   - Usuario debe ser platform admin
   - Motivo obligatorio
   - Aprobación (opcional, según configuración)

2. **Proceso**:
   - Crear registro en `platform.impersonations`
   - Generar token temporal JWT con claim `impersonate: true`
   - Redirigir a `/panel` con token
   - UI muestra banner "Actuando como [Org]"
   - Log en `audit_logs`

3. **Expiración**:
   - Token expira en X minutos (configurable)
   - Cierre de sesión termina impersonación
   - Registro de `ended_at` en `impersonations`

## 📊 Auditoría

### Tipos de Eventos Registrados

- `plan_changed`: Cambio de plan
- `feature_toggled`: Activación/desactivación de feature
- `impersonation_started`: Inicio de impersonación
- `impersonation_ended`: Fin de impersonación
- `booking_created`: Creación de cita (opcional)
- `payment_processed`: Procesamiento de pago (opcional)

### Consulta de Logs

```sql
-- Logs de una organización
SELECT * FROM platform.audit_logs
WHERE org_id = 'org-id'
ORDER BY created_at DESC;

-- Logs de impersonaciones
SELECT * FROM platform.impersonations
WHERE org_id = 'org-id'
ORDER BY started_at DESC;
```

## 🚀 Flujos Comunes

### Alta de Nueva Organización

1. Usuario se registra (Magic Link)
2. Trigger `handle_new_user()` crea tenant automático
3. Se asigna plan Free por defecto
4. Features según `plan_features` del plan Free

### Cambio de Plan

1. Admin accede a `/admin/[orgId]`
2. Selecciona nuevo plan
3. Sistema actualiza `org_plans`
4. Features se recalculan automáticamente
5. Log en `audit_logs`

### Activación Manual de Feature

1. Admin accede a `/admin/[orgId]`
2. Toggle feature específico
3. Se crea/actualiza `org_feature_overrides`
4. Feature disponible inmediatamente
5. Log en `audit_logs`

### Impersonación para Soporte

1. Admin accede a `/admin/[orgId]`
2. Click en "Impersonar"
3. Ingresa motivo (ej: "Soporte técnico - problema con pagos")
4. Sistema genera token y redirige
5. Admin ve UI como si fuera la organización
6. Al cerrar sesión, se registra fin de impersonación

## 📝 Criterios de Aceptación

### Feature Flags

- ✅ Activar/desactivar feature desde `/admin` cambia UI/API en caliente
- ✅ Cambio de plan aplica `plan_features` sin redeploy
- ✅ Overrides tienen prioridad sobre plan features
- ✅ Cache de features se invalida tras cambios

### Impersonación

- ✅ Toda impersonación queda registrada con motivo
- ✅ UI muestra banner durante impersonación
- ✅ Token expira automáticamente
- ✅ Logs incluyen IP, user agent, duración

### Auditoría

- ✅ Todas las acciones administrativas quedan registradas
- ✅ Logs consultables por org, usuario, acción
- ✅ Metadata JSON permite búsquedas avanzadas

## 🔄 Próximos Pasos

1. **Autenticación de Platform Admins**: Implementar JWT con claim específico
2. **Métricas de Salud**: Dashboard con KPIs por organización
3. **Soporte Integrado**: Sistema de tickets con SLA
4. **Notificaciones**: Alertas de cambios de plan, features, etc.
5. **API Pública**: Endpoints para gestionar features programáticamente









