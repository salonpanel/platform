# Guía de Optimización de Carga - Sistema Completo

## 🎯 Objetivo
Carga instantánea de datos con Stale-While-Revalidate y Skeletons

## 📦 Herramientas Creadas

### 1. useStaleWhileRevalidate Hook
**Ubicación:** `src/hooks/useStaleWhileRevalidate.ts`

**Qué hace:**
- Muestra datos cacheados INSTANTÁNEAMENTE (0ms)
- Revalida en segundo plano sin bloquear UI
- Caché de 5 minutos, stale después de 30 segundos

**Uso:**
```tsx
const { data, isLoading, isValidating } = useStaleWhileRevalidate(
  'cache-key',
  async () => {
    // Tu fetcher aquí
    return await fetchData();
  },
  { staleTime: 30000, cacheTime: 300000 }
);
```

### 2. useOptimizedData Hooks
**Ubicación:** `src/hooks/useOptimizedData.ts`

**Hooks disponibles:**
- `useDashboardData(tenantId, timezone)` - Dashboard completo
- `useCustomersData(tenantId)` - Lista de clientes
- `useServicesData(tenantId)` - Lista de servicios
- `useStaffData(tenantId)` - Lista de staff

**Características:**
- Queries en paralelo (no secuenciales)
- Caché automático
- Tiempos de stale optimizados por tipo de dato

### 3. Skeleton Components
**Ubicación:** `src/components/ui/Skeletons.tsx`

**Componentes:**
- `<DashboardSkeleton />` - Para página de dashboard
- `<AgendaSkeleton />` - Para vista de agenda
- `<TableSkeleton rows={5} />` - Para tablas
- `<CardSkeleton />` - Para tarjetas individuales
- `<KPISkeleton />` - Para KPIs

## 🚀 Implementación por Página

### Dashboard (`app/panel/page.tsx`)

**ANTES:**
```tsx
const [loading, setLoading] = useState(true);
const [data, setData] = useState(null);

useEffect(() => {
  fetchData1().then(d1 => {
    fetchData2().then(d2 => {
      setData({ d1, d2 });
      setLoading(false);
    });
  });
}, []);

if (loading) return <Spinner />;
```

**DESPUÉS:**
```tsx
import { useDashboardData } from "@/hooks/useOptimizedData";
import { DashboardSkeleton } from "@/components/ui/Skeletons";

const { kpis, upcomingBookings, isLoading } = useDashboardData(tenantId, timezone);

if (isLoading) return <DashboardSkeleton />;

// Renderizar datos (se muestran desde caché instantáneamente)
```

### Agenda (`app/panel/agenda/page.tsx`)

**Optimizaciones:**
```tsx
import { AgendaSkeleton } from "@/components/ui/Skeletons";

// Mostrar skeleton mientras carga
if (isLoading) return <AgendaSkeleton />;

// Cargar bookings en paralelo con staff y servicios
const [bookings, staff, services] = await Promise.all([
  fetchBookings(),
  fetchStaff(),
  fetchServices(),
]);
```

### Staff/Servicios (`app/panel/staff/page.tsx`)

```tsx
import { useStaffData } from "@/hooks/useOptimizedData";
import { TableSkeleton } from "@/components/ui/Skeletons";

const { data: staff, isLoading } = useStaffData(tenantId);

if (isLoading) return <TableSkeleton rows={5} />;
```

## 📊 Resultados Esperados

| Página | Antes | Después |
|--------|-------|---------|
| Dashboard | 2-3s spinner | 0ms (caché) + skeleton |
| Agenda | 2-4s spinner | 0ms (caché) + skeleton |
| Staff | 1-2s spinner | 0ms (caché) + table skeleton |
| Servicios | 1-2s spinner | 0ms (caché) + table skeleton |

## 🔄 Invalidación de Caché

Cuando se modifican datos (crear, editar, eliminar):

```tsx
import { invalidateCache } from "@/hooks/useStaleWhileRevalidate";

// Después de crear/editar/eliminar
await createStaff(data);
invalidateCache(['staff-' + tenantId, 'dashboard-kpis-' + tenantId]);
```

## ✅ Checklist de Implementación

- [x] Hook useStaleWhileRevalidate creado
- [x] Hook useOptimizedData creado
- [x] Componentes Skeleton creados
- [ ] Dashboard migrado
- [ ] Agenda migrada
- [ ] Staff migrado
- [ ] Servicios migrado
- [ ] Clientes migrado
- [ ] Chat migrado

## 🎨 UX Final

1. **Primera visita:** Skeleton (200ms) → Datos
2. **Visitas subsecuentes:** Datos instantáneos (0ms, desde caché)
3. **Actualización en background:** Sin bloquear UI
4. **Experiencia:** Como app nativa de iOS/Android
