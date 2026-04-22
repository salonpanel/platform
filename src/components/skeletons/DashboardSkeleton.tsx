/**
 * Placeholder del dashboard: misma jerarquía y breakpoints que `PanelHomeClient`
 * (hero → KPIs → reservas+staff en lg → performance+acciones en lg) para evitar saltos de layout al cargar.
 */
export function DashboardSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="w-full min-w-0 max-w-full px-0 py-2.5 min-[400px]:py-3 sm:py-4">
          <div className="animate-pulse">
            {/* Hero (fecha + desplegable periodo) */}
            <div className="mb-3 flex flex-row items-start justify-between gap-3 sm:mb-4">
              <div className="min-w-0 flex-1 pr-2">
                <div className="h-6 max-w-[min(16rem,90%)] rounded-md bg-white/[0.08] sm:h-7" />
              </div>
              <div className="h-9 w-[6.75rem] shrink-0 rounded-lg bg-white/[0.06] sm:w-[7.5rem]" />
            </div>

            {/* KPIs — misma fila en móvil (4 columnas) */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3 lg:gap-4 mb-4 sm:mb-5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="min-w-0 rounded-lg sm:rounded-xl border border-white/10 bg-white/[0.02] p-2 sm:p-3.5 lg:p-4 min-h-[5.5rem] sm:min-h-[7.25rem]"
                >
                  <div className="mb-2 flex items-center gap-0.5 sm:gap-2">
                    <div className="h-6 w-6 shrink-0 rounded-md sm:h-8 sm:w-8 sm:rounded-lg bg-white/[0.06]" />
                    <div className="ml-auto h-2.5 w-4 rounded bg-white/[0.05] sm:h-3 sm:w-6" />
                  </div>
                  <div className="mb-1.5 h-5 w-full max-w-[4rem] rounded bg-white/[0.09] sm:mb-2 sm:h-8 sm:max-w-[8rem]" />
                  <div className="h-2.5 w-full rounded bg-white/[0.05] sm:h-3 sm:w-24" />
                </div>
              ))}
            </div>

            {/* Fila 1: Próximas reservas (lg) + Staff */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-5">
              <div className="hidden lg:block lg:col-span-8">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="h-5 w-36 rounded bg-white/[0.08]" />
                      <div className="h-7 w-32 rounded-full bg-white/[0.06]" />
                    </div>
                    <div className="h-4 w-16 rounded bg-white/[0.05]" />
                  </div>
                  <div className="space-y-2 px-2.5 py-3 sm:px-3">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="h-11 rounded-lg bg-white/[0.04]" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4">
                    <div className="h-5 w-24 rounded bg-white/[0.08]" />
                    <div className="h-4 w-14 rounded bg-white/[0.05]" />
                  </div>
                  <div className="divide-y divide-white/[0.06] px-2.5 py-2 sm:px-3">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center justify-between py-3 first:pt-2 last:pb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 shrink-0 rounded-full bg-white/[0.06]" />
                          <div className="space-y-1.5">
                            <div className="h-4 w-28 rounded bg-white/[0.07]" />
                            <div className="h-3 w-16 rounded bg-white/[0.05]" />
                          </div>
                        </div>
                        <div className="h-4 w-10 rounded bg-white/[0.05]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Fila 2: Performance + Acciones (lg) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 pb-1 md:pb-0">
              <div className="lg:col-span-8">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
                    <div className="h-5 w-28 rounded bg-white/[0.08]" />
                    <div className="flex gap-1">
                      <div className="h-9 w-10 rounded-lg bg-white/[0.06]" />
                      <div className="h-9 w-10 rounded-lg bg-white/[0.06]" />
                    </div>
                  </div>
                  <div className="px-3 py-3 sm:px-4 sm:py-3">
                    <div className="mb-3 flex items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded bg-white/[0.07]" />
                        <div className="h-3 w-24 rounded bg-white/[0.05]" />
                      </div>
                      <div className="space-y-1 text-right">
                        <div className="ml-auto h-7 w-12 rounded bg-white/[0.09]" />
                        <div className="ml-auto h-3 w-8 rounded bg-white/[0.05]" />
                      </div>
                    </div>
                    <div className="mx-auto mb-3 flex h-24 max-w-[85%] items-end justify-between gap-1 sm:h-28">
                      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
                        <div
                          key={k}
                          className="flex flex-1 flex-col items-center gap-1"
                        >
                          <div
                            className="w-full rounded-t bg-white/[0.08]"
                            style={{ height: `${28 + (k % 5) * 12}px` }}
                          />
                          <div className="h-2.5 w-full rounded bg-white/[0.04]" />
                          <div className="h-3 w-4 rounded bg-white/[0.06]" />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-4 border-t border-white/[0.06] pt-3 sm:gap-6">
                      {[0, 1, 2].map((k) => (
                        <div key={k} className="space-y-1.5 text-center">
                          <div className="mx-auto h-4 w-16 rounded bg-white/[0.07]" />
                          <div className="mx-auto h-3 w-20 rounded bg-white/[0.05]" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block lg:col-span-4">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="border-b border-white/10 px-3 py-2.5 sm:px-4">
                    <div className="h-5 w-24 rounded bg-white/[0.08]" />
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="h-10 w-full rounded-lg bg-white/[0.08]" />
                    <div className="h-10 w-full rounded-lg bg-white/[0.05]" />
                    <div className="h-10 w-full rounded-lg bg-white/[0.05]" />
                    <div className="mt-3 border-t border-white/[0.08] pt-3">
                      <div className="mb-2 h-3 w-28 rounded bg-white/[0.05]" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-9 rounded-lg bg-white/[0.04]" />
                        <div className="h-9 rounded-lg bg-white/[0.04]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
