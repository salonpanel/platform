# ✅ Checklist de Deployment - Correcciones de Seguridad

**Fecha:** 2025-11-21  
**Proyecto:** BookFast - Panel Pro

---

## 📋 Pre-Deployment

### Revisión de Código

- [x] ✅ Revisar cambios en `src/lib/supabase/browser.ts`
- [x] ✅ Revisar cambios en `app/auth/callback/route.ts`
- [x] ✅ Revisar cambios en `app/api/auth/verify-otp/route.ts`
- [x] ✅ Revisar cambios en `app/supabase-provider.tsx`
- [ ] ⏳ Revisar que no hay logs sensibles en producción
- [ ] ⏳ Revisar que todas las variables de entorno están configuradas

### Testing Local

- [ ] ⏳ **Login en localhost**
  - [ ] Enviar OTP
  - [ ] Verificar código
  - [ ] Comprobar que las cookies se establecen
  - [ ] Recargar página y verificar persistencia de sesión
  - [ ] Cerrar sesión y verificar que las cookies se eliminan

- [ ] ⏳ **CSRF Protection**
  - [ ] Intentar enviar request desde origen no permitido
  - [ ] Verificar que se rechaza con 403

- [ ] ⏳ **Open Redirect**
  - [ ] Intentar redirect a ruta externa
  - [ ] Verificar que se redirige a /panel (default)

### Preparación de Deployment

- [ ] ⏳ Hacer commit de los cambios
  ```bash
  git add .
  git commit -m "🔒 Security: Implement auth security fixes
  
  - Add secure cookie configuration (SameSite=Lax, dynamic domain)
  - Add redirect validation with whitelist
  - Add CSRF protection with origin validation
  - Add conditional logging (dev only)
  
  Fixes critical security vulnerabilities in authentication system."
  ```

- [ ] ⏳ Push a repositorio
  ```bash
  git push origin main
  ```

---

## 🚀 Deployment a Staging

### Deploy

- [ ] ⏳ Deploy a staging
  ```bash
  # Si usas Vercel
  vercel --prod
  
  # O si usas otro servicio
  npm run deploy:staging
  ```

### Testing en Staging

- [ ] ⏳ **Login en staging**
  - [ ] Abrir https://staging.pro.bookfast.es/login
  - [ ] Enviar OTP
  - [ ] Verificar código
  - [ ] Comprobar que las cookies se establecen con Domain=.bookfast.es
  - [ ] Recargar página y verificar persistencia de sesión

- [ ] ⏳ **Verificar cookies en DevTools**
  - [ ] Abrir DevTools > Application > Cookies
  - [ ] Verificar que `sb-panel-auth-auth-token` tiene:
    - Domain: `.bookfast.es`
    - SameSite: `Lax`
    - Secure: `true`
    - HttpOnly: `true` (si aplica)

- [ ] ⏳ **Verificar que no hay logs sensibles**
  - [ ] Abrir DevTools > Console
  - [ ] Hacer login completo
  - [ ] Verificar que NO hay logs de autenticación en consola

- [ ] ⏳ **CSRF Protection en staging**
  ```bash
  curl -X POST https://staging.pro.bookfast.es/api/auth/verify-otp \
    -H "Origin: https://malicious-site.com" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","token":"12345678"}'
  
  # Resultado esperado: 403 Forbidden
  ```

- [ ] ⏳ **Open Redirect en staging**
  - [ ] Intentar: `https://staging.pro.bookfast.es/auth/callback?code=xxx&redirect_to=https://google.com`
  - [ ] Verificar que redirige a `/panel` (default)

### Monitoreo

- [ ] ⏳ Verificar logs de servidor (Vercel/Railway/etc.)
- [ ] ⏳ Verificar que no hay errores en Sentry (si aplica)
- [ ] ⏳ Verificar métricas de autenticación

---

## 🎯 Deployment a Producción

### Pre-Production Checklist

- [ ] ⏳ Todos los tests en staging pasaron
- [ ] ⏳ No hay errores en logs de staging
- [ ] ⏳ Equipo notificado del deployment
- [ ] ⏳ Plan de rollback preparado

### Deploy

- [ ] ⏳ Deploy a producción
  ```bash
  # Si usas Vercel
  vercel --prod
  
  # O si usas otro servicio
  npm run deploy:production
  ```

### Post-Deployment Testing

- [ ] ⏳ **Login en producción**
  - [ ] Abrir https://pro.bookfast.es/login
  - [ ] Enviar OTP
  - [ ] Verificar código
  - [ ] Comprobar que las cookies se establecen
  - [ ] Recargar página y verificar persistencia de sesión

