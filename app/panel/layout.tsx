/**
 * Server-side layout para el panel
 * IMPORTANTE: La verificación de sesión se maneja en el Client Component (layout-client.tsx)
 * para evitar race conditions con cookies que se establecen en el API route
 */
import { ReactNode } from "react";
import PanelLayoutClient from "./layout-client";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // NO verificar sesión aquí - el Client Component maneja toda la autenticación
  // Esto evita:
  // 1. Race conditions cuando las cookies se acaban de establecer
  // 2. Bucles infinitos de redirección
  // 3. Problemas de propagación de cookies entre Server y Client

  return <PanelLayoutClient>{children}</PanelLayoutClient>;
}
