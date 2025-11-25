"use client";

import { cn } from "@/lib/utils";

/**
 * Skeleton loader para la agenda
 * Se muestra instantáneamente mientras cargan los datos reales
 */
export function AgendaSkeleton() {
  return (
    <div className="h-full flex flex-col animate-pulse">
      {/* Header Skeleton */}
      <div className="flex-shrink-0 space-y-4">
        {/* TopBar */}
        <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] rounded-[var(--radius-xl)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-[var(--glass-bg-subtle)] rounded-lg" />
              <div className="h-6 w-32 bg-[var(--glass-bg-subtle)] rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-24 bg-[var(--glass-bg-subtle)] rounded-lg" />
              <div className="h-10 w-24 bg-[var(--glass-bg-subtle)] rounded-lg" />
              <div className="h-10 w-24 bg-[var(--glass-bg-subtle)] rounded-lg" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] rounded-[var(--radius-xl)] p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 bg-[var(--glass-bg-subtle)] rounded-lg" />
            <div className="h-8 w-20 bg-[var(--glass-bg-subtle)] rounded-lg" />
            <div className="h-8 w-20 bg-[var(--glass-bg-subtle)] rounded-lg" />
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="flex-1 min-h-0 mt-4">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 h-full">
          {/* Main Calendar Area */}
          <div className="flex flex-col h-full">
            {/* Stats Bar */}
            <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] rounded-[var(--radius-xl)] p-4 mb-4">
              <div className="flex items-center gap-6">
                <div className="h-12 w-32 bg-[var(--glass-bg-subtle)] rounded" />
                <div className="h-12 w-32 bg-[var(--glass-bg-subtle)] rounded" />
                <div className="h-12 w-32 bg-[var(--glass-bg-subtle)] rounded" />
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 bg-[var(--glass-bg-default)] border border-[var(--glass-border)] rounded-[var(--radius-xl)] p-4">
              <div className="grid grid-cols-4 gap-4 h-full">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-6 w-full bg-[var(--glass-bg-subtle)] rounded" />
                    <div className="space-y-2">
                      <div className="h-20 w-full bg-[var(--glass-bg-subtle)] rounded-lg" />
                      <div className="h-16 w-full bg-[var(--glass-bg-subtle)] rounded-lg" />
                      <div className="h-24 w-full bg-[var(--glass-bg-subtle)] rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] rounded-[var(--radius-xl)] p-4 h-full">
              <div className="space-y-4">
                <div className="h-6 w-32 bg-[var(--glass-bg-subtle)] rounded" />
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 w-full bg-[var(--glass-bg-subtle)] rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini skeleton para transiciones rápidas
 */
export function AgendaContentSkeleton() {
  return (
    <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] rounded-[var(--radius-xl)] p-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-20 bg-[var(--glass-bg-subtle)] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
