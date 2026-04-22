"use client";

import { ReactNode, useState, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

interface TabsProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ children, value: controlledValue, defaultValue, onValueChange, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const activeTab = controlledValue !== undefined ? controlledValue : internalValue;

  const setActiveTab = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("w-full", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 p-1 bg-[var(--bf-bg-elev)] border border-[var(--bf-border)] rounded-[var(--r-full)]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        "px-4 py-2 text-[13px] font-medium transition-all duration-150 relative rounded-[var(--r-full)]",
        isActive
          ? "bg-[var(--bf-ink-50)] text-[var(--bf-ink)]"
          : "text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]",
        className
      )}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  const { activeTab } = context;
  if (activeTab !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn("mt-6", className)}
    >
      {children}
    </motion.div>
  );
}

