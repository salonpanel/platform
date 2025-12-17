# Changelog

All notable changes to the "BookFast Pro" platform will be documented in this file.

## [v1.0.1] - 2025-12-16

### 🚀 High-Impact Improvements

- **Unified Glass UI**: Implemented consistent `GlassEmptyState` components across Dashboard, Agenda, and Customers pages, replacing generic empty states.
- **Micro-interactions**: Added tactile feedback (`active:scale-[0.98]`) to `GlassButton` and refined focus states for better accessibility.
- **Mobile Experience**:
  - **One-Thumb Usability**: Agenda FAB ("Nueva cita") is now always visible on mobile, not just in Day view.
  - **Sheet-Like Modals**: `GlassModal` now adapts to a bottom-sheet interaction on mobile devices for better reachability and use of screen space.
  - **Touch Targets**: Verified and optimized touch targets (44px+) for critical actions.

### ⚡ Performance & Perceived Speed

- **Render Hygiene**: Optimized `AgendaContent` to minimize unnecessary re-renders of the heavy Day/Week views during interactions.
- **Skeleton Timing**: Refined loading state transitions to eliminate layout "flicker" and "thrashing" when switching views.
- **Visual Polish**: Added subtle fade-in transitions to Grid and Empty states to prevent content from "popping" in, creating a smoother, more premium feel.

### 🐛 Bug Fixes & Polish

- **Agenda**: Fixed potential layout shifts in mobile view switching.
- **Styles**: Removed legacy inline styles in favor of Tailwind classes in refined components.
- **Dependencies**: Removed unused legacy components (`Card`, `Button` variants) in polished areas.

### 📦 Build & Deployment

- **Stability**: Build stabilized with strict type checking and linting.
- **Ready for Scale**: Validated RLS policies and RPC endpoints for tenant isolation.
