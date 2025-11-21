# 🚀 Guía Rápida: OWASP Noir

## Instalación (Solo una vez)

```bash
npm run security:install
```

## Uso Diario

### 1. Análisis Rápido
```bash
npm run security:scan
```

### 2. Análisis Detallado (con vulnerabilidades)
```bash
npm run security:scan:verbose
```

### 3. Análisis para Producción
```bash
npm run security:scan:prod
```

## Interpretando Resultados

### ✅ Todo OK
```
✓ Análisis completado exitosamente
✓ No se detectaron vulnerabilidades obvias
```
**Acción**: Ninguna, continúa con tu trabajo.

### ⚠️ Vulnerabilidades Detectadas
```
⚠ Vulnerabilidades potenciales detectadas: 5
Revisa el reporte completo para más detalles
```
**Acción**: 
1. Abre el reporte en `security-reports/`
2. Revisa cada vulnerabilidad
3. Determina si es real o falso positivo
4. Corrige las vulnerabilidades reales

## Tipos de Vulnerabilidades Comunes

| Tag | Descripción | Severidad | Acción |
|-----|-------------|-----------|--------|
| `sqli` | SQL Injection | 🔴 Alta | Usar consultas parametrizadas |
| `xss` | Cross-Site Scripting | 🔴 Alta | Sanitizar entrada del usuario |
| `path_traversal` | Path Traversal | 🟠 Media | Validar rutas de archivos |
| `command_injection` | Command Injection | 🔴 Alta | Evitar ejecutar comandos con input del usuario |
| `sensitive_data` | Datos Sensibles | 🟡 Baja | Revisar manejo de datos |
| `open_redirect` | Open Redirect | 🟠 Media | Validar URLs de redirección |

## Workflow Recomendado

### Antes de Commit
```bash
npm run security:scan
```

### Antes de PR
```bash
npm run security:scan:verbose
```

### Antes de Deploy
```bash
# El CI/CD ejecuta automáticamente el análisis
# Revisa los resultados en GitHub Actions
```

## Comandos Útiles

### Ver último reporte
```powershell
# Listar reportes
ls security-reports/

# Abrir último reporte en VS Code
code (Get-ChildItem security-reports/*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
```

### Limpiar reportes antiguos
```powershell
# Eliminar reportes de más de 30 días
Get-ChildItem security-reports/ -Recurse | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)} | Remove-Item
```

## Integración con Herramientas

### OWASP ZAP
```bash
# 1. Generar reporte
npm run security:scan

# 2. Importar en ZAP
# File > Import URLs from File > Seleccionar security-reports/noir-report_*.json
```

### Postman/Insomnia
```bash
# Generar OpenAPI spec
noir -b . -u https://localhost:3000 -f oas3 > security-reports/openapi.json

# Importar openapi.json en Postman o Insomnia
```

## Solución de Problemas

### Error: "noir no se reconoce como comando"
```bash
# Reinstalar
npm run security:install

# O reiniciar terminal
```

### Error: "No se puede ejecutar scripts"
```powershell
# Habilitar ejecución de scripts (como admin)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Demasiados falsos positivos
1. Revisa `.noir.yml` para ajustar configuración
2. Excluye directorios específicos
3. Ajusta `min_severity` a `medium` o `high`

## Mejores Prácticas

✅ **DO**
- Ejecutar análisis antes de cada PR importante
- Revisar todos los hallazgos de severidad alta
- Documentar falsos positivos conocidos
- Mantener Noir actualizado
- Integrar con otras herramientas de seguridad

❌ **DON'T**
- Ignorar todos los hallazgos sin revisar
- Subir reportes de seguridad al repositorio
- Confiar solo en análisis estático
- Deshabilitar el análisis en CI/CD

## Recursos

- 📖 [Documentación completa](./OWASP_NOIR.md)
- 🔗 [OWASP Noir Docs](https://owasp-noir.github.io/noir/)
- 🐛 [Reportar problemas](https://github.com/owasp-noir/noir/issues)

---

**¿Preguntas?** Revisa la [documentación completa](./OWASP_NOIR.md) o contacta al equipo de seguridad.
