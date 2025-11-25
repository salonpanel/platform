# Guía Rápida: Uso de Cabeceras Optimizadas

## Para Desarrolladores

### TopBar (Layout Principal)

El `TopBar` se usa automáticamente en el layout y no requiere cambios en las páginas individuales.

**Ubicación**: `src/components/panel/TopBar.tsx`  
**Uso**: Automático via `app/panel/layout-client.tsx`

```tsx
<TopBar
  title="Dashboard"           // Título de la página actual
  tenantName="Mi Peluquería"  // Nombre del tenant (se muestra en dropdown)
  userRole="owner"            // Rol del usuario (se muestra en dropdown)
  timezone="Europe/Madrid"    // Mantenido por compatibilidad (no se muestra)
  sidebarCollapsed={false}    // Controla el padding
/>
```

**No se muestra en UI:**
- ❌ `timezone` - Eliminado de la interfaz
- ❌ `tenantName` y `userRole` directamente - Movidos al menú desplegable

**Se muestra en UI:**
- ✅ Solo el `title` del página
- ✅ Avatar del usuario con menú desplegable

### PageHeader (Páginas Individuales)

Usa `PageHeader` para secciones dentro de páginas que necesiten un encabezado adicional.

**Ubicación**: `src/components/ui/PageHeader.tsx`

#### Uso Básico

```tsx
import { PageHeader } from "@/components/ui/PageHeader";

<PageHeader
  title="Clientes"
  subtitle="Gestiona tu base de clientes"
  description="Visualiza y administra información de todos tus clientes"
/>
```

#### Con Acciones

```tsx
<PageHeader
  title="Servicios"
  subtitle="Gestiona tus servicios"
  actions={
    <>
      <Button variant="outline">Importar</Button>
      <Button variant="primary">Nuevo Servicio</Button>
    </>
  }
/>
```

#### Con Breadcrumbs

```tsx
<PageHeader
  title="Detalle del Cliente"
  breadcrumbs={[
    { label: "Clientes", href: "/panel/clientes" },
    { label: "Juan Pérez" }
  ]}
/>
```

#### Variantes Disponibles

```tsx
// Default - Sin fondo
<PageHeader variant="default" title="Título" />

// Elevated - Con fondo sutil y sombra
<PageHeader variant="elevated" title="Título" />

// Glass - Efecto glassmorphism
<PageHeader variant="glass" title="Título" />

// Minimal - Totalmente transparente
<PageHeader variant="minimal" title="Título" />
```

#### Tamaños

```tsx
// Small
<PageHeader size="sm" title="Título Pequeño" />

// Medium (default)
<PageHeader size="md" title="Título Mediano" />

// Large
<PageHeader size="lg" title="Título Grande" />
```

#### Con Loading State

```tsx
<PageHeader
  title="Cargando..."
  isLoading={true}
  breadcrumbs={[...]}
/>
```

### Ejemplos por Página

#### Dashboard
```tsx
// El TopBar muestra "Dashboard"
// Puedes agregar secciones adicionales con:
<PageHeader
  variant="minimal"
  size="md"
  title="Resumen de Hoy"
  subtitle="Actividad del negocio"
/>
```

#### Agenda
```tsx
// AgendaHeader tiene su propio diseño especial
// TopBar muestra "Agenda"
```

#### Clientes
```tsx
<PageHeader
  title="Clientes"
  subtitle="Base de datos de clientes"
  actions={
    <Button onClick={openNewCustomer}>
      Nuevo Cliente
    </Button>
  }
/>
```

#### Detalle de Cliente
```tsx
<PageHeader
  title={customer.name}
  subtitle={customer.email}
  breadcrumbs={[
    { label: "Clientes", href: "/panel/clientes" },
    { label: customer.name }
  ]}
  actions={
    <>
      <Button variant="outline">Editar</Button>
      <Button variant="danger">Eliminar</Button>
    </>
  }
/>
```

#### Servicios
```tsx
<PageHeader
  variant="elevated"
  title="Servicios"
  description="Gestiona los servicios que ofreces en tu negocio"
  actions={
    <Button icon={<Plus />}>
      Nuevo Servicio
    </Button>
  }
/>
```

## Sistema de Diseño

### Colores y Transparencias

```tsx
// Fondos
const backgrounds = {
  verySubtle: "bg-white/[0.02]",
  subtle: "bg-white/[0.03]",
  hover: "bg-white/[0.06]",
};

// Bordes
const borders = {
  default: "border-white/[0.06]",
  glass: "border-white/[0.08]",
  hover: "border-white/[0.12]",
};

// Textos
const texts = {
  primary: "text-white/95",
  secondary: "text-white/70",
  tertiary: "text-white/50",
  disabled: "text-white/40",
};
```

