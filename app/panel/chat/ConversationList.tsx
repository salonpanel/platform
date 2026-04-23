import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Archive, CheckCheck, Users } from "lucide-react";
import { CreateGroupListButton } from "./CreateGroupModal";

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
	lastMessageSenderName?: string | null;
	targetUserId?: string | null;
};

type MemberDir = Record<string, { displayName: string }>;

type ConversationListProps = {
	conversations: Conversation[];
	tenantLogoUrl?: string | null;
	selectedConversationId: string | null;
	onSelectConversation: (id: string) => void;
	showUnreadOnly: boolean;
	onToggleUnread: () => void;
	currentUserId: string | null;
	/** Nombres para preview "Autor: mensaje" si falta lastMessageSenderName */
	membersDirectory?: MemberDir;
	/** Abre el flujo para crear un chat grupal con miembros del equipo */
	onCreateGroup?: () => void;
	/** Abre modal de chats archivados */
	onOpenArchivedChats?: () => void;
};

/** Hora si el último mensaje tiene menos de 24 h; si no, "Hace N días". */
function formatListConversationTime(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const dayMs = 24 * 60 * 60 * 1000;

	if (diffMs < dayMs) {
		return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
	}

	const days = Math.max(1, Math.floor(diffMs / dayMs));
	if (days === 1) return "Hace 1 día";
	return `Hace ${days} días`;
}

function previewLastMessage(
	conv: Conversation,
	currentUserId: string | null,
	membersDirectory?: MemberDir
): string {
	const raw = conv.lastMessageBody?.trim() ?? "";
	if (!raw) return "Sin mensajes";

	const isGroupish = conv.type === "group" || conv.type === "all";
	if (!isGroupish) return raw;

	const sid = conv.lastMessageSenderId ?? null;
	if (sid && currentUserId && sid === currentUserId) {
		return `Tú: ${raw}`;
	}

	let sender =
		conv.lastMessageSenderName?.trim() ||
		(sid && membersDirectory?.[sid]?.displayName) ||
		"";
	if (!sender) sender = "Equipo";
	return `${sender}: ${raw}`;
}

function GroupChatAvatar({
	name,
	logoUrl,
	variant = "default",
}: {
	name: string;
	logoUrl: string | null | undefined;
	variant?: "default" | "team";
}) {
	const ring =
		variant === "team"
			? "border-2 border-[var(--bf-teal-300)]/50 shadow-[0_0_0_1px_rgba(30,161,159,0.12)]"
			: "border-2 border-[var(--bf-success)]/40";

	if (logoUrl) {
		return (
			<div
				className={cn(
					"relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-[var(--bf-surface)]",
					ring
				)}
			>
				<img src={logoUrl} alt={name} className="h-full w-full object-cover" />
			</div>
		);
	}
	return (
		<div
			className={cn(
				"flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[var(--bf-teal-200)]",
				variant === "team"
					? "border-2 border-[var(--bf-teal-300)]/45 bg-[rgba(30,161,159,0.18)]"
					: "border-2 border-[var(--bf-success)]/35 bg-[rgba(30,161,159,0.15)] text-[var(--bf-success)]"
			)}
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
	membersDirectory,
	onCreateGroup,
	onOpenArchivedChats,
}: ConversationListProps) {
	void onToggleUnread;
	const teamChat = conversations[0]?.type === "all" ? conversations[0] : null;
	const rest = teamChat ? conversations.slice(1) : conversations;

	return (
		<div className="flex h-full min-h-0 flex-col bg-[var(--bf-bg)]">
			<div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-2 md:px-3.5 md:py-2.5">
				{conversations.length === 0 ? (
					<div className="p-8 text-center text-sm text-[var(--bf-ink-400)]">
						{showUnreadOnly ? "No hay chats sin leer" : "No hay chats disponibles"}
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{teamChat && (
							<div className="sticky top-0 z-20 shrink-0 bg-[var(--bf-bg)] pb-0.5 pt-0.5">
								<ConversationRow
									conv={teamChat}
									variant="team"
									selected={selectedConversationId === teamChat.id}
									currentUserId={currentUserId}
									tenantLogoUrl={tenantLogoUrl}
									membersDirectory={membersDirectory}
									onSelect={() => onSelectConversation(teamChat.id)}
								/>
							</div>
						)}
						<div className="flex min-h-0 flex-col gap-1.5">
							{rest.map((conv) => (
								<ConversationRow
									key={conv.id}
									conv={conv}
									variant="default"
									selected={selectedConversationId === conv.id}
									currentUserId={currentUserId}
									tenantLogoUrl={tenantLogoUrl}
									membersDirectory={membersDirectory}
									onSelect={() => onSelectConversation(conv.id)}
								/>
							))}
						</div>
					</div>
				)}
			</div>
			{(onCreateGroup || onOpenArchivedChats) && (
				<div className="shrink-0 border-t border-[var(--bf-border)] bg-[var(--bf-bg)] px-3 py-2.5 md:px-3.5">
					<div
						className={cn(
							"grid gap-2",
							onCreateGroup && onOpenArchivedChats ? "grid-cols-2" : "grid-cols-1"
						)}
					>
						{onOpenArchivedChats && (
							<button
								type="button"
								onClick={onOpenArchivedChats}
								className={cn(
									"flex w-full min-w-0 items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bf-border)]",
									"bg-[var(--bf-surface)]/80 px-2 py-2.5 text-sm font-medium text-[var(--bf-ink-50)]",
									"transition-[background-color,box-shadow,border-color,transform] duration-200",
									"hover:border-[var(--bf-primary)]/40 hover:bg-[var(--bf-surface)]",
									"active:scale-[0.99]",
									"focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bf-bg)]"
								)}
								style={{ fontFamily: "var(--font-sans)" }}
							>
								<Archive className="h-4 w-4 shrink-0 text-[var(--bf-ink-400)]" aria-hidden />
								<span className="truncate">Archivados</span>
							</button>
						)}
						{onCreateGroup && <CreateGroupListButton onClick={onCreateGroup} />}
					</div>
				</div>
			)}
		</div>
	);
}

