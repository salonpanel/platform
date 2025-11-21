# Guía Paso a Paso: Configurar Webhook Secret en Supabase

## 🎯 Lo que necesitas saber

El `SUPABASE_WEBHOOK_SECRET` **NO existe automáticamente** en Supabase. **TÚ lo creas y lo configuras** cuando creas el webhook.

## 📋 Paso a Paso Completo

### Paso 1: Generar el Secret

Abre tu terminal (PowerShell en Windows) y ejecuta:

```powershell
# Opción 1: Si tienes Node.js instalado
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opción 2: Si tienes OpenSSL
openssl rand -hex 32
```

**Ejemplo de output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Copia este valor** - lo necesitarás en los siguientes pasos.

### Paso 2: Crear el Webhook en Supabase

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. En el menú lateral izquierdo, busca **"Database"**
4. Dentro de Database, busca **"Webhooks"** o **"Hooks"**
   - Si no lo ves, puede estar en **"Database" → "Extensions" → "Webhooks"**
   - O busca en la barra de búsqueda superior: "webhook"

5. Haz clic en **"Create a new webhook"** o **"New webhook"**

### Paso 3: Configurar el Webhook

Rellena los campos:

**Name:**
```
Update Login Requests on Auth Users Update
```

**Table:**
```
auth.users
```

**Events:**
- ✅ Marca solo **UPDATE** (desmarca INSERT y DELETE si están marcados)

**HTTP Request:**

**URL:**
```
https://pro.bookfast.es/api/webhooks/supabase-auth
```

**HTTP Method:**
```
POST
```

**HTTP Headers:**
Aquí es donde configuras el secret. Haz clic en **"Add header"** o el botón **"+"** y agrega:

- **Key:** `Authorization`
- **Value:** `Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`
  (Reemplaza con el secret que generaste en el Paso 1)

**HTTP Version:**
```
HTTP/1.1
```

6. Haz clic en **"Save"** o **"Create"**

### Paso 4: Configurar en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Haz clic en **"Add New"**
5. Completa:
   - **Key:** `SUPABASE_WEBHOOK_SECRET`
   - **Value:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`
     (El mismo secret que usaste en Supabase, pero **SIN** "Bearer")
   - **Environment:** Marca todas (Production, Preview, Development)
6. Haz clic en **"Save"**

### Paso 5: Verificar

1. En Supabase, ve a **Database** → **Webhooks**
2. Deberías ver tu webhook listado
3. Haz clic en él para ver los detalles
4. Verifica que el header `Authorization` esté configurado correctamente

## 🔍 Si no encuentras "Webhooks" en Supabase

### Opción A: Database Webhooks (Nuevo)

1. Ve a **Database**
2. Busca **"Webhooks"** en el menú lateral
3. Si no lo ves, puede estar en **"Database" → "Extensions"**

### Opción B: Database Hooks (Versión anterior)

1. Ve a **Database**
2. Busca **"Hooks"** o **"Database Hooks"**
3. Puede estar en un submenú

### Opción C: Usar la búsqueda

1. En el Dashboard de Supabase, usa la barra de búsqueda superior
2. Busca: "webhook" o "hook"
3. Debería aparecerte la opción

## ⚠️ Nota Importante

**El secret NO aparece automáticamente en Supabase.** Tú lo creas cuando:
1. Generas el valor (Paso 1)
2. Lo agregas en los HTTP Headers del webhook (Paso 3)
3. Lo agregas en Vercel como variable de entorno (Paso 4)

## 🧪 Probar que Funciona

1. Solicita un magic link desde `/login`
2. Haz clic en el enlace del correo
3. Ve a Vercel → **Deployments** → Último deployment → **Logs**
4. Busca:
   - ✅ `[SupabaseWebhook] Received hook` → ¡Funciona!
   - ❌ `[SupabaseWebhook] Invalid authorization header` → El secret no coincide

## 🐛 Troubleshooting

### "No veo Webhooks en Supabase"

**Posibles causas:**
- Tu plan de Supabase no incluye Database Webhooks
- Estás en una versión anterior que usa "Hooks" en lugar de "Webhooks"
- Necesitas activar la extensión

**Solución:**
- Verifica tu plan de Supabase
- Busca "Hooks" en lugar de "Webhooks"
- Contacta con soporte de Supabase si no encuentras la opción

### "El webhook no se ejecuta"

**Verifica:**
1. ✅ El webhook está activo (debe tener un toggle o estado "Active")
2. ✅ La URL es correcta: `https://pro.bookfast.es/api/webhooks/supabase-auth`
3. ✅ El método es `POST`
4. ✅ El header `Authorization` está configurado con `Bearer {secret}`
5. ✅ El secret en Vercel coincide (sin "Bearer")

## 📸 Ubicación Visual (Conceptual)

```
Supabase Dashboard
├── Database
│   ├── Tables
│   ├── Functions
│   ├── Webhooks  ← AQUÍ
│   ├── Extensions
│   └── ...
```

O en versiones anteriores:

```
Supabase Dashboard
├── Database
│   ├── Tables
│   ├── Hooks  ← AQUÍ (versión anterior)
│   └── ...
```

## 💡 Alternativa: Usar Auth Hooks

Si no encuentras Database Webhooks, puedes usar **Auth Hooks** que están en:

1. **Authentication** → **Hooks** (o **Webhooks**)
2. Crea un hook tipo **POST_SIGN_IN**
3. Configura la misma URL y headers

El endpoint `/api/webhooks/supabase-auth` soporta ambos tipos.



