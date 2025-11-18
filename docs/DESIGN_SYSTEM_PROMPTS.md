# 🎨 Design System & UI Rebuild - Prompts para Cursor

Este documento contiene los prompts exactos para construir el sistema de diseño premium y todas las vistas del panel.

---

## ✅ FASE 1 — Construcción del Design System + UI Base

**📌 Objetivo**: Crear la base visual antes de tocar páginas.

**💬 PROMPT 1 — CREAR DESIGN SYSTEM COMPLETO**

```
We are rebuilding the entire UI with a premium, modern, glass-neon design system inspired by:
- Revolut
- Notion
- iOS liquid glass components
- Dark UI dashboards with neon gradients

Start by creating a complete DESIGN SYSTEM in /components/ui including:

1. Colors (Tailwind tokens):
   - Background scale: #0A0C14, #0D0F1A, #12141F, #1A1D29
   - Surface glass: rgba(255,255,255,0.03) and rgba(255,255,255,0.06)
   - Neon gradients (blue-purple, pink-orange)
   - Text colors (primary, secondary, dimmed)
   - Semantic colors (success, warning, danger, info)

2. Typography:
   - Use Satoshi for headings and Inter for body text
   - Build classes for H1, H2, H3, H4, body-lg, body-md, body-sm

3. Spacing & Radius tokens:
   - spacing scale: 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32 / 40
   - radius: 6 / 10 / 14 / 20 / 28 / 40

4. Shadows:
   - card-shadow (deep dark shadow)
   - neon-glow-blue
   - neon-glow-purple

5. Build the following base UI components using React + Tailwind + framer-motion:
   - Button (primary, secondary, ghost, text, with loading state)
   - Input (default, error, disabled)
   - Select (floating glass style)
   - Switch (iOS style)
   - Card (glass, elevated, simple)
   - Modal (center modal, side drawer, fullscreen mobile)
   - Tabs (underline + pill variants)
   - DropdownMenu
   - Tooltip
   - Badge (normal + glowing)
   - Avatar
   - Icon wrapper
   - ScrollArea with custom invisible scrollbar

Make all components:
- responsive
- glass-based
- animated with smooth transitions
- fully reusable

DO NOT design pages yet. This step is ONLY the design system.

Produce files in clean, organized folders.
```

---

## ✅ FASE 2 — Layout principal (Sidebar + Topbar + AppShell)

**💬 PROMPT 2 — CREAR LAYOUT BASE DEL PANEL**

```
Now build the APP LAYOUT.

Create a reusable AppShell component (/components/layout/AppShell.tsx) with:

1. Sidebar (left):
   - Glass background
   - Vertical icons with labels
   - Active state with neon glow
   - Collapsible behavior for mobile
   - Sections: Dashboard, Agenda, Clients, Services, Staff, Settings, Chats
   - Bottom section: Logout

2. Topbar:
   - Glass surface
   - Breadcrumb title
   - Search input (floating)
   - Notifications icon (opens a right-side drawer)
   - Settings icon
   - Timezone indicator

3. PageContainer:
   - Padding controlled by spacing tokens
   - Max width behavior
   - Smooth scrolling without showing default scrollbar

4. Mobile/Tablet responsiveness:
   - Sidebar becomes hidden and replaced with a top-left hamburger
   - Modals become fullscreen
   - Calendar sections stack vertically

Implement AppShell so every page can wrap content inside it.

Update existing /app/panel/layout.tsx to use this new AppShell component.
```

---

## ✅ FASE 3 — Agenda (la parte más importante)

**💬 PROMPT 3 — CREAR LA AGENDA COMPLETA (DAY VIEW + WEEK VIEW + LIST VIEW)**

