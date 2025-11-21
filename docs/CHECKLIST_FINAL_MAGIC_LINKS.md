# ✅ Checklist Final - Configuración de Magic Links

## 🎯 Estado Actual

- ✅ URLs de redirección configuradas en Supabase con wildcards
- ✅ Site URL configurado en Supabase
- ✅ Código actualizado para usar URLs absolutas

## 📋 Verificación Final

### 1. Supabase Dashboard ✅

- [x] **Site URL**: `https://pro.bookfast.es`
- [x] **Redirect URLs**:
  - `https://*.bookfast.es/auth/callback`
  - `https://*.bookfast.es/auth/magic-link-handler`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/magic-link-handler`

### 2. Vercel Dashboard (Verificar)

- [ ] **Environment Variable** `NEXT_PUBLIC_APP_URL` configurada para **Production**:
  ```
  NEXT_PUBLIC_APP_URL=https://pro.bookfast.es
  ```

**Cómo verificar:**
1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Busca `NEXT_PUBLIC_APP_URL`
3. Verifica que está configurada para **Production** con el valor `https://pro.bookfast.es`
4. Si no existe o está mal, créala/corrígela y haz un nuevo deployment

### 3. Código (Ya Corregido) ✅

- [x] `app/login/page.tsx` usa URLs absolutas
- [x] Usa `NEXT_PUBLIC_APP_URL` o `window.location.origin` como fallback

### 4. Deployment

- [ ] Verificar que el último deployment incluye los cambios de `app/login/page.tsx`
- [ ] Si no, hacer push de los cambios:
  ```bash
  git add app/login/page.tsx
  git commit -m "fix: use absolute URL for magic link callback"
  git push origin main
  ```

## 🧪 Prueba del Flujo

### Paso 1: Verificar Variable en Vercel

1. Ve a Vercel Dashboard → Settings → Environment Variables
2. Verifica `NEXT_PUBLIC_APP_URL=https://pro.bookfast.es` (Production)

### Paso 2: Hacer Deployment (si es necesario)

Si acabas de cambiar la variable de entorno o el código:
- Espera a que Vercel despliegue automáticamente, o
- Haz un nuevo deployment manual

### Paso 3: Probar el Login

1. Visita `https://pro.bookfast.es/login`
2. Introduce tu email
3. Revisa tu correo
4. **Verifica que el magic link apunta a**: `https://pro.bookfast.es/auth/callback?...`
   - ❌ NO debería apuntar a `http://localhost:3000`
   - ✅ SÍ debería apuntar a `https://pro.bookfast.es`
5. Haz clic en el link
6. Deberías ser redirigido a `https://pro.bookfast.es/panel`

## 🐛 Si Algo No Funciona

### El magic link sigue usando localhost

**Causa**: `NEXT_PUBLIC_APP_URL` no está configurado en Vercel o el deployment no incluye los cambios.

**Solución**:
1. Verifica `NEXT_PUBLIC_APP_URL` en Vercel (Production)
2. Haz un nuevo deployment
3. Limpia la caché del navegador
4. Prueba de nuevo

### Error: "Redirect URL not allowed"

**Causa**: La URL no está en la lista de Redirect URLs en Supabase.

**Solución**:
1. Verifica que las URLs con wildcards están guardadas en Supabase
2. Verifica que el Site URL está configurado
3. Prueba de nuevo

### El callback funciona pero redirige a localhost

**Causa**: El código está usando `window.location.origin` en lugar de `NEXT_PUBLIC_APP_URL`.

**Solución**: Ya está corregido. Verifica que el deployment incluye los cambios más recientes.

## 📚 Documentación Relacionada

- `docs/CONFIGURACION_WILDCARDS_SUPABASE.md` - Guía de wildcards
- `docs/CONFIGURAR_SUPABASE_REDIRECTS.md` - Configuración completa
- `docs/SOLUCION_ERROR_SUPABASE_URL.md` - Troubleshooting
- `docs/ENV_VARS.md` - Variables de entorno

## ✅ Resumen

**Configuración completada:**
- ✅ Supabase: Site URL y Redirect URLs con wildcards
- ✅ Código: URLs absolutas usando `NEXT_PUBLIC_APP_URL`
- ⏳ Pendiente: Verificar `NEXT_PUBLIC_APP_URL` en Vercel y hacer deployment si es necesario

**Siguiente paso:** Verificar la variable de entorno en Vercel y probar el flujo de login.

