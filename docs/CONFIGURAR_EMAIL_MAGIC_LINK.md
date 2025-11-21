# Configurar Email de Magic Link en Supabase

## 📧 Plantilla de Email de Supabase

Supabase usa una plantilla de email que siempre incluye `{{ .ConfirmationURL }}`. Esto es **normal y esperado**.

**Plantilla actual:**
```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

## 🔄 Flujo Normal

1. **Usuario hace clic en el link del email** → Va a Supabase para verificar el token
   ```
   https://jsqminbgggwhvkfgeibz.supabase.co/auth/v1/verify?token=...&type=magiclink&redirect_to=...
   ```

2. **Supabase verifica el token** → Redirige a nuestra URL (la que pasamos en `emailRedirectTo`)
   ```
   https://pro.bookfast.es/auth/remote-callback?request_id=...&token=...&code=...
   ```

## ⚠️ Problema Actual

Supabase está redirigiendo a `/login?error=invalid_link` en lugar de a `/auth/remote-callback`. Esto puede pasar si:

1. **La URL no está en Redirect URLs** → Supabase rechaza la redirección
2. **La URL tiene espacios o caracteres inválidos** → Supabase la rechaza
3. **El dominio no está completamente configurado** → Supabase no puede validar la URL

## ✅ Solución: Configurar Redirect URLs en Supabase

### Paso 1: Ir a Supabase Dashboard

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **URL Configuration**

### Paso 2: Configurar Site URL

En **Site URL**, configura:
```
https://pro.bookfast.es
```

**⚠️ IMPORTANTE**: Sin espacios antes o después.

### Paso 3: Añadir Redirect URLs (CRÍTICO)

En **Redirect URLs**, añade **UNA POR UNA** (no todas a la vez):

1. **Primera URL** (la más importante para login remoto):
   ```
   https://pro.bookfast.es/auth/remote-callback
   ```
   - Haz clic en **Add** o el botón de añadir
   - Espera a que Supabase valide la URL (puede tardar unos segundos)
   - Si aparece un error, verifica que el dominio esté funcionando correctamente

2. **Segunda URL** (para callbacks normales):
   ```
   https://pro.bookfast.es/auth/callback
   ```
   - Haz clic en **Add**
   - Espera a que se valide

3. **Tercera URL** (para desarrollo local):
   ```
   http://localhost:3000/auth/remote-callback
   ```
   - Haz clic en **Add**

4. **Cuarta URL** (para desarrollo local):
   ```
   http://localhost:3000/auth/callback
   ```
   - Haz clic en **Add**

### Paso 4: Usar Wildcards (⭐ RECOMENDADO)

Supabase permite wildcards en Redirect URLs. Esto es la mejor opción:

**En Redirect URLs, añade:**
```
https://*.bookfast.es/auth/remote-callback
https://*.bookfast.es/auth/callback
http://localhost:3000/auth/remote-callback
http://localhost:3000/auth/callback
```

**Ventajas del wildcard:**
- ✅ Cubre todos los subdominios: `pro.bookfast.es`, `admin.bookfast.es`, `{tenant}.bookfast.es`
- ✅ Funciona automáticamente para nuevos tenants
- ✅ Una sola configuración para todo
- ✅ No necesitas añadir cada subdominio individualmente

**Nota**: El wildcard `*.bookfast.es` NO cubre el dominio raíz `bookfast.es`. Si necesitas el dominio raíz, añádelo por separado:
```
https://bookfast.es/auth/remote-callback
https://bookfast.es/auth/callback
```

### Paso 5: Guardar Cambios

Haz clic en **Save** o **Update** para guardar los cambios.

## 🔍 Verificación

### 1. Verificar que la URL se está enviando correctamente

En la consola del navegador (cuando haces login), deberías ver:
```
[Login] emailRedirectTo URL: https://pro.bookfast.es/auth/remote-callback?request_id=...&token=...
[Login] baseUrl used: https://pro.bookfast.es
```

**Si ves espacios codificados (`%20`), hay un problema con la configuración.**

### 2. Verificar que Supabase acepta la URL

Después de añadir la URL en Redirect URLs:
- ✅ Debería aparecer en la lista sin errores
- ✅ No debería tener espacios antes o después
- ✅ Debería estar exactamente como: `https://pro.bookfast.es/auth/remote-callback`

### 3. Probar el flujo completo

1. Visita `https://pro.bookfast.es/login`
2. Introduce tu email
3. Revisa el email que recibes
4. El magic link debe apuntar primero a Supabase (esto es normal)
5. Después de hacer clic, Supabase debe redirigir a:
   ```
   https://pro.bookfast.es/auth/remote-callback?request_id=...&token=...&code=...
   ```

## 🐛 Troubleshooting

### El magic link redirige a `/login?error=invalid_link`

**Causa**: La URL no está en Redirect URLs o tiene espacios.

**Solución**:
1. Verifica que `https://pro.bookfast.es/auth/remote-callback` está en Redirect URLs
2. Verifica que NO hay espacios antes o después de la URL
3. Si usas wildcards, verifica que `https://*.bookfast.es/auth/remote-callback` está añadido
4. Prueba de nuevo el flujo

### El magic link tiene espacios codificados (`%20`)

**Causa**: El código está generando la URL con espacios.

**Solución**: Ya está corregido en el código. Verifica que el deployment incluye los cambios más recientes.

### Supabase rechaza la URL al añadirla

**Causa**: El dominio no está completamente configurado o no responde.

**Solución**:
1. Verifica que `https://pro.bookfast.es` responde (abre en el navegador)
2. Verifica que el DNS está configurado correctamente
3. Espera unos minutos y vuelve a intentar
4. Si sigue fallando, añade primero `http://localhost:3000/auth/remote-callback` y luego las URLs de producción

## 📋 Checklist

- [ ] Site URL configurado en Supabase: `https://pro.bookfast.es` (sin espacios)
- [ ] Redirect URLs incluyen `https://pro.bookfast.es/auth/remote-callback` (o wildcard)
- [ ] Redirect URLs incluyen `https://pro.bookfast.es/auth/callback` (o wildcard)
- [ ] Redirect URLs incluyen URLs de localhost para desarrollo
- [ ] `NEXT_PUBLIC_APP_URL` configurado en Vercel Production: `https://pro.bookfast.es`
- [ ] Nuevo deployment realizado después de los cambios
- [ ] Magic link redirige correctamente a `/auth/remote-callback` (no a `/login?error=invalid_link`)
- [ ] El flujo remoto funciona: el móvil aprueba y el PC se loguea automáticamente

## 🔄 Fallback Implementado

Si Supabase sigue redirigiendo a `/login?error=invalid_link` (aunque esté configurado), hemos implementado un fallback:

1. **`/login` detecta tokens en el hash** cuando Supabase redirige con `#access_token=...`
2. **Extrae los tokens** y establece una sesión temporal
3. **Busca la request pendiente** más reciente para ese email
4. **Actualiza la request** con los tokens
5. **Redirige a `/panel`**

Este fallback debería funcionar incluso si Supabase no respeta `emailRedirectTo`, pero la solución correcta es configurar las Redirect URLs correctamente.

## 📚 Referencias

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts#redirect-urls)
- `docs/CONFIGURAR_SUPABASE_REDIRECTS.md` - Guía detallada de configuración
- `docs/DEBUG_LOGIN_REMOTO.md` - Debug del flujo remoto

