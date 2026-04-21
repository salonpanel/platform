"use client";

import { RefObject, useEffect, useRef, useMemo } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";

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
};

type MessageListProps = {
	messages: TeamMessage[];
	currentUserId: string | null;
	loading: boolean;
	containerRef: RefObject<HTMLDivElement | null>;
	membersDirectory?: Record<string, { displayName: string; profilePhotoUrl?: string }>;
	conversationType?: "all" | "direct" | "group";
	/** Para receipts: último last_read_at de cualquier otro miembro (no el viewer) */
	otherLastReadAt?: string | null;
	onLoadMore?: () => void;
	hasMoreMessages?: boolean;
	/** Si la RPC falló, no mostrar el vacío “sin mensajes” (mensaje real va en el padre) */
	loadError?: string | null;
	onReply?: (message: TeamMessage) => void;
	tenantId?: string | null;
	typingUsers?: string[];
};

function formatDateHeader(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

	if (messageDate.getTime() === today.getTime()) return "Hoy";
	if (messageDate.getTime() === yesterday.getTime()) return "Ayer";
	
	const options: Intl.DateTimeFormatOptions = { 
		day: 'numeric', 
		month: 'long' 
	};
	
	if (date.getFullYear() !== now.getFullYear()) {
		options.year = 'numeric';
	}
	
	return date.toLocaleDateString("es-ES", options).toUpperCase();
}

function scrollToBottom(ref: RefObject<HTMLDivElement | null>) {
	if (ref.current) {
		setTimeout(() => {
			if (ref.current) {
				ref.current.scrollTop = ref.current.scrollHeight;
			}
		}, 0);
	}
}

export function MessageList({
	messages,
	currentUserId,
	loading,
	containerRef,
	membersDirectory = {},
	conversationType = "direct",
	otherLastReadAt = null,
	onLoadMore,
	hasMoreMessages = false,
	loadError = null,
	onReply,
	tenantId,
	typingUsers = [],
}: MessageListProps) {
	const isLoadingMoreRef = useRef(false);
	const prevScrollHeightRef = useRef(0);
	const lastMessageIdRef = useRef<string | null>(null);

	// Restaurar posición de scroll después de cargar mensajes antiguos
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !isLoadingMoreRef.current) return;
		const newScrollHeight = container.scrollHeight;
		const diff = newScrollHeight - prevScrollHeightRef.current;
		if (diff > 0) {
			container.scrollTop = diff;
		}
		isLoadingMoreRef.current = false;
	}, [messages.length, containerRef]);

	// Scroll infinito
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !onLoadMore || !hasMoreMessages) return;

		const handleScroll = () => {
			if (container.scrollTop < 100 && !loading && !isLoadingMoreRef.current) {
				isLoadingMoreRef.current = true;
				prevScrollHeightRef.current = container.scrollHeight;
				onLoadMore();
			}
		};

		container.addEventListener('scroll', handleScroll, { passive: true });
		return () => container.removeEventListener('scroll', handleScroll);
	}, [containerRef, onLoadMore, hasMoreMessages, loading]);

	// Agrupar mensajes por fecha
	const messagesWithDates = useMemo(() => {
		const grouped: Record<string, TeamMessage[]> = {};
		messages.forEach((msg) => {
			const date = new Date(msg.created_at);
			const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
			if (!grouped[dateKey]) grouped[dateKey] = [];
			grouped[dateKey].push(msg);
		});
		return grouped;
	}, [messages]);

	const dateKeys = useMemo(() => Object.keys(messagesWithDates).sort((a,b) => a.localeCompare(b)), [messagesWithDates]);

	// Auto-scroll al recibir mensajes nuevos
	useEffect(() => {
		if (messages.length === 0) return;
		const newLastId = messages[messages.length - 1].id;
		if (newLastId !== lastMessageIdRef.current) {
			lastMessageIdRef.current = newLastId;
			if (!isLoadingMoreRef.current) {
				scrollToBottom(containerRef);
			}
		}
	}, [messages, containerRef]);

	if (loading && messages.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center bg-transparent">
				<Spinner />
			</div>
		);
	}

	const padBottomForWhatsAppLayout = !hasMoreMessages && messages.length > 0;

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
			<div
				ref={containerRef}
				className={cn(
					"relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-6",
					"scroll-smooth [scrollbar-gutter:stable]"
				)}
			>
				<div
					className={cn(
						"flex flex-col",
						padBottomForWhatsAppLayout && "min-h-full",
						messages.length === 0 && !loadError && "min-h-full"
					)}
				>
					{/* Con poco histórico, empuja el bloque de mensajes hacia abajo como WhatsApp */}
					{padBottomForWhatsAppLayout && <div className="min-h-0 flex-1" aria-hidden />}

					{/* Cargador de historial (arriba) */}
					{hasMoreMessages && (
						<div className="flex shrink-0 justify-center py-4">
							{loading ? <Spinner size="sm" /> : <div className="h-4" />}
						</div>
					)}

					{messages.length === 0 && !loadError && (
						<div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm italic text-[#8696a0]">
							<p>No hay mensajes en esta conversación</p>
						</div>
					)}

					{dateKeys.map((dateKey) => {
					const dayMessages = messagesWithDates[dateKey];
					return (
						<div key={dateKey} className="flex flex-col space-y-0.5">
							{/* Separador de fecha Estilo WhatsApp */}
							<div className="sticky top-4 z-20 flex justify-center my-4 pointer-events-none">
								<span className="px-3 py-1.5 rounded-lg bg-[#182229] text-[12px] text-[#8696a0] shadow-md select-none">
									{formatDateHeader(dayMessages[0].created_at)}
								</span>
							</div>

							{dayMessages.map((msg, idx) => {
								const isOwn = msg.sender_id === currentUserId;
								const isReadByOther =
									isOwn && !!otherLastReadAt && otherLastReadAt >= msg.created_at;
								const senderInfo = membersDirectory[msg.sender_id] ?? {
									displayName: `Usuario`,
								};
								
								const prevMessage = idx > 0 ? dayMessages[idx - 1] : null;
								
								// Agrupación inteligente
								const isFirstInGroup = !prevMessage || prevMessage.sender_id !== msg.sender_id;
								
								// Solo mostramos nombre si es grupo y es el primer mensaje de la ráfaga
								const isGroup = conversationType !== "direct";
								const showSenderName = isGroup && !isOwn && isFirstInGroup;

								return (
									<div 
										key={msg.id} 
										className={cn(
											"flex flex-col",
											isFirstInGroup ? "mt-3" : "mt-[2px]"
										)}
									>
										<MessageBubble
											message={msg}
											isOwn={isOwn}
											isRead={isReadByOther}
											senderName={senderInfo.displayName}
											senderAvatar={senderInfo.profilePhotoUrl}
											showSenderName={showSenderName}
											showAvatar={false} // Quitamos avatar de burbuja para ser más WhatsApp
											onReply={onReply}
										/>
									</div>
								);
							})}
						</div>
					);
				})}
				</div>
			</div>
		</div>
	);
}
