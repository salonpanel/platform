# 🔒 Casos Límite Blindados - BookFast Multi-Dominio

**Fecha**: 2024-12-19  
**Propósito**: Documentación de casos límite y su manejo seguro

---

## 🎯 Casos Límite Implementados

### 1. Host Desconocido/Inválido

**Escenario**: Un host que no coincide con ningún patrón conocido.

**Patrones Reconocidos**:
- ✅ `pro.bookfast.es` → contexto "pro"
- ✅ `admin.bookfast.es` → contexto "admin"
- ✅ `*.bookfast.es` (subdomain válido) → contexto "tenantPublic"
- ✅ `bookfast.es` → contexto "marketing"
- ✅ `localhost` / `127.0.0.1` → contexto "pro" (desarrollo)

**Comportamiento**:
- ❌ Cualquier otro host → **SIEMPRE redirige a `URLS.ROOT`** (marketing)
- ✅ No hay `NextResponse.next()` sin protección
- ✅ Logs de depuración en desarrollo

**Implementación**: `middleware.ts` - Caso "unknown"

---

### 2. Tenant Inexistente en {tenant}.bookfast.es

**Escenario**: Un subdominio que parece ser de tenant pero no existe en la base de datos.

**Comportamiento**:

#### En Desarrollo (localhost)
- ✅ Permite acceso directo a `/r/[orgId]` como fallback
- ✅ La página `/r/[orgId]` maneja el caso mostrando 404 elegante

#### En Producción/localtest.me
- ✅ Redirige a marketing con `?reason=unknown-tenant`
- ✅ URL: `https://bookfast.es?reason=unknown-tenant`

**En la Página `/r/[orgId]`**:
- ✅ Si el tenant no existe → muestra 404 elegante
- ✅ Mensaje: "Esta barbería no existe o ya no está activa en BookFast"
- ✅ Botón: "Ir a BookFast" → redirige a marketing

**Implementación**: 
- `middleware.ts` - Verificación de tenant antes de rewrite
- `app/r/[orgId]/page.tsx` - 404 elegante cuando tenant no existe

---

### 3. Subdominio Reservado como Tenant

**Escenario**: Alguien intenta usar un subdominio reservado como tenant (ej: `api.bookfast.es`).

**Comportamiento**:
- ✅ Verificación ANTES de intentar resolver como tenant
- ✅ Si es reservado → redirige inmediatamente a marketing
- ✅ No consulta Supabase innecesariamente

**Lista de Reservados**: Ver `src/lib/domains.ts` - `RESERVED_SUBDOMAINS`

**Implementación**: `middleware.ts` - Verificación en contexto "tenantPublic"

---

### 4. Aislamiento de APIs por Dominio

**Escenario**: Intentar acceder a APIs internas desde un dominio incorrecto.

**APIs Protegidas**:
- `/api/admin/*` → Solo desde `pro.bookfast.es` o `admin.bookfast.es`
- `/api/internal/*` → Solo desde `pro.bookfast.es` o `admin.bookfast.es`

**Comportamiento**:

| Desde | `/api/admin/*` | `/api/internal/*` |
|-------|----------------|-------------------|
| `pro.bookfast.es` | ✅ Permitido | ✅ Permitido |
| `admin.bookfast.es` | ✅ Permitido | ✅ Permitido |
| `{tenant}.bookfast.es` | ❌ 403 | ❌ 403 |
| `bookfast.es` | ❌ 403 | ❌ 403 |

**Respuesta**:
```json
{
  "error": "Esta API no está disponible desde este dominio"
}
```
Status: `403 Forbidden`

**Nota**: Las APIs ya tienen protección por autenticación y RLS. Esta capa adicional previene acceso desde dominios incorrectos.

**Implementación**: `middleware.ts` - Verificación antes de protección legacy

---

## 🧪 Casos de Prueba

### Hosts Desconocidos

