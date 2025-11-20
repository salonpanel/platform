# ✅ Checklist de Routing Multi-Dominio - Desarrollo Local

**Fecha**: 2024-12-19  
**Propósito**: Guía para probar la arquitectura multi-dominio en desarrollo local usando `localtest.me`

---

## 🎯 Configuración Inicial

### Usar localtest.me para Simular Subdominios

`*.localtest.me` siempre resuelve a `127.0.0.1`, permitiendo probar subdominios en local sin modificar `/etc/hosts`.

**No necesitas modificar hosts**, simplemente usa:
- `http://pro.bookfast.es.localtest.me:3000`
- `http://admin.bookfast.es.localtest.me:3000`
- `http://barberstudio.bookfast.es.localtest.me:3000`

---

## 📋 Escenarios de Prueba

### 1. Localhost Directo

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://localhost:3000/` | → Muestra página raíz o redirige según lógica | |
| `http://localhost:3000/login` | → Muestra página de login | |
| `http://localhost:3000/panel` | → Muestra panel (requiere login) | |
| `http://localhost:3000/admin` | → Muestra admin (requiere login + Platform Admin) | |
| `http://localhost:3000/r/[orgId]` | → Muestra portal público (sin subdominio) | |

**Notas**:
- En localhost, el contexto por defecto es "pro"
- No se aplican redirecciones de dominio (solo protección de rutas)
- Logs del middleware deberían aparecer en consola

---

### 2. Dominio Pro Simulado (`pro.bookfast.es.localtest.me`)

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://pro.bookfast.es.localtest.me:3000/` | → **Redirige a `/panel`** | |
| `http://pro.bookfast.es.localtest.me:3000/panel` | → Muestra panel (requiere login) | |
| `http://pro.bookfast.es.localtest.me:3000/panel/agenda` | → Muestra agenda (requiere login) | |
| `http://pro.bookfast.es.localtest.me:3000/admin` | → **Redirige a `http://admin.bookfast.es.localtest.me:3000/admin`** | |
| `http://pro.bookfast.es.localtest.me:3000/r/test` | → **Redirige a `http://localhost:3000/`** (marketing) | |
| `http://pro.bookfast.es.localtest.me:3000/login` | → Muestra página de login | |

**Verificaciones**:
- ✅ Redirección `/` → `/panel` funciona
- ✅ Bloqueo de `/admin/*` funciona (redirige a admin domain)
- ✅ Bloqueo de `/r/*` funciona (redirige a marketing)
- ✅ Logs del middleware muestran contexto "pro"

---

### 3. Dominio Admin Simulado (`admin.bookfast.es.localtest.me`)

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://admin.bookfast.es.localtest.me:3000/` | → **Redirige a `/admin`** | |
| `http://admin.bookfast.es.localtest.me:3000/admin` | → Muestra admin (requiere login + Platform Admin) | |
| `http://admin.bookfast.es.localtest.me:3000/admin/[orgId]` | → Muestra detalles de tenant (requiere Platform Admin) | |
| `http://admin.bookfast.es.localtest.me:3000/panel` | → **Redirige a `http://pro.bookfast.es.localtest.me:3000/panel`** | |
| `http://admin.bookfast.es.localtest.me:3000/r/test` | → **Redirige a `http://localhost:3000/`** (marketing) | |
| `http://admin.bookfast.es.localtest.me:3000/login` | → Muestra página de login | |

**Verificaciones**:
- ✅ Redirección `/` → `/admin` funciona
- ✅ Bloqueo de `/panel/*` funciona (redirige a pro domain)
- ✅ Bloqueo de `/r/*` funciona (redirige a marketing)
- ✅ Logs del middleware muestran contexto "admin"
- ✅ Solo Platform Admins pueden acceder a `/admin/*`

---

### 4. Dominio Tenant Público Simulado (`barberstudio.bookfast.es.localtest.me`)

**Prerequisito**: Debe existir un tenant en Supabase con `slug = "barberstudio"`.

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://barberstudio.bookfast.es.localtest.me:3000/` | → **Rewrite interno a `/r/[tenant.id]`** (muestra portal) | |
| `http://barberstudio.bookfast.es.localtest.me:3000/panel` | → **Redirige a `http://pro.bookfast.es.localtest.me:3000/panel`** | |
| `http://barberstudio.bookfast.es.localtest.me:3000/admin` | → **Redirige a `http://admin.bookfast.es.localtest.me:3000/admin`** | |
| `http://barberstudio.bookfast.es.localtest.me:3000/r/test` | → Muestra portal (acceso directo) | |

**Verificaciones**:
- ✅ Rewrite `/` → `/r/[tenant.id]` funciona (usando UUID, no slug)
- ✅ Bloqueo de `/panel/*` funciona (redirige a pro domain)
- ✅ Bloqueo de `/admin/*` funciona (redirige a admin domain)
- ✅ Logs del middleware muestran contexto "tenantPublic"
- ✅ Logs muestran tenant resuelto correctamente

---

### 5. Subdominio Inválido/Reservado (`pro.bookfast.es.localtest.me` como tenant)

**Nota**: `pro` es un subdominio reservado, no puede ser tenant.

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://pro.bookfast.es.localtest.me:3000/` | → **NO debe intentar resolver como tenant**, debe ir a contexto "pro" | |