```
We now build the FULL agenda view. Structure:

/app/panel/agenda/page.tsx
/components/agenda/

The agenda must include:

========================
HEADER (high-level)
========================
- Tabs: Day | Week | Month | List
- Navigation arrows (previous/next day/week/month)
- Date selector with calendar picker
- Calendar button (opens mini-month picker)
- Settings button
- Search button
- View switcher with smooth transitions

========================
LEFT SIDEBAR FILTERS
========================
- Date picker (compact)
- Jump buttons: Today / -1 week / +1 week
- Payment filters: Paid / Unpaid
- Status filters: Confirmed / Pending / Canceled / No-show
- Employee filters (checkboxes with avatars)
- Highlights: Starred / Not starred
- A legend section at bottom with color codes matching appointment statuses

Make this sidebar:
- Collapsible for mobile (becomes drawer)
- Sticky on desktop
- Glass background with subtle borders

========================
MAIN CALENDAR GRID
========================

DAY VIEW:
- Hourly grid with soft, subtle lines
- Hour column on left (sticky)
- Staff columns (one per active staff member)
- Glass-card appointment blocks positioned absolutely
- Appointment card structure:
   - Client name (bold)
   - Service name
   - Time range
   - Staff name (if different from column)
   - Price (abonado/total)
   - Status icon (colored)
   - Background color changes depending on status (use statusColors)
- On click: open contextual menu:
   - Modify appointment
   - Send message
   - Cancel appointment
   - Go to client profile

WEEK VIEW:
- 7 columns (one per day)
- Hours on left (sticky)
- Appointments placed across days
- Current day highlighted subtly

MONTH VIEW:
- Grid of days
- Small appointment indicators (dots/bars)
- Click day to switch to day view

LIST VIEW:
- List of appointments grouped by day
- Each item uses Card component
- Sortable by date, client, staff, status

========================
CREATING APPOINTMENTS
========================
When clicking on empty slot:
Show popup with:
- New appointment
- Add unavailable time
- Add absence

Each option opens appropriate modal.

========================
FAB BUTTON (+)
========================
Floating action button on bottom right:
- Neon glow effect
- Opens New Appointment modal
- Smooth animation on mount

========================
PERFORMANCE & INTERACTIONS
========================
- Optimize calendar rendering using memo and virtualization
- Smooth drag & drop for rescheduling
- Resize handles on appointments (drag to change duration)
- Line showing current time (red, only on today)
- Past appointments are dimmed (opacity-50 grayscale)
- Scrollbars hidden but functional (.scrollbar-hide)
- Calendar height adapts to available hours (based on staff schedules)

========================
CONFLICT DETECTION
========================
- Show visual warnings for overlapping appointments
- Allow force override for admins
- Suggest alternative times

Ensure all colors match the legend in sidebar.
All components must use the new design system.
```

---

## ✅ FASE 4 — Pantalla "Nueva Cita"

**💬 PROMPT 4 — NUEVA CITA (MODAL AVANZADO)**

```
Build the NewAppointment modal (/components/agenda/NewAppointmentModal.tsx).

Structure:

Tabs:
1. Appointment
2. Notes & Client Data

APPOINTMENT TAB:
- Client selector with avatar and search
  - If new client: "Create new client" button
  - Shows recent clients first
- List of selected services (each is a glass card)
  - Each service includes:
     - Service name
     - Price (editable)
     - Duration (auto-calculated, editable)
     - Assigned staff (dropdown)
     - Start time (auto-chained from previous service)
     - End time (auto-calculated)
     - Remove button
- Button: "Add another service" (opens service picker)
- Summary section (sticky at bottom):
   - Total price
   - Total duration
   - Time range (start - end)
   - Payment status selector (Unpaid / Deposit / Paid)

NOTES TAB:
- Internal notes (textarea, only employees see)
  - Star icon opens note templates popover
- Client-facing message (textarea)
  - Preview button to see how it will look
- Checkbox: "Mark as highlighted"

Footer:
- Secondary button: Discard
- Primary button: Save (with loading state)

Animations must match premium SaaS behavior:
- Slide up for modal (from bottom)
- Fade background overlay
- Smooth transitions between tabs
- Loading states on save

Validation:
- Client is required
- At least one service required
- Time slots must not conflict (show warning)
- All required fields marked with asterisk

Use glass design system components throughout.
```

---

## ✅ FASE 5 — Ficha del Cliente

**💬 PROMPT 5 — CLIENT PROFILE PAGE**

```
Create the Client Profile page (/app/panel/clientes/[id]/page.tsx).

Top section:
- Avatar (large, 80px)
- Name (H1)
- Phone number (clickable, opens call/message)
- Email (clickable)
- Quick action buttons row:
   - Call (if phone available)
   - Message (opens messaging modal)
   - New Appointment (pre-fills client)
   - Edit Client

Tabs:
1. Appointments
2. Client Info

APPOINTMENTS TAB:
- Filter: Upcoming | Past | All
- List of appointments (each is a card):
   - Date and time
   - Service(s)
   - Staff name
   - Status badge (with color)
   - Price
   - Actions: View details | Modify | Cancel
- Empty state if no appointments

CLIENT INFO TAB:
- Allergies (textarea, labeled "Allergies & Medical Notes")
- Internal notes (textarea, labeled "Internal Notes")
- Tags (pill chips, add/edit tags):
   - VIP
   - Price Sensitive
   - Regular Customer
   - Color Every 3 Weeks
   - etc.
- Client history metrics (cards):
   - Total appointments (number)
   - No-shows count (with percentage)
   - Average ticket (€)
   - Last visit (date)
   - Total spent (€)

Everything must follow the glass-neon visual system.
All cards use glass components.
Smooth transitions on tab changes.
```

