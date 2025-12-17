import { useMediaQuery } from "./useMediaQuery";

/**
 * Standardized responsive breakpoints
 * Align with Tailwind CSS default breakpoints
 */
export function useResponsive() {
    const isMobile = useMediaQuery("(max-width: 640px)"); // sm
    const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1024px)"); // md -> lg
    const isDesktop = useMediaQuery("(min-width: 1025px)"); // lg+
    const isWide = useMediaQuery("(min-width: 1280px)"); // xl

    return {
        isMobile,
        isTablet,
        isDesktop,
        isWide,
    };
}
