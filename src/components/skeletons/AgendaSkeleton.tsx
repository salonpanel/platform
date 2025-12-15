import { cn } from "@/lib/utils";

export function AgendaSkeleton() {
    return (
        <div className="space-y-4 animate-pulse w-full h-full flex flex-col">
            {/* Header toolbars */}
            <div className="flex items-center justify-between p-1">
                <div className="h-9 w-48 bg-white/[0.03] rounded-lg border border-white/5" />
                <div className="flex gap-2">
                    <div className="h-9 w-24 bg-white/[0.03] rounded-lg border border-white/5" />
                    <div className="h-9 w-9 bg-white/[0.03] rounded-lg border border-white/5" />
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 bg-white/[0.02] rounded-xl border border-white/5 relative overflow-hidden">
                {/* Time column */}
                <div className="absolute left-0 top-0 bottom-0 w-12 border-r border-white/5" />

                {/* Columns */}
                <div className="ml-12 h-full grid grid-cols-3 divide-x divide-white/5">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-full relative">
                            {/* Random blocks simulation */}
                            <div className="absolute top-20 left-1 right-1 h-24 bg-white/[0.04] rounded mx-1" />
                            <div className="absolute top-60 left-1 right-1 h-32 bg-white/[0.04] rounded mx-1" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