---

## ✅ FASE 6 — Dashboard Principal

**💬 PROMPT 6 — DASHBOARD PRINCIPAL**

```
Build the main Dashboard page (/app/panel/page.tsx).

Layout:
- Grid of cards (responsive: 1 col mobile, 2 col tablet, 3-4 col desktop)

KPI Cards (top row):
- Total Revenue (today/week/month selector)
- Appointments (today/tomorrow/this week)
- No-show Rate
- Average Ticket
Each card:
  - Large number (gradient text)
  - Trend indicator (↑↓)
  - Period selector
  - Glass card with neon glow on hover

Quick Stats:
- Upcoming Appointments (next 5, click to go to agenda)
- Recent Clients (last 5 registered)
- Top Services (by booking count)

Charts:
- Revenue chart (line chart, last 30 days)
- Appointments chart (bar chart, by day/week)
- Staff performance (if multiple staff)

Recent Activity:
- List of recent actions (bookings created, cancelled, etc.)
- Timeline-style layout

Quick Actions:
- New Appointment (large button, opens modal)
- View Calendar (links to agenda)
- Manage Clients (links to clients page)

All components must use the design system.
Smooth animations on data load.
```

---

## ✅ FASE 7 — Páginas de Gestión (Clientes, Staff, Servicios)

**💬 PROMPT 7 — CLIENTES, STAFF, SERVICIOS PAGES**

```
Rebuild the management pages with the new design system:

1. CLIENTES PAGE (/app/panel/clientes/page.tsx):
   - Header with search bar and "New Client" button
   - Filter chips: All / VIP / Regular / No-shows
   - Client list (grid or table):
      - Avatar
      - Name (clickable, goes to profile)
      - Phone / Email
      - Last appointment date
      - Total appointments
      - Actions: View | Edit | Delete
   - Empty state with illustration
   - Pagination or infinite scroll

2. STAFF PAGE (/app/panel/staff/page.tsx):
   - Header with "New Staff" button
   - Staff list (cards):
      - Avatar (large)
      - Name
      - Role/Title
      - Weekly hours
      - Active status (badge)
      - Schedule preview (if available)
      - Actions: Edit | Deactivate | Delete
   - Click staff card opens edit modal/drawer
   - Schedule management in modal

3. SERVICIOS PAGE (/app/panel/servicios/page.tsx):
   - Header with "New Service" button
   - Service list (cards):
      - Service name
      - Category (badge)
      - Duration
      - Price
      - Assigned staff (if specific)
      - Active status (toggle)
      - Actions: Edit | Duplicate | Delete
   - Group by category (optional)
   - Drag to reorder (optional)

All pages must:
- Use glass cards
- Have search/filter functionality
- Be fully responsive
- Use design system components
- Have empty states
- Support bulk actions (optional, future)
```

---

## 📋 Orden de Ejecución

1. **FASE 1**: Design System (fundación)
2. **FASE 2**: Layout base (estructura)
3. **FASE 3**: Agenda (funcionalidad core)
4. **FASE 4**: Nueva Cita modal (interacción principal)
5. **FASE 5**: Client Profile (vista detalle)
6. **FASE 6**: Dashboard (overview)
7. **FASE 7**: Páginas de gestión (completar panel)

---

## 🎯 Reglas Generales para Todos los Prompts

- **NO** crear páginas hasta que el design system esté completo
- **SÍ** usar componentes del design system una vez creados
- **SÍ** mantener consistencia visual en todo
- **SÍ** hacer responsive (mobile-first)
- **SÍ** usar animaciones suaves (framer-motion)
- **SÍ** ocultar scrollbars pero mantener funcionalidad
- **SÍ** usar glassmorphism consistente
- **SÍ** respetar dark mode siempre

---

## 🔄 Integración con Código Existente

- **Mantener**: Lógica de negocio existente (Supabase, RLS, etc.)
- **Reemplazar**: Componentes UI antiguos con nuevos del design system
- **Migrar**: Gradualmente, página por página
- **Preservar**: Funcionalidades existentes (drag & drop, conflictos, etc.)

---

**Última actualización**: 2024-11-14