- [ ] ⏳ **Verificar cookies en producción**
  - [ ] Abrir DevTools > Application > Cookies
  - [ ] Verificar configuración correcta de cookies

- [ ] ⏳ **Verificar que no hay logs sensibles en producción**
  - [ ] Abrir DevTools > Console
  - [ ] Hacer login completo
  - [ ] Verificar que NO hay logs

- [ ] ⏳ **Smoke tests**
  - [ ] Login con usuario real
  - [ ] Navegar a /panel/agenda
  - [ ] Navegar a /panel/clientes
  - [ ] Cerrar sesión
  - [ ] Verificar que redirige a /login

### Monitoreo Post-Deployment

- [ ] ⏳ Monitorear logs durante 1 hora
- [ ] ⏳ Verificar métricas de autenticación
- [ ] ⏳ Verificar que no hay errores en Sentry
- [ ] ⏳ Verificar que no hay quejas de usuarios

---

## 📊 Métricas a Monitorear

### Métricas de Autenticación

- [ ] ⏳ Tasa de éxito de login
- [ ] ⏳ Tiempo promedio de login
- [ ] ⏳ Número de intentos fallidos
- [ ] ⏳ Número de sesiones activas

### Métricas de Seguridad

- [ ] ⏳ Número de requests rechazados por CSRF
- [ ] ⏳ Número de redirects bloqueados
- [ ] ⏳ Número de rate limits alcanzados (cuando se implemente)

### Métricas de Performance

- [ ] ⏳ Tiempo de respuesta de /api/auth/verify-otp
- [ ] ⏳ Tiempo de respuesta de /auth/callback
- [ ] ⏳ Tiempo de carga de /login

---

## 🔄 Plan de Rollback

### Si algo sale mal

1. **Identificar el problema**
   - [ ] Revisar logs de servidor
   - [ ] Revisar errores en Sentry
   - [ ] Revisar quejas de usuarios

2. **Rollback inmediato**
   ```bash
   # Si usas Vercel
   vercel rollback
   
   # O si usas Git
   git revert HEAD
   git push origin main
   ```

3. **Notificar al equipo**
   - [ ] Notificar en Slack/Discord
   - [ ] Documentar el problema
   - [ ] Planear fix

4. **Investigar y corregir**
   - [ ] Reproducir el problema en local
   - [ ] Corregir el problema
   - [ ] Re-testear en staging
   - [ ] Re-deploy a producción

---

## 📝 Notas de Deployment

### Cambios Implementados

1. ✅ **Configuración de cookies segura**
   - SameSite=Lax para protección CSRF
   - Dominio dinámico según entorno
   - Secure solo en producción

2. ✅ **Validación de redirects**
   - Whitelist de rutas permitidas
   - Protección contra open redirect

3. ✅ **CSRF protection**
   - Validación de origen de requests
   - Solo orígenes confiables

4. ✅ **Logs condicionales**
   - Solo en desarrollo
   - No hay información sensible en producción

### Impacto Esperado

- ✅ **Seguridad:** Mejora significativa (3/10 → 8/10)
- ✅ **Performance:** Sin impacto negativo
- ✅ **UX:** Sin cambios visibles para el usuario
- ✅ **Compatibilidad:** Compatible con versiones anteriores

### Riesgos Conocidos

- ⚠️ **Cookies en localhost:** Ahora funcionan correctamente
- ⚠️ **Cookies en producción:** Ahora son más seguras
- ⚠️ **Redirects:** Solo rutas permitidas funcionan

---

## ✅ Sign-Off

### Pre-Deployment

- [ ] ⏳ **Developer:** Código revisado y testeado
- [ ] ⏳ **Tech Lead:** Cambios aprobados
- [ ] ⏳ **QA:** Tests pasados en staging

### Post-Deployment

- [ ] ⏳ **Developer:** Deployment exitoso
- [ ] ⏳ **Tech Lead:** Monitoreo OK
- [ ] ⏳ **QA:** Smoke tests pasados

---

## 📞 Contactos de Emergencia

### En caso de problemas críticos

- **Developer:** [Tu nombre]
- **Tech Lead:** [Nombre del Tech Lead]
- **DevOps:** [Nombre del DevOps]

### Canales de Comunicación

- **Slack:** #engineering-alerts
- **Email:** engineering@bookfast.es
- **Phone:** [Número de emergencia]

---

**Preparado por:** Antigravity AI  
**Fecha:** 2025-11-21  
**Versión:** 1.0
