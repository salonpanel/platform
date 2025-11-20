# 🔄 Guía de Migración - AppShell

## ✅ FASE 2 — Layout Base (COMPLETADA)

Se ha creado un nuevo componente `AppShell` que encapsula toda la estructura del panel con mejoras premium.

### 📁 Ubicación

- **Nuevo AppShell**: `src/components/layout/AppShell.tsx`
- **Layout existente**: `app/panel/layout.tsx` (mantener para compatibilidad)

### ✨ Mejoras Implementadas

#### 1. Sidebar Mejorado
- ✅ Iconos de Lucide React (en lugar de emojis)
- ✅ Estado activo con neon glow (`shadow-neon-glow-blue`)
- ✅ Indicador visual de página activa (punto blanco a la derecha)
- ✅ Glassmorphism completo
- ✅ Animación suave al abrir/cerrar
- ✅ ScrollArea con scrollbar oculto
- ✅ Botón de logout en footer

#### 2. Topbar Mejorado
- ✅ Búsqueda flotante (se expande al hacer clic)
- ✅ Icono de notificaciones con badge
- ✅ Icono de settings
- ✅ Timezone indicator (solo desktop)
- ✅ Avatar de usuario con hover effect
- ✅ Glassmorphism completo
- ✅ Sticky position (z-30)

#### 3. PageContainer Mejorado
- ✅ Props configurables: `maxWidth` y `padding`
- ✅ Opciones de maxWidth: sm, md, lg, xl, 2xl, full
- ✅ Opciones de padding: none, sm, md, lg
- ✅ Scroll suave sin scrollbar visible

#### 4. Mobile/Tablet Responsiveness
- ✅ Sidebar se convierte en drawer móvil
- ✅ Overlay oscuro con blur al abrir sidebar
- ✅ Botón hamburger en mobile
- ✅ Búsqueda adaptativa (oculta en mobile si está colapsada)

### 🔧 Uso del Nuevo AppShell

#### Opción 1: Usar directamente (recomendado para nuevas páginas)

```tsx
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/panel/PageContainer";

export default function MyPage() {
  return (
    <AppShell
      tenantName="Barbería Ejemplo"
      userEmail="user@example.com"
      userRole="owner"
      timezone="Europe/Madrid"
      onSearch={(query) => console.log("Search:", query)}
      onNotificationsClick={() => console.log("Notifications")}
      onSettingsClick={() => console.log("Settings")}
      onLogout={() => window.location.href = "/logout"}
    >
      <PageContainer>
        <h1>Mi Página</h1>
        {/* Contenido */}
      </PageContainer>
    </AppShell>
  );
}
```

#### Opción 2: Integrar con layout existente

El layout actual (`app/panel/layout.tsx`) puede gradualmente migrar a usar `AppShell` internamente:

```tsx
// En app/panel/layout.tsx
import { AppShell } from "@/components/layout/AppShell";

// Reemplazar la estructura actual con:
<AppShell
  tenantName={tenant?.name}
  userEmail={user?.email}
  userRole={userRole}
  timezone={tenant?.timezone}
>
  <PageContainer>{children}</PageContainer>
</AppShell>
```

### 📋 Propiedades del AppShell

```typescript
interface AppShellProps {
  children: ReactNode;
  tenantName?: string;              // Nombre del tenant/barbería
  userEmail?: string;               // Email del usuario (para avatar)
  userAvatar?: string;              // URL del avatar (opcional)
  userRole?: string | null;         // Rol del usuario (owner, admin, staff)
  timezone?: string;                // Zona horaria (default: "Europe/Madrid")
  onSearch?: (query: string) => void;              // Callback de búsqueda
  onNotificationsClick?: () => void;              // Callback notificaciones
  onSettingsClick?: () => void;                   // Callback settings
  onLogout?: () => void;                          // Callback logout
}
```

### 📋 Propiedades del PageContainer

```typescript
interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "sm" | "md" | "lg" | "none";
}
```

### 🎨 Características Visuales

- **Sidebar**: 
  - Glass background con blur
  - Iconos Lucide consistentes
  - Neon glow en estado activo
  - Hover effects suaves
  - ScrollArea invisible

- **Topbar**:
  - Glass surface sticky
  - Búsqueda expandible
  - Badge de notificaciones
  - Avatar con ring hover
  - Responsive completo

- **PageContainer**:
  - Padding configurable
  - Max-width responsive
  - Scroll suave sin scrollbar

### 🔄 Migración Gradual

1. **Paso 1**: Mantener layout actual funcionando
2. **Paso 2**: Crear nuevas páginas con AppShell
3. **Paso 3**: Migrar páginas existentes una por una
4. **Paso 4**: Reemplazar layout completo cuando todas las páginas estén migradas

### ⚠️ Notas Importantes

- El `AppShell` NO incluye la lógica de carga de tenant (eso sigue en `layout.tsx`)
- El `AppShell` es solo UI/UX, la lógica de datos debe venir del parent
- Compatible con el sistema de autenticación existente
- Respeta RLS y multitenancy (no toca la lógica de negocio)

---

**Estado**: ✅ AppShell creado y listo para usar  
**Próximo**: FASE 3 — Agenda Completa