**Verificaciones**:
- ✅ Subdominios reservados no se intentan resolver como tenants
- ✅ Lista de reservados funciona correctamente

---

### 6. Tenant No Existe (`invalido.bookfast.es.localtest.me`)

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://invalido.bookfast.es.localtest.me:3000/` | → **Redirige a `http://localhost:3000/`** (marketing) | |

**Verificaciones**:
- ✅ Si tenant no existe, redirige a marketing (no muestra error técnico)
- ✅ Logs muestran que tenant no se pudo resolver
- ✅ No hay loops ni 404 técnicos

---

## 🔍 Verificaciones Adicionales

### Logs del Middleware (Solo Desarrollo)

Al hacer requests, deberías ver en la consola del servidor:

```
[MIDDLEWARE-DEBUG] [timestamp] Request recibida { host: '...', pathname: '...', context: '...' }
[MIDDLEWARE-DEBUG] [timestamp] ✅ Tenant resuelto para ... { slug: '...', id: '...' }
```

**Si no ves logs**: Verifica que `NODE_ENV !== 'production'`

### Verificación de Rewrites

Para verificar que los rewrites funcionan:

1. Abre DevTools → Network
2. Visita `http://barberstudio.bookfast.es.localtest.me:3000/`
3. Deberías ver:
   - Request a `/` (status 200)
   - El contenido mostrado es el de `/r/[tenant.id]`
   - La URL en el navegador sigue siendo `/` (rewrite interno)

### Verificación de Redirecciones

Para verificar redirecciones:

1. Abre DevTools → Network
2. Visita `http://pro.bookfast.es.localtest.me:3000/admin`
3. Deberías ver:
   - Request a `/admin` (status 307/308)
   - Location header: `http://admin.bookfast.es.localtest.me:3000/admin`
   - El navegador redirige correctamente

### Verificación de Aislamiento

**Matriz de Aislamiento**:

| Desde | `/panel/*` | `/admin/*` | `/r/*` |
|-------|------------|------------|--------|
| `pro.bookfast.es` | ✅ Permitido | ❌ → admin domain | ❌ → marketing |
| `admin.bookfast.es` | ❌ → pro domain | ✅ Permitido | ❌ → marketing |
| `{tenant}.bookfast.es` | ❌ → pro domain | ❌ → admin domain | ✅ Permitido (rewrite) |
| `bookfast.es` | ✅ Permitido | ✅ Permitido | ✅ Permitido |

---

## 🚨 Casos de Error a Probar

### 1. Tenant No Existe

| Escenario | Comportamiento Esperado |
|-----------|------------------------|
| Visitar `http://nonexistent.bookfast.es.localtest.me:3000/` | → Redirige a `http://localhost:3000/` (marketing) |

### 2. Subdominio Reservado

| Escenario | Comportamiento Esperado |
|-----------|------------------------|
| Visitar `http://api.bookfast.es.localtest.me:3000/` | → Redirige a marketing (no intenta resolver como tenant) |

### 3. Rutas Protegidas Sin Sesión

| Escenario | Comportamiento Esperado |
|-----------|------------------------|
| Visitar `/panel` sin login | → Redirige a `/login?redirect=/panel` |
| Visitar `/admin` sin login | → Redirige a `/login?redirect=/admin` |
| Visitar `/admin` sin ser Platform Admin | → Redirige a `/login?error=unauthorized` |

---

## 📝 Notas de Testing

### Limitaciones en Desarrollo

1. **Redirecciones entre dominios**: Las redirecciones entre `pro.bookfast.es.localtest.me` y `admin.bookfast.es.localtest.me` funcionan correctamente porque ambos resuelven a `127.0.0.1`.

2. **Subdominios en localhost**: `localhost` no soporta subdominios directamente. Usa `localtest.me` para probar subdominios.

3. **HTTPS en desarrollo**: Las URLs usan `http://` en desarrollo, lo cual es correcto.

### Próximos Pasos

Una vez que todo funcione en desarrollo:

1. **Desplegar en Vercel** con los dominios configurados
2. **Probar en producción** con los dominios reales
3. **Verificar logs** en Vercel para debugging
4. **Monitorear errores** en producción

---

## ✅ Checklist Final

Antes de considerar el routing completo:

- [ ] Todos los escenarios de `pro.bookfast.es.localtest.me` funcionan
- [ ] Todos los escenarios de `admin.bookfast.es.localtest.me` funcionan
- [ ] Todos los escenarios de `{tenant}.bookfast.es.localtest.me` funcionan
- [ ] Localhost funciona correctamente
- [ ] Los logs del middleware aparecen en desarrollo
- [ ] Los rewrites funcionan (verificar en Network tab)
- [ ] Las redirecciones funcionan (verificar en Network tab)
- [ ] Los casos de error se manejan correctamente
- [ ] Las rutas protegidas requieren autenticación
- [ ] El aislamiento entre dominios funciona (matriz completa)
- [ ] Subdominios reservados no se intentan resolver como tenants
- [ ] Rewrite siempre usa UUID del tenant, nunca slug

---

**Última actualización**: 2024-12-19


