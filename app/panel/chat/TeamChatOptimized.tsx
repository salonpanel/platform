"use client";

// Updated error logging - 2025-12-10
import {
	RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { Plus, MessageSquare, User, Settings, UserX } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ConversationList } from "./ConversationList";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { MembersModal } from "./MembersModal";
import { AddMembersModal } from "./AddMembersModal";
import { UserProfileModal } from "./UserProfileModal";
import type { ChatPageDataset } from "@/lib/chat-page-data";

type ConversationType = "all" | "direct" | "group";

const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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
	status?: "active" | "pending_direct";
};

type TeamMessage = {
	id: string;
	conversation_id: string;
	sender_id: string;
	body: string;
	created_at: string;
	edited_at: string | null;
	metadata?: any;
	parent_message_id?: string | null;
	parent_message_body?: string | null;
	parent_author_name?: string | null;
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

interface TeamChatOptimizedProps {
	initialData: ChatPageDataset;
}

export function TeamChatOptimized({ initialData }: TeamChatOptimizedProps) {
	const supabase = getSupabaseBrowser();

	// Estados principales con datos iniciales
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
	const [tenantId, setTenantId] = useState<string>(initialData.tenant.id);
	const [conversations, setConversations] = useState<Conversation[]>(initialData.conversations);
	const [membersDirectory, setMembersDirectory] = useState<Record<string, TenantMemberProfile>>(initialData.membersDirectory);

	// Estados de UI
	const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
		if (initialData.conversations.length === 0) return null;
		// Prioritizar el chat grupal (tipo 'all') como selección inicial
		const groupChat = initialData.conversations.find(c => c.type === 'all');
		return groupChat ? groupChat.id : initialData.conversations[0].id;
	});
	const [messagesByConversation, setMessagesByConversation] = useState<Record<string, TeamMessage[]>>({});
	const [messagesLoadError, setMessagesLoadError] = useState<string | null>(null);
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

	// Estados para respuestas y móvil
	const [replyToMessage, setReplyToMessage] = useState<TeamMessage | null>(null);
	const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
	const [isMobile, setIsMobile] = useState(false);

	// Estados del modal nuevo chat
	const [newChatType, setNewChatType] = useState<ConversationType>("direct");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [groupName, setGroupName] = useState("");
	const [creatingChat, setCreatingChat] = useState(false);

	// Typing indicators
	const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});
	const [isTyping, setIsTyping] = useState(false);
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const profileDropdownRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const messageContainerRef = useRef<HTMLDivElement>(null);
	const messagesByConversationRef = useRef<Record<string, TeamMessage[]>>({});
	const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

	messagesByConversationRef.current = messagesByConversation;

	const lastSyncedTenantIdRef = useRef<string | null>(null);
	useEffect(() => {
		const id = initialData.tenant.id;
		if (lastSyncedTenantIdRef.current === id) return;
		lastSyncedTenantIdRef.current = id;
		setTenantId(id);
		setConversations(initialData.conversations);
		setMembersDirectory(initialData.membersDirectory);
		setMessagesByConversation({});
		setMessagesLoadError(null);
		setHasMoreMessages({});
		setMembersByConversation({});
		const groupChat = initialData.conversations.find((c) => c.type === "all");
		setSelectedConversationId(
			groupChat?.id ?? initialData.conversations[0]?.id ?? null
		);
	}, [
		initialData.tenant.id,
		initialData.conversations,
		initialData.membersDirectory,
	]);

	// 🔥 NUEVO: Procesar conversaciones para resolver nombres dinámicos (estilo WhatsApp)
	// Y añadir miembros del equipo que aún no tienen cuenta (Ghost conversations)
	const processedConversations = useMemo(() => {
		// 1. Mapear conversaciones existentes con nombres reales
		const mapped = conversations.map(conv => {
			if (conv.type === 'direct' && conv.targetUserId) {
				const profile = membersDirectory[conv.targetUserId];
				if (profile) {
					return { ...conv, name: profile.displayName, status: 'active' as const };
				}
			}
			return { ...conv, status: 'active' as const };
		});

		// 2. Identificar miembros del staff que NO tienen chat directo todavía
		const usersWithChat = new Set(
			conversations
				.filter(c => c.type === 'direct' && c.targetUserId)
				.map(c => c.targetUserId)
		);

		const ghostConversations: Conversation[] = Object.values(membersDirectory)
			.filter(member => {
				// No incluirse a uno mismo
				if (currentUserId && member.userId === currentUserId) return false;
				// No incluir si ya tiene chat
				if (member.userId && usersWithChat.has(member.userId)) return false;
				return true;
			})
			.map((member) => ({
				id: `ghost-${member.userId}`,
				tenantId: tenantId,
				type: 'direct' as const,
				name: member.displayName,
				lastMessageBody: 'Sin conversación directa',
				lastMessageAt: null,
				unreadCount: 0,
				membersCount: 2,
				lastReadAt: null,
				createdBy: 'system',
				viewerRole: 'member' as const,
				targetUserId: member.userId,
				status: 'pending_direct' as const,
			}));

		return [...mapped, ...ghostConversations];
	}, [conversations, membersDirectory, currentUserId, tenantId]);

	const selectedConversation = useMemo(() => 
		processedConversations.find((c) => c.id === selectedConversationId) || null
	, [processedConversations, selectedConversationId]);

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

		// Detector de móvil
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 1024);
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, [supabase.auth]);

	// 🔥 CARGAR MENSAJES DE CONVERSACIÓN SELECCIONADA CON RPC OPTIMIZADO
	const loadMessagesForConversation = useCallback(
		async (conversationId: string, beforeTimestamp?: string) => {
			if (
				!beforeTimestamp &&
				messagesByConversationRef.current[conversationId] !== undefined
			)
				return;

			if (conversationId.startsWith("ghost-")) {
				setMessagesByConversation((prev) => ({
					...prev,
					[conversationId]: [],
				}));
				setHasMoreMessages((prev) => ({ ...prev, [conversationId]: false }));
				return;
			}

			setMessagesLoading(true);
			setMessagesLoadError(null);
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
					metadata: msg.metadata,
					parent_message_id: msg.parent_message_id,
					parent_message_body: msg.parent_message_body,
					parent_author_name: msg.parent_author_name,
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
				const msg =
					err instanceof Error ? err.message : typeof err === "string" ? err : "Error al cargar mensajes";
				setMessagesLoadError(msg);
				console.error("[TeamChatOptimized] Error cargando mensajes", {
					error: err,
					message: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined,
					conversationId,
					beforeTimestamp
				});
			} finally {
				setMessagesLoading(false);
			}
		},
		[supabase, currentUserId]
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

	// 🔥 REAL-TIME SUBSCRIPTION OPTIMIZADA (mismo canal para postgres + broadcast typing)
	useEffect(() => {
		if (!tenantId) return;

		const channel = supabase
			.channel(`team_chat_optimized_${tenantId}`, {
				config: {
					presence: {
						key: currentUserId || "anon",
					},
				},
			})
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
					const isOwnMessage = Boolean(
						currentUserId && newMessage.sender_id === currentUserId
					);

					setConversations((prev) =>
						prev
							.map((conv) => {
								if (conv.id !== conversationId) return conv;
								const isOpen = conv.id === selectedConversationId;
								const nextUnread =
									isOpen || isOwnMessage
										? isOpen
											? 0
											: conv.unreadCount
										: conv.unreadCount + 1;
								return {
									...conv,
									lastMessageBody: newMessage.body,
									lastMessageAt: newMessage.created_at,
									lastMessageSenderId: newMessage.sender_id,
									unreadCount: nextUnread,
								};
							})
							.sort((a, b) => {
								const aTime = a.lastMessageAt ?? MESSAGE_FALLBACK_DATE;
								const bTime = b.lastMessageAt ?? MESSAGE_FALLBACK_DATE;
								return bTime.localeCompare(aTime);
							})
					);

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
			.on("broadcast", { event: "typing" }, (payload) => {
				const { userId, typing, conversationId } = payload.payload as {
					userId?: string;
					typing?: boolean;
					conversationId?: string;
				};
				if (!userId || !conversationId || userId === currentUserId) return;

				setTypingUsers((prev) => {
					const next = { ...prev };
					const users = new Set(next[conversationId] || []);
					if (typing) {
						users.add(userId);
					} else {
						users.delete(userId);
					}
					next[conversationId] = users;
					return next;
				});
			})
			.subscribe(async (status) => {
				if (status === "SUBSCRIBED" && currentUserId) {
					await channel.track({
						user_id: currentUserId,
						online_at: new Date().toISOString(),
					});
				}
			});

		realtimeChannelRef.current = channel;

		return () => {
			if (realtimeChannelRef.current === channel) {
				realtimeChannelRef.current = null;
			}
			supabase.removeChannel(channel);
		};
	}, [supabase, tenantId, selectedConversationId, currentUserId]);

	useEffect(() => {
		setMessagesLoadError(null);
	}, [selectedConversationId]);

	// Cargar mensajes cuando se selecciona conversación (undefined = aún no cargado)
	useEffect(() => {
		if (
			!selectedConversationId ||
			messagesByConversation[selectedConversationId] !== undefined
		) {
			return;
		}
		void loadMessagesForConversation(selectedConversationId);
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

	const handleTyping = () => {
		if (!selectedConversationId || !currentUserId || !tenantId) return;

		const channel = realtimeChannelRef.current;
		if (!channel) return;

		if (!isTyping) {
			setIsTyping(true);
			void channel.send({
				type: "broadcast",
				event: "typing",
				payload: {
					userId: currentUserId,
					typing: true,
					conversationId: selectedConversationId,
				},
			});
		}

		if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
		typingTimeoutRef.current = setTimeout(() => {
			setIsTyping(false);
			const ch = realtimeChannelRef.current;
			if (!ch) return;
			void ch.send({
				type: "broadcast",
				event: "typing",
				payload: {
					userId: currentUserId,
					typing: false,
					conversationId: selectedConversationId,
				},
			});
		}, 3000);
	};

	const visibleConversations = useMemo(
		() => (showUnreadOnly ? processedConversations.filter((conv) => conv.unreadCount > 0) : processedConversations),
		[processedConversations, showUnreadOnly]
	);

	const messagesForSelected = selectedConversationId
		? messagesByConversation[selectedConversationId] ?? []
		: [];

	const handleSendMessage = async (body: string, attachments: any[] = []) => {
		if (!selectedConversation || !tenantId || !currentUserId || (!body.trim() && attachments.length === 0)) return;

		const trimmedBody = body.trim();
		const optimisticId = `optimistic-${Date.now()}`;
		const optimisticMessage: TeamMessage = {
			id: optimisticId,
			conversation_id: selectedConversation.id,
			sender_id: currentUserId,
			body: trimmedBody,
			metadata: attachments.length > 0 ? { attachments } : null,
			created_at: new Date().toISOString(),
			edited_at: null,
			parent_message_id: replyToMessage?.id || null,
			parent_message_body: replyToMessage?.body || null,
			parent_author_name: replyToMessage?.author_name || null,
		};

		// Limpiar respuesta inmediatamente
		setReplyToMessage(null);

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
					metadata: attachments.length > 0 ? { attachments } : null,
					parent_message_id: optimisticMessage.parent_message_id,
				})
				.select()
				.single();

			if (error) throw error;
			
			// Reemplazar mensaje optimista
			if (data) {
				setMessagesByConversation((prev) => ({
					...prev,
					[selectedConversation.id]: (prev[selectedConversation.id] ?? []).map((m) =>
						m.id === optimisticId ? (data as TeamMessage) : m
					),
				}));
			}
		} catch (err) {
			console.error("[TeamChatOptimized] Error enviando mensaje", err);
			// Revertir optimista
			setMessagesByConversation((prev) => ({
				...prev,
				[selectedConversation.id]: (prev[selectedConversation.id] ?? []).filter((m) => m.id !== optimisticId),
			}));
		}
	};

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0 || !selectedConversation || !tenantId) return;

		const file = files[0];
		if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
			console.error(
				"[TeamChatOptimized] Archivo demasiado grande (máx. 10 MB)"
			);
			return;
		}
		const fileExt = file.name.split('.').pop();
		const fileName = `${selectedConversation.id}/${Math.random().toString(36).substring(7)}.${fileExt}`;

		try {
			// 1. Subir al Storage
			const { error: uploadError } = await supabase.storage
				.from('chat-attachments')
				.upload(fileName, file);

			if (uploadError) throw uploadError;

			// 2. Obtener URL pública
			const { data: { publicUrl } } = supabase.storage
				.from('chat-attachments')
				.getPublicUrl(fileName);

			// 3. Enviar mensaje con el adjunto
			await handleSendMessage("", [
				{
					name: file.name,
					url: publicUrl,
					type: file.type,
					size: file.size,
				}
			]);
		} catch (err) {
			console.error("[TeamChatOptimized] Error al subir archivo:", err);
		} finally {
			if (fileInputRef.current) fileInputRef.current.value = "";
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
					lastMessageSenderId: conv.last_message_sender_id ?? null,
					targetUserId: conv.target_user_id ?? null,
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

			const { data: existingId, error: findErr } = await supabase.rpc(
				"find_direct_team_conversation",
				{
					p_tenant_id: tenantId,
					p_user_a: currentUserId,
					p_user_b: targetUserId,
				}
			);

			if (findErr) throw findErr;

			if (existingId) {
				await refreshConversations();
				setSelectedConversationId(existingId as string);
				setShowNewChatModal(false);
				setSelectedUserIds([]);
				setGroupName("");
				return;
			}

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
			<header className="flex items-center justify-end">
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
									className="absolute right-0 mt-2 w-56 rounded-xl glass border border-[rgba(255,255,255,0.1)] shadow-[0px_8px_32px_rgba(0,0,0,0.3)] overflow-hidden z-[80]"
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
			<div className="flex-1 flex flex-col lg:grid lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
				{/* Lista de conversaciones */}
				<div 
					className={cn(
						"lg:col-span-1 h-full min-h-0 transition-all duration-300",
						isMobile && mobileView === 'chat' ? "hidden" : "block"
					)}
				>
					<ConversationList
						conversations={visibleConversations}
						selectedConversationId={selectedConversationId}
						onSelectConversation={(id) => {
							setSelectedConversationId(id);
							if (isMobile) setMobileView('chat');
						}}
						showUnreadOnly={showUnreadOnly}
						onToggleUnread={() => setShowUnreadOnly(!showUnreadOnly)}
						currentUserId={currentUserId}
					/>
				</div>

				{/* Área de mensajes */}
				<div 
					className={cn(
						"lg:col-span-2 flex flex-col min-h-0 h-full transition-all duration-300 relative",
						isMobile && mobileView === 'list' ? "hidden" : "flex"
					)}
				>
					{selectedConversation ? (
						<GlassCard className="flex-1 flex flex-col min-h-0 overflow-hidden p-0 relative">
							{/* Fondo de Chat Estilo WhatsApp (Sutil) */}
							<div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
							
							<ConversationHeader
								conversation={selectedConversation}
								onViewMembers={handleOpenMembersModal}
								onAddMember={handleOpenAddMembers}
								onBack={() => setMobileView('list')}
								isMobile={isMobile}
							/>
							<div className="flex-1 min-h-0 relative">
								{messagesLoadError && (
									<div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-300 text-sm">
										{messagesLoadError}
									</div>
								)}
								<MessageList
									messages={messagesForSelected}
									currentUserId={currentUserId || ""}
									onReply={setReplyToMessage}
									typingUsers={Array.from(typingUsers[selectedConversationId || ""] || [])}
									membersDirectory={membersDirectory}
									loading={messagesLoading}
									containerRef={messageContainerRef}
									onLoadMore={handleLoadMoreMessages}
									hasMoreMessages={
										selectedConversationId
											? hasMoreMessages[selectedConversationId] ?? false
											: false
									}
								/>
							</div>
							{selectedConversation.status === "pending_direct" ? (
								<div className="p-10 border-t border-white/5 bg-[#202c33] flex flex-col items-center text-center">
									<div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
										<UserX className="h-8 w-8 text-[#8696a0]" />
									</div>
									<h3 className="text-[#e9edef] font-medium mb-1">Sin conversación directa</h3>
									<p className="text-[#8696a0] text-sm max-w-sm">
										Aún no hay un hilo directo con esta persona en el sistema. Usa{" "}
										<span className="text-[#e9edef] font-medium">Nuevo chat</span>, elige al
										miembro y se reutilizará la conversación si ya existía.
									</p>
								</div>
							) : (
								<>
									<MessageComposer
										onSend={handleSendMessage}
										onTyping={handleTyping}
										replyTo={replyToMessage}
										onCancelReply={() => setReplyToMessage(null)}
										onAttach={() => fileInputRef.current?.click()}
									/>
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleFileUpload}
										className="hidden"
										accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
									/>
								</>
							)}
						</GlassCard>
					) : (
						<div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-[#222e35] rounded-xl border border-white/5 relative overflow-hidden">
							<div className="flex flex-col items-center max-w-sm text-center p-8 z-10 transition-all duration-700 animate-in fade-in zoom-in slide-in-from-bottom-4">
								<div className="w-48 h-48 mb-8 bg-gradient-to-br from-[#00a884]/15 to-[#53bdeb]/15 rounded-full flex items-center justify-center relative">
									<div className="absolute inset-0 rounded-full border border-white/5 animate-ping opacity-20" />
									<MessageSquare className="h-24 w-24 text-[#00a884]/40" />
								</div>
								<h2 className="text-2xl font-light text-[#e9edef] mb-3 font-satoshi tracking-tight">BookFast Chat</h2>
								<p className="text-[#8696a0] text-[14px] leading-relaxed mb-10 px-4">
									Envía y recibe mensajes sin necesidad de tener tu teléfono conectado.<br/>
									Usa BookFast Chat en hasta 4 dispositivos vinculados a la vez.
								</p>
								<div className="flex items-center gap-2 text-[#8696a0] text-[12px] opacity-40">
									<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"></path></svg>
									<span className="font-medium">Conexión segura (HTTPS)</span>
								</div>
							</div>
							<div className="absolute bottom-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00a884]/40 to-transparent" />
						</div>
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
