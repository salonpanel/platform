# ✅ Checklist de Routing Multi-Dominio - BookFast

**Fecha**: 2024-12-19  
**Propósito**: Guía para probar manualmente la arquitectura multi-dominio en desarrollo y producción.

---

## 🧪 Pruebas en Desarrollo Local

### Configuración Inicial

Para probar subdominios en local, puedes usar:

1. **Modificar `/etc/hosts`** (macOS/Linux) o `C:\Windows\System32\drivers\etc\hosts` (Windows):
   ```
   127.0.0.1 pro.bookfast.es.local
   127.0.0.1 admin.bookfast.es.local
   127.0.0.1 barberstudio.bookfast.es.local
   ```

2. **Usar `localtest.me`** (no requiere modificar hosts):
   - `http://pro.bookfast.es.localtest.me:3000`
   - `http://admin.bookfast.es.localtest.me:3000`
   - `http://barberstudio.bookfast.es.localtest.me:3000`

3. **Usar `localhost` directamente** (funciona sin configuración):
   - `http://localhost:3000` (por defecto, contexto "pro")

---

## 📋 Escenarios a Probar

### 1. Dominio Pro (`pro.bookfast.es`)

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://pro.bookfast.es.local:3000/` | → Redirige a `/panel` | |
| `http://pro.bookfast.es.local:3000/panel` | → Muestra panel (requiere login) | |
| `http://pro.bookfast.es.local:3000/panel/agenda` | → Muestra agenda (requiere login) | |
| `http://pro.bookfast.es.local:3000/admin` | → Redirige a `https://admin.bookfast.es/admin` | |
| `http://pro.bookfast.es.local:3000/r/test` | → Redirige a `/` | |
| `http://pro.bookfast.es.local:3000/login` | → Muestra página de login | |

**Notas**:
- En desarrollo, las redirecciones a `https://admin.bookfast.es` pueden no funcionar (dominio no existe localmente)
- El middleware debería loggear en consola (solo en desarrollo)

---

### 2. Dominio Admin (`admin.bookfast.es`)

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://admin.bookfast.es.local:3000/` | → Redirige a `/admin` | |
| `http://admin.bookfast.es.local:3000/admin` | → Muestra admin (requiere login + Platform Admin) | |
| `http://admin.bookfast.es.local:3000/admin/[orgId]` | → Muestra detalles de tenant (requiere Platform Admin) | |
| `http://admin.bookfast.es.local:3000/panel` | → Redirige a `https://pro.bookfast.es/panel` | |
| `http://admin.bookfast.es.local:3000/r/test` | → Redirige a `/admin` | |
| `http://admin.bookfast.es.local:3000/login` | → Muestra página de login | |

**Notas**:
- Solo usuarios con rol Platform Admin pueden acceder a `/admin/*`
- Usuarios normales serán redirigidos a `/login?error=unauthorized`

---

### 3. Dominio Tenant Público (`{tenant}.bookfast.es`)

**Prerequisito**: Debe existir un tenant en Supabase con `slug = "barberstudio"` (o el subdominio que uses).

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://barberstudio.bookfast.es.local:3000/` | → Rewrite interno a `/r/[tenant.id]` (muestra portal) | |
| `http://barberstudio.bookfast.es.local:3000/panel` | → Redirige a `https://pro.bookfast.es/panel` | |
| `http://barberstudio.bookfast.es.local:3000/admin` | → Redirige a `https://admin.bookfast.es/admin` | |
| `http://barberstudio.bookfast.es.local:3000/r/test` | → Muestra portal (acceso directo) | |

**Notas**:
- Si el tenant no existe, debería redirigir a `https://bookfast.es` (en producción)
- En desarrollo, puede permitir acceso directo a `/r/[orgId]` como fallback
- El middleware debería loggear la resolución del tenant

---

### 4. Dominio Marketing (`bookfast.es`)

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://bookfast.es.local:3000/` | → Muestra página de marketing (o placeholder) | |
| `http://bookfast.es.local:3000/login` | → Muestra página de login | |
| `http://bookfast.es.local:3000/legal/privacidad` | → Muestra página legal (si existe) | |

