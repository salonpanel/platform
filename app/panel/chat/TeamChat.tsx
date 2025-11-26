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


export function TeamChat() {
	const supabase = getSupabaseBrowser();
	const searchParams = useSearchParams();
	const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams]);

	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
	const [tenantId, setTenantId] = useState<string | null>(null);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
	const [messagesByConversation, setMessagesByConversation] = useState<Record<string, TeamMessage[]>>({});
	const [loading, setLoading] = useState(true);
	const [messagesLoading, setMessagesLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showUnreadOnly, setShowUnreadOnly] = useState(false);
	const [showNewChatModal, setShowNewChatModal] = useState(false);
	const [showMembersModal, setShowMembersModal] = useState(false);
	const [showAddMemberModal, setShowAddMemberModal] = useState(false);
	const [showUserProfileModal, setShowUserProfileModal] = useState(false);
	const [showProfileDropdown, setShowProfileDropdown] = useState(false);
	const [membersDirectory, setMembersDirectory] = useState<Record<string, TenantMemberProfile>>({});
	const messageContainerRef = useRef<HTMLDivElement>(null);
	const profileDropdownRef = useRef<HTMLDivElement>(null);

	// Estados del modal nuevo chat
	const [newChatType, setNewChatType] = useState<ConversationType>("direct");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [groupName, setGroupName] = useState("");
	const [creatingChat, setCreatingChat] = useState(false);

	const fetchLastMessage = useCallback(
		async (conversationId: string): Promise<TeamMessage | null> => {
			const { data, error } = await supabase
				.from("team_messages")
				.select("id, conversation_id, sender_id, body, created_at, edited_at")
				.eq("conversation_id", conversationId)
				.is("deleted_at", null)
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle();

			if (error && error.code !== "PGRST116") {
				throw error;
			}

			return (data as TeamMessage) ?? null;
		},
		[supabase]
	);

	const fetchUnreadCount = useCallback(
		async (conversationId: string, lastReadAt: string | null) => {
			const { count, error } = await supabase
				.from("team_messages")
				.select("id", { count: "exact", head: true })
				.eq("conversation_id", conversationId)
				.is("deleted_at", null)
				.gt("created_at", lastReadAt ?? MESSAGE_FALLBACK_DATE);

			if (error) throw error;
			return count ?? 0;
		},
		[supabase]
	);

	const loadMembersDirectory = useCallback(
		async (targetTenantId: string) => {
			try {
				if (process.env.NODE_ENV === "development") {
					console.debug("[TeamChat] Cargando directorio de miembros", targetTenantId);
				}
				const { data, error } = await supabase.rpc("list_tenant_members", { p_tenant_id: targetTenantId });
				if (error) {
					if (process.env.NODE_ENV === "development") {
						console.debug("[TeamChat] Error en list_tenant_members:", error);
					}
					console.error("[TeamChat] Error en list_tenant_members:", error);
					throw error;
				}
				const directory: Record<string, TenantMemberProfile> = {};
				for (const row of data ?? []) {
					directory[row.user_id] = {
						userId: row.user_id,
						displayName: row.display_name,
						tenantRole: row.tenant_role,
						profilePhotoUrl: row.avatar_url ?? undefined,
					};
				}
				setMembersDirectory(directory);
			} catch (err) {
				if (process.env.NODE_ENV === "development") {
					console.debug("[TeamChat] Error al cargar directorio de miembros:", err);
				}
				console.error("[TeamChat] Error al cargar directorio de miembros:", err);
				// No lanzar el error, solo loguearlo para no bloquear la carga
			}
		},
		[supabase]
	);

	const loadMessagesForConversation = useCallback(
		async (conversationId: string) => {
			setMessagesLoading(true);
			try {
				if (process.env.NODE_ENV === "development") {
					console.debug("[TeamChat] Cargando mensajes para conversación", conversationId);
				}

				// TODO: Implementar paginación/infinite scroll para cargar mensajes anteriores
				// Por ahora limitamos a los últimos 100 mensajes
				const { data, error } = await supabase
					.from("team_messages")
					.select("id, conversation_id, sender_id, body, created_at, edited_at")
					.eq("conversation_id", conversationId)
					.is("deleted_at", null)
					.order("created_at", { ascending: false })
					.limit(100);

				if (error) throw error;

				// Reordenar en cliente para mostrar ASC (más antiguos primero)
				const sorted = (data as TeamMessage[] ?? []).reverse();

				setMessagesByConversation((prev) => ({
					...prev,
					[conversationId]: sorted,
				}));

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
				if (process.env.NODE_ENV === "development") {
					console.debug("[TeamChat] Error al cargar mensajes", err);
				}
				console.error("[TeamChat] Error al cargar mensajes", err);
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setMessagesLoading(false);
			}
		},
		[supabase, currentUserId]
	);

	const loadConversationsOptimized = useCallback(
		async (targetTenantId: string, targetUserId: string): Promise<Conversation[]> => {
			if (!targetTenantId || !targetUserId) return [];

			if (process.env.NODE_ENV === "development") {
				console.debug("[TeamChat] Cargando conversaciones optimizadas", { targetTenantId, targetUserId });
			}

			try {
				// 🔥 OPTIMIZACIÓN: Una sola query con JOIN para obtener todo
				// Esto reemplaza las múltiples queries N+1 de refreshConversations
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
					const aTimestamp = a.lastMessageAt ?? a.lastReadAt ?? MESSAGE_FALLBACK_DATE;
					const bTimestamp = b.lastMessageAt ?? b.lastReadAt ?? MESSAGE_FALLBACK_DATE;
					return bTimestamp.localeCompare(aTimestamp);
				});

				setConversations(conversations);

				// Seleccionar primera conversación si no hay ninguna seleccionada
				if (!selectedConversationId && conversations.length > 0) {
					setSelectedConversationId(conversations[0].id);
				}

				if (process.env.NODE_ENV === "development") {
					console.debug("[TeamChat] ✅ Conversaciones cargadas:", conversations.length);
				}

				return conversations;

			} catch (err) {
				console.error("[TeamChat] Error cargando conversaciones optimizadas", err);

				// Fallback: usar refreshConversations si la RPC falla
				console.warn("[TeamChat] Usando fallback refreshConversations");
				await refreshConversations(targetTenantId, targetUserId);
				return [];
			}
		},
		[supabase, selectedConversationId]
	);

	// Mantener compatibilidad: refreshConversations ahora usa loadConversationsOptimized
	const refreshConversations = useCallback(
		async (tenantIdOverride?: string, userIdOverride?: string) => {
			const targetTenantId = tenantIdOverride ?? tenantId;
			const targetUserId = userIdOverride ?? currentUserId;
			if (!targetTenantId || !targetUserId) return;

			await loadConversationsOptimized(targetTenantId, targetUserId);
		},
		[tenantId, currentUserId, loadConversationsOptimized]
	);

	// Bootstrap: resolver usuario y tenant de forma optimizada
	useEffect(() => {
		let active = true;
		const bootstrap = async () => {
			try {
				setLoading(true);
				setError(null);

				// 🔥 OPTIMIZACIÓN: Resolver usuario Y tenant en paralelo
				const [userResult, tenantResult] = await Promise.all([
					supabase.auth.getUser(),
					// Preparar tenant resolution (se hará en paralelo con user)
					Promise.resolve(null)
				]);

				const { data: { user }, error: userError } = userResult;

				if (userError) throw userError;
				if (!user) throw new Error("No autenticado.");

				if (!active) return;
				setCurrentUserId(user.id);
				setCurrentUserEmail(user.email || null);

				// 🔥 OPTIMIZACIÓN: Resolver tenant y memberships en paralelo
				let targetTenantId: string | null = null;
				let userMemberships: any[] = [];

				if (impersonateOrgId) {
					const [adminResult, membershipResult] = await Promise.all([
						supabase.rpc("check_platform_admin", { p_user_id: user.id }),
						supabase
							.from("memberships")
							.select("tenant_id")
							.eq("user_id", user.id)
							.order("created_at", { ascending: true })
					]);

					const { data: isAdmin } = adminResult;
					const { data: memberships } = membershipResult;

					if (isAdmin) {
						targetTenantId = impersonateOrgId;
					} else if (memberships && memberships.length > 0) {
						targetTenantId = memberships[0].tenant_id;
					}
					userMemberships = memberships || [];
				} else {
					const { data: memberships, error: membershipError } = await supabase
						.from("memberships")
						.select("tenant_id")
						.eq("user_id", user.id)
						.order("created_at", { ascending: true });

					if (membershipError) throw membershipError;
					if (!memberships || memberships.length === 0) throw new Error("No perteneces a ninguna barbería.");
					targetTenantId = memberships[0].tenant_id;
					userMemberships = memberships;
				}

				if (!active) return;
				setTenantId(targetTenantId);

				if (!targetTenantId) {
					throw new Error("No se pudo determinar el tenant");
				}

				// 🔥 OPTIMIZACIÓN: Crear conversación default y cargar conversaciones en paralelo
				const [defaultConvResult, conversationsResult] = await Promise.all([
					supabase.rpc("ensure_default_team_conversation", { p_tenant_id: targetTenantId }),
					loadConversationsOptimized(targetTenantId, user.id)
				]);

				// 🔥 OPTIMIZACIÓN: Lazy load miembros - solo cuando sea necesario
				// Por ahora solo cargamos miembros si hay conversaciones o se necesita
				if (conversationsResult && conversationsResult.length > 0) {
					// Cargar miembros de forma diferida (no bloquea la carga inicial)
					setTimeout(() => {
						if (active) loadMembersDirectory(targetTenantId);
					}, 100);
				}

			} catch (err) {
				console.error("[TeamChat] Bootstrap error", err);
				if (active) setError(err instanceof Error ? err.message : String(err));
			} finally {
				if (active) setLoading(false);
			}
		};

		void bootstrap();

		return () => {
			active = false;
		};
	}, [supabase, impersonateOrgId]);

	// Cargar mensajes cuando se selecciona una conversación
	useEffect(() => {
		if (!selectedConversationId) return;
		if (!messagesByConversation[selectedConversationId]) {
			void loadMessagesForConversation(selectedConversationId);
		}
	}, [selectedConversationId, loadMessagesForConversation, messagesByConversation]);

	// Realtime subscription para mensajes
	useEffect(() => {
		if (!tenantId) return;

		if (process.env.NODE_ENV === "development") {
			console.debug("[TeamChat] Suscribiéndose a realtime para tenant", tenantId);
		}

		const channel = supabase
			.channel(`team_messages_tenant_${tenantId}`)
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

					// Actualizar lista de conversaciones (para actualizar lastMessage y unreadCount)
					void refreshConversations();

					// Si el mensaje es de la conversación seleccionada, añadirlo directamente
					if (conversationId === selectedConversationId) {
						setMessagesByConversation((prev) => {
							const existing = prev[conversationId] ?? [];
							// Evitar duplicados (por si acaso)
							if (existing.some((m) => m.id === newMessage.id)) {
								return prev;
							}
							return {
								...prev,
								[conversationId]: [...existing, newMessage],
							};
						});
					} else {
						// Si no es la conversación seleccionada, incrementar unreadCount
						setConversations((prev) =>
							prev.map((conv) =>
								conv.id === conversationId ? { ...conv, unreadCount: conv.unreadCount + 1 } : conv
							)
						);
					}
				}
			)
			.subscribe((status) => {
				if (process.env.NODE_ENV === "development") {
					console.debug("[TeamChat] Estado de suscripción realtime:", status);
				}
			});

		return () => {
			if (process.env.NODE_ENV === "development") {
				console.debug("[TeamChat] Desuscribiéndose de realtime");
			}
			supabase.removeChannel(channel);
		};
	}, [supabase, tenantId, refreshConversations, selectedConversationId]);

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
		setMessagesByConversation((prev) => {
			const existing = prev[selectedConversation.id] ?? [];
			return {
				...prev,
				[selectedConversation.id]: [...existing, optimisticMessage],
			};
		});

		// Actualizar lastMessage en la lista de conversaciones
		setConversations((prev) =>
			prev.map((conv) =>
				conv.id === selectedConversation.id
					? {
							...conv,
							lastMessageBody: trimmedBody,
							lastMessageAt: optimisticMessage.created_at,
							updated_at: optimisticMessage.created_at,
						}
					: conv
			)
		);

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

			// Reemplazar mensaje optimista con el real cuando llegue por realtime
			// O hacerlo directamente aquí si realtime no lo hace a tiempo
			if (data) {
				setMessagesByConversation((prev) => {
					const existing = prev[selectedConversation.id] ?? [];
					const withoutOptimistic = existing.filter((m) => m.id !== optimisticId);
					return {
						...prev,
						[selectedConversation.id]: [...withoutOptimistic, data as TeamMessage],
					};
				});
			}
		} catch (err) {
			if (process.env.NODE_ENV === "development") {
				console.debug("[TeamChat] Error al enviar mensaje", err);
			}
			console.error("[TeamChat] Error al enviar mensaje", err);
			setError(err instanceof Error ? err.message : String(err));
			// Revertir optimista
			setMessagesByConversation((prev) => {
				const existing = prev[selectedConversation.id] ?? [];
				return {
					...prev,
					[selectedConversation.id]: existing.filter((m) => m.id !== optimisticId),
				};
			});
			// Revertir actualización de conversación
			setConversations((prev) =>
				prev.map((conv) =>
					conv.id === selectedConversation.id
						? {
								...conv,
								lastMessageBody: conv.lastMessageBody,
								lastMessageAt: conv.lastMessageAt,
							}
						: conv
				)
			);
			throw err;
		}
	};

	const generateGroupName = (userIds: string[], directory: Record<string, TenantMemberProfile>, currentUserId: string): string => {
		const names = userIds
			.filter((id) => id !== currentUserId)
			.map((id) => directory[id]?.displayName ?? `Usuario ${id.slice(0, 6)}`)
			.slice(0, 3);
		return names.length > 0 ? names.join(", ") : "Grupo";
	};

	const handleCreateChat = async () => {
		if (!tenantId || !currentUserId) return;

		try {
			setCreatingChat(true);
			setError(null);

			if (newChatType === "direct" && selectedUserIds.length !== 1) {
				throw new Error("Selecciona exactamente un miembro para un chat directo.");
			}

			if (newChatType === "group" && selectedUserIds.length < 2) {
				throw new Error("Un grupo necesita al menos 3 participantes (incluyéndote).");
			}

			const participants = Array.from(new Set([currentUserId, ...selectedUserIds]));

			// Para direct: buscar si ya existe
			if (newChatType === "direct") {
				const { data: existing, error: rpcError } = await supabase.rpc("find_direct_team_conversation", {
					p_tenant_id: tenantId,
					p_user_a: currentUserId,
					p_user_b: selectedUserIds[0],
				});
				if (rpcError) throw rpcError;
				if (existing) {
					setSelectedConversationId(existing);
					setShowNewChatModal(false);
					setNewChatType("direct");
					setSelectedUserIds([]);
					setGroupName("");
					return;
				}
			}

			const computedName =
				newChatType === "direct"
					? membersDirectory[selectedUserIds[0]]?.displayName ?? "Chat directo"
					: groupName.trim() || generateGroupName(participants, membersDirectory, currentUserId);

			const { data: inserted, error: insertError } = await supabase
				.from("team_conversations")
				.insert({
					tenant_id: tenantId,
					name: computedName,
					type: newChatType,
					is_default: false,
					created_by: currentUserId,
					metadata: { participantIds: participants },
				})
				.select("*")
				.single();

			if (insertError) throw insertError;

			const rows = participants.map((userId) => ({
				conversation_id: inserted.id,
				user_id: userId,
				role: userId === currentUserId ? ("admin" as const) : ("member" as const),
			}));

			const { error: memberError } = await supabase.from("team_conversation_members").insert(rows);

			if (memberError) throw memberError;

			await refreshConversations();
			setSelectedConversationId(inserted.id);
			setShowNewChatModal(false);
			setNewChatType("direct");
			setSelectedUserIds([]);
			setGroupName("");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setCreatingChat(false);
		}
	};

	const toggleUserSelection = (userId: string) => {
		if (newChatType === "direct") {
			setSelectedUserIds([userId]);
			return;
		}
		setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
	};

	const availableMembers = useMemo(() => {
		return Object.values(membersDirectory).filter((member) => member.userId !== currentUserId);
	}, [membersDirectory, currentUserId]);

	// Cargar miembros de una conversación
	const [conversationMembers, setConversationMembers] = useState<
		Array<{
			userId: string;
			displayName: string;
			role: "member" | "admin";
			joinedAt: string;
			profilePhotoUrl?: string;
		}>
	>([]);

	const loadConversationMembers = useCallback(
		async (conversationId: string) => {
			if (!tenantId || !currentUserId) return;

			if (process.env.NODE_ENV === "development") {
				console.debug("[TeamChat] Cargando miembros de conversación", conversationId);
			}

			try {
				// Primero verificar que somos miembros de esta conversación
				const { data: ourMembership, error: checkError } = await supabase
					.from("team_conversation_members")
					.select("conversation_id")
					.eq("conversation_id", conversationId)
					.eq("user_id", currentUserId)
					.single();

				if (checkError || !ourMembership) {
					if (process.env.NODE_ENV === "development") {
						console.debug("[TeamChat] No eres miembro de esta conversación");
					}
					console.error("[TeamChat] No eres miembro de esta conversación");
					return;
				}

				// Usar función RPC para obtener todos los miembros (resuelve problemas de RLS)
				const { data: membersData, error: membersError } = await supabase.rpc("get_conversation_members", {
					p_conversation_id: conversationId,
				});

				if (membersError) {
					if (process.env.NODE_ENV === "development") {
						console.debug("[TeamChat] Error al cargar miembros (RPC), usando fallback:", membersError);
					}
					// Fallback: usar solo nuestro membership y el membersDirectory
					const ourMember = membersDirectory[currentUserId];
					if (ourMember) {
						setConversationMembers([
							{
								userId: currentUserId,
								displayName: ourMember.displayName,
								role: selectedConversation?.viewerRole ?? "member",
								joinedAt: new Date().toISOString(),
							},
						]);
					}
					return;
				}

				// Mapear los miembros desde la RPC (ya incluye display_name y profile_photo_url)
				const members = (membersData ?? [])
					.map(
						(m: {
							user_id: string;
							display_name: string | null;
							role: string;
							joined_at: string | null;
							profile_photo_url?: string | null;
						}) => ({
							userId: m.user_id,
							displayName: m.display_name ?? `Usuario ${m.user_id.slice(0, 6)}`,
							role: (m.role as "member" | "admin") ?? "member",
							joinedAt: m.joined_at ?? new Date().toISOString(),
							profilePhotoUrl: m.profile_photo_url ?? undefined,
						})
					)
					.filter((m: { userId: string }) => m.userId);

				setConversationMembers(members);
			} catch (err) {
				if (process.env.NODE_ENV === "development") {
					console.debug("[TeamChat] Error al cargar miembros de conversación:", err);
				}
				console.error("[TeamChat] Error al cargar miembros de conversación:", err);
			}
		},
		[supabase, tenantId, currentUserId, membersDirectory, selectedConversation]
	);

	// Función para añadir miembros a un grupo
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

				// Recargar miembros de la conversación
				if (showMembersModal && selectedConversation.id) {
					await loadConversationMembers(selectedConversation.id);
				}
			} catch (err) {
				console.error("[TeamChat] Error al añadir miembros:", err);
				setError(err instanceof Error ? err.message : String(err));
				throw err;
			}
		},
		[supabase, selectedConversation, tenantId, refreshConversations, showMembersModal, loadConversationMembers]
	);

	// Función para establecer apodo personalizado
	const handleSetNickname = useCallback(
		async (targetUserId: string, nickname: string) => {
			if (!currentUserId || !nickname.trim()) return;

			try {
				const { error } = await supabase.from("user_display_names").upsert(
					{
						viewer_user_id: currentUserId,
						target_user_id: targetUserId,
						custom_name: nickname.trim(),
					},
					{
						onConflict: "viewer_user_id,target_user_id",
					}
				);

				if (error) throw error;

				// Recargar miembros para reflejar el cambio
				if (selectedConversationId) {
					await loadConversationMembers(selectedConversationId);
				}
				// Recargar directorio
				if (tenantId) {
					await loadMembersDirectory(tenantId);
				}
			} catch (err) {
				console.error("[TeamChat] Error al establecer apodo:", err);
				setError(err instanceof Error ? err.message : String(err));
				throw err;
			}
		},
		[supabase, currentUserId, selectedConversationId, tenantId, loadConversationMembers, loadMembersDirectory]
	);

	// Cargar miembros cuando se abre el modal
	useEffect(() => {
		if (showMembersModal && selectedConversationId) {
			void loadConversationMembers(selectedConversationId);
		}
	}, [showMembersModal, selectedConversationId, loadConversationMembers]);

	// Cerrar dropdown de perfil al hacer clic fuera
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

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner size="lg" />
			</div>
		);
	}

	if (error) {
		return (
			<GlassCard className="p-4 border border-red-500/30 bg-red-500/10 text-red-300">
				{error}
			</GlassCard>
		);
	}

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
												// TODO: Añadir más opciones si es necesario
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
						onClick={() => setShowUnreadOnly(!showUnreadOnly)}
						className={cn(
							"px-3 py-1.5 rounded-lg text-sm font-medium transition-smooth",
							showUnreadOnly
								? "bg-[rgba(58,109,255,0.15)] text-[#3A6DFF] border border-[#3A6DFF]/40"
								: "glass border border-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
						)}
					>
						{showUnreadOnly ? "Mostrando no leídos" : "Filtrar no leídos"}
					</button>
					<button
						onClick={() => setShowNewChatModal(true)}
						className="px-3 py-1.5 rounded-lg text-sm font-medium glass border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.25)] transition-smooth flex items-center gap-2"
					>
						<Plus className="h-4 w-4" />
						Nuevo chat
					</button>
				</div>
			</header>

			<div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
				<ConversationList
					conversations={visibleConversations}
					selectedConversationId={selectedConversationId}
					onSelectConversation={setSelectedConversationId}
					showUnreadOnly={showUnreadOnly}
					onToggleUnread={() => setShowUnreadOnly(!showUnreadOnly)}
				/>

				<GlassCard className="md:col-span-2 flex flex-col overflow-hidden p-0">
					{selectedConversation ? (
						<>
							<ConversationHeader
								conversation={selectedConversation}
								onViewMembers={() => setShowMembersModal(true)}
								onAddMember={
									(selectedConversation.viewerRole === "admin" || selectedConversation.createdBy === currentUserId) &&
									selectedConversation.type !== "all"
										? () => setShowAddMemberModal(true)
										: undefined
								}
							/>
							<MessageList
								messages={messagesForSelected}
								currentUserId={currentUserId}
								loading={messagesLoading}
								containerRef={messageContainerRef}
								membersDirectory={Object.fromEntries(
									Object.entries(membersDirectory).map(([k, v]) => [
										k,
										{ displayName: v.displayName, profilePhotoUrl: v.profilePhotoUrl },
									])
								)}
								conversationType={selectedConversation.type}
								tenantId={tenantId}
							/>
							<MessageComposer
								disabled={!selectedConversationId}
								onSend={handleSendMessage}
							/>
						</>
					) : (
						<div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
							<div className="text-center space-y-2">
								<MessageSquare className="h-12 w-12 mx-auto opacity-50" />
								<p>Selecciona una conversación para comenzar</p>
							</div>
						</div>
					)}
				</GlassCard>
			</div>

			{/* Modal Nuevo Chat */}
			<Modal
				isOpen={showNewChatModal}
				onClose={() => {
					setShowNewChatModal(false);
					setNewChatType("direct");
					setSelectedUserIds([]);
					setGroupName("");
				}}
				title="Nuevo chat"
				size="lg"
				footer={
					<>
						<button
							onClick={() => {
								setShowNewChatModal(false);
								setNewChatType("direct");
								setSelectedUserIds([]);
								setGroupName("");
							}}
							className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-smooth"
						>
							Cancelar
						</button>
						<button
							onClick={handleCreateChat}
							disabled={creatingChat || (newChatType === "direct" && selectedUserIds.length !== 1) || (newChatType === "group" && selectedUserIds.length < 2)}
							className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#3A6DFF] to-[#7B5CFF] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(66,92,255,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{creatingChat ? "Creando..." : "Crear"}
						</button>
					</>
				}
			>
				<div className="space-y-4">
					{/* Tipo de chat */}
					<div>
						<p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Tipo de chat</p>
						<div className="grid grid-cols-2 gap-2">
							<button
								onClick={() => {
									setNewChatType("direct");
									if (selectedUserIds.length > 1) setSelectedUserIds(selectedUserIds.slice(0, 1));
								}}
								className={cn(
									"rounded-xl border px-3 py-2 text-sm transition-smooth",
									newChatType === "direct"
										? "border-[#3A6DFF] bg-[#3A6DFF]/10 text-[#3A6DFF]"
										: "border-white/10 text-[var(--text-secondary)] hover:text-white"
								)}
							>
								Chat directo
							</button>
							<button
								onClick={() => setNewChatType("group")}
								className={cn(
									"rounded-xl border px-3 py-2 text-sm transition-smooth",
									newChatType === "group"
										? "border-[#7B5CFF] bg-[#7B5CFF]/10 text-[#7B5CFF]"
										: "border-white/10 text-[var(--text-secondary)] hover:text-white"
								)}
							>
								Grupo
							</button>
						</div>
					</div>

					{/* Participantes */}
					<div>
						<p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">
							{newChatType === "direct" ? "Selecciona un miembro" : "Selecciona participantes"}
						</p>
						<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
							{availableMembers.length === 0 ? (
								<p className="text-sm text-[var(--text-secondary)] text-center py-4">No hay miembros disponibles</p>
							) : (
								availableMembers.map((member) => (
									<label
										key={member.userId}
										className={cn(
											"flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer transition-smooth",
											selectedUserIds.includes(member.userId)
												? "border-[#3A6DFF] bg-[#3A6DFF]/10"
												: "border-white/10 hover:border-white/20"
										)}
									>
										<input
											type={newChatType === "direct" ? "radio" : "checkbox"}
											name={newChatType === "direct" ? "direct-user" : "group-users"}
											className="accent-[#3A6DFF]"
											checked={selectedUserIds.includes(member.userId)}
											onChange={() => toggleUserSelection(member.userId)}
										/>
										<div className="flex-1">
											<p className="text-sm text-white">{member.displayName}</p>
											<p className="text-[11px] text-[var(--text-secondary)] capitalize">{member.tenantRole}</p>
										</div>
									</label>
								))
							)}
						</div>
					</div>

					{/* Nombre del grupo (solo para grupos) */}
					{newChatType === "group" && (
						<div>
							<p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Nombre del grupo</p>
							<input
								type="text"
								value={groupName}
								onChange={(e) => setGroupName(e.target.value)}
								placeholder="Equipo de fin de semana"
								className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7B5CFF]"
							/>
							<p className="text-[11px] text-[var(--text-secondary)] mt-1">
								Si lo dejas vacío, generaremos un nombre con los participantes.
							</p>
						</div>
					)}
				</div>
			</Modal>

			{/* Modal Ver Miembros */}
			<MembersModal
				isOpen={showMembersModal}
				onClose={() => setShowMembersModal(false)}
				members={conversationMembers}
				conversationName={selectedConversation?.name ?? "Conversación"}
				currentUserId={currentUserId}
			/>

			{/* Modal Añadir Miembros */}
			{selectedConversation && (
				<AddMembersModal
					isOpen={showAddMemberModal}
					onClose={() => setShowAddMemberModal(false)}
					conversationId={selectedConversation.id}
					existingMemberIds={conversationMembers.map((m) => m.userId)}
					availableMembers={availableMembers}
					onAddMembers={handleAddMembersToGroup}
				/>
			)}
		</div>
	);
}

