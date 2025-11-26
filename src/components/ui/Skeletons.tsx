"use client";

import { cn } from "@/lib/utils";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPIs skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-slate-800/50 rounded-2xl border border-white/5"
          />
        ))}
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 bg-slate-800/50 rounded-2xl border border-white/5" />
          <div className="h-48 bg-slate-800/50 rounded-2xl border border-white/5" />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="h-48 bg-slate-800/50 rounded-2xl border border-white/5" />
          <div className="h-64 bg-slate-800/50 rounded-2xl border border-white/5" />
        </div>
      </div>
    </div>
  );
}

export function AgendaSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-800/50 rounded" />
        <div className="h-10 w-32 bg-slate-800/50 rounded-lg" />
      </div>

      {/* Calendar skeleton */}
      <div className="h-[600px] bg-slate-800/50 rounded-2xl border border-white/5" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          className="h-16 bg-slate-800/50 rounded-lg border border-white/5"
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 bg-slate-800/50 rounded-2xl border border-white/5 animate-pulse space-y-4">
      <div className="h-6 w-1/3 bg-slate-700/50 rounded" />
      <div className="h-4 w-full bg-slate-700/50 rounded" />
      <div className="h-4 w-2/3 bg-slate-700/50 rounded" />
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="p-4 bg-slate-800/50 rounded-2xl border border-white/5 animate-pulse"
        >
          <div className="space-y-2">
            <div className="h-4 w-20 bg-slate-700/50 rounded" />
            <div className="h-8 w-16 bg-slate-700/50 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
