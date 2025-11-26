"use client";

import {
	RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { Plus, MessageSquare, User, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ConversationList } from "./ConversationList";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { MembersModal } from "./MembersModal";
import { AddMembersModal } from "./AddMembersModal";
import { UserProfileModal } from "./UserProfileModal";

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

type TeamMessage = {
	id: string;
	conversation_id: string;
	sender_id: string;
	body: string;
	created_at: string;
	edited_at: string | null;
};

type TenantMemberProfile = {
	userId: string;
	displayName: string;
	tenantRole: string;
	profilePhotoUrl?: string;
};

const MESSAGE_FALLBACK_DATE = "1970-01-01T00:00:00Z";

type ChatPageData = {
	tenant: {
		id: string;
		name: string;
		timezone: string;
	};
	conversations: Conversation[];
	membersDirectory: Record<string, TenantMemberProfile>;
};

interface TeamChatOptimizedProps {
	initialData: ChatPageData;
	impersonateOrgId: string | null;
}

export function TeamChatOptimized({
	initialData,
	impersonateOrgId,
}: TeamChatOptimizedProps) {
	const supabase = getSupabaseBrowser();
	const searchParams = useSearchParams();

	// Estados principales con datos iniciales
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
	const [tenantId, setTenantId] = useState<string>(initialData.tenant.id);
	const [conversations, setConversations] = useState<Conversation[]>(initialData.conversations);
	const [membersDirectory, setMembersDirectory] = useState<Record<string, TenantMemberProfile>>(initialData.membersDirectory);

	// Estados de UI
	const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
		initialData.conversations.length > 0 ? initialData.conversations[0].id : null
	);
	const [messagesByConversation, setMessagesByConversation] = useState<Record<string, TeamMessage[]>>({});
	const [messagesLoading, setMessagesLoading] = useState(false);
	const [showUnreadOnly, setShowUnreadOnly] = useState(false);
	const [showNewChatModal, setShowNewChatModal] = useState(false);
	const [showMembersModal, setShowMembersModal] = useState(false);
	const [showAddMemberModal, setShowAddMemberModal] = useState(false);
	const [showUserProfileModal, setShowUserProfileModal] = useState(false);
	const [showProfileDropdown, setShowProfileDropdown] = useState(false);

	// Estados del modal nuevo chat
	const [newChatType, setNewChatType] = useState<ConversationType>("direct");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [groupName, setGroupName] = useState("");
	const [creatingChat, setCreatingChat] = useState(false);

	const messageContainerRef = useRef<HTMLDivElement>(null);
	const profileDropdownRef = useRef<HTMLDivElement>(null);

	// 🔥 BOOTSTRAP OPTIMIZADO: Solo resolver usuario (datos ya precargados)
	useEffect(() => {
		const bootstrap = async () => {
			try {
				const { data: { user }, error } = await supabase.auth.getUser();
				if (error) throw error;
				if (!user) throw new Error("No autenticado.");

				setCurrentUserId(user.id);
				setCurrentUserEmail(user.email || null);
			} catch (err) {
				console.error("[TeamChatOptimized] Bootstrap error", err);
			}
		};

		bootstrap();
	}, [supabase.auth]);

	// 🔥 CARGAR MENSAJES DE CONVERSACIÓN SELECCIONADA (solo cuando se necesita)
	const loadMessagesForConversation = useCallback(
		async (conversationId: string) => {
			if (messagesByConversation[conversationId]) return; // Ya cargados

			setMessagesLoading(true);
			try {
				const { data, error } = await supabase
					.from("team_messages")
					.select("id, conversation_id, sender_id, body, created_at, edited_at")
					.eq("conversation_id", conversationId)
					.is("deleted_at", null)
					.order("created_at", { ascending: false })
					.limit(50); // Solo últimos 50 mensajes inicialmente

				if (error) throw error;

				const sorted = (data as TeamMessage[] ?? []).reverse();
				setMessagesByConversation((prev) => ({
					...prev,
					[conversationId]: sorted,
				}));

				// Marcar como leídos
				if (currentUserId) {
					const now = new Date().toISOString();
					await supabase
						.from("team_conversation_members")
						.update({ last_read_at: now })
						.eq("conversation_id", conversationId)
						.eq("user_id", currentUserId);

					setConversations((prev) =>
						prev.map((conv) =>
							conv.id === conversationId ? { ...conv, unreadCount: 0, lastReadAt: now } : conv
						)
					);
				}
			} catch (err) {
				console.error("[TeamChatOptimized] Error cargando mensajes", err);
			} finally {
				setMessagesLoading(false);
			}
		},
		[supabase, currentUserId, messagesByConversation]
	);

	// 🔥 REAL-TIME SUBSCRIPTION OPTIMIZADA
	useEffect(() => {
		if (!tenantId) return;

		const channel = supabase
			.channel(`team_chat_optimized_${tenantId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "team_messages",
					filter: `tenant_id=eq.${tenantId}`,
				},
				(payload) => {
					const newMessage = payload.new as TeamMessage | null;
					if (!newMessage) return;

					const conversationId = newMessage.conversation_id;

					// 🔥 Actualizar conversaciones (lastMessage, unreadCount)
					setConversations((prev) =>
						prev.map((conv) =>
							conv.id === conversationId ? {
								...conv,
								lastMessageBody: newMessage.body,
								lastMessageAt: newMessage.created_at,
								unreadCount: conv.id === selectedConversationId ? 0 : conv.unreadCount + 1
							} : conv
						).sort((a, b) => {
							const aTime = a.lastMessageAt ?? MESSAGE_FALLBACK_DATE;
							const bTime = b.lastMessageAt ?? MESSAGE_FALLBACK_DATE;
							return bTime.localeCompare(aTime);
						})
					);

					// 🔥 Actualizar mensajes solo si es la conversación activa
					if (conversationId === selectedConversationId) {
						setMessagesByConversation((prev) => {
							const existing = prev[conversationId] ?? [];
							if (existing.some((m) => m.id === newMessage.id)) return prev;
							return {
								...prev,
								[conversationId]: [...existing, newMessage],
							};
						});
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [supabase, tenantId, selectedConversationId]);

	// Cargar mensajes cuando se selecciona conversación
	useEffect(() => {
		if (selectedConversationId && !messagesByConversation[selectedConversationId]) {
			loadMessagesForConversation(selectedConversationId);
		}
	}, [selectedConversationId, loadMessagesForConversation, messagesByConversation]);

	// Cerrar dropdown al hacer clic fuera
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
				setShowProfileDropdown(false);
			}
		};

		if (showProfileDropdown) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showProfileDropdown]);

	const visibleConversations = useMemo(
		() => (showUnreadOnly ? conversations.filter((conv) => conv.unreadCount > 0) : conversations),
		[conversations, showUnreadOnly]
	);

	const selectedConversation = useMemo(
		() => conversations.find((conv) => conv.id === selectedConversationId) ?? null,
		[conversations, selectedConversationId]
	);

	const messagesForSelected = selectedConversationId
		? messagesByConversation[selectedConversationId] ?? []
		: [];

	const handleSendMessage = async (body: string) => {
		if (!selectedConversation || !tenantId || !currentUserId || !body.trim()) return;

		const trimmedBody = body.trim();
		const optimisticId = `optimistic-${Date.now()}`;
		const optimisticMessage: TeamMessage = {
			id: optimisticId,
			conversation_id: selectedConversation.id,
			sender_id: currentUserId,
			body: trimmedBody,
			created_at: new Date().toISOString(),
			edited_at: null,
		};

		// Actualización optimista
		setMessagesByConversation((prev) => ({
			...prev,
			[selectedConversation.id]: [...(prev[selectedConversation.id] ?? []), optimisticMessage],
		}));

		try {
			const { data, error } = await supabase
				.from("team_messages")
				.insert({
					tenant_id: tenantId,
					conversation_id: selectedConversation.id,
					sender_id: currentUserId,
					body: trimmedBody,
				})
				.select()
				.single();

			if (error) throw error;

			// Reemplazar mensaje optimista
			if (data) {
				setMessagesByConversation((prev) => {
					const existing = prev[selectedConversation.id] ?? [];
					return {
						...prev,
						[selectedConversation.id]: existing.map((m) =>
							m.id === optimisticId ? (data as TeamMessage) : m
						),
					};
				});
			}
		} catch (err) {
			console.error("[TeamChatOptimized] Error enviando mensaje", err);
			// Revertir optimista
			setMessagesByConversation((prev) => {
				const existing = prev[selectedConversation.id] ?? [];
				return {
					...prev,
					[selectedConversation.id]: existing.filter((m) => m.id !== optimisticId),
				};
			});
		}
	};

	const loadConversationsOptimized = useCallback(
		async (targetTenantId: string, targetUserId: string): Promise<Conversation[]> => {
			try {
				// 🔥 OPTIMIZACIÓN: Una sola query con JOIN para obtener todo
				const { data, error } = await supabase
					.rpc("get_user_conversations_optimized", {
						p_user_id: targetUserId,
						p_tenant_id: targetTenantId,
					});

				if (error) throw error;

				if (!data || data.length === 0) {
					setConversations([]);
					return [];
				}

				// Transformar datos de la RPC a formato Conversation
				const conversations: Conversation[] = data.map((conv: any) => ({
					id: conv.id,
					tenantId: conv.tenant_id,
					type: conv.type as ConversationType,
					name: conv.name,
					lastMessageBody: conv.last_message_body,
					lastMessageAt: conv.last_message_at,
					unreadCount: conv.unread_count || 0,
					membersCount: conv.members_count || 0,
					lastReadAt: conv.last_read_at,
					createdBy: conv.created_by,
					viewerRole: conv.viewer_role as "member" | "admin",
				}));

				// Ordenar por última actividad
				conversations.sort((a, b) => {
					const aTimestamp = a.lastMessageAt ?? MESSAGE_FALLBACK_DATE;
					const bTimestamp = b.lastMessageAt ?? b.lastReadAt ?? MESSAGE_FALLBACK_DATE;
					return bTimestamp.localeCompare(aTimestamp);
				});

				setConversations(conversations);

				// Seleccionar primera conversación si no hay ninguna seleccionada
				if (!selectedConversationId && conversations.length > 0) {
					setSelectedConversationId(conversations[0].id);
				}

				return conversations;
			} catch (err) {
				console.error("[TeamChatOptimized] Error cargando conversaciones optimizadas", err);
				setConversations([]);
				return [];
			}
		},
		[supabase, selectedConversationId]
	);

	const refreshConversations = useCallback(
		async () => {
			if (!tenantId || !currentUserId) return;
			await loadConversationsOptimized(tenantId, currentUserId);
		},
		[tenantId, currentUserId, loadConversationsOptimized]
	);

	const handleAddMembersToGroup = useCallback(
		async (userIds: string[]) => {
			if (!selectedConversation || !tenantId || userIds.length === 0) return;

			try {
				const rows = userIds.map((userId) => ({
					conversation_id: selectedConversation.id,
					user_id: userId,
					role: "member" as const,
				}));

				const { error } = await supabase.from("team_conversation_members").insert(rows);

				if (error) throw error;

				// Refrescar conversaciones para actualizar membersCount
				await refreshConversations();

				// Mostrar mensaje de éxito
				console.log(`Miembros añadidos correctamente a ${selectedConversation.name}`);
			} catch (err) {
				console.error("[TeamChatOptimized] Error al añadir miembros:", err);
				throw err;
			}
		},
		[supabase, selectedConversation, tenantId, refreshConversations]
	);

	const availableMembers = useMemo(() => {
		return Object.values(membersDirectory).filter((member) => member.userId !== currentUserId);
	}, [membersDirectory, currentUserId]);

	return (
		<div className="h-full flex flex-col gap-4">
			<header className="flex items-center justify-between">
				<h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] font-satoshi">
					Chats de equipo
				</h1>
				<div className="flex items-center gap-2">
					{/* Botón para abrir perfil propio con dropdown */}
					<div className="relative" ref={profileDropdownRef}>
						<button
							onClick={() => setShowProfileDropdown(!showProfileDropdown)}
							className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-smooth relative z-10"
							title="Mi perfil"
						>
							<Avatar
								src={membersDirectory[currentUserId ?? ""]?.profilePhotoUrl}
								name={membersDirectory[currentUserId ?? ""]?.displayName ?? currentUserEmail ?? "Usuario"}
								size="sm"
							/>
						</button>

						{/* Dropdown animado */}
						<AnimatePresence>
							{showProfileDropdown && (
								<motion.div
									initial={{ opacity: 0, y: -10, scale: 0.95 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: -10, scale: 0.95 }}
									transition={{ duration: 0.2 }}
									className="absolute right-0 mt-2 w-56 rounded-xl glass border border-[rgba(255,255,255,0.1)] shadow-[0px_8px_32px_rgba(0,0,0,0.3)] overflow-hidden z-50"
								>
									{/* Información del usuario */}
									<div className="px-4 py-3 border-b border-[rgba(255,255,255,0.1)]">
										<p className="text-sm font-semibold text-white font-satoshi truncate">
											{membersDirectory[currentUserId ?? ""]?.displayName ?? currentUserEmail?.split("@")[0] ?? "Usuario"}
										</p>
										<p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
											{currentUserEmail}
										</p>
									</div>

									{/* Opciones del menú */}
									<div className="p-1.5">
										<button
											onClick={() => {
												setShowUserProfileModal(true);
												setShowProfileDropdown(false);
											}}
											className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-smooth"
										>
											<User className="h-4 w-4" />
											<span>Editar perfil</span>
										</button>
										<button
											onClick={() => {
												setShowProfileDropdown(false);
											}}
											className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-smooth"
										>
											<Settings className="h-4 w-4" />
											<span>Configuración</span>
										</button>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
					<button
						onClick={() => setShowNewChatModal(true)}
						className="p-2 rounded-lg bg-gradient-to-r from-[var(--accent-aqua)] to-[var(--accent-purple)] text-white hover:shadow-[0px_4px_20px_rgba(123,92,255,0.4)] transition-all duration-200 hover:scale-105"
						title="Nuevo chat"
					>
						<Plus className="h-4 w-4" />
					</button>
				</div>
			</header>

			{/* Layout principal */}
			<div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
				{/* Lista de conversaciones */}
				<div className="lg:col-span-1">
					<ConversationList
						conversations={visibleConversations}
						selectedConversationId={selectedConversationId}
						onSelectConversation={setSelectedConversationId}
						showUnreadOnly={showUnreadOnly}
						onToggleUnread={() => setShowUnreadOnly(!showUnreadOnly)}
					/>
				</div>

				{/* Área de mensajes */}
				<div className="lg:col-span-2 flex flex-col min-h-0">
					{selectedConversation ? (
						<>
							<ConversationHeader
								conversation={selectedConversation}
								onViewMembers={() => setShowMembersModal(true)}
								onAddMember={() => setShowAddMemberModal(true)}
							/>

							<div className="flex-1 min-h-0 flex flex-col">
								<MessageList
									messages={messagesForSelected}
									currentUserId={currentUserId}
									membersDirectory={membersDirectory}
									loading={messagesLoading}
									containerRef={messageContainerRef}
								/>

								<MessageComposer
									onSend={handleSendMessage}
									disabled={!selectedConversation}
								/>
							</div>
						</>
					) : (
						<GlassCard className="flex-1 flex items-center justify-center">
							<div className="text-center">
								<MessageSquare className="h-12 w-12 text-[var(--text-secondary)] mx-auto mb-4" />
								<p className="text-[var(--text-secondary)]">Selecciona una conversación para empezar a chatear</p>
							</div>
						</GlassCard>
					)}
				</div>
			</div>

			{/* Modales */}
			{showNewChatModal && (
				<Modal
					isOpen={showNewChatModal}
					onClose={() => setShowNewChatModal(false)}
					title="Nuevo chat"
				>
					<div className="p-4">
						<p className="text-sm text-[var(--text-secondary)] mb-4">
							Funcionalidad próximamente disponible
						</p>
					</div>
				</Modal>
			)}

			{showMembersModal && selectedConversation && (
				<MembersModal
					isOpen={showMembersModal}
					onClose={() => setShowMembersModal(false)}
					members={[]} // TODO: Implementar carga de miembros
					conversationName={selectedConversation.name}
					currentUserId={currentUserId}
					onSetNickname={undefined} // TODO: Implementar funcionalidad de apodos
				/>
			)}

			{showAddMemberModal && selectedConversation && (
				<AddMembersModal
					isOpen={showAddMemberModal}
					onClose={() => setShowAddMemberModal(false)}
					conversationId={selectedConversation.id}
					existingMemberIds={[]} // TODO: Implementar lista de miembros existentes
					availableMembers={availableMembers}
					onAddMembers={handleAddMembersToGroup}
				/>
			)}

			{showUserProfileModal && (
				<UserProfileModal
					isOpen={showUserProfileModal}
					onClose={() => setShowUserProfileModal(false)}
					currentUserId={currentUserId || ""}
					tenantId={tenantId || ""}
				/>
			)}
		</div>
	);
}