**Notas**:
- Por ahora, no hay restricciones en el dominio marketing
- En el futuro, aquí se servirá la web comercial

---

### 5. Localhost (Desarrollo)

| URL | Comportamiento Esperado | ✅/❌ |
|-----|------------------------|-------|
| `http://localhost:3000/` | → Muestra página raíz (o redirige según lógica) | |
| `http://localhost:3000/login` | → Muestra página de login | |
| `http://localhost:3000/panel` | → Muestra panel (requiere login) | |
| `http://localhost:3000/admin` | → Muestra admin (requiere login + Platform Admin) | |
| `http://localhost:3000/r/[orgId]` | → Muestra portal público (sin subdominio) | |

**Notas**:
- En localhost, el contexto por defecto es "pro"
- No se aplican redirecciones de dominio (solo protección de rutas)

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
2. Visita `http://barberstudio.bookfast.es.local:3000/`
3. Deberías ver:
   - Request a `/` (status 200)
   - El contenido mostrado es el de `/r/[tenant.id]`
   - La URL en el navegador sigue siendo `/` (rewrite interno)

### Verificación de Redirecciones

Para verificar redirecciones:

1. Abre DevTools → Network
2. Visita `http://pro.bookfast.es.local:3000/admin`
3. Deberías ver:
   - Request a `/admin` (status 307/308)
   - Location header: `https://admin.bookfast.es/admin`
   - El navegador redirige (aunque el dominio no exista localmente)

---

## 🚨 Casos de Error a Probar

### 1. Tenant No Existe

| Escenario | Comportamiento Esperado |
|-----------|------------------------|
| Visitar `http://nonexistent.bookfast.es.local:3000/` | → Redirige a `https://bookfast.es` (en producción) o permite fallback (en desarrollo) |

### 2. Contexto Desconocido

| Escenario | Comportamiento Esperado |
|-----------|------------------------|
| Host que no encaja en ningún patrón | → Redirige a `https://bookfast.es` |

### 3. Rutas Protegidas Sin Sesión

| Escenario | Comportamiento Esperado |
|-----------|------------------------|
| Visitar `/panel` sin login | → Redirige a `/login?redirect=/panel` |
| Visitar `/admin` sin login | → Redirige a `/login?redirect=/admin` |
| Visitar `/admin` sin ser Platform Admin | → Redirige a `/login?error=unauthorized` |

---

## 📝 Notas de Testing

### Limitaciones en Desarrollo

1. **Redirecciones a dominios de producción**: Las redirecciones a `https://pro.bookfast.es` no funcionarán localmente (el dominio no existe). Esto es esperado.

2. **Subdominios en localhost**: `localhost` no soporta subdominios directamente. Usa `localtest.me` o modifica `/etc/hosts`.

3. **HTTPS en desarrollo**: Las URLs de producción usan `https://`, pero en desarrollo usamos `http://`. El middleware maneja esto correctamente.

### Próximos Pasos

Una vez que todo funcione en desarrollo:

1. **Desplegar en Vercel** con los dominios configurados
2. **Probar en producción** con los dominios reales
3. **Verificar logs** en Vercel para debugging
4. **Monitorear errores** en producción

---

## ✅ Checklist Final

Antes de considerar el routing completo:

- [ ] Todos los escenarios de `pro.bookfast.es` funcionan
- [ ] Todos los escenarios de `admin.bookfast.es` funcionan
- [ ] Todos los escenarios de `{tenant}.bookfast.es` funcionan
- [ ] Todos los escenarios de `bookfast.es` funcionan
- [ ] Localhost funciona correctamente
- [ ] Los logs del middleware aparecen en desarrollo
- [ ] Los rewrites funcionan (verificar en Network tab)
- [ ] Las redirecciones funcionan (verificar en Network tab)
- [ ] Los casos de error se manejan correctamente
- [ ] Las rutas protegidas requieren autenticación

---

**Última actualización**: 2024-12-19




