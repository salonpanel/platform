import type { Metadata } from "next";

/**
 * Metadatos para el panel de barberos
 * 
 * Nota: Este archivo existe solo para documentar los metadatos.
 * Como app/panel/layout.tsx es un Client Component, los metadatos
 * se heredan del layout raíz (app/layout.tsx) que tiene robots: { index: false }
 * 
 * Si en el futuro se necesita personalizar metadatos por página del panel,
 * se puede crear un layout wrapper Server Component.
 */
export const metadata: Metadata = {
  title: "Panel - BookFast",
  description: "Panel de gestión para barberías",
  robots: {
    index: false, // NO indexar panel (área privada)
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

// Este archivo es solo documentación, no se exporta nada




