"use client";

import { RefObject, useEffect, useMemo } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { MessageBubble } from "./MessageBubble";

type TeamMessage = {
	id: string;
	conversation_id: string;
	sender_id: string;
	body: string;
	created_at: string;
	edited_at: string | null;
};

type MessageListProps = {
	messages: TeamMessage[];
	currentUserId: string | null;
	loading: boolean;
	containerRef: RefObject<HTMLDivElement | null>;
	membersDirectory?: Record<string, { displayName: string; profilePhotoUrl?: string }>;
	conversationType?: "all" | "direct" | "group";
	tenantId?: string | null;
};

function formatTimestamp(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

	if (messageDate.getTime() === today.getTime()) {
		return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
	}
	return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

function formatDateHeader(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

	if (messageDate.getTime() === today.getTime()) {
		return "Hoy";
	}
	if (messageDate.getTime() === yesterday.getTime()) {
		return "Ayer";
	}
	return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function scrollToBottom(ref: RefObject<HTMLDivElement | null>) {
	if (ref.current) {
		// Usar setTimeout para asegurar que el DOM se haya actualizado
		setTimeout(() => {
			if (ref.current) {
				ref.current.scrollTop = ref.current.scrollHeight;
			}
		}, 0);
	}
}

type MessageWithDate = TeamMessage & {
	dateKey: string;
};

export function MessageList({
	messages,
	currentUserId,
	loading,
	containerRef,
	membersDirectory = {},
	conversationType = "direct",
	tenantId,
}: MessageListProps) {
	const supabase = getSupabaseBrowser();

	// Función para obtener nombre y avatar usando RPC si no están en el directorio
	const getSenderInfo = async (senderId: string): Promise<{ displayName: string; profilePhotoUrl?: string }> => {
		if (membersDirectory[senderId]) {
			return membersDirectory[senderId];
		}

		// Si no está en el directorio, usar función RPC (requiere tenantId)
		if (tenantId && currentUserId) {
			try {
				const displayName = await supabase.rpc("get_user_display_name", {
					p_viewer_user_id: currentUserId,
					p_target_user_id: senderId,
					p_tenant_id: tenantId,
				});
				const profilePhotoUrl = await supabase.rpc("get_user_profile_photo", {
					p_user_id: senderId,
					p_tenant_id: tenantId,
				});
				return {
					displayName: displayName.data ?? `Usuario ${senderId.slice(0, 6)}`,
					profilePhotoUrl: profilePhotoUrl.data ?? undefined,
				};
			} catch (err) {
				console.error("[MessageList] Error al obtener info del remitente:", err);
			}
		}

		return {
			displayName: `Usuario ${senderId.slice(0, 6)}`,
		};
	};
	// Agrupar mensajes por fecha
	const messagesWithDates = useMemo(() => {
		const grouped: Record<string, TeamMessage[]> = {};
		messages.forEach((msg) => {
			const date = new Date(msg.created_at);
			const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
			if (!grouped[dateKey]) {
				grouped[dateKey] = [];
			}
			grouped[dateKey].push(msg);
		});
		return grouped;
	}, [messages]);

	const dateKeys = useMemo(() => Object.keys(messagesWithDates).sort(), [messagesWithDates]);

	// Auto-scroll cuando cambian los mensajes o se carga por primera vez
	useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom(containerRef);
		}
	}, [messages.length, containerRef]);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (messages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
				<div className="text-center space-y-2">
					<p>No hay mensajes todavía. ¡Envía el primero!</p>
				</div>
			</div>
		);
	}

	return (
		<div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
			{dateKeys.map((dateKey) => {
				const dayMessages = messagesWithDates[dateKey];
				const firstMessage = dayMessages[0];
				return (
					<div key={dateKey} className="space-y-3">
						{/* Separador de fecha */}
						<div className="flex items-center gap-2 my-4">
							<div className="flex-1 h-px bg-white/10" />
							<span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide px-2">
								{formatDateHeader(firstMessage.created_at)}
							</span>
							<div className="flex-1 h-px bg-white/10" />
						</div>

						{/* Mensajes del día */}
						{dayMessages.map((msg, idx) => {
							const isOwn = msg.sender_id === currentUserId;
							const senderInfo = membersDirectory[msg.sender_id] ?? {
								displayName: `Usuario ${msg.sender_id.slice(0, 6)}`,
							};
							// Mostrar avatar y nombre solo si es grupo/all y no es el mismo remitente que el anterior
							const prevMessage = idx > 0 ? dayMessages[idx - 1] : null;
							const showAvatar = conversationType !== "direct" && !isOwn && (prevMessage?.sender_id !== msg.sender_id || idx === 0);
							const showSenderName = conversationType !== "direct" && !isOwn && (prevMessage?.sender_id !== msg.sender_id || idx === 0);
							return (
								<MessageBubble
									key={msg.id}
									message={msg}
									isOwn={isOwn}
									senderName={senderInfo.displayName}
									senderAvatar={senderInfo.profilePhotoUrl}
									showSenderName={showSenderName}
									showAvatar={showAvatar}
								/>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}
