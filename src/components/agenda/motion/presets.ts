// Motion presets for Agenda module
// These presets provide consistent animations across the calendar interface

// View Transition Presets
export const viewTransitionPresets = {
  // Calendar view changes (day/week/month/list)
  calendarView: {
    initial: { opacity: 0, scale: 0.98, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 1.02, y: -8 },
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 0.2, 1], // easeOut
    }
  },

  // Sidebar open/close
  sidebarSlide: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  },

  // Modal open/close
  modalScale: {
    initial: { opacity: 0, scale: 0.95, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 8 },
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1], // easeOut
    }
  }
};

// Interactive Element Presets
export const interactionPresets = {
  // Appointment card interactions
  appointmentCard: {
    hover: {
      scale: 1.02,
      y: -2,
      boxShadow: "0px 4px 20px rgba(58,109,255,0.25), inset 0px 1px 0px rgba(255,255,255,0.1)",
      transition: { duration: 0.15 }
    },
    tap: {
      scale: 0.98,
      transition: { duration: 0.1 }
    },
    drag: {
      scale: 1.05,
      boxShadow: "0px 8px 32px rgba(58, 109, 255, 0.4)",
      transition: { duration: 0.15 }
    }
  },

  // Popover animations
  popover: {
    initial: { opacity: 0, scale: 0.95, y: -4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -4 },
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 0.2, 1], // easeOut
    }
  },

  // Button interactions
  button: {
    hover: { scale: 1.02 },
    tap: { scale: 0.98 },
    transition: { duration: 0.15 }
  },

  // List item hover
  listItem: {
    hover: {
      backgroundColor: "rgba(255,255,255,0.03)",
      scale: 1.005
    },
    transition: { duration: 0.1 }
  },

  // Staff column header
  staffHeader: {
    hover: { scale: 1.02 },
    tap: { scale: 0.98 },
    transition: { duration: 0.15 }
  }
};

// Stagger Animation Presets
export const staggerPresets = {
  // Appointment cards loading
  appointmentGrid: {
    initial: "hidden",
    animate: "visible",
    variants: {
      hidden: { opacity: 0, y: 8 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          staggerChildren: 0.02,
          delayChildren: 0.1
        }
      }
    }
  },

  // Staff columns loading
  staffColumns: {
    initial: "hidden",
    animate: "visible",
    variants: {
      hidden: { opacity: 0, x: 16 },
      visible: {
        opacity: 1,
        x: 0,
        transition: {
          staggerChildren: 0.05,
          delayChildren: 0.2
        }
      }
    }
  },

  // Filter options
  filterOptions: {
    initial: "hidden",
    animate: "visible",
    variants: {
      hidden: { opacity: 0, x: -8 },
      visible: {
        opacity: 1,
        x: 0,
        transition: {
          staggerChildren: 0.03,
          delayChildren: 0.05
        }
      }
    }
  }
};

// Performance optimizations
export const performancePresets = {
  // Reduced motion for accessibility
  reducedMotion: {
    duration: 0.01,
    ease: "linear"
  },

  // Hardware acceleration
  gpuAccelerated: {
    transform: "translateZ(0)",
    willChange: "transform, opacity"
  }
};

// Theme-aware motion utilities
export const getThemeAwareMotion = (theme: any) => ({
  accentHover: {
    scale: 1.02,
    boxShadow: `0px 4px 20px ${theme.colors.accentBlue}40`,
    transition: { duration: 0.15 }
  },

  glassHover: {
    backgroundColor: theme.colors.bgGlass,
    scale: 1.005,
    transition: { duration: 0.1 }
  }
});

// Reduced motion utilities
export const useReducedMotion = () => {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const getMotionSafeProps = (originalProps: any) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return {
      ...originalProps,
      animate: { opacity: 1 },
      initial: { opacity: 0 },
      transition: { duration: 0.01 },
      whileHover: undefined,
      whileTap: undefined,
    };
  }

  return originalProps;
};
