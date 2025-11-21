# URLs de Redirect para Configurar en Supabase

## 📋 Lista Completa de URLs Requeridas

### URLs Específicas (Recomendadas)

```
https://bookfast.es/auth/callback
https://bookfast.es/auth/remote-callback
https://www.bookfast.es/auth/callback
https://www.bookfast.es/auth/remote-callback
https://pro.bookfast.es/auth/callback
https://pro.bookfast.es/auth/remote-callback
https://admin.bookfast.es/auth/callback
https://admin.bookfast.es/auth/remote-callback
```

### URLs con Wildcard (Alternativa)

Si prefieres usar wildcards para cubrir todos los subdominios:

```
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/remote-callback
```

**Nota:** El wildcard `*` cubre todos los subdominios, incluyendo:
- `pro.bookfast.es`
- `admin.bookfast.es`
- `[tenant].bookfast.es` (cualquier subdominio de tenant)

## 🔧 Cómo Configurar en Supabase

### Paso 1: Acceder a la Configuración

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **URL Configuration**
4. Busca la sección **Redirect URLs**

### Paso 2: Añadir las URLs

1. Haz clic en **"Add URL"** o en el campo de texto
2. Añade cada URL una por una, o usa wildcards
3. Guarda los cambios

### Paso 3: Verificar Site URL

Asegúrate de que **Site URL** esté configurado como:
```
https://pro.bookfast.es
```

Esta es la URL base que Supabase usa como fallback.

## ✅ Verificación

### Verificar que las URLs están configuradas:

1. Ve a **Authentication** → **URL Configuration**
2. Verifica que todas las URLs estén en la lista
3. Asegúrate de que no haya URLs duplicadas o incorrectas

### Probar el flujo:

1. Ve a `https://pro.bookfast.es/login`
2. Ingresa tu email y solicita un magic link
3. Abre el correo y haz clic en el enlace
4. Deberías ser redirigido a `/auth/callback` o `/auth/remote-callback`
5. Luego deberías ser redirigido al panel

## 🚨 Problemas Comunes

### Error: "redirect_uri_mismatch"

**Causa:** La URL de redirect no está en la lista de URLs permitidas.

**Solución:**
1. Verifica que la URL exacta esté en la lista de Redirect URLs
2. Asegúrate de que no haya espacios o caracteres especiales
3. Verifica que el protocolo sea `https://` (no `http://`)

### Error: "invalid_request"

**Causa:** La URL de redirect no coincide con ninguna URL permitida.

**Solución:**
1. Añade la URL exacta a la lista de Redirect URLs
2. Verifica que el dominio sea correcto (sin `www` si no lo necesitas, o con `www` si lo necesitas)

### Magic Link redirige a Site URL en lugar de emailRedirectTo

**Causa:** La URL en `emailRedirectTo` no está en la lista de Redirect URLs permitidas.

**Solución:**
1. Añade la URL de `emailRedirectTo` a la lista de Redirect URLs
2. Verifica que la URL sea exactamente la misma (sin espacios, sin trailing slashes innecesarios)

## 📝 Notas Importantes

1. **Protocolo HTTPS:** Todas las URLs deben usar `https://` en producción
2. **Sin trailing slashes:** No añadas `/` al final de las URLs (excepto si es parte de la ruta)
3. **Wildcards:** Los wildcards `*` funcionan para subdominios, pero no para dominios principales
4. **Localhost:** Para desarrollo local, añade también `http://localhost:3000/auth/callback`

## 🔄 Actualización de URLs

Si cambias de dominio o añades nuevos subdominios:

1. Añade las nuevas URLs a la lista de Redirect URLs
2. Actualiza la Site URL si es necesario
3. Verifica que las variables de entorno en Vercel estén actualizadas
4. Prueba el flujo completo

## 📞 Soporte

Si después de configurar todas las URLs el problema persiste:

1. Revisa los logs de Vercel para ver la URL exacta que se está usando
2. Verifica que las variables de entorno estén correctas
3. Asegúrate de que el dominio esté correctamente configurado en Vercel

