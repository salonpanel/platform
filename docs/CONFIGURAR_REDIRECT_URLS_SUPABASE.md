# Configurar Redirect URLs en Supabase

## 📋 Lista Recomendada de Redirect URLs

### ✅ URLs de Producción (obligatorias)

```
https://pro.bookfast.es/auth/remote-callback
https://pro.bookfast.es/auth/callback
https://pro.bookfast.es/auth/magic-link-handler
```

### ✅ Wildcards de Producción (recomendadas)

```
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/magic-link-handler
https://*.bookfast.es/auth/remote-callback
```

**Nota**: El wildcard `*.bookfast.es` cubre todos los subdominios (pro, admin, tenants, etc.)

### ✅ URLs de Desarrollo Local (obligatorias)

```
http://localhost:3000/auth/callback
http://localhost:3000/auth/magic-link-handler
http://localhost:3000/auth/remote-callback
```

### ⚠️ URLs de Vercel Preview (opcionales, solo si usas previews)

Si quieres que los magic links funcionen en preview deployments de Vercel:

```
https://bookfast-*-*.vercel.app/auth/callback
https://bookfast-*-*.vercel.app/auth/magic-link-handler
https://bookfast-*-*.vercel.app/auth/remote-callback
```

**Nota**: Los previews de Vercel tienen el formato `project-name-git-branch-username.vercel.app`

## 🧹 Limpieza de URLs Actuales

### URLs a ELIMINAR (duplicados o innecesarias):

1. ❌ `https://*.bookfast.es/auth/remote-callback` - Duplicado (ya está el wildcard)
2. ❌ `https://bookfast-bookfast.vercel.app/` - Sin path específico, no funciona
3. ❌ `https://bookfast-bookfast.vercel.app/**` - Wildcard demasiado amplio
4. ❌ `https://bookfast-*-bookfast.vercel.app` - Sin path específico
5. ❌ `https://bookfast-*-bookfast.vercel.app/**` - Wildcard demasiado amplio

### URLs a MANTENER:

✅ Todas las URLs específicas de producción (`pro.bookfast.es`)
✅ Todas las URLs de localhost
✅ Los wildcards `*.bookfast.es` con paths específicos

## 📝 Lista Final Recomendada (9 URLs)

```
https://pro.bookfast.es/auth/remote-callback
https://pro.bookfast.es/auth/callback
https://pro.bookfast.es/auth/magic-link-handler
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/magic-link-handler
https://*.bookfast.es/auth/remote-callback
http://localhost:3000/auth/callback
http://localhost:3000/auth/magic-link-handler
http://localhost:3000/auth/remote-callback
```

**Total: 9 URLs** (en lugar de 12)

## 🔍 Verificación

Después de actualizar las URLs:

1. ✅ Verifica que todas las URLs estén sin espacios antes/después
2. ✅ Verifica que los paths sean exactos (`/auth/callback`, no `/auth/callback/`)
3. ✅ Prueba el flujo de login en producción
4. ✅ Prueba el flujo de login en desarrollo local

## ⚠️ Importante

- **NO** uses wildcards sin paths específicos (ej: `https://*.bookfast.es`)
- **NO** uses wildcards demasiado amplios (ej: `/**`)
- **SÍ** incluye paths específicos en todas las URLs
- **SÍ** verifica que no haya espacios en las URLs



