import { cn } from "@/lib/utils";

export function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse w-full">
            {/* KPIs skeleton - Grid 4 cols */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className="h-[100px] bg-white/[0.03] rounded-xl border border-white/5"
                    />
                ))}
            </div>

            {/* Content grid skeleton - 12 cols */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Main chart area (8 cols) */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="h-[300px] bg-white/[0.03] rounded-xl border border-white/5" />
                    <div className="h-[200px] bg-white/[0.03] rounded-xl border border-white/5" />
                </div>

                {/* Sidebar/Secondary area (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="h-[250px] bg-white/[0.03] rounded-xl border border-white/5" />
                    <div className="h-[250px] bg-white/[0.03] rounded-xl border border-white/5" />
                </div>
            </div>
        </div>
    );
}
