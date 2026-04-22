import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {icon && <div className="mb-4 text-[var(--bf-ink-400)]">{icon}</div>}
      <h3
        className="text-lg font-semibold text-[var(--bf-ink-50)] mb-2"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm text-[var(--bf-ink-300)] max-w-md mb-4"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

