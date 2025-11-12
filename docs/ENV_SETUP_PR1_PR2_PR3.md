# Variables de Entorno - PR1, PR2, PR3

## Variables Requeridas

### Stripe
```env
STRIPE_SECRET_KEY=sk_live_...  # o sk_test_... para desarrollo
STRIPE_WEBHOOK_SECRET=whsec_...  # Secret del webhook de Stripe
```

### Cron (Limpieza de Holds)
```env
INTERNAL_CRON_KEY=your-secret-key-here  # Clave secreta para proteger el endpoint de cron
```

### Rate Limit (Upstash Redis)
```env
UPSTASH_REDIS_REST_URL=https://...  # URL de Upstash Redis
UPSTASH_REDIS_REST_TOKEN=...  # Token de Upstash Redis
```

### TTL de Holds
```env
HOLD_TTL_MIN=10  # TTL de holds en minutos (default: 10)
```

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Configuración en Vercel

### 1. Añadir Variables de Entorno

1. Ir a Vercel Dashboard → Project → Settings → Environment Variables
2. Añadir todas las variables requeridas
3. Asegurar que estén configuradas para Production, Preview y Development

### 2. Configurar Cron Job

1. Verificar que `vercel.json` está en la raíz del proyecto
2. El cron se ejecutará automáticamente cada 5 minutos
3. **Importante**: El endpoint acepta protección mediante:
   - Header `x-cron-key` (preferido, pero Vercel no lo permite en cron jobs)
   - Query parameter `?key=...` (alternativa)

**Opción A: Configurar manualmente en Vercel Dashboard** (Recomendado)

1. Ir a Vercel Dashboard → Project → Settings → Cron Jobs
2. Añadir nuevo cron job:
   - Path: `/api/internal/cron/release-holds?key=${INTERNAL_CRON_KEY}`
   - Schedule: `*/5 * * * *` (cada 5 minutos)
   - Method: POST

**Nota**: Vercel no permite interpolación de variables de entorno en `vercel.json` para cron jobs. 
Debes usar el valor real de `INTERNAL_CRON_KEY` en la URL del cron job.

**Opción B: Usar Vercel Cron API** (Más seguro)

1. Configurar el cron en `vercel.json` (sin query parameter)
2. Modificar el endpoint para verificar si el request viene de Vercel Cron
3. Usar un método de autenticación más seguro (JWT, webhook secret, etc.)

**Opción C: Usar un servicio externo** (Alternativa)

1. Usar un servicio de cron externo (Cron-job.org, EasyCron, etc.)
2. Configurar el endpoint con header `x-cron-key`
3. Programar el cron cada 5 minutos

### 3. Verificación del Cron

Una vez configurado, verificar que el cron se ejecuta correctamente:

1. Verificar logs en Vercel Dashboard → Functions → Cron Jobs
2. Verificar que el endpoint retorna `200 OK`
3. Verificar que se cancelan holds expirados (consultar la BD)

## Configuración Local (.env.local)

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cron
INTERNAL_CRON_KEY=local-dev-key-123

# Rate Limit (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# TTL
HOLD_TTL_MIN=10

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Verificación

### 1. Verificar Idempotencia (PR1)
```bash
# Disparar el mismo evento de Stripe dos veces
# Verificar que ambas respuestas son 200 OK
# Verificar logs en Vercel Dashboard
```

### 2. Verificar TTL (PR2)
```bash
# Crear hold con HOLD_TTL_MIN=1
# Esperar 60-120 segundos
# Verificar que el hold expirado tiene status='cancelled'
# Verificar logs del cron en Vercel Dashboard
```

### 3. Verificar Rate Limit (PR2)
```bash
# Hacer más de 50 requests en 10 minutos
# Verificar que después del límite se retorna 429
# Verificar logs en Upstash Dashboard
```

### 4. Verificar Anti-Solapes (PR3)
```bash
# Insertar dos holds para el mismo staff_id que se solapen
# Verificar que la segunda petición responde 409
# Verificar que el mensaje de error es claro
```

## Troubleshooting

### Cron no se ejecuta
- Verificar que `vercel.json` está en la raíz del proyecto
- Verificar que el cron está configurado en Vercel Dashboard
- Verificar logs en Vercel Dashboard → Functions → Cron Jobs

### Rate Limit no funciona
- Verificar que `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` están configurados
- Verificar que Upstash Redis está activo
- Verificar logs en Upstash Dashboard

### Constraint anti-solapes no funciona
- Verificar que la extensión `btree_gist` está instalada
- Verificar que el constraint está creado: `excl_staff_overlap_bookings`
- Verificar logs de errores 23P01 en los endpoints

### Webhook no procesa eventos
- Verificar que `STRIPE_WEBHOOK_SECRET` está configurado correctamente
- Verificar que el webhook está configurado en Stripe Dashboard
- Verificar logs en Vercel Dashboard → Functions → Webhooks

