# 📁 Índice de Archivos - Seed BookFast Demo

## 🎯 Archivos Principales (Ejecutar en Este Orden)

### 1️⃣ seed_bookfast_demo.sql
**Descripción**: Script principal que crea la estructura base del tenant BookFast
**Contenido**:
- Tenant BookFast
- Tenant settings
- 8 servicios de barbería
- 4 barberos (staff)
- Horarios semanales
- Asignación servicios-barberos
- 30 clientes

**Ejecutar**: Primero

---

### 2️⃣ seed_bookfast_assign_users.sql
**Descripción**: Helper para asignar usuarios owners al tenant
**Contenido**:
- Query para obtener user IDs
- Template para crear memberships
- Asignación de permisos
- Configuración de profiles

**Ejecutar**: Segundo (después de obtener tus user IDs)

---

### 3️⃣ seed_bookfast_bookings.sql
**Descripción**: Generador de reservas históricas y futuras
**Contenido**:
- Función helper `generate_bookfast_bookings()`
- ~500-800 reservas (últimos 6 meses + próximas 2 semanas)
- Actualización de estadísticas de clientes
- Marcado automático de VIPs
- Reservas destacadas de demo

**Ejecutar**: Tercero

---

## 📚 Archivos de Documentación

### 📖 SEED_BOOKFAST_README.md
**Descripción**: Documentación completa del proceso
**Contenido**:
- Instrucciones paso a paso
- Tabla de contenido del seed
- Validaciones post-ejecución
- Troubleshooting
- Guía de personalización
- Casos de uso

**Uso**: Leer ANTES de ejecutar cualquier script

---

### ✅ seed_bookfast_validate.sql
**Descripción**: Suite completa de validaciones
**Contenido**:
- 9 secciones de validaciones
- 30+ queries de verificación
- Resumen final con checks
- Detección de problemas de integridad

**Ejecutar**: Después de los 3 scripts principales para verificar

---

## 🗂️ Archivos de Referencia

### cleanup_cloud.sql (Existente)
**Descripción**: Script de limpieza de base de datos
**Nota**: NO ejecutar si quieres mantener BookFast

---

## 📊 Diagrama de Ejecución

```
┌─────────────────────────────────────────┐
│  PASO 1: Leer README                    │
│  📖 SEED_BOOKFAST_README.md             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  PASO 2: Crear Estructura               │
│  📄 seed_bookfast_demo.sql              │
│  ✅ Tenant + Services + Staff + Clients │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  PASO 3: Obtener User IDs               │
│  📄 seed_bookfast_assign_users.sql      │
│  (ejecutar query SELECT)                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  PASO 4: Asignar Owners                 │
│  📄 seed_bookfast_assign_users.sql      │
│  (ejecutar bloque INSERT editado)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  PASO 5: Generar Reservas               │
│  📄 seed_bookfast_bookings.sql          │
│  ✅ ~500-800 bookings                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  PASO 6: Validar Todo                   │
│  ✅ seed_bookfast_validate.sql          │
│  📊 30+ validaciones                    │
└─────────────────────────────────────────┘
```

---

## 🏗️ Estructura de Datos Creada

```
BookFast Tenant (bf000000-0000-0000-0000-000000000001)
│
├── 👥 Memberships (2)
│   ├── Owner 1 (tu usuario)
│   └── Owner 2 (socio)
│
├── 💈 Servicios (8)
│   ├── Corte (3)
│   ├── Barba (2)
│   ├── Combo (2)
│   └── Otros (1)
│
├── 👨‍🦲 Staff (4)
│   ├── Carlos (Senior) → 6 días, 7 servicios
│   ├── Miguel (Maestro) → 5 días, 5 servicios
│   ├── Javi (Especialista) → 5 días, 5 servicios
│   └── David (Junior) → 5 días, 4 servicios
│
├── 🧑 Clientes (30)
│   ├── VIP (3-8)
│   ├── Regular (20-25)
│   └── Ocasional (resto)
│
└── 📅 Reservas (~500-800)
    ├── Histórico (6 meses) → 400-600
    ├── Actuales → 20-50
    └── Futuras (2 semanas) → 80-150
```

---

## 🔑 IDs Importantes

| Concepto | UUID | Descripción |
|----------|------|-------------|
| **Tenant BookFast** | `bf000000-0000-0000-0000-000000000001` | ID fijo del tenant |
| **Servicios** | `bf000001-serv-...` | Prefijo de servicios |
| **Staff** | `bf000002-staf-...` | Prefijo de barberos |
| **Clientes** | `bf000003-cust-...` | Prefijo de clientes |

---

## ⚙️ Variables de Configuración

### En seed_bookfast_demo.sql:
- `timezone`: `'Europe/Madrid'`
- `business_open_time`: `'09:00:00'`
- `business_close_time`: `'20:00:00'`
- `no_show_protection_percentage`: `20`
- `no_show_cancellation_hours`: `24`

### En seed_bookfast_bookings.sql:
- Rango histórico: `6 meses`
- Rango futuro: `14 días`
- Probabilidad reserva pasada: `60%`
- Probabilidad reserva futura: `40%`
- Distribución estados:
  - `completed`: 85%
  - `confirmed`: 8%
  - `cancelled`: 4%
  - `no_show`: 3%

---

## 📈 Métricas Esperadas Post-Seed

| Métrica | Valor | Validación |
|---------|-------|------------|
| Total Reservas | 500-800 | ✅ seed_bookfast_validate.sql |
| Ingresos Totales | 15.000€ - 25.000€ | Sección 8.1 |
| Ticket Medio | 20€ - 30€ | Sección 8.1 |
| Tasa No-Show | 2-5% | Sección 8.4 |
| Tasa Cancelación | 5-10% | Sección 8.5 |
| Clientes VIP | 3-8 | Sección 5.2 |
| Ocupación Media | 55-70% | Dashboard |

---

## 🧹 Limpieza y Mantenimiento

### Eliminar BookFast completamente:
Ver sección "Limpieza" en `SEED_BOOKFAST_README.md`

### Re-ejecutar seed:
Los scripts son mayormente idempotentes (usan `ON CONFLICT DO UPDATE/NOTHING`), pero es recomendable limpiar primero.

### Actualizar solo reservas:
1. Eliminar: `DELETE FROM public.bookings WHERE tenant_id = 'bf000000...'`
2. Re-ejecutar: `seed_bookfast_bookings.sql`

---

## 🆘 Soporte

### Problemas comunes:
- **Memberships no asignadas**: Ver sección 2 de `seed_bookfast_validate.sql`
- **Solapamientos en reservas**: Ver sección 7.1 de validaciones
- **No aparecen datos en panel**: Verificar `app.current_tenant_id()`

### Contacto:
Ver sección "Troubleshooting" en `SEED_BOOKFAST_README.md`

---

## 📅 Última Actualización

**Fecha**: 12 de Diciembre de 2025  
**Versión**: 1.0  
**Compatibilidad**: Baseline actual de Supabase Cloud

---

## ✨ Próximos Pasos

Una vez ejecutados todos los scripts y validaciones:

1. ✅ Hacer login en la app con tu usuario
2. ✅ Verificar que aparece BookFast en selector de tenants
3. ✅ Navegar a `/panel/dashboard` → Ver KPIs poblados
4. ✅ Navegar a `/panel/agenda` → Ver reservas distribuidas
5. ✅ Navegar a `/panel/clientes` → Ver lista de 30 clientes
6. ✅ Probar crear nueva reserva → Verificar validaciones
7. ✅ Exportar métricas → Validar cálculos

---

**🎉 ¡Disfruta tu tenant de demo BookFast completamente funcional!**
