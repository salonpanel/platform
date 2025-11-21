# OWASP Noir - Análisis de Seguridad

Este proyecto utiliza **OWASP Noir** para detectar automáticamente endpoints y superficies de ataque en el código fuente, mejorando la seguridad de la aplicación.

## 🔍 ¿Qué es OWASP Noir?

OWASP Noir es una herramienta de análisis estático que:
- Extrae endpoints de API y parámetros del código fuente
- Detecta vulnerabilidades potenciales mediante análisis basado en reglas
- Soporta múltiples lenguajes y frameworks (incluyendo Next.js/React)
- Se integra con herramientas de seguridad como ZAP y Caido
- Genera reportes en formatos JSON, YAML y OpenAPI Specification

## 📦 Instalación

### Windows

Ejecuta el script de instalación incluido:

```powershell
.\scripts\install-noir.ps1
```

Este script:
1. Descarga la última versión de OWASP Noir desde GitHub
2. Instala el ejecutable en `~\.noir\`
3. Agrega automáticamente Noir al PATH del sistema

### Linux/macOS

```bash
# Usando Homebrew
brew install noir

# O descarga manual
wget https://github.com/owasp-noir/noir/releases/latest/download/noir-<version>-<arch>.tar.gz
tar -xzf noir-*.tar.gz
sudo mv noir /usr/local/bin/
```

### Verificar instalación

```bash
noir --version
```

## 🚀 Uso

### Análisis Local

Ejecuta un análisis de seguridad completo:

```powershell
# Análisis básico
.\scripts\run-noir-scan.ps1

# Con URL personalizada
.\scripts\run-noir-scan.ps1 -BaseUrl "https://staging.example.com"

# Con formato específico
.\scripts\run-noir-scan.ps1 -OutputFormat "yaml"

# Con tags de vulnerabilidades y modo verbose
.\scripts\run-noir-scan.ps1 -WithTags -Verbose
```

### Análisis Manual

```bash
# Análisis básico del proyecto
noir -b . -u https://localhost:3000

# Con detección de vulnerabilidades
noir -b . -u https://localhost:3000 -T

# Exportar como JSON
noir -b . -u https://localhost:3000 -f json > security-reports/report.json

