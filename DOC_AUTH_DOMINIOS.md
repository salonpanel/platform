# 🔐 Configuración de Autenticación Multi-Dominio - BookFast

**Fecha**: 2024-12-19  
**Propósito**: Documentar las URLs de callback y redirect que deben registrarse en Supabase Auth para que la autenticación funcione correctamente con la arquitectura multi-dominio.

---

## 📋 URLs a Registrar en Supabase Dashboard

### Producción

En el dashboard de Supabase, ve a **Authentication > URL Configuration** y añade las siguientes URLs:

#### Site URL (Principal)
```
https://pro.bookfast.es
```

#### Redirect URLs (Permitidas)
```
https://pro.bookfast.es/auth/callback
https://pro.bookfast.es/auth/magic-link-handler
https://admin.bookfast.es/auth/callback
https://admin.bookfast.es/auth/magic-link-handler
```

**Nota**: Por ahora, todos los flujos de autenticación redirigen a `pro.bookfast.es` como dominio principal. En el futuro, si se implementa login desde el portal público o marketing, se añadirán URLs adicionales.

---

## 🔄 Flujos de Autenticación

### 1. Login desde Panel (`pro.bookfast.es`)

**Flujo**:
1. Usuario visita `https://pro.bookfast.es/login`
2. Ingresa email y solicita magic link
3. Supabase envía email con magic link
4. Usuario hace clic en el link
5. **Redirect a**: `https://pro.bookfast.es/auth/callback?code=...`
6. Handler procesa el código y establece sesión
7. Redirige a `/panel` (o URL en `?redirect=`)

**URLs necesarias**:
- `https://pro.bookfast.es/auth/callback` ✅
- `https://pro.bookfast.es/auth/magic-link-handler` ✅

### 2. Login desde Admin (`admin.bookfast.es`)

**Flujo**:
1. Usuario visita `https://admin.bookfast.es/login` (o redirige desde middleware)
2. Ingresa email y solicita magic link
3. Supabase envía email con magic link
4. Usuario hace clic en el link
5. **Redirect a**: `https://pro.bookfast.es/auth/callback?code=...` (por ahora, todos usan pro)
6. Handler procesa el código y establece sesión
7. Redirige a `/admin` (o URL en `?redirect=`)

**URLs necesarias**:
- `https://pro.bookfast.es/auth/callback` ✅ (compartido con panel)
- `https://admin.bookfast.es/auth/callback` ✅ (futuro, si se implementa login directo desde admin)

### 3. Auto-login en Desarrollo (`dev-login`)

**Flujo**:
1. Usuario visita `http://localhost:3000/login` con email de desarrollo
2. Endpoint `/api/auth/dev-login` genera magic link automáticamente
3. **Redirect a**: `http://localhost:3000/auth/magic-link-handler`
4. Handler procesa y establece sesión
5. Redirige a `/panel`

**URLs necesarias** (solo desarrollo):
- `http://localhost:3000/auth/callback` ✅
- `http://localhost:3000/auth/magic-link-handler` ✅

---

## 🚧 Futuras Extensiones

### Login desde Portal Público (Futuro)

Si en el futuro se implementa login desde el portal público (`{tenant}.bookfast.es`), se necesitarán URLs adicionales:

```
https://*.bookfast.es/auth/callback
```

**Nota**: Supabase puede no soportar wildcards directamente. En ese caso, se podría:
1. Usar un dominio centralizado para todos los callbacks (recomendado)
2. Registrar dominios específicos de tenants importantes
3. Usar un subdominio dedicado como `auth.bookfast.es`

### Login desde Marketing (Futuro)

Si en el futuro se implementa login desde `bookfast.es` (marketing), se necesitará:

```
https://bookfast.es/auth/callback
```

---

## ⚙️ Configuración Actual en Código

### Archivos Relevantes

1. **`lib/urls.ts`**:
   - `getAuthRedirectUrl()` - Obtiene URL de callback según contexto
   - Por ahora, siempre retorna `pro.bookfast.es/auth/callback`

2. **`app/login/page.tsx`**:
   - Usa rutas relativas para callbacks (`/auth/callback`)
   - El navegador completa automáticamente con el dominio actual

3. **`app/auth/callback/route.ts`**:
   - Valida el host usando `NEXT_PUBLIC_APP_URL`
   - En desarrollo, es más flexible
   - En producción, verifica estrictamente el host

4. **`app/api/auth/dev-login/route.ts`**:
   - Usa `getAuthRedirectUrl()` para generar magic links
   - Solo funciona en desarrollo

---

## ✅ Checklist de Configuración

### Supabase Dashboard

- [ ] Site URL configurado: `https://pro.bookfast.es`
- [ ] Redirect URL añadida: `https://pro.bookfast.es/auth/callback`
- [ ] Redirect URL añadida: `https://pro.bookfast.es/auth/magic-link-handler`
- [ ] Redirect URL añadida: `https://admin.bookfast.es/auth/callback` (opcional, futuro)
- [ ] Redirect URL añadida: `https://admin.bookfast.es/auth/magic-link-handler` (opcional, futuro)

### Variables de Entorno

- [ ] `NEXT_PUBLIC_APP_URL` configurado en producción: `https://pro.bookfast.es`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurado
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurado
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurado (solo servidor)

### Desarrollo Local

- [ ] En desarrollo, `NEXT_PUBLIC_APP_URL` puede estar vacío (se infiere del host)
- [ ] URLs de localhost funcionan automáticamente

---

## 🔒 Seguridad

### Validación de Hosts

El código valida que los callbacks provengan de hosts permitidos:

- **Desarrollo**: Más flexible, acepta `localhost` y variantes
- **Producción**: Verificación estricta contra `NEXT_PUBLIC_APP_URL`

### Prevención de Ataques

- Los magic links tienen códigos únicos y expiran
- Los tokens se validan en el servidor
- Los hosts se verifican antes de procesar callbacks

---

## 📝 Notas Técnicas

### Por qué todos los logins usan `pro.bookfast.es`

**Decisión de diseño**: Por ahora, todos los flujos de autenticación redirigen a `pro.bookfast.es` porque:

1. **Simplicidad**: Un solo dominio para callbacks simplifica la configuración
2. **Seguridad**: Menos URLs que mantener y validar
3. **UX**: El usuario siempre termina en el panel después de autenticarse

**Extensibilidad**: El código está preparado para extender a otros dominios en el futuro. Ver comentarios `TODO` en `lib/urls.ts`.

### Magic Link Handler vs Callback

- **`/auth/callback`**: Handler del servidor que procesa códigos/tokens
- **`/auth/magic-link-handler`**: Handler del cliente que procesa magic links con hash (#)

Ambos son necesarios para cubrir diferentes flujos de Supabase Auth.

---

**Última actualización**: 2024-12-19




