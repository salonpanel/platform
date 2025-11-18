"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SecondaryColumnProps {
  children: ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
}

export function SecondaryColumn({
  children,
  isOpen = true,
  onClose,
  title,
}: SecondaryColumnProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Secondary Column */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 right-0 z-50 w-72 bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 ease-in-out h-screen overflow-y-auto",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        {title && (
          <div className="flex h-16 items-center border-b border-gray-200 px-6">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-auto lg:hidden text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="flex-1 p-6">{children}</div>
      </aside>
    </>
  );
}






