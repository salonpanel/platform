# 🔧 Solución: "Please provide a valid URL" en Supabase

## 🚨 Problema

Al intentar añadir Redirect URLs en Supabase Dashboard, aparece el error:
```
Please provide a valid URL
```

## 🔍 Causa

Supabase **valida que las URLs sean accesibles** antes de aceptarlas. Si el dominio:
- No está completamente configurado en DNS
- No responde correctamente
- Tiene problemas de SSL
- No está accesible públicamente

Supabase rechazará la URL.

## ✅ Soluciones (en orden de preferencia)

### Solución 1: Añadir URLs una por una

**No añadas todas las URLs a la vez**. Añádelas **una por una**:

1. Ve a Supabase Dashboard → Authentication → URL Configuration
2. En el campo de **Redirect URLs**, escribe **solo una URL**:
   ```
   http://localhost:3000/auth/callback
   ```
3. Click en el botón **Add** o **+** (no en Save todavía)
4. Espera a que se valide (debería aparecer un check verde)
5. Repite para cada URL:
   - `http://localhost:3000/auth/magic-link-handler`
   - `https://pro.bookfast.es/auth/callback` (solo si el dominio funciona)
   - `https://pro.bookfast.es/auth/magic-link-handler` (solo si el dominio funciona)
6. Cuando todas estén añadidas, click en **Save**

### Solución 2: Verificar que el dominio funciona primero

Antes de añadir las URLs de producción, verifica que el dominio responde:

1. Abre en tu navegador: `https://pro.bookfast.es`
2. Si ves un error 404 o "Not Found", el dominio aún no está configurado
3. Si ves tu aplicación funcionando, el dominio está bien

**Si el dominio no funciona aún:**
- Añade solo las URLs de `localhost` por ahora
- Configura el dominio en Vercel primero (Settings → Domains)
- Espera a que el DNS se propague (puede tardar hasta 48 horas)
- Vuelve a intentar añadir las URLs de producción después

### Solución 3: Usar solo localhost temporalmente

Si necesitas probar el login ahora mismo:

1. Añade solo estas URLs:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/magic-link-handler
   ```

2. Configura el **Site URL** como:
   ```
   https://pro.bookfast.es
   ```

3. El código ya está configurado para usar `NEXT_PUBLIC_APP_URL` en producción, así que cuando el dominio esté listo, funcionará automáticamente.

### Solución 4: Usar Wildcards (⭐ RECOMENDADO)

Supabase permite wildcards en Redirect URLs. Esto simplifica mucho la configuración:

**En Redirect URLs, añade:**
```
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/magic-link-handler
http://localhost:3000/auth/callback
http://localhost:3000/auth/magic-link-handler
```

El wildcard `*.bookfast.es` cubrirá:
- ✅ `pro.bookfast.es`
- ✅ `admin.bookfast.es`
- ✅ `{cualquier-tenant}.bookfast.es`
- ✅ Cualquier subdominio futuro

**Ventajas:**
- Una sola configuración para todos los subdominios
- No necesitas añadir cada subdominio individualmente
- Funciona automáticamente para nuevos tenants

### Solución 5: Verificar formato de URL

Asegúrate de que las URLs:
- ✅ Empiezan con `http://` o `https://`
- ✅ No tienen espacios al principio o al final
- ✅ No tienen caracteres especiales incorrectos
- ✅ Tienen el formato correcto: `https://dominio.com/ruta`

**Ejemplos correctos:**
```
https://pro.bookfast.es/auth/callback
http://localhost:3000/auth/callback
```

**Ejemplos incorrectos:**
```
pro.bookfast.es/auth/callback  ❌ Falta https://
https://pro.bookfast.es/auth/callback/  ❌ Barra final puede causar problemas
 https://pro.bookfast.es/auth/callback  ❌ Espacio al inicio
```

### Solución 6: Limpiar caché y reintentar

1. Cierra completamente el navegador
2. Abre una ventana de incógnito
3. Ve a Supabase Dashboard
4. Intenta añadir las URLs de nuevo

### Solución 7: Contactar con Soporte de Supabase

Si ninguna de las soluciones anteriores funciona:

1. Verifica que tu plan de Supabase permite múltiples Redirect URLs
2. Revisa los logs de Supabase Dashboard para ver si hay más información del error
3. Contacta con el soporte de Supabase explicando el problema

## 📋 Checklist de Verificación

Antes de añadir URLs de producción, verifica:

- [ ] El dominio `https://pro.bookfast.es` abre en el navegador (no da 404)
- [ ] El SSL está funcionando (candado verde en el navegador)
- [ ] El dominio está configurado en Vercel (Settings → Domains)
- [ ] El DNS se ha propagado (puedes verificar en [whatsmydns.net](https://www.whatsmydns.net))

## 🎯 Recomendación Inmediata

**Para poder probar el login ahora mismo:**

1. Añade solo las URLs de localhost:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/magic-link-handler
   ```

2. Configura Site URL:
   ```
   https://pro.bookfast.es
   ```

3. En Vercel, asegúrate de que `NEXT_PUBLIC_APP_URL=https://pro.bookfast.es` está configurado

4. El código ya generará el magic link con la URL correcta (`https://pro.bookfast.es/auth/callback`) gracias a `NEXT_PUBLIC_APP_URL`

5. Cuando el dominio esté completamente funcional, vuelve a intentar añadir las URLs de producción en Supabase

## 🔗 Referencias

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts#redirect-urls)
- `docs/CONFIGURAR_SUPABASE_REDIRECTS.md` - Guía completa de configuración