function formatUnreadLabel(n: number): string {
	if (n > 99) return "99+";
	return String(n);
}

function ConversationRow({
	conv,
	variant,
	selected,
	currentUserId,
	tenantLogoUrl,
	membersDirectory,
	onSelect,
}: {
	conv: Conversation;
	variant: "team" | "default";
	selected: boolean;
	currentUserId: string | null;
	tenantLogoUrl?: string | null;
	membersDirectory?: MemberDir;
	onSelect: () => void;
}) {
	const unread = conv.unreadCount > 0;
	const team = variant === "team";

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-label={
				unread
					? `${conv.name}, ${conv.unreadCount} sin leer`
					: conv.name
			}
			className={cn(
				"group flex w-full items-center gap-3 rounded-[var(--r-md)] border text-left transition-[background-color,box-shadow,border-color,transform] duration-200",
				"px-3 py-2.5 md:px-3.5 md:py-3",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bf-bg)]",
				"active:scale-[0.99]",
				team
					? [
							"border-[rgba(30,161,159,0.28)]",
							"bg-[linear-gradient(135deg,rgba(30,161,159,0.12)_0%,rgba(79,161,216,0.05)_100%)]",
							"shadow-[var(--bf-shadow-card)]",
							"hover:border-[rgba(30,161,159,0.4)]",
							selected && "border-[var(--bf-teal-400)]/50 shadow-[0_0_0_1px_rgba(30,161,159,0.2)]",
						]
					: [
							"border-[var(--bf-border)]/90 bg-[var(--bf-bg-elev)]/65",
							"hover:border-[var(--bf-border-2)] hover:bg-[var(--bf-surface)]/90",
							selected && "border-[var(--bf-border-2)] bg-[var(--bf-surface)]",
						]
			)}
		>
			<div className="relative flex-shrink-0">
				{conv.type === "all" ? (
					<GroupChatAvatar
						name={conv.name || "Chat del equipo"}
						logoUrl={tenantLogoUrl}
						variant={team ? "team" : "default"}
					/>
				) : (
					<Avatar size="lg" name={conv.name} className="border-none shadow-none" />
				)}
				{unread && (
					<span
						className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bf-bg-elev)] bg-[var(--bf-success)]"
						aria-hidden
					/>
				)}
			</div>

			<div className="flex min-h-[52px] min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5">
				<div className="flex items-baseline justify-between gap-2">
					<h3
						className={cn(
							"min-w-0 flex-1 truncate text-[15px] leading-tight text-[var(--bf-ink-50)]",
							"tracking-[-0.02em]",
							unread && "font-semibold",
							!unread && "font-medium"
						)}
						style={{ fontFamily: "var(--font-sans)" }}
					>
						{conv.name}
					</h3>
					{conv.lastMessageAt && (
						<span
							className={cn(
								"shrink-0 text-[11px] tabular-nums",
								unread ? "font-medium text-[var(--bf-success)]" : "text-[var(--bf-ink-400)]"
							)}
							style={{ fontFamily: "var(--font-mono)" }}
						>
							{formatListConversationTime(conv.lastMessageAt)}
						</span>
					)}
				</div>

				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						{conv.lastMessageSenderId === currentUserId && (
							<CheckCheck
								className={cn(
									"h-3.5 w-3.5 flex-shrink-0",
									!unread && conv.lastMessageAt
										? "text-[var(--bf-primary)]/90"
										: "text-[var(--bf-ink-400)]/55"
								)}
								aria-hidden
							/>
						)}
						<p
							className={cn(
								"min-w-0 flex-1 truncate text-[13px] leading-snug",
								unread ? "font-medium text-[var(--bf-ink-100)]" : "text-[var(--bf-ink-400)]"
							)}
						>
							{previewLastMessage(conv, currentUserId, membersDirectory)}
						</p>
					</div>
					{unread && (
						<span
							className={cn(
								"inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5",
								"bg-[var(--bf-success)] text-[11px] font-bold tabular-nums text-[var(--bf-ink)]",
								"shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
							)}
							aria-label={`${conv.unreadCount} mensajes sin leer`}
						>
							{formatUnreadLabel(conv.unreadCount)}
						</span>
					)}
				</div>
			</div>
		</button>
	);
}
