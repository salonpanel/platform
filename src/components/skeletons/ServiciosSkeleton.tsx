export function ServiciosSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-white/[0.06] rounded-lg" />
          <div className="h-4 w-48 bg-white/[0.03] rounded" />
        </div>
        <div className="h-10 w-36 bg-white/[0.06] rounded-xl" />
      </div>

      {/* Filters bar */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 bg-white/[0.04] rounded-xl border border-white/5" />
        <div className="h-10 w-28 bg-white/[0.04] rounded-xl border border-white/5" />
        <div className="h-10 w-28 bg-white/[0.04] rounded-xl border border-white/5" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(cards)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4"
          >
            {/* Service name + badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-5 w-3/4 bg-white/[0.07] rounded" />
                <div className="h-3 w-1/2 bg-white/[0.04] rounded" />
              </div>
              <div className="h-5 w-14 bg-white/[0.05] rounded-full" />
            </div>

            {/* Price + duration */}
            <div className="flex items-center gap-4">
              <div className="h-8 w-20 bg-white/[0.06] rounded-lg" />
              <div className="h-4 w-16 bg-white/[0.04] rounded" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t border-white/5">
              <div className="h-8 flex-1 bg-white/[0.04] rounded-lg" />
              <div className="h-8 flex-1 bg-white/[0.04] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
