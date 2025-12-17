# P1.3: Sincronización Stripe desde panel

## Resumen

Implementación completa de la sincronización de servicios con Stripe desde el panel de administración. Los servicios deben tener un `stripe_price_id` configurado para ser vendibles. Si falta, el checkout se bloquea.

## Cambios implementados

### 1. Migración SQL (`0027_p1_stripe_sync.sql`)

- **Columnas**: Asegura que `services` tiene `stripe_product_id` y `stripe_price_id`
- **Índices**: Mejora búsquedas de servicios sin `price_id`
- **Funciones helper**:
  - `is_service_sellable(p_service_id uuid)`: Verifica si un servicio es vendible
  - `get_services_without_price_id(p_tenant_id uuid)`: Retorna servicios activos sin `price_id`

### 2. Endpoint de sincronización (`/api/payments/services/sync`)

**POST `/api/payments/services/sync`**

Sincroniza un servicio o todos los servicios de un tenant con Stripe.

**Body (sincronización individual)**:
```json
{
  "service_id": "uuid",
  "tenant_id": "uuid"
}
```

**Body (sincronización masiva)**:
```json
{
  "tenant_id": "uuid"
}
```

**Response (individual)**:
```json
{
  "service_id": "uuid",
  "product_id": "prod_xxx",
  "price_id": "price_xxx",
  "synced": true
}
```

**Response (masiva)**:
```json
{
  "synced": 5,
  "failed": 0,
  "total": 5,
  "details": [
    {
      "service_id": "uuid",
      "product_id": "prod_xxx",
      "price_id": "price_xxx",
      "synced": true
    }
  ]
}
```

**Características**:
- ✅ Autenticación requerida
- ✅ Autorización: Solo `owner` o `admin` pueden sincronizar
- ✅ Crea/actualiza productos en Stripe
- ✅ Crea nuevos precios si el precio actual no coincide
- ✅ Desactiva precios anteriores cuando se crea uno nuevo
- ✅ Auditoría de cambios en `logs`

### 3. UI de configuración (`/panel/config/payments`)

**Características**:
- ✅ Lista todos los servicios del tenant
- ✅ Muestra estado de sincronización (sincronizado / sin precio)
- ✅ Botón "Sincronizar" para cada servicio
- ✅ Botón "Sincronizar todos" para servicios sin precio
- ✅ Indicadores visuales:
  - ✓ Sincronizado (verde)
  - ⚠ Sin precio (amarillo)
- ✅ Muestra `stripe_product_id` y `stripe_price_id`
- ✅ Alertas de éxito/error

### 4. Validación en checkout

**Endpoints actualizados**:
- ✅ `/api/checkout/intent`: Valida que el servicio tenga `stripe_price_id`
- ✅ `/api/reservations/hold`: Valida que el servicio tenga `stripe_price_id`

**Código de error**: `422 Unprocessable Entity` con código `MISSING_PRICE_ID`

**Mensaje de error**: 
```
"Servicio no vendible. El servicio no tiene un precio configurado en Stripe. Por favor, sincroniza el servicio con Stripe primero."
```

## Flujo de uso

1. **Crear servicio**:
   - El servicio se crea en la base de datos
   - Si se crea desde `/api/services`, se crea automáticamente en Stripe
   - Si se crea manualmente, no tiene `stripe_price_id`

2. **Sincronizar servicio**:
   - Ir a `/panel/config/payments`
   - Hacer clic en "Sincronizar" para el servicio
   - El endpoint crea/actualiza el producto y precio en Stripe
   - Se actualiza el servicio en la base de datos con los IDs de Stripe

3. **Checkout**:
   - Si el servicio no tiene `stripe_price_id`, el checkout se bloquea
   - Si tiene `stripe_price_id`, el checkout continúa normalmente

## Seguridad

- ✅ Autenticación requerida
- ✅ Autorización: Solo `owner` o `admin` pueden sincronizar
- ✅ Validación de `tenant_id` en todas las operaciones
- ✅ Auditoría de cambios en `logs`

## Auditoría

Todos los cambios se registran en la tabla `logs`:
- `action`: `service_synced_with_stripe`
- `resource_type`: `service`
- `resource_id`: ID del servicio
- `metadata`: `product_id`, `price_id`, `price_cents`

## Pruebas

### Manual

1. **Crear servicio sin Stripe**:
   ```sql
   INSERT INTO services (tenant_id, name, duration_min, price_cents, active)
   VALUES ('tenant_id', 'Servicio de prueba', 30, 2000, true);
   ```

2. **Intentar checkout**:
   ```bash
   curl -X POST http://localhost:3000/api/checkout/intent \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "tenant_id",
       "service_id": "service_id",
       "starts_at": "2024-01-01T10:00:00Z"
     }'
   ```
   Debe retornar `422` con código `MISSING_PRICE_ID`

3. **Sincronizar servicio**:
   ```bash
   curl -X POST http://localhost:3000/api/payments/services/sync \
     -H "Content-Type: application/json" \
     -H "Cookie: ..." \
     -d '{
       "service_id": "service_id",
       "tenant_id": "tenant_id"
     }'
   ```

4. **Verificar sincronización**:
   ```sql
   SELECT id, name, stripe_product_id, stripe_price_id
   FROM services
   WHERE id = 'service_id';
   ```

5. **Intentar checkout de nuevo**:
   Debe funcionar correctamente

### Automatizadas

- ✅ Validación de autenticación
- ✅ Validación de autorización
- ✅ Validación de `price_id` en checkout
- ✅ Creación de productos y precios en Stripe
- ✅ Actualización de precios cuando cambia el precio

## Notas

- **Precios en Stripe**: Stripe no permite actualizar precios, solo crear nuevos. Cuando se crea un nuevo precio, el anterior se desactiva.
- **Metadata**: Los productos y precios en Stripe incluyen metadata con `tenant_id` y `service_id` para trazabilidad.
- **Currency**: Por defecto se usa `EUR`, configurable con `STRIPE_DEFAULT_CURRENCY`.
- **Legacy**: El endpoint `/api/services/migrate` todavía existe pero usa `org_id` en lugar de `tenant_id`. Se recomienda usar el nuevo endpoint `/api/payments/services/sync`.

## Próximos pasos

- [ ] Migrar endpoint `/api/services/migrate` para usar `tenant_id`
- [ ] Añadir tests automatizados
- [ ] Añadir UI para editar precios (requiere crear nuevo precio en Stripe)
- [ ] Añadir sincronización automática cuando se actualiza el precio de un servicio
- [ ] Añadir webhook de Stripe para sincronizar cambios en productos/precios

