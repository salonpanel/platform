import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Check, CheckCheck, Users } from "lucide-react";

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

export function ConversationList({
	conversations,
	selectedConversationId,
	onSelectConversation,
	showUnreadOnly,
	currentUserId,
}: ConversationListProps) {
	const filteredConversations = showUnreadOnly
		? conversations.filter((conv) => conv.unreadCount > 0)
		: conversations;

	return (
		<div className="flex flex-col h-full bg-[#111b21]">
			<div className="flex-1 overflow-y-auto custom-scrollbar">
				{filteredConversations.length === 0 ? (
					<div className="p-8 text-center text-[var(--text-secondary)] text-sm">
						{showUnreadOnly ? "No hay chats sin leer" : "No hay chats disponibles"}
					</div>
				) : (
					<div className="divide-y divide-white/5">
						{filteredConversations.map((conv) => (
							<button
								key={conv.id}
								onClick={() => onSelectConversation(conv.id)}
								className={cn(
									"group w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-[#202c33]",
									selectedConversationId === conv.id && "bg-[#2a3942]"
								)}
							>
								{/* Avatar Section */}
								<div className="relative flex-shrink-0">
									<Avatar 
										size="lg"
										name={conv.name}
										className={cn(
											"shadow-none border-none",
											conv.type === 'all' && "bg-[#53bdeb] text-white"
										)}
									>
										{conv.type === 'all' && <Users className="h-6 w-6" />}
									</Avatar>
								</div>

								{/* Content Section */}
								<div className="flex-1 min-w-0 border-b border-white/5 py-1 flex flex-col justify-center h-[56px]">
									<div className="flex items-baseline justify-between mb-0.5">
										<h3 className={cn(
											"font-medium text-[#e9edef] text-base truncate pr-2",
											conv.unreadCount > 0 && "font-bold"
										)}>
											{conv.name}
										</h3>
										{conv.lastMessageAt && (
											<span className={cn(
												"text-[12px] flex-shrink-0",
												conv.unreadCount > 0 ? "text-[#00a884] font-medium" : "text-[#8696a0]"
											)}>
												{formatTimestamp(conv.lastMessageAt)}
											</span>
										)}
									</div>

									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1 min-w-0 flex-1">
											{conv.lastMessageSenderId === currentUserId && (
												<CheckCheck className={cn(
													"h-4 w-4 flex-shrink-0",
													conv.unreadCount === 0 && conv.lastMessageAt ? "text-[#53bdeb]" : "text-[#8696a0]/60"
												)} />
											)}
											<p className={cn(
												"text-sm truncate pr-2",
												conv.unreadCount > 0 ? "text-[#e9edef] font-medium" : "text-[#8696a0]"
											)}>
												{conv.lastMessageBody || "Sin mensajes"}
											</p>
										</div>
										{conv.unreadCount > 0 && (
											<span className="flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#00a884] text-[#111b21] text-[12px] font-bold">
												{conv.unreadCount}
											</span>
										)}
									</div>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}



