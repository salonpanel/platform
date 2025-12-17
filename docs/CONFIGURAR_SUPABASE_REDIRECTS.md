# 🔧 Configurar Redirects en Supabase - Solución al Problema de Magic Links

## 🚨 Problema

Después de hacer login con magic link, te redirige a `http://localhost:3000/panel#` en lugar de `https://pro.bookfast.es/panel`.

**Causa**: Supabase está usando el dominio desde donde se hizo la request (localhost) en lugar del dominio de producción configurado.

## ✅ Solución

### Paso 1: Configurar Redirect URLs en Supabase Dashboard

**⚠️ IMPORTANTE**: Supabase valida que las URLs sean accesibles. Si el dominio aún no está completamente configurado, puede rechazar las URLs.

#### Opción A: Si el dominio ya funciona (recomendado)

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **URL Configuration**
4. En **Site URL**, configura:
   ```
   https://pro.bookfast.es
   ```

5. En **Redirect URLs**, añade las URLs **UNA POR UNA** (no todas a la vez):
   - Primero: `https://pro.bookfast.es/auth/callback`
   - Click en **Add** o el botón de añadir
   - Espera a que se valide
   - Luego: `https://pro.bookfast.es/auth/magic-link-handler`
   - Click en **Add**
   - Luego: `http://localhost:3000/auth/callback`
   - Click en **Add**
   - Finalmente: `http://localhost:3000/auth/magic-link-handler`
   - Click en **Add**

6. Click en **Save**

#### Opción B: Si Supabase rechaza las URLs (dominio aún no configurado)

Si Supabase sigue rechazando las URLs porque el dominio no responde aún:

1. **Primero, añade solo localhost** (esto siempre funciona):
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/magic-link-handler
   ```

2. **Luego, configura el Site URL**:
   ```
   https://pro.bookfast.es
   ```

3. **Después de que el dominio esté funcionando**, vuelve a intentar añadir las URLs de producción:
   - Verifica que `https://pro.bookfast.es` responde (abre en el navegador)
   - Añade `https://pro.bookfast.es/auth/callback` (una por una)
   - Añade `https://pro.bookfast.es/auth/magic-link-handler`

#### Opción C: Usar wildcards (⭐ RECOMENDADO)

Supabase permite wildcards en Redirect URLs. Esto es la mejor opción:

**En Redirect URLs, añade:**
```
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/magic-link-handler
http://localhost:3000/auth/callback
http://localhost:3000/auth/magic-link-handler
```

**Ventajas del wildcard:**
- ✅ Cubre todos los subdominios: `pro.bookfast.es`, `admin.bookfast.es`, `{tenant}.bookfast.es`
- ✅ Funciona automáticamente para nuevos tenants
- ✅ Una sola configuración para todo
- ✅ No necesitas añadir cada subdominio individualmente

**Nota**: El wildcard `*.bookfast.es` NO cubre el dominio raíz `bookfast.es`. Si necesitas el dominio raíz, añádelo por separado:
```
https://bookfast.es/auth/callback
```

### Paso 2: Verificar Variable de Entorno en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Verifica que `NEXT_PUBLIC_APP_URL` está configurado para **Production**:
   ```
   NEXT_PUBLIC_APP_URL=https://pro.bookfast.es
   ```

5. Si no existe o está mal configurado:
   - Añádela o corrígela
   - Haz un nuevo deployment después de cambiarla

### Paso 3: Verificar Código (Ya Corregido)

El código ya está corregido para usar URLs absolutas. En `app/login/page.tsx`:

```typescript
// Usa NEXT_PUBLIC_APP_URL o el dominio actual
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
const callbackUrl = `${baseUrl}/auth/callback`;
```

Esto asegura que:
- En producción: usa `https://pro.bookfast.es/auth/callback`
- En desarrollo: usa `http://localhost:3000/auth/callback`

### Paso 4: Hacer Nuevo Deployment

Después de configurar todo:

1. Haz un nuevo deployment en Vercel (o espera a que se despliegue automáticamente)
2. Prueba el flujo de login nuevamente

## 🔍 Verificación

### 1. Verificar que Supabase está configurado

En Supabase Dashboard → Authentication → URL Configuration:
- ✅ Site URL: `https://pro.bookfast.es`
- ✅ Redirect URLs incluyen `https://pro.bookfast.es/auth/callback`

### 2. Verificar que Vercel tiene la variable

En Vercel Dashboard → Settings → Environment Variables:
- ✅ `NEXT_PUBLIC_APP_URL=https://pro.bookfast.es` (Production)

### 3. Probar el flujo

1. Visita `https://pro.bookfast.es/login`
2. Introduce tu email
3. Revisa el email que recibes
4. El magic link debe apuntar a `https://pro.bookfast.es/auth/callback?...`
5. Después de hacer clic, debe redirigir a `https://pro.bookfast.es/panel`

## 🐛 Troubleshooting

### El magic link sigue usando localhost

**Causa**: `NEXT_PUBLIC_APP_URL` no está configurado en Vercel o está mal configurado.

**Solución**:
1. Verifica que `NEXT_PUBLIC_APP_URL` está en Production
2. Haz un nuevo deployment
3. Limpia la caché del navegador y prueba de nuevo

### Error: "Redirect URL not allowed"

**Causa**: La URL no está en la lista de Redirect URLs permitidas en Supabase.

**Solución**:
1. Ve a Supabase Dashboard → Authentication → URL Configuration
2. Añade la URL que está fallando a la lista de Redirect URLs
3. Click en Save

### El callback funciona pero redirige a localhost

**Causa**: El código está usando `window.location.origin` en lugar de `NEXT_PUBLIC_APP_URL`.

**Solución**: Ya está corregido en el código. Verifica que el deployment incluye los cambios más recientes.

## 📋 Checklist

- [ ] Site URL configurado en Supabase: `https://pro.bookfast.es`
- [ ] Redirect URLs añadidas en Supabase (producción y desarrollo)
- [ ] `NEXT_PUBLIC_APP_URL` configurado en Vercel Production
- [ ] Nuevo deployment realizado después de los cambios
- [ ] Magic link apunta a `https://pro.bookfast.es/auth/callback`
- [ ] Después del login, redirige a `https://pro.bookfast.es/panel`

## 📚 Referencias

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts#redirect-urls)
- `docs/ENV_VARS.md` - Variables de entorno
- `docs/DEPLOY_VERCEL.md` - Guía de deployment

