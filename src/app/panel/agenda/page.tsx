"use client";

import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { AgendaContainer } from "@/components/agenda/AgendaContainer";

/**
 * Página de Agenda - Arquitectura Premium Refactorizada
 *
 * Nueva estructura modular:
 * - AgendaContainer: Orquestador principal con toda la lógica de estado
 * - AgendaFilters: Sistema de filtros inteligente
 * - AgendaStats: Estadísticas premium con insights
 * - AgendaContent: Contenido dinámico según viewMode
 *
 * Beneficios:
 * ✅ Código más mantenible (627 líneas → ~50 líneas)
 * ✅ Mejor performance con memoización inteligente
 * ✅ Arquitectura escalable y modular
 * ✅ Experiencia premium consistente
 */
function AgendaContent() {
  return <AgendaContainer />;
}

function AgendaWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Spinner size="lg" className="text-[var(--accent-aqua)]" />
            <p className="mt-4 text-lg font-medium text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-body)" }}>
              Cargando agenda premium...
            </p>
          </div>
        </div>
      }
    >
      <AgendaContent />
    </Suspense>
  );
}

export default function AgendaPage() {
  return <AgendaWrapper />;
}
