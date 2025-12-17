# 🎨 PLAN COMPLETO - REFACTOR VISUAL + NUEVO DESIGN SYSTEM

**Fase:** 2 - Visual Refactor + Implementation  
**Fecha:** 2024  
**Objetivo:** Establecer el nuevo design system oficial (capsule shapes, soft glass, premium gradients, neo-glow) y refactorizar todos los componentes y páginas del panel.

---

## 📋 ÍNDICE

1. [Nuevo Design System Oficial](#1-nuevo-design-system-oficial)
2. [Mapeo Completo de Componentes](#2-mapeo-completo-de-componentes)
3. [Componentes Faltantes](#3-componentes-faltantes)
4. [Plan de Refactor por Página](#4-plan-de-refactor-por-página)
5. [Roadmap de Implementación](#5-roadmap-de-implementación)

---

## 1. NUEVO DESIGN SYSTEM OFICIAL

### 1.1 Core Visual Identity

**Principios Fundamentales:**
- ✅ **Capsule Shapes** - Formas de píldora como geometría base
- ✅ **Soft Glass** - Superficies de vidrio suave con blur sutil
- ✅ **Premium Gradients** - Gradientes blue-aqua-purple
- ✅ **Neo-Glow Edges** - Bordes con resplandor suave
- ✅ **Subtle Blur** - Blur sutil en todas las superficies necesarias
- ✅ **Minimal & Readable** - Estética minimalista y altamente legible
- ✅ **Mobile-First** - Decisiones de diseño mobile-first obligatorias

---

### 1.2 Sistema de Colores

#### 1.2.1 Paleta de Neutros (Dark Mode Foundation)

```css
/* Neutros - Escala completa */
--neutral-50: #06141B;   /* Más oscuro - Background principal */
--neutral-100: #11212D;  /* Background secundario */
--neutral-200: #253745;  /* Background terciario / Cards */
--neutral-300: #4A5C6A;  /* Borders / Dividers */
--neutral-400: #9BA8AB;  /* Texto secundario */
--neutral-500: #CCD0CF;  /* Texto primario */

/* Mapeo semántico */
--bg-primary: var(--neutral-50);
--bg-secondary: var(--neutral-100);
--bg-tertiary: var(--neutral-200);
--bg-card: var(--neutral-200);
--border-default: var(--neutral-300);
--text-primary: var(--neutral-500);
--text-secondary: var(--neutral-400);
--text-tertiary: var(--neutral-300);
```

#### 1.2.2 Paleta de Acentos

```css
/* Acentos Premium */
--accent-aqua: #4FE3C1;      /* Aqua - Acción principal */
--accent-purple: #A06BFF;    /* Purple - Acción secundaria */
--accent-blue: #3A6DFF;      /* Blue - Información / Links */
--accent-pink: #FF6DA3;      /* Pink - Destacados / Alerts */

/* Variantes con opacidad para glass effects */
--accent-aqua-glass: rgba(79, 227, 193, 0.12);
--accent-purple-glass: rgba(160, 107, 255, 0.12);
--accent-blue-glass: rgba(58, 109, 255, 0.12);
--accent-pink-glass: rgba(255, 109, 163, 0.12);

/* Bordes con glow */
--accent-aqua-border: rgba(79, 227, 193, 0.3);
--accent-purple-border: rgba(160, 107, 255, 0.3);
--accent-blue-border: rgba(58, 109, 255, 0.3);
--accent-pink-border: rgba(255, 109, 163, 0.3);
```

#### 1.2.3 Gradientes Premium

```css
/* Gradientes principales */
--gradient-primary: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-aqua) 100%);
--gradient-secondary: linear-gradient(135deg, var(--accent-aqua) 0%, var(--accent-purple) 100%);
--gradient-accent: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-pink) 100%);

/* Gradientes radiales para backgrounds */
--gradient-radial-primary: radial-gradient(ellipse at top, rgba(58, 109, 255, 0.15) 0%, transparent 70%);
--gradient-radial-secondary: radial-gradient(ellipse at top, rgba(79, 227, 193, 0.15) 0%, transparent 70%);
```

#### 1.2.4 Colores Semánticos

```css
/* Estados semánticos */
--color-success: #10B981;
--color-success-glass: rgba(16, 185, 129, 0.12);
--color-warning: #F59E0B;
--color-warning-glass: rgba(245, 158, 11, 0.12);
--color-danger: #EF4444;
--color-danger-glass: rgba(239, 68, 68, 0.12);
--color-info: #3B82F6;
--color-info-glass: rgba(59, 130, 246, 0.12);
```

---

### 1.3 Sistema de Tipografía

#### 1.3.1 Fuentes

```css
/* Fuentes principales */
--font-heading: 'Plus Jakarta Sans', 'Satoshi', system-ui, sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-kpi: 'Inter', system-ui, sans-serif; /* SemiBold para KPIs */
```

#### 1.3.2 Escala Tipográfica

```css
/* Headings */
--text-h1-size: 32px;
--text-h1-line: 1.2;
--text-h1-weight: 700;
--text-h1-letter: -0.03em;

--text-h2-size: 24px;
--text-h2-line: 1.3;
--text-h2-weight: 600;
--text-h2-letter: -0.02em;

--text-h3-size: 20px;
--text-h3-line: 1.4;
--text-h3-weight: 600;
--text-h3-letter: -0.02em;

--text-h4-size: 18px;
--text-h4-line: 1.4;
--text-h4-weight: 600;
--text-h4-letter: -0.01em;

/* Body */
--text-body-lg-size: 16px;
--text-body-lg-line: 1.5;
--text-body-lg-weight: 400;

--text-body-md-size: 15px;
--text-body-md-line: 1.5;
--text-body-md-weight: 400;

--text-body-sm-size: 13px;
--text-body-sm-line: 1.5;
--text-body-sm-weight: 400;

/* KPIs / Numeric */
--text-kpi-size: 28px;
--text-kpi-line: 1.2;
--text-kpi-weight: 600;
--text-kpi-letter: -0.01em;
```

#### 1.3.3 Uso Semántico

- **Headings (H1-H4):** Plus Jakarta Sans / Satoshi
- **Body Text:** Inter
- **KPIs / Números:** Inter SemiBold
- **Code / Monospace:** JetBrains Mono

---

### 1.4 Sistema de Formas y Border Radius

#### 1.4.1 Border Radius Scale

```css
/* Radius Scale - Capsule System */
--radius-xs: 8px;        /* Badges pequeños, tags */
--radius-sm: 12px;       /* Inputs pequeños, botones pequeños */
--radius-md: 18px;       /* Inputs, botones, cards pequeños */
--radius-lg: 24px;       /* Cards medianos, modales pequeños */
--radius-xl: 28px;       /* Cards grandes, modales */
--radius-2xl: 40px;      /* Containers grandes */
--radius-pill: 9999px;   /* Pills / Capsules completas */
```

#### 1.4.2 Mapeo de Uso

| Elemento | Radius | Notas |
|----------|--------|-------|
| **Pills / Capsules** | `--radius-pill` | Botones pill, badges, tags |
| **Inputs** | `--radius-md` | Todos los inputs |
| **Buttons** | `--radius-md` o `--radius-pill` | Según variante |
| **Cards pequeños** | `--radius-md` | Cards compactos |
| **Cards medianos** | `--radius-lg` | Cards estándar |
| **Cards grandes** | `--radius-xl` | Cards destacados |
| **Modales** | `--radius-xl` | Todos los modales |
| **Badges** | `--radius-pill` | Badges de estado |

---

### 1.5 Sistema de Sombras y Glows

#### 1.5.1 Sombras Premium

```css
/* Sombras de Cards */
--shadow-card: 0px 4px 16px rgba(0, 0, 0, 0.3), 
               0px 2px 8px rgba(0, 0, 0, 0.2),
               inset 0px 1px 0px rgba(255, 255, 255, 0.08);

--shadow-card-hover: 0px 8px 32px rgba(0, 0, 0, 0.4),
                     0px 4px 16px rgba(0, 0, 0, 0.3),
                     inset 0px 1px 0px rgba(255, 255, 255, 0.12);

/* Sombra de Modal */
--shadow-modal: 0px 12px 48px rgba(0, 0, 0, 0.5),
                0px 4px 16px rgba(0, 0, 0, 0.3),
                inset 0px 1px 0px rgba(255, 255, 255, 0.1);

/* Sombra de Input Focus */
--shadow-input-focus: 0px 0px 0px 3px rgba(79, 227, 193, 0.2),
                      inset 0px 1px 2px rgba(0, 0, 0, 0.1);
```

#### 1.5.2 Glows Neo

```css
/* Glows de Acentos */
--glow-aqua: 0px 0px 16px rgba(79, 227, 193, 0.4),
             0px 0px 32px rgba(79, 227, 193, 0.2);

--glow-purple: 0px 0px 16px rgba(160, 107, 255, 0.4),
               0px 0px 32px rgba(160, 107, 255, 0.2);

--glow-blue: 0px 0px 16px rgba(58, 109, 255, 0.4),
             0px 0px 32px rgba(58, 109, 255, 0.2);

--glow-pink: 0px 0px 16px rgba(255, 109, 163, 0.4),
             0px 0px 32px rgba(255, 109, 163, 0.2);

/* Glow de Borde (neo-glow edges) */
--glow-border-aqua: 0px 0px 8px rgba(79, 227, 193, 0.3);
--glow-border-purple: 0px 0px 8px rgba(160, 107, 255, 0.3);
--glow-border-blue: 0px 0px 8px rgba(58, 109, 255, 0.3);
```

---

### 1.6 Sistema de Glass (Soft Glass)

#### 1.6.1 Glass Surfaces

```css
/* Glass Base */
--glass-bg: rgba(255, 255, 255, 0.06);
--glass-bg-subtle: rgba(255, 255, 255, 0.03);
--glass-bg-strong: rgba(255, 255, 255, 0.1);

/* Glass Borders */
--glass-border: rgba(255, 255, 255, 0.08);
--glass-border-subtle: rgba(255, 255, 255, 0.04);
--glass-border-strong: rgba(255, 255, 255, 0.12);

/* Glass Blur */
--glass-blur: blur(16px);
--glass-blur-subtle: blur(12px);
--glass-blur-strong: blur(20px);

/* Glass con Acentos */
--glass-aqua: rgba(79, 227, 193, 0.08);
--glass-purple: rgba(160, 107, 255, 0.08);
--glass-blue: rgba(58, 109, 255, 0.08);
--glass-pink: rgba(255, 109, 163, 0.08);
```

#### 1.6.2 Clases CSS Glass

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
}

.glass-subtle {
  background: var(--glass-bg-subtle);
  backdrop-filter: var(--glass-blur-subtle);
  -webkit-backdrop-filter: var(--glass-blur-subtle);
  border: 1px solid var(--glass-border-subtle);
}

.glass-strong {
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-border-strong);
}
```

---

### 1.7 Sistema de Espaciado

```css
/* Spacing Scale */
--spacing-0: 0px;
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;
--spacing-7: 32px;
--spacing-8: 40px;
--spacing-9: 48px;
--spacing-10: 64px;

/* Spacing Semántico */
--spacing-xs: var(--spacing-2);
--spacing-sm: var(--spacing-3);
--spacing-md: var(--spacing-4);
--spacing-lg: var(--spacing-6);
--spacing-xl: var(--spacing-8);
--spacing-2xl: var(--spacing-10);
```

---

### 1.8 Sistema de Animaciones y Motion

#### 1.8.1 Easing Functions

```css
/* Easing suaves */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out-smooth: cubic-bezier(0.2, 0, 0, 1);
--ease-in-smooth: cubic-bezier(0.4, 0, 1, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

#### 1.8.2 Duración de Transiciones

```css
/* Duración estándar */
--duration-fast: 150ms;
--duration-base: 200ms;
--duration-slow: 300ms;
--duration-slower: 400ms;
```

#### 1.8.3 Animaciones Estándar

```css
/* Entry Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Micro-interactions */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: var(--glow-aqua);
  }
  50% {
    box-shadow: var(--glow-aqua), 0px 0px 24px rgba(79, 227, 193, 0.6);
  }
}
```

#### 1.8.4 Reglas de Motion

- **Entry:** fadeInUp con duration-base
- **Exit:** fadeOut con duration-fast
- **Hover:** scale(1.02) con duration-fast
- **Tap:** scale(0.98) con duration-fast
- **Focus:** glow border con duration-base
- **Loading:** pulse suave

---

## 2. MAPEO COMPLETO DE COMPONENTES

### 2.1 Componentes Base a Rediseñar

| Componente | Archivo Actual | Estado | Cambios Requeridos |
|------------|----------------|--------|-------------------|
| **Button** | `src/components/ui/Button.tsx` | ✅ Existe | Adaptar a capsule shapes, nuevos colores, neo-glow |
| **Input** | `src/components/ui/Input.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores, focus glow |
| **Card** | `src/components/ui/Card.tsx` | ✅ Existe | Adaptar a capsule shapes, soft glass, nuevos shadows |
| **Modal** | `src/components/ui/Modal.tsx` | ✅ Existe | Adaptar a nuevos colores, glass, shadows premium |
| **Select** | `src/components/ui/Select.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores |
| **Badge** | `src/components/ui/Badge.tsx` | ✅ Existe | Adaptar a pill shape, nuevos colores, glow |
| **StatusBadge** | `src/components/ui/StatusBadge.tsx` | ✅ Existe | Adaptar a pill shape, nuevos colores |
| **Alert** | `src/components/ui/Alert.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores |
| **Table** | `src/components/ui/Table.tsx` | ✅ Existe | Adaptar a glass, nuevos colores, NO USADO |
| **Tabs** | `src/components/ui/Tabs.tsx` | ✅ Existe | Adaptar a capsule shapes, nuevos colores |
| **DropdownMenu** | `src/components/ui/DropdownMenu.tsx` | ✅ Existe | Adaptar a glass, nuevos colores |
| **Tooltip** | `src/components/ui/Tooltip.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores |
| **Toast** | `src/components/ui/Toast.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores |
| **Avatar** | `src/components/ui/Avatar.tsx` | ✅ Existe | Adaptar a nuevos gradientes |
| **Spinner** | `src/components/ui/Spinner.tsx` | ✅ Existe | Adaptar a nuevos colores |
| **EmptyState** | `src/components/ui/EmptyState.tsx` | ✅ Existe | Adaptar a nuevos colores, glass |
| **Switch** | `src/components/ui/Switch.tsx` | ✅ Existe | Adaptar a capsule, nuevos colores |
| **ScrollArea** | `src/components/ui/ScrollArea.tsx` | ✅ Existe | Adaptar a nuevos colores |

### 2.2 Componentes de Layout a Rediseñar

| Componente | Archivo Actual | Estado | Cambios Requeridos |
|------------|----------------|--------|-------------------|
| **SidebarNav** | `src/components/panel/SidebarNav.tsx` | ✅ Existe | Rediseño premium con nuevos gradientes, glass, capsule nav items |
| **TopBar** | `src/components/panel/TopBar.tsx` | ✅ Existe | Adaptar a nuevos colores, glass, mejor spacing |
| **PageContainer** | `src/components/panel/PageContainer.tsx` | ✅ Existe | Adaptar spacing, nuevos colores |
| **ImpersonationBanner** | `src/components/panel/ImpersonationBanner.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores |

### 2.3 Componentes de Calendar a Rediseñar

| Componente | Archivo Actual | Estado | Cambios Requeridos |
|------------|----------------|--------|-------------------|
| **AgendaCalendarView** | `src/components/panel/AgendaCalendarView.tsx` | ✅ Existe | Adaptar a glass, nuevos colores, capsule booking cards |
| **WeekView** | `src/components/calendar/WeekView.tsx` | ✅ Existe | Adaptar a glass, nuevos colores |
| **MonthView** | `src/components/calendar/MonthView.tsx` | ✅ Existe | Adaptar a glass, nuevos colores |
| **ListView** | `src/components/calendar/ListView.tsx` | ✅ Existe | Adaptar a glass, nuevos colores |
| **AgendaHeader** | `src/components/calendar/AgendaHeader.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores |
| **AgendaSidebar** | `src/components/calendar/AgendaSidebar.tsx` | ✅ Existe | Adaptar a glass, nuevos colores |
| **NewBookingModal** | `src/components/calendar/NewBookingModal.tsx` | ✅ Existe | Adaptar a nuevos componentes Input/Select, glass |
| **BookingDetailPanel** | `src/components/calendar/BookingDetailPanel.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores |
| **FloatingActionButton** | `src/components/calendar/FloatingActionButton.tsx` | ✅ Existe | Adaptar a capsule, nuevo glow |

### 2.4 Componentes de Servicios a Rediseñar

| Componente | Archivo Actual | Estado | Cambios Requeridos |
|------------|----------------|--------|-------------------|
| **ServiceCard** | `src/app/panel/servicios/components/ServiceCard.tsx` | ✅ Existe | Adaptar a glass capsule, nuevos colores |
| **ServiceForm** | `src/app/panel/servicios/components/ServiceForm.tsx` | ✅ Existe | Usar nuevos Input/Select/Range, glass |
| **ServicePreviewModal** | `src/app/panel/servicios/components/ServicePreviewModal.tsx` | ✅ Existe | Adaptar a nuevos colores, glass |
| **ServiceStatusBadge** | `src/app/panel/servicios/components/ServiceStatusBadge.tsx` | ✅ Existe | Adaptar a pill shape, nuevos colores |

---

## 3. COMPONENTES FALTANTES

### 3.1 Componentes Críticos (P0)

| Componente | Descripción | Prioridad | Archivo a Crear |
|------------|-------------|-----------|-----------------|
| **Slider/Range** | Slider para filtros de precio/rango | P0 | `src/components/ui/Slider.tsx` |
| **DatePicker** | Selector de fecha con calendario | P0 | `src/components/ui/DatePicker.tsx` |
| **TimePicker** | Selector de hora | P0 | `src/components/ui/TimePicker.tsx` |
| **SearchInput** | Input de búsqueda con icono y debounce visual | P0 | `src/components/ui/SearchInput.tsx` |
| **FormField** | Wrapper para campos de formulario (label, error, helper) | P0 | `src/components/ui/FormField.tsx` |
| **DataTable** | Tabla avanzada con sorting, filtering, pagination | P0 | `src/components/ui/DataTable.tsx` |
| **ConfirmDialog** | Diálogo de confirmación reutilizable | P0 | `src/components/ui/ConfirmDialog.tsx` |
| **LoadingSkeleton** | Skeletons para loading states | P0 | `src/components/ui/LoadingSkeleton.tsx` |

### 3.2 Componentes de Filtros (P1)

| Componente | Descripción | Prioridad | Archivo a Crear |
|------------|-------------|-----------|-----------------|
| **FilterPanel** | Panel de filtros reutilizable con glass | P1 | `src/components/ui/FilterPanel.tsx` |
| **FilterChip** | Chip de filtro activo (pill shape) | P1 | `src/components/ui/FilterChip.tsx` |
| **FilterGroup** | Grupo de filtros relacionados | P1 | `src/components/ui/FilterGroup.tsx` |

### 3.3 Componentes de KPIs (P1)

| Componente | Descripción | Prioridad | Archivo a Crear |
|------------|-------------|-----------|-----------------|
| **KPICard** | Card circular/rectangular para KPIs con glass | P1 | `src/components/ui/KPICard.tsx` |
| **KPIGrid** | Grid de KPIs responsive | P1 | `src/components/ui/KPIGrid.tsx` |
| **StatCard** | Card de estadística con icono y valor | P1 | `src/components/ui/StatCard.tsx` |

### 3.4 Componentes Avanzados (P2)

| Componente | Descripción | Prioridad | Archivo a Crear |
|------------|-------------|-----------|-----------------|
| **CommandPalette** | Búsqueda rápida (Cmd+K) | P2 | `src/components/ui/CommandPalette.tsx` |
| **Breadcrumbs** | Navegación de ruta | P2 | `src/components/ui/Breadcrumbs.tsx` |
| **Tour/Onboarding** | Guía para nuevos usuarios | P2 | `src/components/ui/Tour.tsx` |
| **ToastContainer** | Contenedor para toasts | P2 | `src/components/ui/ToastContainer.tsx` |

---

## 4. PLAN DE REFACTOR POR PÁGINA

### 4.1 `/panel` (Dashboard)

**Archivo:** `src/app/panel/page.tsx`

**Estado Actual:**
- UI Consistency: 4/10
- Funcionalidad: 70%
- Usa emojis como iconos
- Cards básicos sin glass
- Colores hardcodeados

**Plan de Refactor:**

1. **KPIs Cards:**
   - ✅ Crear componente `KPICard` con glass capsule
   - ✅ Reemplazar emojis con iconos lucide-react
   - ✅ Agregar gradientes radiales de fondo
   - ✅ Agregar animaciones de entrada
   - ✅ Agregar hover effects con glow

2. **Quick Access Cards:**
   - ✅ Convertir a glass capsule cards
   - ✅ Agregar iconos lucide-react
   - ✅ Agregar hover effects
   - ✅ Mejorar spacing y jerarquía

3. **Layout:**
   - ✅ Mejorar grid responsive (mobile-first)
   - ✅ Agregar spacing consistente
   - ✅ Agregar animaciones de entrada escalonadas

4. **Colores:**
   - ✅ Reemplazar todos los colores hardcodeados con variables CSS
   - ✅ Usar nuevos acentos (aqua, purple, blue)

**Componentes a Usar:**
- `KPICard` (nuevo)
- `Card` (refactorizado)
- `Button` (refactorizado)
- Iconos de `lucide-react`

---

### 4.2 `/panel/agenda`

**Archivo:** `src/app/panel/agenda/page.tsx`

**Estado Actual:**
- UI Consistency: 5/10
- Funcionalidad: 80%
- Solo lista básica (no usa componentes de calendar existentes)
- Inputs nativos
- Tabla HTML nativa

**Plan de Refactor:**

1. **Integrar Sistema de Calendar Completo:**
   - ✅ Reemplazar lista básica con `AgendaCalendarView`
   - ✅ Integrar `WeekView`, `MonthView`, `ListView`
   - ✅ Usar `AgendaHeader` y `AgendaSidebar`
   - ✅ Integrar `NewBookingModal`, `BookingDetailPanel`

2. **Componentes de Filtros:**
   - ✅ Reemplazar inputs nativos con `DatePicker`
   - ✅ Reemplazar select nativo con `Select` refactorizado
   - ✅ Crear `FilterPanel` para filtros avanzados

3. **Vistas del Calendario:**
   - ✅ **Week View:** Glass timeline con capsule booking cards
   - ✅ **Month View:** Grid glass con días destacados
   - ✅ **Day View:** Timeline vertical con glass slots
   - ✅ **List View:** DataTable refactorizado

4. **Booking Cards:**
   - ✅ Convertir a glass capsule shapes
   - ✅ Agregar neo-glow en hover
   - ✅ Mejorar estados visuales (hold, paid, completed, etc.)

5. **Modales:**
   - ✅ Refactorizar `NewBookingModal` con nuevos Input/Select/DatePicker/TimePicker
   - ✅ Usar `FormField` wrapper
   - ✅ Agregar animaciones suaves

**Componentes a Usar:**
- `AgendaCalendarView` (refactorizado)
- `WeekView`, `MonthView`, `ListView` (refactorizados)
- `DatePicker` (nuevo)
- `TimePicker` (nuevo)
- `DataTable` (nuevo)
- `FilterPanel` (nuevo)
- `FormField` (nuevo)

---

### 4.3 `/panel/clientes`

**Archivo:** `src/app/panel/clientes/page.tsx`

**Estado Actual:**
- UI Consistency: 6/10
- Funcionalidad: 85%
- Mejor implementada que otras
- Usa variables CSS parcialmente
- Inputs en modal no usan componente Input

**Plan de Refactor:**

1. **Búsqueda y Filtros:**
   - ✅ Reemplazar input de búsqueda con `SearchInput`
   - ✅ Crear `FilterPanel` para filtros avanzados
   - ✅ Agregar `FilterChip` para filtros activos

2. **Tabla:**
   - ✅ Reemplazar tabla HTML con `DataTable` refactorizado
   - ✅ Agregar sorting, filtering integrado
   - ✅ Mejorar responsive (cards en mobile)

3. **Modal de Cliente:**
   - ✅ Reemplazar inputs nativos con componente `Input`
   - ✅ Usar `FormField` wrapper
   - ✅ Agregar validación visual mejorada

4. **Cards Mobile:**
   - ✅ Convertir a glass capsule cards
   - ✅ Mejorar jerarquía visual
   - ✅ Agregar animaciones

**Componentes a Usar:**
- `SearchInput` (nuevo)
- `DataTable` (nuevo)
- `Input` (refactorizado)
- `FormField` (nuevo)
- `FilterPanel` (nuevo)
- `FilterChip` (nuevo)
- `Card` (refactorizado)

---

### 4.4 `/panel/servicios`

**Archivo:** `src/app/panel/servicios/page.tsx` + `ServiciosClient.tsx`

**Estado Actual:**
- UI Consistency: 7/10
- Funcionalidad: 90%
- **MEJOR PÁGINA** en términos de UI/UX
- Ya usa variables CSS extensivamente
- Ya tiene animaciones

**Plan de Refactor:**

1. **ServiceForm:**
   - ✅ Reemplazar inputs nativos con componente `Input`
   - ✅ Reemplazar sliders de precio con componente `Slider`
   - ✅ Usar `FormField` wrapper
   - ✅ Agregar `DatePicker` si es necesario

2. **ServiceCard:**
   - ✅ Adaptar a glass capsule más pronunciado
   - ✅ Mejorar hover effects con neo-glow
   - ✅ Agregar animaciones más suaves

3. **Filtros:**
   - ✅ Convertir filtros a `FilterPanel`
   - ✅ Agregar `FilterChip` para filtros activos
   - ✅ Mejorar UI de filtros de precio con `Slider`

4. **Modales:**
   - ✅ Refactorizar `ServicePreviewModal` con nuevos colores
   - ✅ Mejorar animaciones

**Componentes a Usar:**
- `Input` (refactorizado)
- `Slider` (nuevo)
- `FormField` (nuevo)
- `FilterPanel` (nuevo)
- `FilterChip` (nuevo)
- `Card` (refactorizado)

---

### 4.5 `/panel/staff`

**Archivo:** `src/app/panel/staff/page.tsx`

**Estado Actual:**
- UI Consistency: 3/10
- Funcionalidad: 75%
- **PÁGINA MÁS DESACTUALIZADA**
- Estilos legacy (gray-900, white, etc.)
- No usa componentes UI
- No usa variables CSS

**Plan de Refactor (COMPLETO):**

1. **Refactor Total:**
   - ✅ Reemplazar TODOS los estilos legacy con variables CSS
   - ✅ Reemplazar inputs nativos con componente `Input`
   - ✅ Reemplazar botones nativos con componente `Button`
   - ✅ Reemplazar formularios inline con `Modal` + `FormField`

2. **Staff Cards:**
   - ✅ Crear cards glass capsule para cada staff member
   - ✅ Agregar avatar con gradiente
   - ✅ Agregar badges de estado (pill shape)
   - ✅ Agregar hover effects

3. **Formularios:**
   - ✅ Crear `StaffForm` component usando `Input`, `Select`, `FormField`
   - ✅ Usar `Modal` refactorizado
   - ✅ Agregar validación visual

4. **Layout:**
   - ✅ Mejorar grid responsive
   - ✅ Agregar spacing consistente
   - ✅ Agregar animaciones de entrada

**Componentes a Usar:**
- `Card` (refactorizado)
- `Input` (refactorizado)
- `Button` (refactorizado)
- `Modal` (refactorizado)
- `FormField` (nuevo)
- `Badge` (refactorizado)
- `Avatar` (refactorizado)

---

### 4.6 `/panel/ajustes`

**Archivo:** `src/app/panel/ajustes/page.tsx`

**Estado Actual:**
- UI Consistency: 3/10
- Funcionalidad: 70%
- **SEGUNDA PÁGINA MÁS DESACTUALIZADA**
- Estilos legacy
- No usa componentes UI

**Plan de Refactor (COMPLETO):**

1. **Refactor Total:**
   - ✅ Reemplazar TODOS los estilos legacy
   - ✅ Reemplazar inputs/selects nativos con componentes UI
   - ✅ Crear secciones estructuradas con cards

2. **Secciones:**
   - ✅ Crear `SettingsSection` component
   - ✅ Cada sección en glass capsule card
   - ✅ Mejorar jerarquía visual
   - ✅ Agregar iconos lucide-react

3. **Formularios:**
   - ✅ Usar `Input`, `Select`, `FormField`
   - ✅ Agregar validación visual
   - ✅ Mejorar spacing

4. **Layout:**
   - ✅ Grid responsive mejorado
   - ✅ Spacing consistente
   - ✅ Animaciones de entrada

**Componentes a Usar:**
- `Card` (refactorizado)
- `Input` (refactorizado)
- `Select` (refactorizado)
- `FormField` (nuevo)
- `Button` (refactorizado)

---

### 4.7 `/panel/config/payments`

**Archivo:** `src/app/panel/config/payments/page.tsx`

**Estado Actual:**
- UI Consistency: 4/10
- Funcionalidad: 80%
- Estilos legacy básicos
- No usa componentes UI

**Plan de Refactor:**

1. **Cards de Servicios:**
   - ✅ Convertir lista a glass capsule cards
   - ✅ Agregar badges de estado (pill shape)
   - ✅ Mejorar jerarquía visual

2. **Botones:**
   - ✅ Reemplazar botones nativos con componente `Button`
   - ✅ Agregar estados de loading mejorados

3. **Layout:**
   - ✅ Mejorar spacing
   - ✅ Agregar animaciones

**Componentes a Usar:**
- `Card` (refactorizado)
- `Button` (refactorizado)
- `Badge` (refactorizado)
- `Alert` (refactorizado)

---

## 5. ROADMAP DE IMPLEMENTACIÓN

### Fase 1: Design Tokens y Base (Semana 1)

**Objetivo:** Establecer el nuevo design system en CSS

1. ✅ Actualizar `src/app/globals.css` con nuevos tokens
2. ✅ Definir todas las variables CSS (colores, spacing, radius, shadows, glass)
3. ✅ Crear clases utilitarias (glass, capsule, glow, etc.)
4. ✅ Actualizar tipografía
5. ✅ Testing visual de tokens

**Entregables:**
- `src/app/globals.css` actualizado
- Documentación de tokens

---

### Fase 2: Componentes Base (Semana 2-3)

**Objetivo:** Refactorizar componentes UI base

**Prioridad P0:**
1. ✅ `Button.tsx` - Capsule shapes, nuevos colores, neo-glow
2. ✅ `Input.tsx` - Glass capsule, focus glow
3. ✅ `Card.tsx` - Soft glass, capsule, nuevos shadows
4. ✅ `Modal.tsx` - Glass, nuevos colores, shadows premium
5. ✅ `Select.tsx` - Glass capsule
6. ✅ `Badge.tsx` - Pill shape, nuevos colores
7. ✅ `StatusBadge.tsx` - Pill shape, nuevos colores
8. ✅ `Alert.tsx` - Glass capsule

**Prioridad P1:**
9. ✅ `Table.tsx` - Glass, nuevos colores
10. ✅ `Tabs.tsx` - Capsule shapes
11. ✅ `DropdownMenu.tsx` - Glass
12. ✅ `Tooltip.tsx` - Glass capsule
13. ✅ `Toast.tsx` - Glass capsule
14. ✅ `Avatar.tsx` - Nuevos gradientes
15. ✅ `Spinner.tsx` - Nuevos colores
16. ✅ `EmptyState.tsx` - Glass, nuevos colores
17. ✅ `Switch.tsx` - Capsule, nuevos colores

**Entregables:**
- Todos los componentes base refactorizados
- Storybook o documentación visual (opcional)

---

### Fase 3: Componentes Nuevos (Semana 3-4)

**Objetivo:** Crear componentes faltantes críticos

1. ✅ `Slider.tsx` - Slider/Range para filtros
2. ✅ `DatePicker.tsx` - Selector de fecha
3. ✅ `TimePicker.tsx` - Selector de hora
4. ✅ `SearchInput.tsx` - Input de búsqueda con icono
5. ✅ `FormField.tsx` - Wrapper de campo de formulario
6. ✅ `DataTable.tsx` - Tabla avanzada
7. ✅ `ConfirmDialog.tsx` - Diálogo de confirmación
8. ✅ `LoadingSkeleton.tsx` - Skeletons de carga

**Entregables:**
- Componentes nuevos creados y documentados

---

### Fase 4: Componentes de Layout (Semana 4)

**Objetivo:** Refactorizar layout system

1. ✅ `SidebarNav.tsx` - Rediseño premium con nuevos gradientes
2. ✅ `TopBar.tsx` - Adaptar a nuevos colores, glass
3. ✅ `PageContainer.tsx` - Adaptar spacing
4. ✅ `ImpersonationBanner.tsx` - Glass capsule

**Entregables:**
- Layout system refactorizado

---

### Fase 5: Refactor de Páginas (Semana 5-7)

**Orden de Implementación:**

1. **Semana 5: Dashboard**
   - ✅ Crear `KPICard` component
   - ✅ Refactorizar `/panel/page.tsx`
   - ✅ Testing

2. **Semana 5-6: Agenda**
   - ✅ Integrar sistema de calendar completo
   - ✅ Refactorizar componentes de calendar
   - ✅ Refactorizar `/panel/agenda/page.tsx`
   - ✅ Testing

3. **Semana 6: Clientes**
   - ✅ Refactorizar búsqueda y filtros
   - ✅ Integrar DataTable
   - ✅ Refactorizar modal
   - ✅ Refactorizar `/panel/clientes/page.tsx`
   - ✅ Testing

4. **Semana 6: Servicios**
   - ✅ Refactorizar ServiceForm
   - ✅ Mejorar ServiceCard
   - ✅ Refactorizar filtros
   - ✅ Testing

5. **Semana 7: Staff (Refactor Completo)**
   - ✅ Refactor total de `/panel/staff/page.tsx`
   - ✅ Crear StaffForm component
   - ✅ Testing

6. **Semana 7: Ajustes (Refactor Completo)**
   - ✅ Refactor total de `/panel/ajustes/page.tsx`
   - ✅ Crear secciones estructuradas
   - ✅ Testing

7. **Semana 7: Payments**
   - ✅ Refactorizar `/panel/config/payments/page.tsx`
   - ✅ Testing

**Entregables:**
- Todas las páginas refactorizadas
- Testing completo

---

### Fase 6: Componentes Avanzados (Semana 8 - Opcional)

**Objetivo:** Componentes adicionales (P1-P2)

1. ✅ `FilterPanel.tsx`
2. ✅ `FilterChip.tsx`
3. ✅ `KPICard.tsx`
4. ✅ `StatCard.tsx`
5. ✅ `CommandPalette.tsx` (P2)
6. ✅ `Breadcrumbs.tsx` (P2)
7. ✅ `ToastContainer.tsx` (P2)

**Entregables:**
- Componentes avanzados (opcional)

---

### Fase 7: Polish y Optimización (Semana 9)

**Objetivo:** Refinamiento final

1. ✅ Revisar todas las animaciones
2. ✅ Optimizar responsive (mobile-first)
3. ✅ Revisar accesibilidad
4. ✅ Performance optimizations
5. ✅ Testing final
6. ✅ Documentación

**Entregables:**
- Plataforma completamente refactorizada
- Documentación completa

---

## 6. RESUMEN EJECUTIVO

### 6.1 Nuevo Design System

✅ **Establecido:**
- Sistema de colores completo (neutros + acentos)
- Sistema de tipografía (Plus Jakarta Sans / Inter)
- Sistema de formas (capsule shapes con radius scale)
- Sistema de sombras y glows (premium + neo-glow)
- Sistema de glass (soft glass surfaces)
- Sistema de animaciones (easing suaves, micro-interactions)

### 6.2 Componentes a Refactorizar

✅ **Total: 25 componentes base**
- 18 componentes UI existentes a adaptar
- 4 componentes de layout a adaptar
- 3 componentes de calendar a adaptar

### 6.3 Componentes Nuevos a Crear

✅ **Total: 15 componentes nuevos**
- 8 componentes críticos (P0)
- 4 componentes de filtros/KPIs (P1)
- 3 componentes avanzados (P2)

### 6.4 Páginas a Refactorizar

✅ **Total: 7 páginas**
- 2 páginas con refactor completo (staff, ajustes)
- 5 páginas con mejoras significativas (dashboard, agenda, clientes, servicios, payments)

### 6.5 Timeline Estimado

- **Fase 1-2:** 3 semanas (Design tokens + Componentes base)
- **Fase 3-4:** 2 semanas (Componentes nuevos + Layout)
- **Fase 5:** 3 semanas (Refactor de páginas)
- **Fase 6-7:** 2 semanas (Componentes avanzados + Polish)

**Total: 10 semanas** (2.5 meses)

---

## 7. PRÓXIMOS PASOS

Una vez aprobado este plan:

1. ✅ **Actualizar design tokens** en `globals.css`
2. ✅ **Refactorizar componentes base** (Button, Input, Card, etc.)
3. ✅ **Crear componentes nuevos** (Slider, DatePicker, etc.)
4. ✅ **Refactorizar layout** (SidebarNav, TopBar)
5. ✅ **Refactorizar páginas** una por una (dashboard primero)

---

**FIN DEL PLAN**




