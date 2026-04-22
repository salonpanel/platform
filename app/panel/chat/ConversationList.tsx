import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { CheckCheck, Pin, Users } from "lucide-react";

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
	lastMessageSenderId?: string | null;
	targetUserId?: string | null;
};

type ConversationListProps = {
	conversations: Conversation[];
	tenantLogoUrl?: string | null;
	selectedConversationId: string | null;
	onSelectConversation: (id: string) => void;
	showUnreadOnly: boolean;
	onToggleUnread: () => void;
	currentUserId: string | null;
};

function formatTimestamp(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

	if (messageDate.getTime() === today.getTime()) {
		return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
	}

	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	if (messageDate.getTime() === yesterday.getTime()) {
		return "Ayer";
	}

	return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function GroupChatAvatar({
	name,
	logoUrl,
}: {
	name: string;
	logoUrl: string | null | undefined;
}) {
	if (logoUrl) {
		return (
			<div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-[var(--bf-success)]/40 bg-[var(--bf-bg-elev)]">
				<img src={logoUrl} alt={name} className="h-full w-full object-cover" />
			</div>
		);
	}
	return (
		<div
			className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--bf-success)]/35 bg-[rgba(30,161,159,0.15)] text-[var(--bf-success)]"
			aria-hidden
		>
			<Users className="h-6 w-6" />
		</div>
	);
}

export function ConversationList({
	conversations,
	tenantLogoUrl,
	selectedConversationId,
	onSelectConversation,
	showUnreadOnly,
	onToggleUnread,
	currentUserId,
}: ConversationListProps) {
	void onToggleUnread;
	const pinned = conversations[0]?.type === "all" ? conversations[0] : null;
	const rest = pinned ? conversations.slice(1) : conversations;

	return (
		<div className="flex h-full flex-col bg-[var(--bf-bg-elev)]">
			<div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
				{conversations.length === 0 ? (
					<div className="p-8 text-center text-[var(--bf-ink-400)] text-sm">
						{showUnreadOnly ? "No hay chats sin leer" : "No hay chats disponibles"}
					</div>
				) : (
					<>
						{pinned && (
							<div className="sticky top-0 z-20 flex-shrink-0 border-b border-[var(--bf-border)] bg-[var(--bf-bg-elev)]">
								<div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--bf-success)]" style={{ fontFamily: "var(--font-mono)" }}>
									<Pin className="h-3 w-3" aria-hidden />
									<span>Chat del equipo</span>
								</div>
								<ConversationRow
									conv={pinned}
									isPinned
									selected={selectedConversationId === pinned.id}
									currentUserId={currentUserId}
									tenantLogoUrl={tenantLogoUrl}
									onSelect={() => onSelectConversation(pinned.id)}
								/>
							</div>
						)}
						<div className="divide-y divide-[var(--bf-border)]">
							{rest.map((conv) => (
								<ConversationRow
									key={conv.id}
									conv={conv}
									isPinned={false}
									selected={selectedConversationId === conv.id}
									currentUserId={currentUserId}
									tenantLogoUrl={tenantLogoUrl}
									onSelect={() => onSelectConversation(conv.id)}
								/>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function ConversationRow({
	conv,
	isPinned,
	selected,
	currentUserId,
	tenantLogoUrl,
	onSelect,
}: {
	conv: Conversation;
	isPinned: boolean;
	selected: boolean;
	currentUserId: string | null;
	tenantLogoUrl?: string | null;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"group flex w-full items-center gap-3 px-4 py-3 text-left transition-all hover:bg-[var(--bf-surface)]",
				selected && "bg-[var(--bf-surface-2)]",
				isPinned && "border-l-[3px] border-l-[var(--bf-success)]"
			)}
		>
			<div className="relative flex-shrink-0">
				{conv.type === "all" ? (
					<GroupChatAvatar name={conv.name || "Chat del equipo"} logoUrl={tenantLogoUrl} />
				) : (
					<Avatar size="lg" name={conv.name} className="border-none shadow-none" />
				)}
			</div>

			<div className="flex h-[56px] min-w-0 flex-1 flex-col justify-center border-b border-[var(--bf-border)] py-1">
				<div className="mb-0.5 flex items-baseline justify-between">
					<h3
						className={cn(
							"truncate pr-2 text-base font-medium text-[var(--bf-ink-50)]",
							conv.unreadCount > 0 && "font-bold"
						)}
					>
						{conv.name}
					</h3>
					{conv.lastMessageAt && (
						<span
							className={cn(
								"flex-shrink-0 text-[12px]",
								conv.unreadCount > 0 ? "font-medium text-[var(--bf-success)]" : "text-[var(--bf-ink-400)]"
							)}
							style={{ fontFamily: "var(--font-mono)" }}
						>
							{formatTimestamp(conv.lastMessageAt)}
						</span>
					)}
				</div>

				<div className="flex items-center justify-between">
					<div className="flex min-w-0 flex-1 items-center gap-1">
						{conv.lastMessageSenderId === currentUserId && (
							<CheckCheck
								className={cn(
									"h-4 w-4 flex-shrink-0",
									conv.unreadCount === 0 && conv.lastMessageAt ? "text-[var(--bf-primary)]" : "text-[var(--bf-ink-400)]/60"
								)}
							/>
						)}
						<p
							className={cn(
								"truncate pr-2 text-sm",
								conv.unreadCount > 0 ? "font-medium text-[var(--bf-ink-100)]" : "text-[var(--bf-ink-400)]"
							)}
						>
							{conv.lastMessageBody || "Sin mensajes"}
						</p>
					</div>
					{conv.unreadCount > 0 && (
						<span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[var(--bf-success)] px-1.5 text-[12px] font-bold text-[var(--bf-ink)]">
							{conv.unreadCount}
						</span>
					)}
				</div>
			</div>
		</button>
	);
}
