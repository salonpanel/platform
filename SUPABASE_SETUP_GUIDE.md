# 🚀 Guía de Configuración Supabase

## 📋 Estado Actual
- ✅ WSL2 + Ubuntu 24.04 configurado
- ✅ Docker Desktop integrado con WSL2
- ✅ Proyecto con estructura Supabase existente
- ✅ Dependencias de Supabase instaladas en package.json
- ⏳ Supabase CLI pendiente de instalación en Ubuntu

---

## 🔧 PASO 1: Instalar Supabase CLI en Ubuntu

Abre una terminal WSL2 de Ubuntu y ejecuta:

```bash
# 1. Descargar Supabase CLI
wget https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -O /tmp/supabase.tar.gz

# 2. Extraer el archivo
tar -xzf /tmp/supabase.tar.gz -C /tmp

# 3. Mover a /usr/local/bin (te pedirá contraseña)
sudo mv /tmp/supabase /usr/local/bin/supabase

# 4. Dar permisos de ejecución
sudo chmod +x /usr/local/bin/supabase

# 5. Verificar instalación
supabase --version

# 6. Limpiar archivos temporales
rm /tmp/supabase.tar.gz
```

✅ **Confirmación**: Deberías ver algo como `supabase version 2.x.x`

---

## 🎯 PASO 2: Elegir tu método de trabajo

### Opción A: Desarrollo Local con Docker (Recomendado para desarrollo)

**Ventajas:**
- No necesitas internet
- Control total de tu base de datos
- Migraciones y cambios seguros
- Ideal para testing

**Desventajas:**
- Consume recursos locales
- Requiere Docker corriendo

### Opción B: Supabase Cloud (Producción/Staging)

**Ventajas:**
- No consume recursos locales
- Backups automáticos
- Escalable

**Desventajas:**
- Requiere conexión a internet
- Los cambios afectan directamente a la nube

---

## 🏠 OPCIÓN A: Configuración Local con Docker

### 1. Iniciar Supabase localmente

Desde la raíz del proyecto en WSL:

```bash
# Navegar al proyecto
cd /mnt/c/Users/Josep\ Calafat/Documents/GitHub/platform

# Iniciar Supabase con Docker
supabase start
```

**⚠️ Primera vez:** Docker descargará las imágenes necesarias (~2-3 GB). Puede tardar 5-10 minutos.

**Resultado esperado:**
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
       S3 Region: local
```

### 2. Crear archivo .env.local

Copia las keys del output anterior:

```bash
cp .env.example .env.local
```

Edita `.env.local` con los valores de `supabase start`:

```env
# Desarrollo Local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copia el anon key de arriba>
SUPABASE_SERVICE_ROLE_KEY=<copia el service_role key de arriba>

# URLs locales
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CLIENT_URL=http://localhost:3000

# Resto de configuración (Stripe, Resend, etc.)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
```

### 3. Aplicar migraciones

```bash
# Ver el estado de las migraciones
supabase migration list

# Aplicar migraciones pendientes (si las hay)
supabase db push

# O hacer un reset completo (CUIDADO: borra todos los datos)
supabase db reset
```

### 4. Acceder a Supabase Studio

Abre tu navegador en: `http://127.0.0.1:54323`

Aquí puedes:
- Ver tus tablas
- Ejecutar queries SQL
- Ver logs de Auth
- Gestionar Storage
- Probar Edge Functions

---

## ☁️ OPCIÓN B: Configuración con Supabase Cloud

### 1. Crear proyecto en Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Crea un nuevo proyecto
3. Guarda la contraseña de la base de datos

### 2. Obtener las credenciales

En tu proyecto de Supabase:
1. Ve a **Settings** → **API**
2. Copia:
   - Project URL
   - `anon` `public` key
   - `service_role` key (¡NUNCA expongas esta en el frontend!)

### 3. Configurar .env.local

```env
# Producción/Cloud
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUz...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUz...

NEXT_PUBLIC_APP_URL=https://tudominio.com
NEXT_PUBLIC_CLIENT_URL=https://tudominio.com
```

### 4. Vincular proyecto local con cloud

```bash
# Login en Supabase
supabase login

# Vincular el proyecto
supabase link --project-ref <tu-project-id>

# Push de migraciones a la nube
supabase db push
```

---

## 📦 PASO 3: Comandos útiles para desarrollo

Agrega estos scripts a tu `package.json`:

```json
{
  "scripts": {
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:status": "supabase status",
    "supabase:reset": "supabase db reset",
    "supabase:migrate": "supabase migration new",
    "supabase:push": "supabase db push",
    "supabase:pull": "supabase db pull",
    "supabase:gen-types": "supabase gen types typescript --local > types/database.types.ts"
  }
}
```

---

## 🔄 Workflow de Desarrollo Recomendado

### 1. Iniciar entorno de desarrollo

```bash
# Terminal 1: Supabase
npm run supabase:start

# Terminal 2: Next.js
npm run dev
```

### 2. Crear una nueva migración

```bash
# Crear archivo de migración
npm run supabase:migrate nombre_de_la_migracion

# Edita el archivo en: supabase/migrations/YYYYMMDDHHMMSS_nombre_de_la_migracion.sql

# Aplicar la migración
npm run supabase:reset
```

### 3. Sincronizar cambios con la nube

```bash
# Subir migraciones a Supabase Cloud
npm run supabase:push

# O bajar cambios de la nube
npm run supabase:pull
```

### 4. Generar tipos TypeScript

```bash
# Generar tipos desde tu esquema local
npm run supabase:gen-types
```

---

## 🧪 Testing

### Test de conexión

Crea un archivo `test-supabase-connection.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count')
    
    if (error) throw error
    
    console.log('✅ Conexión exitosa a Supabase')
    console.log('Datos:', data)
  } catch (error) {
    console.error('❌ Error de conexión:', error)
  }
}

testConnection()
```

Ejecutar:

```bash
ts-node test-supabase-connection.ts
```

---

## 🐛 Troubleshooting

### Docker no inicia
```bash
# Verificar Docker
docker ps

# Reiniciar Docker Desktop
# Asegurarse de que WSL integration está activa
```

### Puerto 54321 ya en uso
```bash
# Detener Supabase
supabase stop

# Matar procesos en puerto 54321
sudo lsof -ti:54321 | xargs kill -9

# Reiniciar
supabase start
```

### Migraciones fallidas
```bash
# Ver logs
supabase logs

# Reset completo (BORRA DATOS)
supabase db reset
```

### Problemas de permisos en WSL
```bash
# Cambiar ownership
sudo chown -R $(whoami) /mnt/c/Users/Josep\ Calafat/Documents/GitHub/platform
```

---

## 📚 Recursos

- [Documentación Supabase CLI](https://supabase.com/docs/guides/cli)
- [Migraciones](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Auth con Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ Checklist Final

- [ ] Supabase CLI instalado en Ubuntu (`supabase --version`)
- [ ] Docker Desktop corriendo
- [ ] `supabase start` ejecutado con éxito
- [ ] `.env.local` configurado con las keys correctas
- [ ] Supabase Studio accesible en `http://127.0.0.1:54323`
- [ ] Next.js dev server corriendo (`npm run dev`)
- [ ] Conexión a base de datos verificada
- [ ] Migraciones aplicadas
- [ ] Types de TypeScript generados (opcional)

---

**¿Necesitas ayuda?** 
1. Verifica los logs: `supabase logs`
2. Comprueba el status: `supabase status`
3. Revisa la documentación oficial
