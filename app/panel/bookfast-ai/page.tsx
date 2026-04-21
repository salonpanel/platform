/**
 * BookFast AI — Página principal del asistente inteligente
 *
 * Esta página es el punto de entrada del Asistente IA del panel.
 * Por ahora es un placeholder visual. En fases siguientes se integrará:
 *   - Chat con Claude/OpenAI (streaming)
 *   - Tools de lectura/escritura sobre el tenant
 *   - WhatsApp + email outbound
 *   - Audit log + undo
 *
 * Ver: PROPUESTA_ASISTENTE_IA.md y CASOS_USO_ASISTENTE_IA.md en la raíz del repo.
 */
import { Suspense } from "react";
import BookfastAiClient from "./BookfastAiClient";

export const metadata = {
  title: "BookFast AI",
  description: "Tu asistente inteligente para gestionar la barbería",
};

export default function BookfastAiPage() {
  return (
    <Suspense fallback={null}>
      <BookfastAiClient />
    </Suspense>
  );
}
