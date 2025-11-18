/**
 * Sistema de diseño premium - UI Theme
 * 
 * Este archivo centraliza todos los tokens de diseño:
 * - Colores
 * - Tipografía
 * - Espaciado
 * - Radios
 * - Sombras
 * - Animaciones
 */

export const theme = {
  colors: {
    // Fondos
    bgPrimary: "#0E0F11",
    bgSecondary: "rgba(255,255,255,0.03)",
    bgCard: "#15171A",
    bgGlass: "rgba(255,255,255,0.08)",
    
    // Texto
    textPrimary: "#FFFFFF",
    textSecondary: "#d1d4dc",
    textTertiary: "#9ca3af",
    
    // Acentos
    accentBlue: "#3A6DFF",
    accentAqua: "#4FE3C1",
    accentPurple: "#A06BFF",
    accentPink: "#FF6DA3",
    
    // Estados de citas (pastel)
    statusPending: "rgba(255, 193, 7, 0.2)", // Amarillo suave
    statusConfirmed: "rgba(79, 227, 193, 0.2)", // Verde pastel
    statusCancelled: "rgba(239, 68, 68, 0.2)", // Rojo suave
    statusNoShow: "rgba(255, 109, 163, 0.2)", // Rosa apagado
    statusCompleted: "rgba(58, 109, 255, 0.2)", // Azul suave
    
    // Bordes
    borderDefault: "rgba(255,255,255,0.06)",
    borderHover: "rgba(255,255,255,0.1)",
    borderFocus: "rgba(58, 109, 255, 0.3)",
  },
  
  typography: {
    fontFamily: {
      sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      mono: ["JetBrains Mono", "monospace"],
    },
    fontSize: {
      h1: "28px",
      h2: "22px",
      h3: "18px",
      body: "15px",
      small: "13px",
      tiny: "11px",
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
    "3xl": "64px",
  },
  
  borderRadius: {
    sm: "8px",
    md: "10px",
    lg: "14px",
    xl: "16px",
    full: "9999px",
  },
  
  shadows: {
    sm: "0px 2px 8px rgba(0,0,0,0.15)",
    md: "0px 4px 16px rgba(0,0,0,0.25)",
    lg: "0px 6px 20px rgba(0,0,0,0.45)",
    xl: "0px 8px 32px rgba(0,0,0,0.5)",
    glass: "0px 4px 20px rgba(0,0,0,0.15), inset 0px 1px 0px rgba(255,255,255,0.05)",
    neon: "0px 0px 20px rgba(58, 109, 255, 0.4)",
  },
  
  animations: {
    duration: {
      fast: "150ms",
      base: "200ms",
      slow: "300ms",
    },
    easing: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      easeOut: "cubic-bezier(0, 0, 0.2, 1)",
      easeIn: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
  
  glassmorphism: {
    background: "rgba(255,255,255,0.08)",
    backdropBlur: "12px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
} as const;

// Utilidades para usar en componentes
export const getStatusColor = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: theme.colors.statusPending,
    confirmed: theme.colors.statusConfirmed,
    cancelled: theme.colors.statusCancelled,
    "no-show": theme.colors.statusNoShow,
    completed: theme.colors.statusCompleted,
  };
  return statusMap[status] || theme.colors.bgGlass;
};

export const getStatusTextColor = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: "#FFC107",
    confirmed: theme.colors.accentAqua,
    cancelled: "#EF4444",
    "no-show": theme.colors.accentPink,
    completed: theme.colors.accentBlue,
  };
  return statusMap[status] || theme.colors.textSecondary;
};