### Espaciado Consistente

```tsx
// Padding del TopBar
const topBarPadding = cn(
  "pb-8 pt-6 md:pt-8",
  sidebarCollapsed ? "px-6 md:px-8" : "px-6 md:px-10"
);

// Spacing en PageHeader
const spacing = {
  sm: "space-y-2",
  md: "space-y-3",
  lg: "space-y-4",
};
```

### Animaciones

```tsx
// Ease suave para transiciones principales
const smoothEase = [0.22, 1, 0.36, 1];

// Duración estándar
const durations = {
  main: 0.5,        // Transiciones principales
  interaction: 0.3, // Hover, clicks
  quick: 0.2,       // Micro-interacciones
};

// Ejemplo de uso
<motion.div
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
>
  {content}
</motion.div>
```

## Mejores Prácticas

### ✅ DO - Hacer

```tsx
// ✅ Usa PageHeader para secciones importantes
<PageHeader title="Título Claro" subtitle="Descripción breve" />

// ✅ Agrupa acciones relacionadas
<PageHeader
  title="Clientes"
  actions={
    <>
      <Button variant="outline">Exportar</Button>
      <Button variant="primary">Nuevo</Button>
    </>
  }
/>

// ✅ Usa breadcrumbs para navegación clara
<PageHeader
  breadcrumbs={[
    { label: "Inicio", href: "/panel" },
    { label: "Clientes", href: "/panel/clientes" },
    { label: "Juan Pérez" }
  ]}
/>

// ✅ Usa variantes apropiadas según contexto
<PageHeader variant="elevated" /> // Para destacar
<PageHeader variant="minimal" />  // Para integrar
```

### ❌ DON'T - No hacer

```tsx
// ❌ No agregues información redundante
<PageHeader
  title="Dashboard"
  subtitle="Panel de Dashboard del Dashboard"
/>

// ❌ No uses títulos muy largos
<PageHeader
  title="Sistema de Gestión Integral de Clientes y Servicios de Peluquería"
/>

// ❌ No mezcles variantes innecesariamente
<PageHeader variant="elevated" className="bg-red-500" />

// ❌ No agregues timezone u otra info que ya no se muestra
<PageHeader title="Agenda" subtitle="Europe/Madrid" />
```

## Checklist de Implementación

Cuando crees o modifiques una página:

- [ ] El TopBar automático muestra el título correcto
- [ ] Si necesitas header adicional, usa PageHeader
- [ ] El título es claro y conciso
- [ ] Las acciones están agrupadas lógicamente
- [ ] Los breadcrumbs (si los hay) muestran la jerarquía
- [ ] No hay información redundante o innecesaria
- [ ] El espaciado es consistente con otras páginas
- [ ] Las animaciones son suaves y no molestas
- [ ] Funciona bien en móvil, tablet y desktop
- [ ] El contraste de texto es suficiente

## Solución de Problemas

### El título no se muestra
```tsx
// Verifica que el layout esté actualizando el título
// En layout-client.tsx:
const getPageTitle = () => {
  if (pathname === "/panel/tu-pagina") return "Tu Página";
  return "Panel";
};
```

### El espaciado no es correcto
```tsx
// Verifica que PageContainer esté envolviendo tu contenido
<PageContainer>
  <PageHeader title="..." />
  {/* Tu contenido */}
</PageContainer>
```

### El dropdown del usuario no funciona
```tsx
// Asegúrate de que tenantName y userRole se pasen correctamente
<TopBar
  title="Dashboard"
  tenantName={tenant.name}      // Debe existir
  userRole={role}                // Debe existir
  sidebarCollapsed={collapsed}
/>
```

### Los estilos no se aplican
```tsx
// Verifica que estés usando las clases de Tailwind correctamente
<PageHeader
  className="mb-6"  // Agregar margen inferior si es necesario
  title="..."
/>
```

## Recursos Adicionales

- **Documentación completa**: `OPTIMIZACION_CABECERAS_PAGINAS.md`
- **Comparación visual**: `COMPARACION_VISUAL_CABECERAS.md`
- **Componente TopBar**: `src/components/panel/TopBar.tsx`
- **Componente PageHeader**: `src/components/ui/PageHeader.tsx`
- **Layout principal**: `app/panel/layout-client.tsx`

## Soporte

Si tienes dudas o problemas:
1. Revisa los ejemplos en este documento
2. Consulta la documentación completa
3. Revisa implementaciones existentes en otras páginas
4. Verifica que las props se estén pasando correctamente

---

**Última actualización**: 2025-11-25  
**Versión**: 1.0.0