| Host | Comportamiento Esperado |
|------|------------------------|
| `otrodominio-raro.com` | → Redirige a `URLS.ROOT` |
| `bookfast.com` (sin .es) | → Redirige a `URLS.ROOT` |
| `pro.bookfast.com` | → Redirige a `URLS.ROOT` |
| `192.168.1.1` | → Redirige a `URLS.ROOT` |

### Tenants Inexistentes

| Host | Comportamiento Esperado |
|------|------------------------|
| `invalido.bookfast.es.localtest.me:3000/` | → Redirige a `localhost:3000?reason=unknown-tenant` |
| `nonexistent.bookfast.es` (prod) | → Redirige a `bookfast.es?reason=unknown-tenant` |

### Subdominios Reservados

| Host | Comportamiento Esperado |
|------|------------------------|
| `api.bookfast.es.localtest.me:3000/` | → Redirige a marketing (no intenta resolver como tenant) |
| `static.bookfast.es` | → Redirige a marketing |
| `cdn.bookfast.es` | → Redirige a marketing |

### APIs desde Dominios Incorrectos

| Desde | Endpoint | Comportamiento Esperado |
|-------|----------|------------------------|
| `barberstudio.bookfast.es.localtest.me:3000` | `/api/admin/tenants` | → 403 Forbidden |
| `barberstudio.bookfast.es.localtest.me:3000` | `/api/internal/cron/calculate-metrics` | → 403 Forbidden |
| `pro.bookfast.es.localtest.me:3000` | `/api/admin/tenants` | → ✅ Permitido (si está autenticado) |

---

## 🔍 Verificaciones en Desarrollo

### Simulación Manual

Puedes probar estos casos usando `localtest.me`:

1. **Host desconocido**:
   ```bash
   curl -H "Host: otrodominio-raro.com" http://localhost:3000/
   ```
   Debería redirigir a `http://localhost:3000/`

2. **Tenant inexistente**:
   ```bash
   curl http://invalido.bookfast.es.localtest.me:3000/
   ```
   Debería redirigir a `http://localhost:3000?reason=unknown-tenant`

3. **Subdominio reservado**:
   ```bash
   curl http://api.bookfast.es.localtest.me:3000/
   ```
   Debería redirigir a `http://localhost:3000/` (no intenta resolver como tenant)

4. **API desde dominio incorrecto**:
   ```bash
   curl http://barberstudio.bookfast.es.localtest.me:3000/api/admin/tenants
   ```
   Debería devolver `403 Forbidden`

---

## 📝 Decisiones de Diseño

### 1. Redirección vs 404 para Tenant Inexistente

**Decisión**: Redirección a marketing con query param en middleware, 404 elegante en página.

**Razón**:
- Middleware: Más eficiente, evita renderizar página
- Página: Mejor UX si alguien accede directamente a `/r/[orgId]` inválido

### 2. Bloqueo de APIs por Dominio

**Decisión**: Bloquear en middleware además de protección por auth/RLS.

**Razón**:
- Defensa en profundidad
- Previene intentos de acceso desde dominios incorrectos
- Logs claros de intentos bloqueados

### 3. Host Desconocido

**Decisión**: SIEMPRE redirigir a marketing, nunca `NextResponse.next()`.

**Razón**:
- Seguridad: Evita comportamiento impredecible
- UX: Usuario siempre llega a un lugar válido
- Consistencia: Mismo comportamiento en todos los casos edge

---

## ✅ Checklist de Validación

Antes de considerar los casos límite completamente blindados:

- [x] Host desconocido redirige a marketing
- [x] Tenant inexistente redirige con query param o muestra 404
- [x] Subdominios reservados no se intentan resolver como tenants
- [x] APIs internas bloqueadas desde dominios de tenant
- [x] Logs de depuración en desarrollo
- [x] Sin `NextResponse.next()` sin protección
- [x] Documentación completa

---

**Última actualización**: 2024-12-19




