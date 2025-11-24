"use client";

import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartModal } from "@/components/agenda/SmartModal";

// Define SmartModalProps interface locally since it's not exported
interface SmartModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps?: Array<{
    id: string;
    title: string;
    description?: string;
    required?: boolean;
    completed?: boolean;
  }>;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  showProgress?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  variant?: "default" | "guided" | "minimal";
  children: React.ReactNode;
  actions?: React.ReactNode;
  context?: {
    type: "booking" | "customer" | "service" | "staff";
    data?: any;
  };
}
import { theme } from "@/theme/ui";
import { getMotionSafeProps } from "@/components/agenda/motion/presets";

interface AgendaModalProps extends Omit<SmartModalProps, 'variant' | 'size' | 'context'> {
  // Agenda-specific variants
  variant?: "modal" | "drawer" | "slide";
  
  // Mobile-first responsive sizing
  size?: "sm" | "md" | "lg" | "xl" | "full";
  
  // Responsive behavior
  showMobileDrawer?: boolean;
  drawerPosition?: "bottom" | "right";
  
  // Enhanced features
  enhancedHeader?: boolean;
  stickyFooter?: boolean;
  preventClose?: boolean;
  
  // Override context with extended types
  context?: {
    type: "booking" | "customer" | "service" | "staff" | "availability" | "conflict";
    data?: any;
  };
  
  // Additional styling (handled internally, not passed to SmartModal)
  className?: string;
}

/**
 * AgendaModal - Premium modal wrapper for Agenda module
 * Extends SmartModal with Agenda-specific behaviors:
 * - Mobile drawer mode for detail panels
 * - Booking-specific context themes  
 * - Responsive sizing and positioning
 * - Enhanced accessibility patterns
 */
