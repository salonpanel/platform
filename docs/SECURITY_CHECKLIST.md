# 🛡️ Checklist de Seguridad - OWASP Noir

## Pre-Commit Checklist

- [ ] Ejecutar análisis de seguridad local
  ```bash
  npm run security:scan
  ```
- [ ] Revisar nuevos endpoints detectados
- [ ] Verificar que no hay vulnerabilidades de severidad alta
- [ ] Documentar cualquier falso positivo nuevo

## Pre-PR Checklist

- [ ] Ejecutar análisis detallado
  ```bash
  npm run security:scan:verbose
  ```
- [ ] Revisar todos los hallazgos de seguridad
- [ ] Corregir vulnerabilidades reales detectadas
- [ ] Actualizar documentación de seguridad si es necesario
- [ ] Verificar que el análisis de CI/CD pasa exitosamente

## Pre-Deploy Checklist

### Desarrollo → Staging
- [ ] Análisis de seguridad completo ejecutado
- [ ] Todas las vulnerabilidades críticas resueltas
- [ ] Reportes de seguridad revisados por el equipo
- [ ] Tests de seguridad automatizados pasando
- [ ] Configuración de seguridad validada

### Staging → Producción
- [ ] Análisis de seguridad en staging completado
- [ ] Zero vulnerabilidades críticas sin resolver
- [ ] Revisión de seguridad por pares completada
- [ ] Logs de seguridad configurados
- [ ] Plan de rollback preparado
- [ ] Monitoreo de seguridad activo

## Revisión de Vulnerabilidades

### Para cada vulnerabilidad detectada:

#### 1. Clasificación
- [ ] Determinar si es real o falso positivo
- [ ] Asignar severidad (Crítica/Alta/Media/Baja)
- [ ] Identificar componentes afectados
- [ ] Estimar impacto potencial

#### 2. Análisis
- [ ] Revisar código fuente relacionado
- [ ] Verificar flujo de datos
- [ ] Identificar vectores de ataque
- [ ] Documentar hallazgos

#### 3. Remediación
- [ ] Crear ticket/issue si es necesario
- [ ] Implementar fix
- [ ] Verificar que el fix funciona
- [ ] Re-ejecutar análisis para confirmar

#### 4. Documentación
- [ ] Actualizar documentación de seguridad
- [ ] Agregar tests para prevenir regresión
- [ ] Compartir aprendizajes con el equipo

## Tipos de Vulnerabilidades - Checklist de Verificación

### SQL Injection
- [ ] Todas las consultas usan parámetros preparados
- [ ] No hay concatenación de strings en queries
- [ ] Input del usuario está validado
- [ ] ORM configurado correctamente

### XSS (Cross-Site Scripting)
- [ ] Output del usuario está sanitizado
- [ ] Headers de seguridad configurados (CSP)
- [ ] No hay `dangerouslySetInnerHTML` sin sanitizar
- [ ] Validación de input en frontend y backend

### Path Traversal
- [ ] Rutas de archivos están validadas
- [ ] No se permite `../` en paths
- [ ] Whitelist de directorios permitidos
- [ ] Permisos de archivos correctos

### Command Injection
- [ ] No se ejecutan comandos con input del usuario
- [ ] Si es necesario, usar librerías seguras
- [ ] Input está estrictamente validado
- [ ] Usar alternativas más seguras cuando sea posible

### Sensitive Data Exposure
- [ ] Datos sensibles encriptados en tránsito (HTTPS)
- [ ] Datos sensibles encriptados en reposo
- [ ] No hay logs de datos sensibles
- [ ] Headers de seguridad configurados

### Open Redirect
- [ ] URLs de redirección validadas
- [ ] Whitelist de dominios permitidos
- [ ] No se confía en parámetros de URL sin validar

## Configuración de Seguridad

### Variables de Entorno
- [ ] No hay secrets en código
- [ ] `.env` en `.gitignore`
- [ ] Variables de producción seguras
- [ ] Rotación de secrets implementada

### Headers de Seguridad
- [ ] Content-Security-Policy configurado
- [ ] X-Frame-Options configurado
- [ ] X-Content-Type-Options configurado
- [ ] Strict-Transport-Security configurado
- [ ] Referrer-Policy configurado

### Autenticación y Autorización
- [ ] Autenticación implementada correctamente
- [ ] Autorización verificada en cada endpoint
- [ ] Tokens seguros (JWT, session)
- [ ] Rate limiting configurado
- [ ] CSRF protection habilitado

### Base de Datos
- [ ] RLS (Row Level Security) configurado
- [ ] Permisos mínimos necesarios
- [ ] Backups configurados
- [ ] Conexiones encriptadas

## Monitoreo y Mantenimiento

### Semanal
- [ ] Revisar reportes de seguridad de CI/CD
- [ ] Verificar logs de seguridad
- [ ] Actualizar dependencias con vulnerabilidades

### Mensual
- [ ] Ejecutar análisis completo de seguridad
- [ ] Revisar y actualizar políticas de seguridad
- [ ] Auditar accesos y permisos
- [ ] Revisar configuración de seguridad

### Trimestral
- [ ] Penetration testing
- [ ] Revisión de arquitectura de seguridad
- [ ] Actualización de documentación
- [ ] Capacitación del equipo en seguridad

## Integración CI/CD

### GitHub Actions
- [ ] Workflow de seguridad configurado
- [ ] Análisis automático en PRs
- [ ] Reportes generados y archivados
- [ ] Notificaciones configuradas
- [ ] Umbrales de vulnerabilidades definidos

### Políticas de Merge
- [ ] Análisis de seguridad debe pasar
- [ ] Revisión de código requerida
- [ ] Tests de seguridad deben pasar
- [ ] Documentación actualizada

## Respuesta a Incidentes

### Si se detecta una vulnerabilidad crítica:

1. **Inmediato (0-1 hora)**
   - [ ] Evaluar severidad e impacto
   - [ ] Notificar al equipo de seguridad
   - [ ] Determinar si está siendo explotada
   - [ ] Implementar mitigación temporal si es necesario

2. **Corto Plazo (1-24 horas)**
   - [ ] Desarrollar fix permanente
   - [ ] Probar fix exhaustivamente
   - [ ] Preparar deploy de emergencia
   - [ ] Documentar incidente

3. **Seguimiento (1-7 días)**
   - [ ] Deploy de fix a producción
   - [ ] Verificar que la vulnerabilidad está cerrada
   - [ ] Análisis post-mortem
   - [ ] Actualizar procesos para prevenir recurrencia

## Recursos y Herramientas

### Herramientas Instaladas
- [x] OWASP Noir (análisis estático)
- [ ] OWASP ZAP (análisis dinámico)
- [ ] Dependabot (vulnerabilidades en dependencias)
- [ ] ESLint security plugins
- [ ] Snyk o similar

### Documentación
- [ ] [Guía Rápida OWASP Noir](./NOIR_QUICK_START.md)
- [ ] [Documentación Completa](./OWASP_NOIR.md)
- [ ] [Políticas de Seguridad](../SECURITY.md)
- [ ] [Guía de Contribución](../CONTRIBUTING.md)

## Notas

**Última revisión**: 2025-11-21  
**Próxima revisión**: [Fecha]  
**Responsable**: [Nombre del equipo/persona]

---

**Recuerda**: La seguridad es responsabilidad de todo el equipo. Si tienes dudas, pregunta antes de hacer commit.
