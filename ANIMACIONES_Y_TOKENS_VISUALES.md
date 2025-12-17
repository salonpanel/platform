# Documentación: Animaciones y Tokens Visuales

## 🎨 Tokens de Animación

### Easing Functions

Todos los componentes utilizan curvas de easing consistentes definidas en `globals.css`:

```css
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out-smooth: cubic-bezier(0.2, 0, 0, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Uso en Framer Motion:**
- `[0.4, 0, 0.2, 1]` - Transiciones suaves generales
- `[0.2, 0, 0, 1]` - Entradas/salidas rápidas
- `{ type: "spring", damping: 25, stiffness: 200 }` - Animaciones elásticas

### Duraciones

```css
--duration-fast: 150ms;
--duration-base: 200ms;
--duration-slow: 300ms;
```

## 🎭 Patrones de Animación

### 1. Entrada de Modales

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: 20 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: 20 }}
  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
>
```

**Características:**
- Fade in/out con scale sutil
- Desplazamiento vertical mínimo (20px)
- Duración: 200ms
- Easing: `ease-out-smooth`

### 2. Hover en Cards

```tsx
<motion.div
  whileHover={{ scale: 1.02, y: -2 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
>
```

**Características:**
- Scale: 1.02 (2% de aumento)
- Elevación: -2px
- Tap: scale 0.98 (feedback táctil)
- Duración: 150ms

### 3. Staggered Entries (Listas)

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.2, 0, 0, 1],
    },
  },
};
```

**Características:**
- Delay entre items: 50ms
- Desplazamiento inicial: 8px
- Efecto cascada suave

### 4. Sidebar Collapse/Expand

```tsx
<motion.aside
  animate={{
    width: isExpanded ? 240 : 64,
  }}
  transition={{
    type: "spring",
    damping: 25,
    stiffness: 200,
    duration: 0.3
  }}
>
```

**Características:**
- Spring animation para movimiento natural
- Damping: 25 (amortiguación media)
- Stiffness: 200 (rigidez media-alta)

### 5. BottomNavBar Show/Hide

```tsx
<motion.nav
  initial={{ y: 100, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: 100, opacity: 0 }}
  transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
>
```

**Características:**
- Deslizamiento desde abajo (100px)
- Fade simultáneo
- Duración: 300ms (más lento para visibilidad)

## 🎨 Tokens Visuales Aplicados

### Glass Effects

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
}

.glass-subtle {
  background: var(--glass-bg-subtle);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border-subtle);
}
```

### Neo-Glow

```css
--glow-aqua: 0px 0px 24px rgba(79, 227, 193, 0.3);
--glow-purple: 0px 0px 24px rgba(160, 107, 255, 0.3);
--glow-blue: 0px 0px 24px rgba(58, 109, 255, 0.3);
```

**Uso:**
- Cards de alta prioridad (BentoCard priority="high")
- Estados activos
- Elementos destacados

### Shadows

```css
--shadow-card: 0px 4px 16px rgba(0,0,0,0.2);
--shadow-card-hover: 0px 8px 24px rgba(0,0,0,0.3);
--shadow-card-subtle: 0px 2px 8px rgba(0,0,0,0.15);
```

## 📱 Comportamiento por Input Mode

### Touch (useInputMode)

- **Botones más grandes**: Mínimo 44x44px
- **Sin hover**: Los efectos hover se desactivan
- **Feedback táctil**: `whileTap` más pronunciado

### Mouse

- **Hover activo**: Todos los efectos hover funcionan
- **Botones estándar**: Tamaños normales
- **Tooltips**: Aparecen en hover

## 🎯 Reglas de Uso

1. **No animar en cada render**: Usar `initial` solo en montaje
2. **Reservar animaciones fuertes**: Para modales, KPIs, cards importantes
3. **Micro-interacciones sutiles**: En inputs, botones, hover
4. **Consistencia**: Mismo easing y duración para elementos similares
5. **Performance**: Evitar animaciones en listas largas (>50 items)

## 📝 Checklist de Implementación

- ✅ Modales: Entrada/salida con fade + scale
- ✅ Cards: Hover con scale + elevation
- ✅ Listas: Staggered entries
- ✅ Sidebar: Spring animation
- ✅ BottomNavBar: Slide from bottom
- ✅ Buttons: Tap feedback
- ✅ Inputs: Focus glow (sin animación de entrada)
- ✅ StatusBadge: Scale on hover
- ✅ KPICard: Staggered entries en grid




