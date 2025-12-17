# 🌐 Implementación de Wildcards y Arquitectura Multi-Dominio

## ✅ Cambios Implementados

### 1. Actualización de `src/lib/domains.ts`

- ✅ Añadida función `getHostType()` - Determina el tipo de host (marketing, pro, admin, tenant)
- ✅ Añadida función `getTenantSubdomain()` - Extrae el subdominio del tenant desde el host
- ✅ `getAppContextFromHost()` ahora usa `getHostType()` internamente (compatibilidad mantenida)
- ✅ `resolveTenantByHost()` ahora busca también por `public_subdomain` además de `slug`

### 2. Actualización de `src/lib/multiTenant.ts`

- ✅ Añadida función `resolveTenantBySlugOrSubdomain()` - Busca tenant por slug o public_subdomain
  - Primero busca por `slug`
  - Si no encuentra, busca por `public_subdomain`
  - Retorna `{ id, slug, public_subdomain }` o `null`

### 3. Actualización de `app/r/[orgId]/page.tsx`

- ✅ Ahora usa `resolveTenantBySlugOrSubdomain()` para resolver tenants
- ✅ Funciona con UUID, slug o public_subdomain
- ✅ Metadatos SEO también usan la nueva función

### 4. Migración SQL

- ✅ Creada `supabase/migrations/0077_add_public_subdomain_to_tenants.sql`
  - Añade columna `public_subdomain` a la tabla `tenants`
  - Crea índice único en `public_subdomain` (solo valores no-null)
  - Añade comentario descriptivo

### 5. Middleware

- ✅ Importa las nuevas funciones `getHostType` y `getTenantSubdomain`
- ✅ Mantiene compatibilidad con el código existente

## 📋 Pasos Pendientes (Configuración Manual)

### 1. Aplicar Migración SQL

Ejecuta la migración en Supabase:

```bash
# Opción 1: Desde Supabase CLI
supabase migration up

# Opción 2: Desde el Dashboard de Supabase
# Ve a Database → Migrations y ejecuta manualmente el contenido de:
# supabase/migrations/0077_add_public_subdomain_to_tenants.sql
```

### 2. Configurar DNS en el Registrador

En el panel de tu registrador de dominio (donde gestionas `bookfast.es`):

#### Apex Domain (bookfast.es)
- **Tipo**: A (o ALIAS/ANAME si tu proveedor lo soporta)
- **Valor**: El que te indique Vercel para el apex domain

#### www.bookfast.es
- **Tipo**: CNAME
- **Valor**: El CNAME que te dé Vercel (ej: `cname.vercel-dns.com`)

#### pro.bookfast.es
- **Tipo**: CNAME
- **Valor**: Mismo CNAME de Vercel

#### admin.bookfast.es
- **Tipo**: CNAME
- **Valor**: Mismo CNAME de Vercel

#### *.bookfast.es (Wildcard)
- **Tipo**: CNAME
- **Valor**: Mismo CNAME de Vercel
- **Nota**: Esto cubre TODOS los subdominios futuros sin tocar DNS nunca más

### 3. Configurar Dominios en Vercel

En Vercel Dashboard → Tu Proyecto → Settings → Domains:

Añade estos dominios (uno por uno):

1. `bookfast.es`
2. `www.bookfast.es`
3. `pro.bookfast.es`
4. `admin.bookfast.es`
5. `*.bookfast.es` ⭐ **Clave para wildcards**

Todos deben estar asociados al mismo proyecto.

**Nota**: Si Vercel te pide verificación/DNS, sigue las instrucciones que te da para cada dominio.

### 4. Verificar Variables de Entorno en Vercel

En Vercel Dashboard → Settings → Environment Variables:

Verifica que `NEXT_PUBLIC_APP_URL` está configurada para **Production**:
```
NEXT_PUBLIC_APP_URL=https://pro.bookfast.es
```

### 5. Configurar Supabase Auth (Ya hecho, pero verificar)

En Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://pro.bookfast.es`
- **Redirect URLs**:
  - `https://*.bookfast.es/auth/callback`
  - `https://*.bookfast.es/auth/magic-link-handler`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/magic-link-handler`

## 🧪 Pruebas Post-Implementación

### 1. Verificar Dominios Base

- [ ] `https://bookfast.es` carga la landing (marketing)
- [ ] `https://www.bookfast.es` redirige a `https://bookfast.es`
- [ ] `https://pro.bookfast.es/login` → login funciona → redirige a `/panel`
- [ ] `https://admin.bookfast.es/admin` → panel admin (si tienes usuario)

