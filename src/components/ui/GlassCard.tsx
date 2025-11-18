import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div
			className={cn(
				"rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(15,17,21,0.96)] shadow-[0_18px_45px_rgba(0,0,0,0.6)] backdrop-blur-xl",
				"transition-smooth hover:border-[rgba(255,255,255,0.14)] hover:-translate-y-[1px]",
				className
			)}
		>
			{children}
		</div>
	);
}







