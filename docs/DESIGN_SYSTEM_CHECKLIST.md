# ✅ Checklist de Implementación - Design System & UI Rebuild

## 📋 Estado de Implementación

### ✅ FASE 1 — Design System
- [ ] Colores (tokens Tailwind)
- [ ] Typography (Satoshi + Inter)
- [ ] Spacing & Radius tokens
- [ ] Shadows
- [ ] Button component
- [ ] Input component
- [ ] Select component
- [ ] Switch component
- [ ] Card component
- [ ] Modal component
- [ ] Tabs component
- [ ] DropdownMenu component
- [ ] Tooltip component
- [ ] Badge component
- [ ] Avatar component
- [ ] Icon wrapper
- [ ] ScrollArea component

### ✅ FASE 2 — Layout Base
- [ ] AppShell component
- [ ] Sidebar (glass, collapsible)
- [ ] Topbar (glass, breadcrumb)
- [ ] PageContainer
- [ ] Mobile responsiveness
- [ ] Integración con layout existente

### ✅ FASE 3 — Agenda
- [ ] Header (tabs, navigation, date picker)
- [ ] Sidebar filters
- [ ] Day View
- [ ] Week View
- [ ] Month View
- [ ] List View
- [ ] Appointment cards (glass, coloreadas)
- [ ] Contextual menu (click appointment)
- [ ] Popup (click empty slot)
- [ ] FAB button
- [ ] Línea roja hora actual
- [ ] Citas pasadas decoloradas
- [ ] Conflict detection visual
- [ ] Drag & drop
- [ ] Resize handles

### ✅ FASE 4 — Nueva Cita Modal
- [ ] Tabs (Appointment / Notes)
- [ ] Client selector
- [ ] Service list (glass cards)
- [ ] Add service button
- [ ] Summary section
- [ ] Notes tab
- [ ] Footer actions
- [ ] Validations
- [ ] Animations

### ✅ FASE 5 — Client Profile
- [ ] Top section (avatar, info, actions)
- [ ] Tabs (Appointments / Info)
- [ ] Appointments list
- [ ] Client info form
- [ ] Tags system
- [ ] Metrics cards

### ✅ FASE 6 — Dashboard
- [ ] KPI cards
- [ ] Quick stats
- [ ] Charts
- [ ] Recent activity
- [ ] Quick actions

### ✅ FASE 7 — Páginas de Gestión
- [ ] Clientes page
- [ ] Staff page
- [ ] Servicios page

---

## 🎨 Design System Specs

### Colores
```
Background: #0A0C14 (base), #0D0F1A, #12141F, #1A1D29
Glass: rgba(255,255,255,0.03), rgba(255,255,255,0.06)
Neon Blue-Purple: #627DFF → #A16CFF
Neon Pink-Orange: #FF6F91 → #FFB56B
Text: #FFFFFF (primary), #9DA3B5 (secondary), #60667A (dimmed)
Success: #10B981
Warning: #F59E0B
Danger: #EF4444
Info: #3B82F6
```

### Tipografía
```
Headings: Satoshi (Bold/Semibold)
Body: Inter (Regular/Medium)
H1: 32px / 40px (line-height)
H2: 24px / 32px
H3: 20px / 28px
H4: 18px / 24px
Body-lg: 16px / 24px
Body-md: 14px / 20px
Body-sm: 12px / 16px
```

### Espaciado
```
4px, 6px, 8px, 12px, 16px, 20px, 24px, 32px, 40px
```

### Border Radius
```
6px, 10px, 14px, 20px, 28px, 40px
```

### Shadows
```
card-shadow: 0px 6px 20px rgba(0,0,0,0.45)
neon-glow-blue: 0px 0px 20px rgba(98,125,255,0.3)
neon-glow-purple: 0px 0px 20px rgba(161,108,255,0.3)
```

---

## 🔧 Componentes Base Requeridos

### Button
- Variants: primary, secondary, ghost, text
- Sizes: sm, md, lg
- States: default, hover, active, disabled, loading
- Icon support (left/right)

### Input
- States: default, error, disabled
- Types: text, email, phone, number, date, time
- Icon support (left/right)
- Placeholder styling

### Select
- Floating glass style
- Searchable (optional)
- Multi-select (optional)

### Card
- Variants: glass, elevated, simple
- Hover effects
- Clickable option

### Modal
- Types: center, side drawer, fullscreen
- Backdrop blur
- Close button
- Esc key support
- Mobile responsive

### Tabs
- Variants: underline, pill
- Smooth transitions
- Keyboard navigation

---

## 📱 Responsive Breakpoints

```
Mobile: < 768px
Tablet: 768px - 1024px
Desktop: > 1024px
```

---

## ⚡ Performance Targets

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Smooth 60fps animations
- Virtualized lists for > 100 items

---

## 🧪 Testing Checklist

- [ ] Todos los componentes renderizan correctamente
- [ ] Responsive en todos los breakpoints
- [ ] Animaciones suaves (60fps)
- [ ] Scrollbars ocultos funcionan
- [ ] Modales funcionan en mobile
- [ ] Formularios validan correctamente
- [ ] Accesibilidad (keyboard nav, screen readers)
- [ ] Dark mode consistente

---

**Notas**:
- Migrar gradualmente, no romper funcionalidad existente
- Mantener RLS y lógica de negocio
- Priorizar UX sobre features nuevas
- Documentar decisiones de diseño








