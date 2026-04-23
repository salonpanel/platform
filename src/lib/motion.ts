/**
 * Curvas y presets de motion compartidos (Framer Motion + referencia CSS).
 */
export const BF_EASE_OUT = [0.22, 0.61, 0.36, 1] as const;

export const BF_MODAL_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.82,
};

export const BF_MODAL_SPRING_SOFT = {
  type: "spring" as const,
  stiffness: 340,
  damping: 32,
  mass: 0.9,
};

export const BF_PAGE_TRANSITION = {
  duration: 0.22,
  ease: BF_EASE_OUT,
} as const;
