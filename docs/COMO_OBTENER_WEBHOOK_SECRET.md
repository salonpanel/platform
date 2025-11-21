# Cómo Obtener o Configurar SUPABASE_WEBHOOK_SECRET

## 🔍 ¿Dónde está el Secret?

El `SUPABASE_WEBHOOK_SECRET` es un valor que **TÚ generas y configuras** tanto en Supabase como en Vercel. No es algo que Supabase te proporciona automáticamente.

## 📋 Opción 1: Si ya lo configuraste

### En Supabase Dashboard:

1. Ve a **Database** → **Webhooks**
2. Haz clic en el webhook que creaste
3. Busca el campo **"HTTP Headers"** o **"Authorization Header"**
4. El secret debería estar ahí como: `Bearer tu_secret_aqui`

### En Vercel:

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com)
2. Ve a **Settings** → **Environment Variables**
3. Busca `SUPABASE_WEBHOOK_SECRET`
4. El valor está ahí (puedes hacer clic en el ojo para verlo)

## 🆕 Opción 2: Si NO lo has configurado aún

### Paso 1: Generar un Secret Seguro

Abre tu terminal y ejecuta:

```bash
openssl rand -hex 32
```

O si no tienes `openssl`, puedes usar Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O usar un generador online seguro como: https://www.random.org/strings/

**Ejemplo de output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### Paso 2: Configurarlo en Supabase

1. Ve a **Database** → **Webhooks**
2. Crea un nuevo webhook o edita uno existente
3. En la sección **"HTTP Headers"**, agrega:
   ```
   Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
   ```
   (Reemplaza con tu secret generado)

### Paso 3: Configurarlo en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com)
2. Ve a **Settings** → **Environment Variables**
3. Haz clic en **"Add New"**
4. Agrega:
   - **Key:** `SUPABASE_WEBHOOK_SECRET`
   - **Value:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`
   - **Environment:** Selecciona todas (Production, Preview, Development)
5. Haz clic en **"Save"**

### Paso 4: Redesplegar (si es necesario)

Si ya tenías el webhook configurado, Vercel debería detectar el cambio automáticamente. Si no, puedes:

1. Ir a **Deployments**
2. Hacer clic en los tres puntos del último deployment
3. Seleccionar **"Redeploy"**

## ✅ Verificar que Funciona

### 1. Verificar en Supabase

1. Ve a **Database** → **Webhooks**
2. Haz clic en tu webhook
3. Verifica que el header `Authorization` esté configurado correctamente

### 2. Verificar en Vercel

1. Ve a **Settings** → **Environment Variables**
2. Verifica que `SUPABASE_WEBHOOK_SECRET` esté presente
3. Haz clic en el ojo para ver el valor (debe coincidir con el de Supabase)

### 3. Probar el Webhook

1. Solicita un magic link desde `/login`
2. Haz clic en el enlace del correo
3. Revisa los logs de Vercel:
   - Si ves `[SupabaseWebhook] Invalid authorization header` → El secret no coincide
   - Si ves `[SupabaseWebhook] Received hook` → ¡Funciona correctamente!

## 🔒 Seguridad

**IMPORTANTE:**
- ✅ El secret debe ser **diferente** para cada proyecto
- ✅ **NUNCA** lo compartas públicamente
- ✅ **NUNCA** lo subas a Git (ya está en `.gitignore`)
- ✅ Úsalo solo en variables de entorno
- ✅ El mismo secret debe estar en Supabase Y Vercel

## 🐛 Troubleshooting

### Error: "Invalid authorization header"

**Causa:** El secret en Supabase no coincide con el de Vercel.

**Solución:**
1. Verifica que ambos tengan el mismo valor
2. Asegúrate de que en Supabase esté como: `Bearer {secret}`
3. Asegúrate de que en Vercel esté solo el secret (sin "Bearer")

### Error: "SUPABASE_WEBHOOK_SECRET no configurado"

**Causa:** La variable de entorno no está configurada en Vercel.

**Solución:**
1. Ve a Vercel → Settings → Environment Variables
2. Agrega `SUPABASE_WEBHOOK_SECRET` con el valor correcto
3. Redesplega la aplicación

### El webhook no se ejecuta

**Causa:** Puede ser que el secret esté mal configurado o el webhook no esté activo.

**Solución:**
1. Verifica que el webhook esté activo en Supabase
2. Verifica que la URL sea correcta: `https://pro.bookfast.es/api/webhooks/supabase-auth`
3. Verifica que el método sea `POST`
4. Revisa los logs de Supabase para ver si hay errores

## 📚 Referencias

- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