### 2. Crear Tenant de Prueba

1. Crea un tenant en Supabase con:
   - `slug`: `barberia-demo`
   - `public_subdomain`: `barberia-demo` (opcional, puede ser diferente del slug)

2. Navega a `https://barberia-demo.bookfast.es`
3. Debería:
   - Redirigir internamente a `/r/[tenant-id]`
   - Mostrar el portal de reservas de ese tenant
   - Cargar servicios y disponibilidad

### 3. Verificar Magic Links

1. Solicita un magic link desde `https://pro.bookfast.es/login`
2. El link debe apuntar a `https://pro.bookfast.es/auth/callback`
3. Después del login, debe redirigir a `/panel` sin bucle

## 📚 Archivos Modificados

- `src/lib/domains.ts` - Funciones de resolución de hosts
- `src/lib/multiTenant.ts` - Helper para resolver tenants
- `app/r/[orgId]/page.tsx` - Uso del nuevo helper
- `middleware.ts` - Importa nuevas funciones (compatibilidad mantenida)
- `supabase/migrations/0077_add_public_subdomain_to_tenants.sql` - Nueva migración

## 🔍 Cómo Funciona

### Flujo de Resolución de Tenant

1. Usuario visita `barberia-demo.bookfast.es`
2. Middleware detecta que es un host tipo `tenant` usando `getHostType()`
3. Extrae el subdominio `barberia-demo` usando `getTenantSubdomain()`
4. `resolveTenantByHost()` busca en Supabase:
   - Primero por `slug = 'barberia-demo'`
   - Si no encuentra, busca por `public_subdomain = 'barberia-demo'`
5. Si encuentra el tenant, hace rewrite de `/` a `/r/[tenant-id]`
6. La página `/r/[orgId]` usa `resolveTenantBySlugOrSubdomain()` para cargar datos

### Ventajas

- ✅ **Escalable**: Cualquier `{subdomain}.bookfast.es` funciona sin tocar Vercel
- ✅ **Flexible**: Los tenants pueden tener `slug` diferente de `public_subdomain`
- ✅ **Mantenible**: Una sola configuración DNS wildcard para todos los tenants
- ✅ **Compatible**: No rompe código existente, usa funciones nuevas internamente

## 🐛 Troubleshooting

### El dominio no resuelve

- Verifica que el DNS está configurado correctamente
- Espera a que se propague (puede tardar hasta 48 horas)
- Verifica en [whatsmydns.net](https://www.whatsmydns.net)

### El tenant no se encuentra

- Verifica que el tenant tiene `slug` o `public_subdomain` configurado
- Verifica que la migración SQL se aplicó correctamente
- Revisa los logs del middleware para ver qué está pasando

### Magic link sigue con bucle

- Verifica que `NEXT_PUBLIC_APP_URL` está configurado en Vercel
- Verifica que las Redirect URLs en Supabase incluyen wildcards
- Solicita un nuevo magic link (los antiguos pueden tener el problema)

## 📝 Notas Importantes

1. **El wildcard `*.bookfast.es` NO cubre el dominio raíz**: Si necesitas `bookfast.es`, añádelo por separado en DNS y Vercel.

2. **`public_subdomain` es opcional**: Los tenants pueden seguir usando solo `slug`. El `public_subdomain` es útil si quieres que un tenant tenga un subdominio diferente de su slug.

3. **Compatibilidad mantenida**: Todo el código existente sigue funcionando. Las nuevas funciones se usan internamente donde es apropiado.

4. **Login siempre por `pro.bookfast.es`**: Por diseño, todo el login del staff pasa por `pro.bookfast.es`, incluso si las páginas públicas son `{tenant}.bookfast.es`. Esto simplifica la configuración de Supabase Auth.

## 🔗 Referencias

- `docs/CONFIGURACION_WILDCARDS_SUPABASE.md` - Configuración de Supabase
- `docs/CONFIGURAR_DOMINIO_VERCEL.md` - Configuración de Vercel
- `docs/SOLUCION_BUCLE_MAGIC_LINK.md` - Solución del bucle de magic links



