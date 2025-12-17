# 🔧 Configurar Dominio en Vercel - Solución al Error 404

## 🚨 Problema Actual

Cuando intentas acceder a `https://pro.bookfast.es` obtienes:
```
404: NOT_FOUND
Code: DEPLOYMENT_NOT_FOUND
```

Esto significa que **el dominio no está configurado en Vercel** o **no está apuntando correctamente a Vercel**.

## ✅ Solución Paso a Paso

### Paso 1: Verificar Deployment en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Deployments**
4. Verifica que hay un deployment exitoso (debe aparecer como "Ready" con un check verde)

### Paso 2: Añadir Dominio en Vercel

1. En el Dashboard de Vercel, ve a **Settings** → **Domains**
2. Click en **Add Domain**
3. Introduce: `pro.bookfast.es`
4. Click en **Add**

### Paso 3: Configurar DNS en tu Proveedor de Dominio

Vercel te mostrará las instrucciones de DNS. Necesitas configurar un **registro CNAME** o **A** en tu proveedor de dominio (donde compraste `bookfast.es`).

#### Opción A: CNAME (Recomendado)

En tu proveedor de DNS (ej: Cloudflare, Namecheap, GoDaddy):

1. Crea un registro **CNAME**:
   - **Nombre/Host**: `pro`
   - **Valor/Target**: `cname.vercel-dns.com` (o el que Vercel te indique)
   - **TTL**: 3600 (o automático)

#### Opción B: A Record (Alternativa)

Si CNAME no está disponible:

1. Vercel te dará una IP (ej: `76.76.21.21`)
2. Crea un registro **A**:
   - **Nombre/Host**: `pro`
   - **Valor/Target**: `76.76.21.21` (la IP que Vercel te dé)
   - **TTL**: 3600

### Paso 4: Verificar Configuración DNS

Después de configurar DNS, puede tardar unos minutos en propagarse. Verifica:

```bash
# Verificar que el dominio apunta a Vercel
nslookup pro.bookfast.es

# O usar dig (si tienes dig instalado)
dig pro.bookfast.es
```

Deberías ver que apunta a Vercel (cname.vercel-dns.com o una IP de Vercel).

### Paso 5: Verificar en Vercel

1. En Vercel Dashboard → **Settings** → **Domains**
2. El dominio `pro.bookfast.es` debe aparecer como:
   - ✅ **Valid Configuration** (verde)
   - Si aparece en amarillo/rojo, revisa los logs de DNS

### Paso 6: Configurar Variable de Entorno

Una vez que el dominio esté configurado y funcionando:

1. Ve a **Settings** → **Environment Variables**
2. Busca `NEXT_PUBLIC_APP_URL`
3. Asegúrate de que en **Production** está configurado como:
   ```
   NEXT_PUBLIC_APP_URL=https://pro.bookfast.es
   ```
4. Si no existe, créala para **Production**

### Paso 7: Verificar SSL/HTTPS

Vercel configura automáticamente SSL/HTTPS. Debería aparecer como:
- ✅ **SSL Certificate**: Valid (automático)

Si no está validado, espera unos minutos (Vercel necesita generar el certificado).

## 🔍 Troubleshooting

### Error: "Domain not found" o 404

**Causas posibles:**
1. ❌ El dominio no está añadido en Vercel
2. ❌ El DNS no está configurado correctamente
3. ❌ El DNS aún no se ha propagado (puede tardar hasta 48 horas, normalmente 5-30 minutos)

**Solución:**
1. Verifica que el dominio está en Vercel Dashboard → Settings → Domains
2. Verifica que el DNS está configurado correctamente en tu proveedor
3. Espera a que se propague el DNS (usa [whatsmydns.net](https://www.whatsmydns.net) para verificar)

### Error: "DNS_PROBE_FINISHED_NXDOMAIN"

**Causa:** El DNS no está configurado o el dominio no existe.

**Solución:**
1. Verifica que el registro CNAME/A está creado en tu proveedor de DNS
2. Verifica que el nombre del registro es exactamente `pro` (sin puntos ni espacios)
3. Espera a que se propague el DNS

### El dominio funciona pero da 404

**Causa:** El dominio está configurado pero Vercel no lo reconoce o hay un problema con el deployment.

**Solución:**
1. Verifica que hay un deployment activo en Vercel
2. Verifica que el dominio está asignado al proyecto correcto
3. Intenta hacer un nuevo deployment: **Deployments** → **Redeploy**

### El dominio funciona pero redirige incorrectamente

**Causa:** `NEXT_PUBLIC_APP_URL` no está configurado o está mal configurado.

**Solución:**
1. Verifica que `NEXT_PUBLIC_APP_URL=https://pro.bookfast.es` está en Production
2. Haz un nuevo deployment después de cambiar la variable
3. Verifica que no hay espacios o caracteres extraños en la variable

## 📋 Checklist de Configuración

- [ ] Dominio añadido en Vercel Dashboard → Settings → Domains
- [ ] DNS configurado en proveedor (CNAME o A record)
- [ ] DNS propagado (verificado con nslookup/dig)
- [ ] `NEXT_PUBLIC_APP_URL` configurado en Production
- [ ] SSL/HTTPS validado en Vercel
- [ ] Deployment activo y funcionando
- [ ] Dominio aparece como "Valid Configuration" en Vercel

## 🆘 Si Nada Funciona

1. **Verifica los logs de Vercel:**
   - Ve a **Deployments** → Selecciona un deployment → **Functions** → **Logs**
   - Busca errores relacionados con el dominio

2. **Contacta con Vercel:**
   - Si el dominio está configurado pero sigue dando 404, puede ser un problema de Vercel
   - Ve a [Vercel Support](https://vercel.com/support)

3. **Verifica el middleware:**
   - El middleware espera que el host sea exactamente `pro.bookfast.es`
   - Si hay redirecciones o proxies, puede causar problemas

## 📚 Referencias

- [Vercel Domain Configuration](https://vercel.com/docs/concepts/projects/domains)
- [DNS Propagation Checker](https://www.whatsmydns.net)
- `docs/DEPLOY_VERCEL.md` - Guía completa de deployment



