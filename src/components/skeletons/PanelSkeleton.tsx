import { DashboardSkeleton } from "./DashboardSkeleton";

export function PanelSkeleton() {
    return (
        <div className="w-full h-full flex flex-col animate-pulse">
            {/* Fake TopBar to prevent layout shift */}
            <div className="h-16 border-b border-white/5 bg-slate-950 mb-6 flex items-center px-6 justify-between">
                <div className="h-6 w-32 bg-white/[0.05] rounded" />
                <div className="h-8 w-8 rounded-full bg-white/[0.05]" />
            </div>

            {/* Content Area */}
            <div className="flex-1 px-6 pb-6">
                <DashboardSkeleton />
            </div>
        </div>
    );
}
