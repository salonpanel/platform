"use client";

import { Users, UserPlus, Bell } from "lucide-react";
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

type ConversationHeaderProps = {
	conversation: Conversation | null;
	onViewMembers?: () => void;
	onAddMember?: () => void;
	onToggleMute?: () => void;
};

function ConversationTypeBadge({ type }: { type: ConversationType }) {
	const registry: Record<ConversationType, { label: string; className: string }> = {
		all: { label: "General", className: "bg-[#4DE2C31a] text-[#4DE2C3]" },
		direct: { label: "Directo", className: "bg-[#3A6DFF1a] text-[#3A6DFF]" },
		group: { label: "Grupo", className: "bg-[#FF7AB61a] text-[#FF7AB6]" },
	};

	const config = registry[type];
	return (
		<span className={cn("px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide", config.className)}>
			{config.label}
		</span>
	);
}

export function ConversationHeader({
	conversation,
	onViewMembers,
	onAddMember,
	onToggleMute,
}: ConversationHeaderProps) {
	if (!conversation) {
		return null;
	}

	return (
		<div className="border-b border-white/5 p-4 flex items-center justify-between">
			<div className="flex-1 min-w-0">
				<h2 className="font-semibold text-white text-lg truncate">{conversation.name}</h2>
				<div className="flex items-center gap-2 mt-1">
					<ConversationTypeBadge type={conversation.type} />
					<span className="text-[10px] text-[var(--text-secondary)]">
						{conversation.membersCount} {conversation.membersCount === 1 ? "miembro" : "miembros"}
					</span>
				</div>
			</div>
			<div className="flex items-center gap-2">
				{onViewMembers && (
					<button
						onClick={onViewMembers}
						className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-smooth"
						title="Ver miembros"
					>
						<Users className="h-4 w-4" />
					</button>
				)}
				{onAddMember && (
					<button
						onClick={onAddMember}
						className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-smooth"
						title="Añadir miembro"
					>
						<UserPlus className="h-4 w-4" />
					</button>
				)}
				{onToggleMute && (
					<button
						onClick={onToggleMute}
						className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-smooth"
						title="Silenciar"
					>
						<Bell className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	);
}



