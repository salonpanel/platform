"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="glass rounded-xl border border-[rgba(255,255,255,0.08)] backdrop-blur-md overflow-hidden">
        <table className={cn("w-full", className)}>
          {children}
        </table>
      </div>
    </div>
  );
}

interface TableHeaderProps {
  children: ReactNode;
  className?: string;
}

export function TableHeader({ children, className }: TableHeaderProps) {
  return (
    <thead className={cn("border-b border-[rgba(255,255,255,0.1)] glass-subtle", className)}>
      {children}
    </thead>
  );
}

interface TableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function TableRow({ children, className, onClick }: TableRowProps) {
  return (
    <tr
      className={cn(
        "border-b border-[rgba(255,255,255,0.05)] transition-colors",
        onClick && "cursor-pointer hover:bg-[rgba(255,255,255,0.05)]",
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps {
  children: ReactNode;
  className?: string;
}

export function TableHead({ children, className }: TableHeadProps) {
  return (
    <th className={cn("px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider font-satoshi", className)}>
      {children}
    </th>
  );
}

interface TableCellProps {
  children: ReactNode;
  className?: string;
}

export function TableCell({ children, className }: TableCellProps) {
  return (
    <td className={cn("px-6 py-4 text-sm font-semibold text-[var(--text-primary)] font-satoshi", className)}>
      {children}
    </td>
  );
}