# Exportar como OpenAPI Specification
noir -b . -u https://localhost:3000 -f oas3 > security-reports/openapi.json
```

## 📊 Reportes

Los reportes se generan automáticamente en el directorio `security-reports/` con timestamp:

```
security-reports/
├── noir-report_2025-11-21_22-30-00.json
├── noir-report_2025-11-21_22-30-00.yaml
└── openapi-spec.json
```

### Estructura del Reporte JSON

```json
{
  "endpoints": [
    {
      "url": "https://localhost:3000/api/auth/login",
      "method": "POST",
      "params": [
        {
          "name": "email",
          "value": "",
          "param_type": "form",
          "tags": []
        },
        {
          "name": "password",
          "value": "",
          "param_type": "form",
          "tags": [
            {
              "name": "sensitive_data",
              "description": "This parameter contains sensitive information",
              "tagger": "Hunt"
            }
          ]
        }
      ],
      "details": {
        "code_paths": [
          {
            "path": "app/api/auth/login/route.ts",
            "line": 15
          }
        ]
      },
      "protocol": "http",
      "tags": []
    }
  ]
}
```

## 🔄 Integración CI/CD

### GitHub Actions

El proyecto incluye un workflow de GitHub Actions que:
- Se ejecuta automáticamente en push/PR a `main` y `develop`
- Ejecuta análisis semanales programados
- Genera reportes y los sube como artefactos
- Comenta en PRs con resultados del análisis
- Falla si se detectan demasiadas vulnerabilidades

El workflow está en: `.github/workflows/noir-security-scan.yml`

### Ejecutar manualmente en GitHub

1. Ve a la pestaña "Actions" en GitHub
2. Selecciona "OWASP Noir Security Scan"
3. Click en "Run workflow"
4. Opcionalmente, especifica una URL base personalizada

## 🛡️ Vulnerabilidades Detectadas

OWASP Noir puede detectar:

- **SQL Injection**: Parámetros que pueden ser vulnerables a inyección SQL
- **XSS (Cross-Site Scripting)**: Parámetros que pueden permitir inyección de scripts
- **Path Traversal**: Rutas que pueden ser vulnerables a traversal
- **Command Injection**: Parámetros que pueden ejecutar comandos del sistema
- **SSRF (Server-Side Request Forgery)**: Endpoints que pueden hacer requests arbitrarios
- **Open Redirect**: Redirecciones que pueden ser manipuladas
- **Sensitive Data Exposure**: Parámetros que manejan datos sensibles

## 📈 Mejores Prácticas

1. **Ejecuta análisis regularmente**: Antes de cada deploy o PR importante
2. **Revisa los reportes**: No todos los hallazgos son vulnerabilidades reales (falsos positivos)
3. **Prioriza por severidad**: Enfócate primero en vulnerabilidades críticas
4. **Integra con DAST**: Usa los reportes de Noir para alimentar herramientas DAST como ZAP
5. **Documenta excepciones**: Si un hallazgo es un falso positivo, documéntalo

## 🔗 Integración con Otras Herramientas

### OWASP ZAP

Exporta los endpoints detectados para usarlos con ZAP:

```bash
noir -b . -u https://localhost:3000 -f json > endpoints.json
# Importa endpoints.json en ZAP para escaneo dinámico
```

### Caido

```bash
noir -b . -u https://localhost:3000 -f caido > caido-endpoints.txt
```

### OpenAPI/Swagger

```bash
noir -b . -u https://localhost:3000 -f oas3 > openapi-spec.json
# Usa openapi-spec.json con herramientas compatibles con OpenAPI
```

## 📝 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `install-noir.ps1` | Instala OWASP Noir en Windows |
| `run-noir-scan.ps1` | Ejecuta análisis de seguridad completo |

### Agregar a package.json

Puedes agregar estos scripts a tu `package.json`:

```json
{
  "scripts": {
    "security:scan": "powershell -File scripts/run-noir-scan.ps1",
    "security:install": "powershell -File scripts/install-noir.ps1"
  }
}
```

Luego ejecuta:

```bash
npm run security:scan
```

## 🎯 Configuración

La configuración de Noir está en `.noir.yml`:

```yaml
exclude:
  - node_modules
  - .next
  - .vercel

security:
  enable_vulnerability_detection: true
  min_severity: low

reporting:
  default_format: json
  include_security_tags: true
```

## 🚨 Umbrales de Seguridad

El workflow de CI/CD está configurado para:
- ✅ **Permitir**: Hasta 10 vulnerabilidades potenciales
- ❌ **Fallar**: Más de 10 vulnerabilidades potenciales

Puedes ajustar este umbral en `.github/workflows/noir-security-scan.yml`:

```yaml
MAX_VULNERABILITIES=10  # Cambia este valor
```

## 📚 Recursos Adicionales

- [Documentación oficial de OWASP Noir](https://owasp-noir.github.io/noir/)
- [Repositorio de GitHub](https://github.com/owasp-noir/noir)
- [Blog: Powering Up DAST with ZAP and Noir](https://www.zaproxy.org/blog/2024-11-11-powering-up-dast-with-zap-and-noir/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## 🤝 Contribuir

Si encuentras problemas o tienes sugerencias para mejorar la configuración de seguridad:

1. Abre un issue en el repositorio
2. Propón mejoras en los scripts de análisis
3. Comparte hallazgos de seguridad de forma responsable

## ⚠️ Notas Importantes

- **Falsos Positivos**: OWASP Noir puede reportar falsos positivos. Revisa cada hallazgo manualmente.
- **Complemento, no reemplazo**: Noir es una herramienta de análisis estático. Complementa con pruebas dinámicas (DAST) y revisiones manuales.
- **Datos Sensibles**: Los reportes pueden contener rutas de código. No los compartas públicamente sin revisarlos.
- **Actualizaciones**: Mantén OWASP Noir actualizado para obtener las últimas reglas de detección.

---

**Última actualización**: 2025-11-21  
**Versión de Noir recomendada**: Latest (se instala automáticamente)
