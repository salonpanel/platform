"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface DropdownMenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "danger";
}

export function DropdownMenu({
  trigger,
  children,
  align = "left",
  className,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        triggerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const updatePosition = () => {
    if (!menuRef.current || !triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();

    if (align === "right") {
      menuRef.current.style.right = `${window.innerWidth - triggerRect.right}px`;
      menuRef.current.style.left = "auto";
    } else {
      menuRef.current.style.left = `${triggerRect.left}px`;
      menuRef.current.style.right = "auto";
    }

    menuRef.current.style.top = `${triggerRect.bottom + 8}px`;
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(updatePosition, 0);
      window.addEventListener("scroll", updatePosition);
      window.addEventListener("resize", updatePosition);
    }

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer"
      >
        {trigger}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "absolute z-50 min-w-[200px] rounded-[var(--r-md)] p-1",
              "bg-[var(--bf-surface)] border border-[var(--bf-border)]",
              "shadow-[var(--bf-shadow-card)] backdrop-blur-sm",
              className
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled = false,
  variant = "default",
  className,
}: DropdownMenuItemProps) {
  return (
    <motion.button
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left px-4 py-2.5 rounded-[var(--r-md)] text-sm font-medium",
        "transition-all duration-200",
        variant === "danger"
          ? "text-[var(--bf-danger)] hover:bg-[rgba(224,96,114,0.12)]"
          : "text-[var(--bf-ink-100)] hover:text-[var(--bf-ink-50)] hover:bg-[rgba(79,161,216,0.12)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {children}
    </motion.button>
  );
}

