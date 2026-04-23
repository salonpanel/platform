"use client";

import { ReactNode, useEffect, useState, useRef, useMemo } from "react";
import { X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartModal } from "@/components/agenda/SmartModal";
import { ModalActions, ModalAction } from "@/components/agenda/ModalActions";
import { SheetModalFrame } from "@/components/ui/sheet-modal-frame";

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

interface AgendaModalProps extends Omit<SmartModalProps, "variant" | "size" | "context" | "actions"> {
  variant?: "modal" | "drawer" | "slide";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showMobileDrawer?: boolean;
  drawerPosition?: "bottom" | "right";
  enhancedHeader?: boolean;
  stickyFooter?: boolean;
  preventClose?: boolean;
  header?: {
    title?: string;
    subtitle?: string;
    showBackButton?: boolean;
    onBack?: () => void;
  };
  context?: {
    type: "booking" | "customer" | "service" | "staff" | "availability" | "conflict";
    data?: any;
  };
  actions?: ModalAction[];
  actionsConfig?: {
    layout?: "start" | "center" | "end" | "space-between";
    size?: "sm" | "md" | "lg";
    showCancel?: boolean;
    onCancel?: () => void;
    cancelLabel?: string;
  };
  className?: string;
}

/**
 * AgendaModal — modal / cajón móvil sobre el mismo marco de hoja inferior (pestaña arrastrable).
 */
export function AgendaModal({
  isOpen,
  onClose,
  title,
  variant = "modal",
  size = "md",
  context,
  showMobileDrawer = false,
  header,
  actions,
  actionsConfig,
  preventClose = false,
  children,
  className = "",
  ...props
}: AgendaModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerTitleId = useRef(
    `agenda-drawer-${Math.random().toString(36).slice(2, 9)}`
  );
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const actualVariant = useMemo(
    () => (isMobile && showMobileDrawer ? "drawer" : variant),
    [isMobile, showMobileDrawer, variant]
  );

  useEffect(() => {
    if (!mounted || !isOpen || actualVariant !== "drawer") return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    const el = drawerRef.current;
    if (el) {
      const focusables = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusables[0] ?? el).focus();
    }

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !el) return;
      const list = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (node) =>
          !node.hasAttribute("disabled") &&
          !node.hasAttribute("aria-hidden") &&
          node.offsetParent !== null
      );
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !preventClose) onClose();
    };

    document.addEventListener("keydown", onTab);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("keydown", onTab);
      document.removeEventListener("keydown", onEsc);
      previousActiveElement.current?.focus();
    };
  }, [mounted, isOpen, actualVariant, preventClose, onClose]);

  if (!mounted) return null;

  const smartModalContext = context
    ? {
        type: context.type as "booking" | "customer" | "service" | "staff",
        data: context.data,
      }
    : undefined;

  const enhancedHeader = (
    <div
      className={cn(
        "flex w-full shrink-0 items-center justify-between",
        "border-b border-[var(--glass-border-subtle)] px-5 py-4 sm:px-6"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {header?.showBackButton && (
          <button
            type="button"
            onClick={header.onBack || onClose}
            className={cn(
              "rounded-xl p-2 transition-all duration-200",
              "text-[var(--bf-ink-300)] hover:bg-[var(--bf-bg-elev)] hover:text-[var(--bf-ink-50)] active:scale-95"
            )}
            aria-label="Volver"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2
            id={drawerTitleId.current}
            className={cn(
              "truncate font-[var(--font-sans)] text-lg font-semibold text-[var(--bf-ink-50)]"
            )}
          >
            {header?.title || title}
          </h2>
          {header?.subtitle && (
            <p
              className={cn(
                "mt-1 truncate font-[var(--font-sans)] text-sm text-[var(--bf-ink-300)]"
              )}
            >
              {header.subtitle}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!preventClose) onClose();
        }}
        className={cn(
          "rounded-xl p-2 transition-all duration-200",
          "text-[var(--bf-ink-300)] hover:bg-[var(--bf-bg-elev)] hover:text-[var(--bf-ink-50)] active:scale-95",
          preventClose && "cursor-not-allowed opacity-50"
        )}
        aria-label="Cerrar"
        disabled={preventClose}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  const enhancedFooter =
    actions && actions.length > 0 ? (
      <ModalActions
        actions={actions}
        layout={actionsConfig?.layout || "end"}
        size={actionsConfig?.size || "md"}
        showCancel={actionsConfig?.showCancel ?? true}
        onCancel={actionsConfig?.onCancel || onClose}
        cancelLabel={actionsConfig?.cancelLabel || "Cancelar"}
      />
    ) : null;

  const handleClose = () => {
    if (!preventClose) onClose();
  };

  const drawerFrameSize =
    size === "sm"
      ? "sm"
      : size === "md"
        ? "lg"
        : size === "lg" || size === "xl" || size === "full"
          ? "xl"
          : "md";

  const drawerSheetExtra =
    size === "full"
      ? "md:max-w-[min(96rem,calc(100vw-1.5rem))]"
      : size === "xl"
        ? "md:max-w-6xl"
        : undefined;

  if (actualVariant === "drawer") {
    return (
      <SheetModalFrame
        isOpen={isOpen}
        onClose={onClose}
        onBackdropClick={handleClose}
        allowDragDismiss={!preventClose}
        size={drawerFrameSize}
        sheetRef={drawerRef}
        titleId={drawerTitleId.current}
        sheetClassName={cn(drawerSheetExtra, className)}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {enhancedHeader}
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-5 py-2 sm:px-6">
            {children}
          </div>
          {enhancedFooter && (
            <div className="shrink-0 border-t border-[var(--glass-border-subtle)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
              {enhancedFooter}
            </div>
          )}
        </div>
      </SheetModalFrame>
    );
  }

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size={size}
      variant="default"
      context={smartModalContext}
      preventClose={preventClose}
      {...props}
    >
      <div className="flex h-full flex-col">
        {header ? enhancedHeader : null}

        <div className="min-h-0 flex-1 overflow-auto">{children}</div>

        {enhancedFooter}
      </div>
    </SmartModal>
  );
}

export default AgendaModal;
