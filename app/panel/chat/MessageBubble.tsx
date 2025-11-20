"use client";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

type MessageBubbleProps = {
	message: {
		id: string;
		sender_id: string;
		body: string;
		created_at: string;
	};
	isOwn: boolean;
	senderName: string;
	senderAvatar?: string;
	showSenderName: boolean;
	showAvatar: boolean;
};

function formatTimestamp(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

	if (messageDate.getTime() === today.getTime()) {
		return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
	}
	return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

export function MessageBubble({
	message,
	isOwn,
	senderName,
	senderAvatar,
	showSenderName,
	showAvatar,
}: MessageBubbleProps) {
	return (
		<div className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
			{showAvatar && (
				<div className="flex-shrink-0">
					<Avatar src={senderAvatar} name={senderName} size="sm" />
				</div>
			)}
			<div className={cn("flex flex-col", isOwn ? "items-end" : "items-start", showAvatar ? "" : "flex-1")}>
				{showSenderName && !isOwn && (
					<p className="text-[10px] text-[var(--text-secondary)] mb-1 px-1 font-medium">{senderName}</p>
				)}
				<div
					className={cn(
						"max-w-[70%] rounded-xl px-4 py-2 glass border",
						isOwn
							? "bg-[rgba(58,109,255,0.15)] border-[#3A6DFF]/30"
							: "bg-white/5 border-white/10"
					)}
				>
					<p className="text-sm text-white whitespace-pre-wrap break-words">{message.body}</p>
					<p className="text-[10px] text-[var(--text-secondary)] mt-1">{formatTimestamp(message.created_at)}</p>
				</div>
			</div>
		</div>
	);
}



