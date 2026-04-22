"use client";

import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { CheckCheck, Reply, Paperclip, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type MessageBubbleProps = {
	message: {
		id: string;
		sender_id: string;
		body: string;
		created_at: string;
		parent_message_id?: string | null;
		parent_message_body?: string | null;
		parent_author_name?: string | null;
		metadata?: any;
	};
	isOwn: boolean;
	isRead?: boolean;
	senderName: string;
	senderAvatar?: string;
	showSenderName: boolean;
	showAvatar: boolean;
	onReply?: (message: any) => void;
};

function formatTimestamp(iso: string): string {
	const date = new Date(iso);
	return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
	message,
	isOwn,
	isRead = false,
	senderName,
	showSenderName,
	onReply,
}: MessageBubbleProps) {
	const hasParent = !!message.parent_message_id;
	const hasAttachments = (message.metadata?.attachments?.length ?? 0) > 0;
	const imageAttachments = useMemo(() => {
		const all = (message.metadata?.attachments ?? []) as Array<Record<string, unknown>>;
		return all
			.filter((a) => typeof a.url === "string" && typeof a.type === "string" && a.type.startsWith("image/"))
			.map((a) => ({
				url: a.url as string,
				name: (typeof a.name === "string" && a.name) ? (a.name as string) : "Imagen",
			}));
	}, [message.metadata?.attachments]);

	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
	const lightboxOpen = lightboxIndex !== null;
	const currentImage = lightboxIndex !== null ? imageAttachments[lightboxIndex] : null;
	const canPrev = lightboxIndex !== null && lightboxIndex > 0;
	const canNext = lightboxIndex !== null && lightboxIndex < imageAttachments.length - 1;

	useEffect(() => {
		if (!lightboxOpen) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft" && canPrev) setLightboxIndex((i) => (i === null ? i : Math.max(0, i - 1)));
			if (e.key === "ArrowRight" && canNext) setLightboxIndex((i) => (i === null ? i : Math.min(imageAttachments.length - 1, i + 1)));
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [lightboxOpen, canPrev, canNext, imageAttachments.length]);

	return (
		<>
			<div
				className={cn(
					"group flex w-full mb-[2px] px-4 md:px-12",
					isOwn ? "justify-end" : "justify-start"
				)}
			>
				<div className={cn(
					"relative flex min-w-0 max-w-[85%] flex-col group/bubble md:max-w-[65%]",
					isOwn ? "items-end" : "items-start"
				)}>
					<div
						className={cn(
							"relative px-2 py-1.5 shadow-[var(--bf-shadow-card)] transition-all duration-200",
							isOwn
								// Own: cyan brand — bg-primary con borde muy sutil, texto ink
								? "bg-[var(--bf-primary)] text-[var(--bf-ink)] rounded-l-[var(--r-md)] rounded-br-[var(--r-md)] rounded-tr-none"
								// Other: surface-2 con borde, texto ink-50
								: "bg-[var(--bf-surface-2)] text-[var(--bf-ink-50)] rounded-r-[var(--r-md)] rounded-bl-[var(--r-md)] rounded-tl-none border border-[var(--bf-border)]"
						)}
					>
						{/* Quick Reply Button */}
						<button
							onClick={() => onReply?.(message)}
							className={cn(
								"absolute top-0 p-1.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity bg-[var(--bf-surface)] rounded-full hover:bg-[var(--bf-surface-2)] z-20 shadow-lg border border-[var(--bf-border)]",
								isOwn ? "-left-10" : "-right-10"
							)}
						>
							<Reply className="h-4 w-4 text-[var(--bf-ink-400)]" />
						</button>

						{/* Sender Name (for groups) */}
						{!isOwn && showSenderName && (
							<p className="text-[12.5px] font-semibold text-[var(--bf-primary)] mb-1 px-1">
								{senderName}
							</p>
						)}

						{/* Quoted Message */}
						{hasParent && (
							<div className={cn(
								"mb-1 p-2 rounded-[var(--r-sm)] border-l-[4px] text-left overflow-hidden select-none",
								isOwn
									? "bg-[rgba(5,7,10,0.2)] border-[var(--bf-ink)]/40"
									: "bg-[var(--bf-bg-elev)] border-[var(--bf-primary)]/60"
							)}>
								<p className={cn("text-[12px] font-bold truncate", isOwn ? "text-[var(--bf-ink)]/80" : "text-[var(--bf-primary)]")}>
									{message.parent_author_name || "Usuario"}
								</p>
								<p className={cn("text-[12.5px] line-clamp-2 leading-tight mt-0.5", isOwn ? "text-[var(--bf-ink)]/70" : "text-[var(--bf-ink-400)]")}>
									{message.parent_message_body}
								</p>
							</div>
						)}

						{/* Attachments */}
						{hasAttachments && (
							<div className="mb-1 space-y-1">
								{message.metadata.attachments.map((attachment: any, idx: number) => (
									<div key={idx} className="rounded-[var(--r-md)] overflow-hidden bg-[rgba(0,0,0,0.15)]">
										{attachment.type?.startsWith("image/") ? (
											<button
												type="button"
												onClick={() => {
													const url = String(attachment.url);
													const idx = imageAttachments.findIndex((img) => img.url === url);
													setLightboxIndex(idx >= 0 ? idx : 0);
												}}
												className="relative group/img block cursor-zoom-in max-w-sm"
												title="Ver imagen"
											>
												<img
													src={attachment.url}
													alt={attachment.name}
													loading="lazy"
													className="w-full max-h-[320px] object-cover"
												/>
												<div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors" />
											</button>
										) : (
											<a
												href={attachment.url}
												target="_blank"
												rel="noopener noreferrer"
												className={cn("flex items-center gap-3 p-2 transition-colors", isOwn ? "hover:bg-[rgba(5,7,10,0.15)]" : "hover:bg-[var(--bf-bg-elev)]")}
											>
												<div className={cn("p-1.5 rounded-[var(--r-sm)]", isOwn ? "bg-[rgba(5,7,10,0.2)]" : "bg-[rgba(79,161,216,0.15)]")}>
													<Paperclip className={cn("h-4 w-4", isOwn ? "text-[var(--bf-ink)]" : "text-[var(--bf-primary)]")} />
												</div>
												<div className="flex-1 min-w-0">
													<p className="text-[12px] font-medium truncate">{attachment.name}</p>
													<p className={cn("text-[10px]", isOwn ? "text-[var(--bf-ink)]/60" : "text-[var(--bf-ink-400)]")}>
														{(attachment.size / 1024).toFixed(1)} KB
													</p>
												</div>
											</a>
										)}
									</div>
								))}
							</div>
						)}

						{/* Message Content + Metadata */}
						<div className="flex flex-wrap items-end justify-end gap-x-2">
							<p className="min-w-0 flex-1 whitespace-pre-wrap break-words px-0.5 py-0.5 text-[14.2px] leading-[1.45] [overflow-wrap:anywhere]">
								{message.body}
							</p>

							<div className="flex items-center gap-1 shrink-0 select-none pb-0.5">
								<span className={cn("text-[11px] font-normal mt-1", isOwn ? "text-[var(--bf-ink)]/70" : "text-[var(--bf-ink-400)]")} style={{ fontFamily: "var(--font-mono)" }}>
									{formatTimestamp(message.created_at)}
								</span>
								{isOwn && (
									<CheckCheck
										className={cn(
											"h-3.5 w-3.5",
											isRead ? "text-[var(--bf-ink)]/90" : "text-[var(--bf-ink)]/50"
										)}
										aria-label={isRead ? "Visto" : "Enviado"}
									/>
								)}
							</div>
						</div>
					</div>

					{/* Tail */}
					<div className={cn(
						"absolute top-0 w-2 h-2",
						isOwn
							? "right-[-4px] border-t-[8px] border-t-[var(--bf-primary)] border-r-[8px] border-r-transparent"
							: "left-[-4px] border-t-[8px] border-t-[var(--bf-surface-2)] border-l-[8px] border-l-transparent"
					)} />
				</div>
			</div>

			<Modal
				isOpen={lightboxOpen}
				onClose={() => setLightboxIndex(null)}
				title={currentImage?.name ?? "Imagen"}
				size="xl"
			>
				<div className="p-4">
					{currentImage && (
						<div className="relative w-full max-h-[75dvh] overflow-hidden rounded-[var(--r-xl)] border border-[var(--bf-border)] bg-[var(--bf-bg)]">
							<img
								src={currentImage.url}
								alt={currentImage.name}
								className="w-full h-full object-contain"
							/>
							{imageAttachments.length > 1 && (
								<>
									<button
										type="button"
										onClick={() => canPrev && setLightboxIndex((i) => (i === null ? i : i - 1))}
										disabled={!canPrev}
										className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[var(--bf-bg-elev)] border border-[var(--bf-border)] text-[var(--bf-ink-50)] flex items-center justify-center disabled:opacity-30"
									>
										<ChevronLeft className="h-6 w-6" />
									</button>
									<button
										type="button"
										onClick={() => canNext && setLightboxIndex((i) => (i === null ? i : i + 1))}
										disabled={!canNext}
										className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[var(--bf-bg-elev)] border border-[var(--bf-border)] text-[var(--bf-ink-50)] flex items-center justify-center disabled:opacity-30"
									>
										<ChevronRight className="h-6 w-6" />
									</button>
									<div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-[var(--r-full)] bg-[var(--bf-bg-elev)] border border-[var(--bf-border)] px-3 py-1 text-[12px] text-[var(--bf-ink-200)]" style={{ fontFamily: "var(--font-mono)" }}>
										{(lightboxIndex ?? 0) + 1} / {imageAttachments.length}
									</div>
								</>
							)}
						</div>
					)}
				</div>
			</Modal>
		</>
	);
}
