import { cn } from "@/lib/utils";

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="w-full space-y-4 animate-pulse">
            {/* Toolbar / Filters */}
            <div className="flex justify-between items-center mb-6">
                <div className="h-10 w-64 bg-white/[0.03] rounded-lg border border-white/5" />
                <div className="h-10 w-32 bg-white/[0.03] rounded-lg border border-white/5" />
            </div>

            {/* Table Structure */}
            <div className="rounded-xl border border-white/5 bg-slate-900/50 overflow-hidden">
                {/* Header */}
                <div className="h-12 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-4">
                    <div className="h-4 w-4 bg-white/10 rounded" />
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-4 w-24 bg-white/10 rounded" />
                    <div className="h-4 w-24 bg-white/10 rounded" />
                </div>

                {/* Rows */}
                {[...Array(rows)].map((_, i) => (
                    <div
                        key={i}
                        className="h-16 border-b border-white/5 flex items-center px-4 gap-4 last:border-0"
                    >
                        <div className="h-4 w-4 bg-white/[0.05] rounded" />
                        <div className="h-10 w-10 rounded-full bg-white/[0.05]" />
                        <div className="space-y-2 flex-1">
                            <div className="h-4 w-48 bg-white/[0.05] rounded" />
                            <div className="h-3 w-32 bg-white/[0.03] rounded" />
                        </div>
                        <div className="h-6 w-20 bg-white/[0.05] rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}
