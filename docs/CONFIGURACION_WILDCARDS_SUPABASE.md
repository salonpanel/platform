# 🌟 Configuración con Wildcards en Supabase - Solución Óptima

## ✅ Solución Recomendada

Supabase permite usar **wildcards** en Redirect URLs, lo que simplifica mucho la configuración para aplicaciones multi-dominio.

## 📝 Configuración Paso a Paso

### 1. Ve a Supabase Dashboard

1. Abre [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **URL Configuration**

### 2. Configura Site URL

En **Site URL**, pon:
```
https://pro.bookfast.es
```

### 3. Configura Redirect URLs (con Wildcards)

En **Redirect URLs**, añade estas URLs (una por línea):

```
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/magic-link-handler
http://localhost:3000/auth/callback
http://localhost:3000/auth/magic-link-handler
```

**Si también necesitas el dominio raíz** (sin subdominio), añade:
```
https://bookfast.es/auth/callback
https://bookfast.es/auth/magic-link-handler
```

### 4. Guarda los Cambios

Click en **Save** o el botón de guardar.

## 🎯 ¿Qué Cubre el Wildcard?

El patrón `https://*.bookfast.es/auth/callback` cubre **todos** estos dominios:

- ✅ `https://pro.bookfast.es/auth/callback`
- ✅ `https://admin.bookfast.es/auth/callback`
- ✅ `https://cualquier-tenant.bookfast.es/auth/callback`
- ✅ `https://test.bookfast.es/auth/callback`
- ✅ Cualquier subdominio futuro

**NO cubre:**
- ❌ `https://bookfast.es/auth/callback` (dominio raíz, sin subdominio)
  - Si lo necesitas, añádelo por separado

## 🔍 Verificación

Después de configurar:

1. **Verifica que las URLs están guardadas:**
   - Deberías ver las URLs con wildcards en la lista
   - No debería aparecer ningún error

2. **Prueba el login:**
   - Visita `https://pro.bookfast.es/login`
   - Solicita un magic link
   - El link debería funcionar correctamente

## 📋 URLs Completas Recomendadas

Para una aplicación completa con todos los contextos posibles:

```
# Wildcards para subdominios (cubre todos)
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/magic-link-handler

# Dominio raíz (marketing)
https://bookfast.es/auth/callback
https://bookfast.es/auth/magic-link-handler

# Desarrollo local
http://localhost:3000/auth/callback
http://localhost:3000/auth/magic-link-handler
```

## 🚀 Ventajas de Usar Wildcards

1. **Simplicidad**: Una sola configuración para todos los subdominios
2. **Escalabilidad**: Funciona automáticamente para nuevos tenants
3. **Mantenimiento**: No necesitas actualizar Supabase cada vez que añades un tenant
4. **Flexibilidad**: Cubre todos los casos de uso actuales y futuros

## ⚠️ Notas Importantes

1. **El wildcard NO cubre el dominio raíz**: Si necesitas `bookfast.es`, añádelo por separado
2. **Solo funciona con subdominios**: `*.bookfast.es` cubre subdominios, no rutas como `bookfast.es/subdomain`
3. **Verifica que tu plan de Supabase soporta wildcards**: La mayoría de planes lo soportan, pero verifica si tienes problemas

## 🔗 Referencias

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts#redirect-urls)
- `docs/CONFIGURAR_SUPABASE_REDIRECTS.md` - Guía completa
- `docs/SOLUCION_ERROR_SUPABASE_URL.md` - Troubleshooting



