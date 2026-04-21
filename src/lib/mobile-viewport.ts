/**
 * Altura del tab bar fijo del panel en móvil (< md). 0 si no hay nav inferior o en desktop.
 * Útil para posicionar popovers y no solaparlos con la barra inferior.
 */
export function getMobileBottomNavInsetPx(): number {
  if (typeof window === "undefined") return 0;
  if (!window.matchMedia("(max-width: 767px)").matches) return 0;
  const nav = document.querySelector<HTMLElement>("nav.fixed.bottom-0");
  return nav?.getBoundingClientRect().height ?? 0;
}
