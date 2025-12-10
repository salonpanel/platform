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
	// 🚀 Metadatos del RPC para paginación infinita
	author_name?: string;
	author_avatar?: string;
	has_more_before?: boolean;
	has_more_after?: boolean;
};

type TenantMemberProfile = {
	userId: string;
	displayName: string;
	tenantRole: string;
	profilePhotoUrl?: string;
};

type ConversationMember = {
	userId: string;
	displayName: string;
	role: "member" | "admin";
	joinedAt: string;
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
	const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({}); // 🚀 Rastrear si hay más mensajes
	const [membersByConversation, setMembersByConversation] = useState<Record<string, ConversationMember[]>>({});
	const [membersLoading, setMembersLoading] = useState(false);
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

	// 🔥 CARGAR MENSAJES DE CONVERSACIÓN SELECCIONADA CON RPC OPTIMIZADO
	const loadMessagesForConversation = useCallback(
		async (conversationId: string, beforeTimestamp?: string) => {
			// Si ya hay mensajes y no es paginación, no recargar
			if (!beforeTimestamp && messagesByConversation[conversationId]) return;

			setMessagesLoading(true);
			try {
				// 🚀 OPTIMIZACIÓN: Usar get_conversation_messages_paginated RPC
				const { data, error } = await supabase.rpc('get_conversation_messages_paginated', {
					p_conversation_id: conversationId,
					p_limit: 50,
					p_before_timestamp: beforeTimestamp || null,
					p_after_timestamp: null,
				});

				if (error) throw error;

				const messages = (data || []).map((msg: any) => ({
					id: msg.id,
					conversation_id: msg.conversation_id,
					sender_id: msg.sender_id,
					body: msg.body,
					created_at: msg.created_at,
					edited_at: msg.edited_at,
					// Metadatos adicionales del RPC (útiles para paginación infinita)
					author_name: msg.author_name,
					author_avatar: msg.author_avatar,
					has_more_before: msg.has_more_before,
					has_more_after: msg.has_more_after,
				}));

				// 🚀 Actualizar has_more_before para esta conversación
				const hasMore = messages.length > 0 ? messages[0].has_more_before : false;
				setHasMoreMessages(prev => ({
					...prev,
					[conversationId]: hasMore,
				}));

				// Si es paginación (beforeTimestamp), agregar al inicio; sino reemplazar
				setMessagesByConversation((prev) => {
					if (beforeTimestamp) {
						const existing = prev[conversationId] || [];
						return {
							...prev,
							[conversationId]: [...messages, ...existing],
						};
					}
					return {
						...prev,
						[conversationId]: messages,
					};
				});

				// Marcar como leídos solo en la primera carga
				if (!beforeTimestamp && currentUserId) {
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

		// 🔥 Cargar miembros de la conversación (para modales y contadores precisos)
		const loadMembersForConversation = useCallback(
			async (conversationId: string) => {
				if (membersByConversation[conversationId]) return membersByConversation[conversationId];

				setMembersLoading(true);
				try {
					const { data, error } = await supabase
						.from("team_conversation_members")
						.select("user_id, role, created_at")
						.eq("conversation_id", conversationId);

					if (error) throw error;

					const enriched: ConversationMember[] = await Promise.all(
						(data || []).map(async (member) => {
							const fromDirectory = membersDirectory[member.user_id];
							if (fromDirectory) {
								return {
									userId: member.user_id,
									displayName: fromDirectory.displayName,
									role: (member.role as "member" | "admin") ?? "member",
									joinedAt: member.created_at,
									profilePhotoUrl: fromDirectory.profilePhotoUrl,
								};
							}

							// Fallback: obtener display name via RPC para no mostrar email
							let displayName = "Usuario";
							try {
								if (tenantId && currentUserId) {
									const resp = await supabase.rpc("get_user_display_name", {
										p_viewer_user_id: currentUserId,
										p_target_user_id: member.user_id,
										p_tenant_id: tenantId,
									});
									displayName = resp.data ?? "Usuario";
								}
							} catch (fetchErr) {
								console.error("[TeamChatOptimized] Error obteniendo display name", fetchErr);
							}

							return {
								userId: member.user_id,
								displayName,
								role: (member.role as "member" | "admin") ?? "member",
								joinedAt: member.created_at,
								profilePhotoUrl: undefined,
							};
						})
					);

					setMembersByConversation((prev) => ({
						...prev,
						[conversationId]: enriched,
					}));

					return enriched;
				} catch (err) {
					console.error("[TeamChatOptimized] Error cargando miembros", err);
					return [];
				} finally {
					setMembersLoading(false);
				}
			},
			[supabase, membersDirectory, membersByConversation, tenantId, currentUserId]
		);

	// 🚀 FUNCIÓN PARA SCROLL INFINITO: Cargar mensajes más antiguos
	const handleLoadMoreMessages = useCallback(() => {
		if (!selectedConversationId || messagesLoading) return;

		const messages = messagesByConversation[selectedConversationId];
		if (!messages || messages.length === 0) return;

		// Obtener timestamp del mensaje más antiguo
		const oldestMessage = messages[0];
		if (!oldestMessage) return;

		// Cargar mensajes anteriores a este timestamp
		loadMessagesForConversation(selectedConversationId, oldestMessage.created_at);
	}, [selectedConversationId, messagesLoading, messagesByConversation, loadMessagesForConversation]);

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

	const handleOpenMembersModal = useCallback(async () => {
		if (!selectedConversation) return;
		await loadMembersForConversation(selectedConversation.id);
		setShowMembersModal(true);
	}, [selectedConversation, loadMembersForConversation]);

	const handleOpenAddMembers = useCallback(async () => {
		if (!selectedConversation) return;
		await loadMembersForConversation(selectedConversation.id);
		setShowAddMemberModal(true);
	}, [selectedConversation, loadMembersForConversation]);

	const handleCreateNewChat = useCallback(async () => {
		if (!tenantId || !currentUserId) return;
		if (creatingChat) return;

		const targetUserId = selectedUserIds[0];
		if (!targetUserId) return;

		setCreatingChat(true);
		try {
			const targetMember = membersDirectory[targetUserId];
			const targetDisplay = targetMember?.displayName ?? "Chat directo";

			const { data: conv, error: convError } = await supabase
				.from("team_conversations")
				.insert({
					tenant_id: tenantId,
					type: "direct",
					name: targetDisplay,
					created_by: currentUserId,
				})
				.select()
				.single();

			if (convError) throw convError;

			const memberRows = [currentUserId, targetUserId].map((userId) => ({
				conversation_id: conv.id,
				user_id: userId,
				role: "member" as const,
			}));

			const { error: membersError } = await supabase
				.from("team_conversation_members")
				.insert(memberRows);

			if (membersError) throw membersError;

			const updated = await refreshConversations();
			setSelectedConversationId(conv.id);
			setShowNewChatModal(false);
			setSelectedUserIds([]);
			setGroupName("");
			return updated;
		} catch (err) {
			console.error("[TeamChatOptimized] Error creando chat directo", err);
		} finally {
			setCreatingChat(false);
		}
	}, [tenantId, currentUserId, creatingChat, selectedUserIds, membersDirectory, supabase, refreshConversations]);

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
								onViewMembers={handleOpenMembersModal}
								onAddMember={handleOpenAddMembers}
							/>

							<div className="flex-1 min-h-0 flex flex-col">
							<MessageList
								messages={messagesForSelected}
								currentUserId={currentUserId}
								membersDirectory={membersDirectory}
								loading={messagesLoading}
								containerRef={messageContainerRef}
								onLoadMore={handleLoadMoreMessages}
								hasMoreMessages={selectedConversationId ? (hasMoreMessages[selectedConversationId] || false) : false}
							/>								<MessageComposer
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
					onClose={() => {
						setShowNewChatModal(false);
						setSelectedUserIds([]);
						setGroupName("");
					}}
					title="Nuevo chat"
				>
					<div className="p-4 space-y-4">
						<p className="text-sm text-[var(--text-secondary)]">
							Selecciona un miembro para iniciar un chat directo.
						</p>
						<div className="space-y-2 max-h-64 overflow-y-auto pr-1">
							{availableMembers.length === 0 ? (
								<p className="text-sm text-[var(--text-secondary)] text-center py-6">No hay miembros disponibles</p>
							) : (
								availableMembers.map((member) => (
									<label
										key={member.userId}
										className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2 cursor-pointer transition-smooth hover:border-white/20"
									>
										<input
											type="radio"
											name="new-chat-member"
											checked={selectedUserIds.includes(member.userId)}
											onChange={() => setSelectedUserIds([member.userId])}
											className="accent-[#3A6DFF]"
										/>
										<Avatar name={member.displayName} size="sm" className="flex-shrink-0" />
										<div className="flex-1 min-w-0">
											<p className="text-sm text-white font-medium truncate">{member.displayName}</p>
											<p className="text-[11px] text-[var(--text-secondary)] capitalize">{member.tenantRole}</p>
										</div>
									</label>
								))
							)}
						</div>

						<div className="flex justify-end gap-2 pt-2">
							<button
								onClick={() => {
									setSelectedUserIds([]);
									setShowNewChatModal(false);
								}}
								className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-smooth"
							>
								Cancelar
							</button>
							<button
								onClick={() => void handleCreateNewChat()}
								disabled={selectedUserIds.length === 0 || creatingChat}
								className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#3A6DFF] to-[#7B5CFF] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(66,92,255,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{creatingChat ? "Creando..." : "Crear chat"}
							</button>
						</div>
					</div>
				</Modal>
			)}

			{showMembersModal && selectedConversation && (
				<MembersModal
					isOpen={showMembersModal}
					onClose={() => setShowMembersModal(false)}
					members={membersByConversation[selectedConversation.id] ?? []}
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
					existingMemberIds={(membersByConversation[selectedConversation.id] ?? []).map((m) => m.userId)}
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
