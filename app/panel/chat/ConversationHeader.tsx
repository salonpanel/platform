"use client";

import { Users, UserPlus, Bell, ChevronLeft, MoreVertical, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";

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
	targetUserId?: string | null;
};

type ConversationHeaderProps = {
	conversation: Conversation | null;
	onViewMembers?: () => void;
	onAddMember?: () => void;
	onToggleMute?: () => void;
	onBack?: () => void;
	isMobile?: boolean;
	/** Chats directos y grupales (no canal de equipo ni placeholder) */
	chatActionsEnabled?: boolean;
	onArchiveChat?: () => void;
	onDeleteChat?: () => void;
};

function ConversationTypeBadge({ type }: { type: ConversationType }) {
	const registry: Record<ConversationType, { label: string; className: string }> = {
		all:    { label: "General", className: "bg-[rgba(30,161,159,0.12)] text-[var(--bf-success)] border border-[rgba(30,161,159,0.30)]" },
		direct: { label: "Directo", className: "bg-[rgba(79,161,216,0.12)] text-[var(--bf-primary)] border border-[rgba(79,161,216,0.30)]" },
		group:  { label: "Grupo",   className: "bg-[rgba(232,176,74,0.10)] text-[var(--bf-warn)] border border-[rgba(232,176,74,0.25)]" },
	};

	const config = registry[type];
	return (
		<span className={cn("px-2 py-0.5 rounded-[var(--r-sm)] text-[10px] font-medium uppercase tracking-wide", config.className)} style={{ fontFamily: "var(--font-mono)" }}>
			{config.label}
		</span>
	);
}

export function ConversationHeader({
	conversation,
	onViewMembers,
	onAddMember,
	onToggleMute,
	onBack,
	isMobile,
	chatActionsEnabled = false,
	onArchiveChat,
	onDeleteChat,
}: ConversationHeaderProps) {
	if (!conversation) return null;

	const showOverflowMenu =
		chatActionsEnabled && (onArchiveChat || onDeleteChat);

	return (
		<div className="relative z-20 flex shrink-0 items-center justify-between border-b border-[var(--bf-border)] bg-[var(--bf-bg)] px-4 py-3 md:px-5">
			<div className="flex items-center gap-3 min-w-0">
				{isMobile && onBack && (
					<button
						onClick={onBack}
						className="p-2 -ml-2 rounded-full text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-surface)] transition-all lg:hidden"
					>
						<ChevronLeft className="h-6 w-6" />
					</button>
				)}
				<div className="min-w-0">
					<h2
						className="truncate text-base font-semibold leading-tight text-[var(--bf-ink-50)] md:text-lg"
						style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" }}
					>
						{conversation.name}
					</h2>
					<div className="flex items-center gap-2">
						<ConversationTypeBadge type={conversation.type} />
						{conversation.type !== "direct" && (
							<span className="text-[10px] text-[var(--bf-ink-400)]" style={{ fontFamily: "var(--font-mono)" }}>
								{conversation.membersCount} {conversation.membersCount === 1 ? "miembro" : "miembros"}
							</span>
						)}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-1">
				{showOverflowMenu && (
					<DropdownMenu
						align="right"
						trigger={
							<button
								type="button"
								className="p-2 rounded-[var(--r-md)] text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-surface)] transition-all"
								aria-label="Más opciones del chat"
							>
								<MoreVertical className="h-4 w-4" />
							</button>
						}
					>
						{onArchiveChat && (
							<DropdownMenuItem
								onClick={() => {
									onArchiveChat();
								}}
							>
								<span className="flex items-center gap-2">
									<Archive className="h-4 w-4 opacity-80" />
									Archivar chat
								</span>
							</DropdownMenuItem>
						)}
						{onDeleteChat && (
							<DropdownMenuItem
								variant="danger"
								onClick={() => {
									onDeleteChat();
								}}
							>
								<span className="flex items-center gap-2">
									<Trash2 className="h-4 w-4 opacity-90" />
									Eliminar chat
								</span>
							</DropdownMenuItem>
						)}
					</DropdownMenu>
				)}
				{onViewMembers && (
					<button
						onClick={onViewMembers}
						className="p-2 rounded-[var(--r-md)] text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-surface)] transition-all"
						title="Ver miembros"
					>
						<Users className="h-4 w-4" />
					</button>
				)}
				{onAddMember && (
					<button
						onClick={onAddMember}
						className="p-2 rounded-[var(--r-md)] text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-surface)] transition-all"
						title="Añadir miembro"
					>
						<UserPlus className="h-4 w-4" />
					</button>
				)}
				{onToggleMute && (
					<button
						onClick={onToggleMute}
						className="p-2 rounded-[var(--r-md)] text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-surface)] transition-all"
						title="Silenciar"
					>
						<Bell className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	);
}
