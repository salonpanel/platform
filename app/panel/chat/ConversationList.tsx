"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

type ConversationType = "all" | "direct" | "group";

type Conversation = {
	id: string;
	tenantId: string;
	type: ConversationType;
	name: string;
	lastMessageBody: string | null;
	lastMessageAt: string | null;
	unreadCount: number;
	membersCount: number;
	lastReadAt: string | null;
	createdBy: string;
	viewerRole: "member" | "admin";
};

type ConversationListProps = {
	conversations: Conversation[];
	selectedConversationId: string | null;
	onSelectConversation: (id: string) => void;
	showUnreadOnly: boolean;
	onToggleUnread: () => void;
};

function getConversationSubtitle(type: ConversationType): string {
	switch (type) {
		case "all":
			return "Chat general de la barbería";
		case "direct":
			return "Chat 1:1";
		case "group":
			return "Grupo de equipo";
	}
}

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

export function ConversationList({
	conversations,
	selectedConversationId,
	onSelectConversation,
	showUnreadOnly,
	onToggleUnread,
}: ConversationListProps) {
	const filteredConversations = showUnreadOnly
		? conversations.filter((conv) => conv.unreadCount > 0)
		: conversations;

	return (
		<GlassCard className="flex flex-col overflow-hidden p-0">
			<div className="flex-1 overflow-y-auto">
				{filteredConversations.length === 0 ? (
					<div className="p-4 text-center text-[var(--text-secondary)] text-sm">
						{showUnreadOnly ? "No hay conversaciones sin leer" : "No hay conversaciones"}
					</div>
				) : (
					<div className="divide-y divide-white/5">
						{filteredConversations.map((conv) => (
							<button
								key={conv.id}
								onClick={() => onSelectConversation(conv.id)}
								className={cn(
									"w-full text-left p-4 transition-smooth hover:bg-white/5",
									selectedConversationId === conv.id && "bg-[rgba(58,109,255,0.1)] border-l-2 border-[#3A6DFF]"
								)}
							>
								<div className="flex items-start justify-between gap-2 mb-1">
									<h3 className="font-semibold text-white text-sm truncate flex-1">{conv.name}</h3>
									{conv.unreadCount > 0 && (
										<span className="px-2 py-0.5 rounded-full bg-[#3A6DFF] text-white text-[10px] font-medium min-w-[20px] text-center">
											{conv.unreadCount}
										</span>
									)}
								</div>
								<p className="text-[11px] text-[var(--text-secondary)] mb-1">{getConversationSubtitle(conv.type)}</p>
								{conv.lastMessageBody && (
									<p className="text-xs text-[var(--text-secondary)] truncate mb-1">{conv.lastMessageBody}</p>
								)}
								{conv.lastMessageAt && (
									<p className="text-[10px] text-[var(--text-secondary)]">{formatTimestamp(conv.lastMessageAt)}</p>
								)}
							</button>
						))}
					</div>
				)}
			</div>
		</GlassCard>
	);
}