export function AgendaModal({
  isOpen,
  onClose,
  title,
  variant = "modal",
  size = "md",
  context,
  showMobileDrawer = false,
  drawerPosition = "bottom",
  header,
  actions,
  stickyFooter = false,
  preventClose = false,
  children,
  className = "",
  ...props
}: AgendaModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // SSR-safe mobile detection using CSS media query
  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    
    // Set initial value
    setIsMobile(mediaQuery.matches);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Focus management for drawer
  useEffect(() => {
    if (!mounted || !isOpen || actualVariant !== "drawer") return;

    // Save current active element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus drawer when opened
    const drawerElement = drawerRef.current;
    if (drawerElement) {
      const focusableElements = drawerElement.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        drawerElement.focus();
      }
    }

    // Focus trap for drawer
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !drawerElement) return;

      const focusableElements = Array.from(
        drawerElement.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        return !el.hasAttribute("disabled") && 
               !el.hasAttribute("aria-hidden") &&
               el.offsetParent !== null;
      });

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Escape key handler
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !preventClose) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleTabKey);
    document.addEventListener("keydown", handleEscape);

    // Prevent body scroll when drawer is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      document.removeEventListener("keydown", handleEscape);
      // Restore focus and body scroll when drawer closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
      document.body.style.overflow = "unset";
    };
  }, [isOpen, mounted, isMobile, showMobileDrawer, variant, preventClose, onClose]);

  // Body scroll lock for modal variants (SmartModal handles this, but ensuring consistency)
  useEffect(() => {
    const actualVariant = isMobile && showMobileDrawer ? "drawer" : variant;
    if (!mounted || !isOpen || actualVariant === "drawer") return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, mounted, isMobile, showMobileDrawer, variant]);

  if (!mounted) return null;

  // Determine actual variant based on screen size and props
  const actualVariant = isMobile && showMobileDrawer ? "drawer" : variant;
  
  // Map Agenda context to SmartModal context
  const smartModalContext = context ? {
    type: context.type as "booking" | "customer" | "service" | "staff",
    data: context.data
  } : undefined;

  // Enhanced header component
  const enhancedHeader = (
    <div className={cn(
      "flex items-center justify-between w-full"
    )}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {header?.showBackButton && (
          <button
            onClick={header.onBack || onClose}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--glass-bg-subtle)] active:scale-95"
            )}
            aria-label="Volver"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className={cn(
            "text-lg font-semibold truncate",
            "text-[var(--text-primary)] font-[var(--font-heading)]"
          )}>
            {header?.title || title}
          </h2>
          {header?.subtitle && (
            <p className={cn(
              "text-sm mt-1 truncate",
              "text-[var(--text-secondary)] font-[var(--font-body)]"
            )}>
              {header.subtitle}
            </p>
          )}
        </div>
      </div>
      
      <button
        onClick={() => {
          if (!preventClose) {
            onClose();
          }
        }}
        className={cn(
          "p-2 rounded-xl transition-all duration-200",
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          "hover:bg-[var(--glass-bg-subtle)] active:scale-95",
          preventClose && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Cerrar"
        disabled={preventClose}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  // Enhanced footer component
  const enhancedFooter = actions ? (
    <div className={cn(
      "flex items-center justify-between gap-4 w-full",
      stickyFooter && "sticky bottom-0 bg-[var(--glass-bg-subtle)] border-t border-[var(--glass-border-subtle)] p-4"
    )}>
      {actions}
    </div>
  ) : undefined;

  // Drawer-specific styling and animations
  const drawerClasses: { size: "sm" | "md" | "lg" | "xl" | "full"; className: string } = 
    actualVariant === "drawer" ? {
      size: drawerPosition === "bottom" ? "full" : "lg",
      className: cn(
        drawerPosition === "bottom" && "rounded-t-3xl mb-0",
        drawerPosition === "right" && "rounded-l-3xl ml-0 h-full max-w-md",
        className
      )
    } : { size, className };

  // Enhanced close handler with form protection
  const handleClose = () => {
    if (!preventClose) {
      onClose();
    }
  };

  // If drawer variant, use custom implementation
  if (actualVariant === "drawer") {
    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Enhanced backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "absolute inset-0 bg-black/40 backdrop-blur-sm"
              )}
              onClick={handleClose}
            />
            
            {/* Drawer container */}
            <div className={cn(
              "relative z-10 w-full",
              drawerPosition === "bottom" && "items-end",
              drawerPosition === "right" && "items-center justify-start"
            )}>
              <motion.div
                ref={drawerRef}
                {...getMotionSafeProps({
                  initial: drawerPosition === "bottom" 
                    ? { y: "100%", opacity: 0 }
                    : { x: "100%", opacity: 0 },
                  animate: drawerPosition === "bottom"
                    ? { y: 0, opacity: 1 }
                    : { x: 0, opacity: 1 },
                  exit: drawerPosition === "bottom"
                    ? { y: "100%", opacity: 0 }
                    : { x: "100%", opacity: 0 },
                  transition: { type: "spring", stiffness: 300, damping: 30 }
                })}
                className={cn(
                  "relative flex flex-col bg-[var(--bg-primary)] border",
                  "border-[var(--glass-border)] shadow-[var(--shadow-premium)]",
                  "backdrop-blur-md",
                  drawerPosition === "bottom" && "max-w-full mx-4 mb-0 rounded-t-3xl max-h-[80vh]",
                  drawerPosition === "right" && "h-full max-w-md rounded-l-3xl",
                  className
                )}
              >
                {enhancedHeader}
                
                <div className={cn(
                  "flex-1 overflow-auto",
                  drawerPosition === "bottom" ? "overscroll-contain" : "overscroll-y-contain"
                )}>
                  {children}
                </div>
                
                {enhancedFooter}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  // Use SmartModal for modal variants
  return (
    <SmartModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size={drawerClasses.size}
      variant="default"
      context={smartModalContext}
      {...props}
    >
      <div className="flex flex-col h-full">
        {header && enhancedHeader}
        
        <div className="flex-1 overflow-auto">
          {children}
        </div>
        
        {enhancedFooter}
      </div>
    </SmartModal>
  );
}

export default AgendaModal;
