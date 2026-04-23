import AgendaServerPage from "./agenda/AgendaServerPage";

/**
 * `/panel` sirve la agenda directamente (sin redirect a `/panel/agenda`) para evitar
 * un round-trip extra al abrir la app. El dashboard sigue en `/panel/dashboard`.
 */
export default AgendaServerPage;
