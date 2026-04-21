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
	/** Logo de la barbería para el chat grupal (sin solapar iconos) */
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
			<div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-[#00a884]/40 bg-[#0b141a] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
				<img src={logoUrl} alt={name} className="h-full w-full object-cover" />
			</div>
		);
	}
	return (
		<div
			className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#00a884]/35 bg-[#53bdeb] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
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
		<div className="flex h-full flex-col bg-[#111b21]">
			<div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
				{conversations.length === 0 ? (
					<div className="p-8 text-center text-[var(--text-secondary)] text-sm">
						{showUnreadOnly ? "No hay chats sin leer" : "No hay chats disponibles"}
					</div>
				) : (
					<>
						{pinned && (
							<div className="sticky top-0 z-20 flex-shrink-0 border-b border-[#00a884]/35 bg-gradient-to-b from-[#1a2c22]/95 to-[#111b21] shadow-[0_6px_20px_rgba(0,0,0,0.45)] backdrop-blur-sm">
								<div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#4DE2C3]">
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
						<div className="divide-y divide-white/5">
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
				"group flex w-full items-center gap-3 px-4 py-3 text-left transition-all hover:bg-[#202c33]",
				selected && "bg-[#2a3942]",
				isPinned && "border-l-[3px] border-l-[#00a884]"
			)}
		>
			<div className="relative flex-shrink-0">
				{conv.type === "all" ? (
					<GroupChatAvatar name={conv.name || "Chat del equipo"} logoUrl={tenantLogoUrl} />
				) : (
					<Avatar size="lg" name={conv.name} className="border-none shadow-none" />
				)}
			</div>

			<div className="flex h-[56px] min-w-0 flex-1 flex-col justify-center border-b border-white/5 py-1">
				<div className="mb-0.5 flex items-baseline justify-between">
					<h3
						className={cn(
							"truncate pr-2 text-base font-medium text-[#e9edef]",
							conv.unreadCount > 0 && "font-bold",
							isPinned && "text-[#e9edef]"
						)}
					>
						{conv.name}
					</h3>
					{conv.lastMessageAt && (
						<span
							className={cn(
								"flex-shrink-0 text-[12px]",
								conv.unreadCount > 0 ? "font-medium text-[#00a884]" : "text-[#8696a0]"
							)}
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
									conv.unreadCount === 0 && conv.lastMessageAt ? "text-[#53bdeb]" : "text-[#8696a0]/60"
								)}
							/>
						)}
						<p
							className={cn(
								"truncate pr-2 text-sm",
								conv.unreadCount > 0 ? "font-medium text-[#e9edef]" : "text-[#8696a0]"
							)}
						>
							{conv.lastMessageBody || "Sin mensajes"}
						</p>
					</div>
					{conv.unreadCount > 0 && (
						<span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#00a884] px-1.5 text-[12px] font-bold text-[#111b21]">
							{conv.unreadCount}
						</span>
					)}
				</div>
			</div>
		</button>
	);
}
