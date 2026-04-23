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
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { MessageSquare, UserX } from "lucide-react";
import { ConversationList } from "./ConversationList";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { MembersModal } from "./MembersModal";
import { AddMembersModal } from "./AddMembersModal";
import { CreateGroupModal } from "./CreateGroupModal";
import { ArchivedChatsModal } from "./ArchivedChatsModal";
import type { ChatPageDataset } from "@/lib/chat-page-data";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Modal } from "@/components/ui/Modal";

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
	lastMessageSenderName?: string | null;
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

type PendingAttachment = {
	id: string;
	file: File;
	previewUrl: string;
};

type ConversationMember = {
	userId: string;
	displayName: string;
	role: "member" | "admin";
	joinedAt: string;
	lastReadAt?: string | null;
	profilePhotoUrl?: string;
};

const MESSAGE_FALLBACK_DATE = "1970-01-01T00:00:00Z";

/** PostgREST / Supabase devuelve errores como objeto { message, code, details }, no siempre Error */
function readSupabaseClientError(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (err && typeof err === "object") {
		const o = err as Record<string, unknown>;
		if (typeof o.message === "string" && o.message.length > 0) {
			const base = o.message;
			const details = typeof o.details === "string" && o.details ? ` (${o.details})` : "";
			const hint = typeof o.hint === "string" && o.hint ? ` — ${o.hint}` : "";
			return `${base}${details}${hint}`;
		}
	}
	if (typeof err === "string") return err;
	return "Error desconocido";
}

interface TeamChatOptimizedProps {
	initialData: ChatPageDataset;
}

export function TeamChatOptimized({ initialData }: TeamChatOptimizedProps) {
	const supabase = getSupabaseBrowser();
	const { role: tenantRole } = usePermissions();

	// Estados principales con datos iniciales
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
	const [showMembersModal, setShowMembersModal] = useState(false);
	const [showAddMemberModal, setShowAddMemberModal] = useState(false);
	const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
	const [deleteChatModalOpen, setDeleteChatModalOpen] = useState(false);
	const [deleteChatBusy, setDeleteChatBusy] = useState(false);
	const [archivedChatsModalOpen, setArchivedChatsModalOpen] = useState(false);

	// Estados para respuestas y móvil
	const [replyToMessage, setReplyToMessage] = useState<TeamMessage | null>(null);
	const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
	const [isMobile, setIsMobile] = useState(false);
	const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
	const touchStartRef = useRef<{ x: number; y: number; at: number } | null>(null);

	// Typing indicators
	const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});
	const [isTyping, setIsTyping] = useState(false);
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
		setPendingAttachments((prev) => {
			for (const a of prev) URL.revokeObjectURL(a.previewUrl);
			return [];
		});
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

	const chatActionsEnabled =
		!!selectedConversation &&
		selectedConversation.type !== "all" &&
		selectedConversation.status !== "pending_direct";

	const canDeleteSelectedChat = useMemo(() => {
		if (!chatActionsEnabled || !selectedConversation || !currentUserId) return false;
		if (selectedConversation.type === "direct") return true;
		const elevated =
			tenantRole === "owner" || tenantRole === "admin" || tenantRole === "manager";
		return selectedConversation.createdBy === currentUserId || elevated;
	}, [chatActionsEnabled, selectedConversation, currentUserId, tenantRole]);

	const listMembersPreview = useMemo(() => {
		const o: Record<string, { displayName: string }> = {};
		for (const [id, m] of Object.entries(membersDirectory)) {
			o[id] = { displayName: m.displayName };
		}
		return o;
	}, [membersDirectory]);

	// 🔥 BOOTSTRAP OPTIMIZADO: Solo resolver usuario (datos ya precargados)
	useEffect(() => {
		const bootstrap = async () => {
			try {
				const { data: { user }, error } = await supabase.auth.getUser();
				if (error) throw error;
				if (!user) throw new Error("No autenticado.");

				setCurrentUserId(user.id);
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

				// Marcar como leídos (no debe fallar la carga del historial si esto falla por RLS)
				if (!beforeTimestamp && currentUserId) {
					const now = new Date().toISOString();
					try {
						const { error: readErr } = await supabase
							.from("team_conversation_members")
							.update({ last_read_at: now })
							.eq("conversation_id", conversationId)
							.eq("user_id", currentUserId);

						if (readErr) {
							console.warn("[TeamChatOptimized] No se pudo marcar como leído", readSupabaseClientError(readErr));
						} else {
							setConversations((prev) =>
								prev.map((conv) =>
									conv.id === conversationId ? { ...conv, unreadCount: 0, lastReadAt: now } : conv
								)
							);
						}
					} catch (markErr) {
						console.warn("[TeamChatOptimized] Marcar leído:", markErr);
					}
				}
			} catch (err) {
				const msg = readSupabaseClientError(err);
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
						.select("user_id, role, joined_at, last_read_at")
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
									joinedAt: member.joined_at,
									lastReadAt: (member as any).last_read_at ?? null,
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
								joinedAt: member.joined_at,
								lastReadAt: (member as any).last_read_at ?? null,
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

	// Para receipts ("visto"), necesitamos el last_read_at de otros miembros.
	useEffect(() => {
		if (!selectedConversationId) return;
		void loadMembersForConversation(selectedConversationId);
	}, [selectedConversationId, loadMembersForConversation]);

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

	// Barra inferior móvil: al tocar "Chat" estando dentro, volver a la lista
	useEffect(() => {
		const handler = () => {
			setMobileView("list");
		};
		window.addEventListener("panel-chat:go-list", handler as EventListener);
		return () => window.removeEventListener("panel-chat:go-list", handler as EventListener);
	}, []);

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

	/** Chat grupal (type=all) siempre primero; con “solo no leídos” solo aparece si tiene no leídos */
	const conversationsForList = useMemo(() => {
		const general = processedConversations.find((c) => c.type === "all");
		const rest = processedConversations.filter((c) => c.type !== "all");
		const restFiltered = showUnreadOnly ? rest.filter((c) => c.unreadCount > 0) : rest;
		const sorted = [...restFiltered].sort((a, b) =>
			(b.lastMessageAt ?? MESSAGE_FALLBACK_DATE).localeCompare(a.lastMessageAt ?? MESSAGE_FALLBACK_DATE)
		);
		const includeGeneral = Boolean(general) && (!showUnreadOnly || (general?.unreadCount ?? 0) > 0);
		if (includeGeneral && general) return [general, ...sorted];
		return sorted;
	}, [processedConversations, showUnreadOnly]);

	const messagesForSelected = selectedConversationId
		? messagesByConversation[selectedConversationId] ?? []
		: [];

	const otherLastReadAtForSelected = useMemo(() => {
		if (!selectedConversationId) return null;
		const members = membersByConversation[selectedConversationId] ?? [];
		const others = members.filter((m) => m.userId && m.userId !== currentUserId);
		let max: string | null = null;
		for (const m of others) {
			const ts = m.lastReadAt ?? null;
			if (!ts) continue;
			if (!max || ts > max) max = ts;
		}
		return max;
	}, [selectedConversationId, membersByConversation, currentUserId]);

	const uploadPendingAttachments = useCallback(
		async (conversationId: string, files: PendingAttachment[]) => {
			const uploaded: Array<{ name: string; url: string; type: string; size: number }> = [];
			for (const item of files) {
				const file = item.file;
				if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
					throw new Error("Archivo demasiado grande (máx. 10 MB)");
				}
				const fileExt = file.name.split(".").pop();
				const fileName = `${conversationId}/${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}.${fileExt}`;

				const { error: uploadError } = await supabase.storage
					.from("chat-attachments")
					.upload(fileName, file, { upsert: false });
				if (uploadError) throw uploadError;

				const { data } = supabase.storage.from("chat-attachments").getPublicUrl(fileName);
				const publicUrl = data.publicUrl;
				uploaded.push({
					name: file.name,
					url: publicUrl,
					type: file.type,
					size: file.size,
				});
			}
			return uploaded;
		},
		[supabase.storage]
	);

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
		if (!files || files.length === 0) return;

		const next: PendingAttachment[] = [];
		for (const file of Array.from(files)) {
			if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
				console.error("[TeamChatOptimized] Archivo demasiado grande (máx. 10 MB)");
				continue;
			}
			next.push({
				id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
				file,
				previewUrl: URL.createObjectURL(file),
			});
		}

		setPendingAttachments((prev) => [...prev, ...next]);
		if (fileInputRef.current) fileInputRef.current.value = "";
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
					lastMessageSenderName: conv.last_message_sender_name ?? null,
					targetUserId: conv.target_user_id ?? null,
				}));

				// Ordenar por última actividad
				conversations.sort((a, b) => {
					const aTimestamp = a.lastMessageAt ?? MESSAGE_FALLBACK_DATE;
					const bTimestamp = b.lastMessageAt ?? b.lastReadAt ?? MESSAGE_FALLBACK_DATE;
					return bTimestamp.localeCompare(aTimestamp);
				});

				setConversations(conversations);
				setSelectedConversationId((prev) => {
					if (prev && conversations.some((c) => c.id === prev)) return prev;
					const groupChat = conversations.find((c) => c.type === "all");
					return groupChat?.id ?? conversations[0]?.id ?? null;
				});

				return conversations;
			} catch (err) {
				console.error("[TeamChatOptimized] Error cargando conversaciones optimizadas", err);
				setConversations([]);
				return [];
			}
		},
		[supabase]
	);

	const refreshConversations = useCallback(
		async () => {
			if (!tenantId || !currentUserId) return;
			await loadConversationsOptimized(tenantId, currentUserId);
		},
		[tenantId, currentUserId, loadConversationsOptimized]
	);

	const handleArchiveChat = useCallback(async () => {
		if (!selectedConversation || !chatActionsEnabled) return;
		if (
			!window.confirm(
				"¿Archivar este chat? Dejará de mostrarse en tu lista (solo para ti)."
			)
		) {
			return;
		}
		const cid = selectedConversation.id;
		const { data, error } = await supabase.rpc("user_archive_team_conversation", {
			p_conversation_id: cid,
		});
		if (error) {
			window.alert(readSupabaseClientError(error));
			return;
		}
		if (!data) {
			window.alert("No se pudo archivar el chat.");
			return;
		}
		setMessagesByConversation((prev) => {
			const next = { ...prev };
			delete next[cid];
			return next;
		});
		await refreshConversations();
		if (isMobile) setMobileView("list");
	}, [
		selectedConversation,
		chatActionsEnabled,
		supabase,
		refreshConversations,
		isMobile,
	]);

	const handleConfirmDeleteChat = useCallback(async () => {
		if (!selectedConversation || !chatActionsEnabled) return;
		const cid = selectedConversation.id;
		setDeleteChatBusy(true);
		try {
			const { data, error } = await supabase.rpc("user_delete_team_conversation", {
				p_conversation_id: cid,
			});
			if (error) {
				window.alert(readSupabaseClientError(error));
				return;
			}
			if (!data) {
				window.alert(
					"No se pudo eliminar. En grupos solo el creador o un administrador del negocio puede borrar el chat."
				);
				return;
			}
			setDeleteChatModalOpen(false);
			setMessagesByConversation((prev) => {
				const next = { ...prev };
				delete next[cid];
				return next;
			});
			await refreshConversations();
			if (isMobile) setMobileView("list");
		} finally {
			setDeleteChatBusy(false);
		}
	}, [
		selectedConversation,
		chatActionsEnabled,
		supabase,
		refreshConversations,
		isMobile,
	]);

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

	const availableMembers = useMemo(() => {
		return Object.values(membersDirectory).filter((member) => member.userId !== currentUserId);
	}, [membersDirectory, currentUserId]);

	const handleCreateGroup = useCallback(
		async (name: string, otherMemberUserIds: string[]) => {
			if (!tenantId) {
				throw new Error("No hay negocio activo");
			}
			const { data, error } = await supabase.rpc("create_group_team_conversation", {
				p_tenant_id: tenantId,
				p_name: name,
				p_member_user_ids: otherMemberUserIds,
			});
			if (error) {
				throw new Error(readSupabaseClientError(error));
			}
			if (data == null || String(data) === "") {
				throw new Error("No se pudo crear el grupo");
			}
			const newId = String(data);
			await refreshConversations();
			setSelectedConversationId(newId);
			if (isMobile) {
				setMobileView("chat");
			}
		},
		[supabase, tenantId, refreshConversations, isMobile]
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			{/* Lista + hilo: sin cabecera local (perfil y acciones en TopBar; chats en la lista) */}
			<div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden lg:grid lg:h-full lg:min-h-0 lg:grid-cols-3 lg:grid-rows-1 lg:gap-0 lg:items-stretch">
				{/* Lista de conversaciones */}
				<div
					className={cn(
						"flex min-h-0 flex-1 flex-col border-[var(--bf-border)] transition-all duration-300 lg:col-span-1 lg:h-full lg:max-h-full lg:min-h-0 lg:flex-none lg:border-r",
						isMobile && mobileView === "chat" && "hidden"
					)}
				>
					<ConversationList
						conversations={conversationsForList}
						tenantLogoUrl={initialData.tenant.logoUrl ?? null}
						selectedConversationId={selectedConversationId}
						onSelectConversation={(id) => {
							setSelectedConversationId(id);
							if (isMobile) setMobileView('chat');
						}}
						showUnreadOnly={showUnreadOnly}
						onToggleUnread={() => setShowUnreadOnly(!showUnreadOnly)}
						currentUserId={currentUserId}
						membersDirectory={listMembersPreview}
						onCreateGroup={() => setShowCreateGroupModal(true)}
						onOpenArchivedChats={() => setArchivedChatsModalOpen(true)}
					/>
				</div>

				{/* Área de mensajes */}
				<div
					className={cn(
						"relative flex min-h-0 flex-1 flex-col transition-all duration-300 lg:col-span-2 lg:h-full lg:max-h-full lg:min-h-0 lg:flex-none",
						isMobile && mobileView === "list" && "hidden"
					)}
					onTouchStart={(e) => {
						if (!isMobile || mobileView !== "chat") return;
						const t = e.touches[0];
						if (!t) return;
						touchStartRef.current = { x: t.clientX, y: t.clientY, at: Date.now() };
					}}
					onTouchEnd={(e) => {
						if (!isMobile || mobileView !== "chat") return;
						const start = touchStartRef.current;
						touchStartRef.current = null;
						const t = e.changedTouches[0];
						if (!start || !t) return;
						const dx = t.clientX - start.x;
						const dy = t.clientY - start.y;
						const dt = Date.now() - start.at;

						// Swipe hacia la derecha (similar al gesto back iOS)
						if (dx > 70 && Math.abs(dy) < 40 && dt < 450) {
							setMobileView("list");
						}
					}}
				>
					{selectedConversation ? (
						<div
							className={cn(
								"relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bf-bg)]",
								"rounded-none border-0 p-0 shadow-none",
								"md:rounded-[var(--r-xl)] md:border md:border-[var(--bf-border)] md:shadow-[var(--bf-shadow-card)]",
								"pb-0"
							)}
						>
							{/* Textura muy sutil — tinte desde --bf-border (sin matiz azulado ni blur) */}
							<div
								className="pointer-events-none absolute inset-0 opacity-[0.18]"
								aria-hidden
								style={{
									backgroundImage:
										"linear-gradient(rgba(29,36,48,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(29,36,48,0.45) 1px, transparent 1px)",
									backgroundSize: "32px 32px",
									maskImage: "radial-gradient(ellipse at 50% 45%, #000 28%, transparent 70%)",
								}}
							/>
							
							<ConversationHeader
								conversation={selectedConversation}
								onViewMembers={
									selectedConversation.type === "direct"
										? undefined
										: handleOpenMembersModal
								}
								onAddMember={
									selectedConversation.type === "direct"
										? undefined
										: handleOpenAddMembers
								}
								onBack={() => setMobileView('list')}
								isMobile={isMobile}
								chatActionsEnabled={chatActionsEnabled}
								onArchiveChat={chatActionsEnabled ? handleArchiveChat : undefined}
								onDeleteChat={
									chatActionsEnabled && canDeleteSelectedChat
										? () => setDeleteChatModalOpen(true)
										: undefined
								}
							/>
							{/* flex-col + overflow: el hijo MessageList necesita un flex parent para que flex-1 limite altura y el scroll funcione */}
							<div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
								{messagesLoadError && (
									<div
										className="shrink-0 border-b border-[rgba(224,96,114,0.28)] bg-[rgba(224,96,114,0.06)] px-4 py-2 text-sm text-[var(--bf-danger)]"
										style={{ fontFamily: "var(--font-sans)" }}
									>
										{messagesLoadError}
									</div>
								)}
								<MessageList
									messages={messagesForSelected}
									currentUserId={currentUserId || ""}
									onReply={setReplyToMessage}
									typingUsers={Array.from(typingUsers[selectedConversationId || ""] || [])}
									membersDirectory={membersDirectory}
									conversationType={selectedConversation.type}
									otherLastReadAt={otherLastReadAtForSelected}
									loading={messagesLoading}
									containerRef={messageContainerRef}
									onLoadMore={handleLoadMoreMessages}
									hasMoreMessages={
										selectedConversationId
											? hasMoreMessages[selectedConversationId] ?? false
											: false
									}
									loadError={messagesLoadError}
								/>
							</div>
							{selectedConversation.status === "pending_direct" ? (
								<div className="relative z-10 flex shrink-0 flex-col items-center border-t border-[var(--bf-border)] bg-[var(--bf-bg)] p-10 text-center">
									<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--r-lg)] border border-[var(--bf-border)] bg-[var(--bf-surface)] shadow-[var(--bf-shadow-card)]">
										<UserX className="h-7 w-7 text-[var(--bf-ink-400)]" strokeWidth={1.5} />
									</div>
									<h3 className="text-[var(--bf-ink-50)] font-medium mb-1" style={{ fontFamily: "var(--font-sans)" }}>Sin conversación directa</h3>
									<p className="text-[var(--bf-ink-400)] text-sm max-w-sm" style={{ fontFamily: "var(--font-sans)" }}>
										Aún no hay un hilo directo en el sistema con esta persona. Elige su entrada en
										la lista de la izquierda; al enviar el primer mensaje se creará o reutilizará el
										hilo si ya existía.
									</p>
								</div>
							) : (
								<div className="relative z-20 shrink-0 border-t border-[var(--bf-border)] bg-[var(--bf-bg)]">
									{pendingAttachments.length > 0 && (
										<div className="bg-transparent px-4 py-3">
											<div className="flex items-center gap-2 overflow-x-auto">
												{pendingAttachments.map((att) => {
													const isImage = att.file.type.startsWith("image/");
													return (
														<div
															key={att.id}
															className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-surface)]"
														>
															{isImage ? (
																<img
																	src={att.previewUrl}
																	alt={att.file.name}
																	className="h-full w-full object-cover"
																/>
															) : (
																<div className="h-full w-full flex items-center justify-center text-[10px] text-[var(--bf-ink-400)] px-1 text-center" style={{ fontFamily: "var(--font-sans)" }}>
																	{att.file.name}
																</div>
															)}
															<button
																type="button"
																onClick={() =>
																	setPendingAttachments((prev) => {
																		const next = prev.filter((p) => p.id !== att.id);
																		URL.revokeObjectURL(att.previewUrl);
																		return next;
																	})
																}
																className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[var(--bf-bg)] border border-[var(--bf-border)] text-[var(--bf-ink-50)] flex items-center justify-center"
																aria-label="Quitar adjunto"
																title="Quitar"
															>
																×
															</button>
														</div>
													);
												})}
											</div>
										</div>
									)}
									<MessageComposer
										onSend={async (text) => {
											if (!selectedConversationId) return;
											const files = pendingAttachments;
											setPendingAttachments([]);
											try {
												const uploaded =
													files.length > 0
														? await uploadPendingAttachments(selectedConversationId, files)
														: [];
												await handleSendMessage(text, uploaded);
											} finally {
												for (const a of files) URL.revokeObjectURL(a.previewUrl);
											}
										}}
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
										multiple
										accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
									/>
								</div>
							)}
						</div>
					) : (
						<div
							className={cn(
								"relative hidden min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[var(--bf-bg)]",
								"rounded-none border-0 md:rounded-[var(--r-xl)] md:border md:border-[var(--bf-border)] md:shadow-[var(--bf-shadow-card)] lg:flex"
							)}
						>
							<div
								className="pointer-events-none absolute inset-0 opacity-[0.18]"
								aria-hidden
								style={{
									backgroundImage:
										"linear-gradient(rgba(29,36,48,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(29,36,48,0.45) 1px, transparent 1px)",
									backgroundSize: "32px 32px",
									maskImage: "radial-gradient(ellipse at 50% 45%, #000 28%, transparent 70%)",
								}}
							/>
							<div className="relative z-10 flex max-w-sm flex-col items-center p-8 text-center transition-all duration-700 animate-in fade-in zoom-in slide-in-from-bottom-4">
								<div className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-[var(--r-xl)] border border-[var(--bf-border)] bg-[var(--bf-surface)] shadow-[var(--bf-shadow-card)]">
									<div className="absolute inset-0 rounded-[var(--r-xl)] ring-1 ring-[rgba(79,161,216,0.12)]" aria-hidden />
									<MessageSquare className="h-14 w-14 text-[var(--bf-primary)]" strokeWidth={1.25} />
								</div>
								<h2
									className="mb-2 text-lg font-semibold tracking-tight text-[var(--bf-ink-50)] md:text-xl"
									style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" }}
								>
									BookFast Chat
								</h2>
								<p className="mb-8 px-2 text-sm leading-relaxed text-[var(--bf-ink-300)]" style={{ fontFamily: "var(--font-sans)" }}>
									Envía y recibe mensajes sin necesidad de tener tu teléfono conectado.<br/>
									Usa BookFast Chat en hasta 4 dispositivos vinculados a la vez.
								</p>
								<div className="flex items-center gap-2 text-[var(--bf-ink-400)] text-[11px] opacity-60" style={{ fontFamily: "var(--font-mono)" }}>
									<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"></path></svg>
									<span className="font-medium">Conexión segura (HTTPS)</span>
								</div>
							</div>
							<div className="absolute bottom-0 w-full h-px bg-gradient-to-r from-transparent via-[var(--bf-border)] to-transparent" />
						</div>
					)}
				</div>
			</div>

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

			<CreateGroupModal
				isOpen={showCreateGroupModal}
				onClose={() => setShowCreateGroupModal(false)}
				availableMembers={availableMembers}
				onCreate={handleCreateGroup}
			/>

			<ArchivedChatsModal
				isOpen={archivedChatsModalOpen}
				onClose={() => setArchivedChatsModalOpen(false)}
				tenantId={tenantId}
				currentUserId={currentUserId}
				membersDirectory={listMembersPreview}
				onDidUnarchive={refreshConversations}
			/>

			<Modal
				isOpen={deleteChatModalOpen}
				onClose={() => !deleteChatBusy && setDeleteChatModalOpen(false)}
				title="Eliminar chat"
				size="sm"
				footer={
					<div className="flex w-full justify-end gap-2">
						<button
							type="button"
							disabled={deleteChatBusy}
							onClick={() => setDeleteChatModalOpen(false)}
							className="rounded-[var(--r-md)] border border-[var(--bf-border)] bg-transparent px-4 py-2 text-sm text-[var(--bf-ink-100)] hover:bg-[var(--bf-surface)]"
						>
							Cancelar
						</button>
						<button
							type="button"
							disabled={deleteChatBusy}
							onClick={() => void handleConfirmDeleteChat()}
							className="rounded-[var(--r-md)] bg-[var(--bf-danger)] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
						>
							{deleteChatBusy ? "Eliminando…" : "Eliminar"}
						</button>
					</div>
				}
			>
				<p className="text-sm text-[var(--bf-ink-300)]" style={{ fontFamily: "var(--font-sans)" }}>
					Se borrarán todos los mensajes y este chat desaparecerá para todos los miembros.
					Esta acción no se puede deshacer.
				</p>
			</Modal>

		</div>
	);
}
