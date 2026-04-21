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
			if (e.key === "ArrowLeft") {
				if (canPrev) setLightboxIndex((i) => (i === null ? i : Math.max(0, i - 1)));
			}
			if (e.key === "ArrowRight") {
				if (canNext) setLightboxIndex((i) => (i === null ? i : Math.min(imageAttachments.length - 1, i + 1)));
			}
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
					"relative flex flex-col group/bubble max-w-[85%] md:max-w-[65%]", 
					isOwn ? "items-end" : "items-start"
				)}>
					<div
						className={cn(
							"relative px-2 py-1.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] transition-all duration-200",
							isOwn
								? "bg-[#005c4b] text-[#e9edef] rounded-l-lg rounded-br-lg rounded-tr-none"
								: "bg-[#202c33] text-[#e9edef] rounded-r-lg rounded-bl-lg rounded-tl-none border border-white/5"
						)}
					>
					{/* Quick Reply Button */}
					<button 
						onClick={() => onReply?.(message)}
						className={cn(
							"absolute top-0 p-1.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity bg-[#2a3942] rounded-full hover:bg-[#3b4a54] z-20 shadow-lg",
							isOwn ? "-left-10" : "-right-10"
						)}
					>
						<Reply className="h-4 w-4 text-[#8696a0]" />
					</button>

					{/* Sender Name (for groups) */}
					{!isOwn && showSenderName && (
						<p className="text-[12.5px] font-semibold text-[#53bdeb] mb-1 px-1">
							{senderName}
						</p>
					)}

					{/* Quoted Message */}
					{hasParent && (
						<div className="mb-1 p-2 rounded-md bg-[#000000]/20 border-l-[4px] border-[#53bdeb]/60 text-left overflow-hidden select-none">
							<p className="text-[12px] font-bold text-[#53bdeb] truncate">
								{message.parent_author_name || "Usuario"}
							</p>
							<p className="text-[12.5px] text-[#8696a0] line-clamp-2 leading-tight mt-0.5">
								{message.parent_message_body}
							</p>
						</div>
					)}

					{/* Attachments */}
					{hasAttachments && (
						<div className="mb-1 space-y-1">
							{message.metadata.attachments.map((attachment: any, idx: number) => (
								<div key={idx} className="rounded-md overflow-hidden bg-black/10">
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
											className="flex items-center gap-3 p-2 hover:bg-white/5 transition-colors"
										>
											<div className="bg-[#53bdeb]/20 p-1.5 rounded">
												<Paperclip className="h-4 w-4 text-[#53bdeb]" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-[12px] font-medium truncate">{attachment.name}</p>
												<p className="text-[10px] text-[#8696a0]">
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
						<p className="text-[14.2px] leading-[1.45] whitespace-pre-wrap break-words min-w-[40px] flex-1 py-0.5 px-0.5">
							{message.body}
						</p>
						
						<div className="flex items-center gap-1 shrink-0 select-none pb-0.5">
							<span className="text-[11px] text-[#8696a0] font-normal uppercase mt-1">
								{formatTimestamp(message.created_at)}
							</span>
							{isOwn && (
								<CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]/80" />
							)}
						</div>
					</div>
				</div>

					{/* Tail Decoration (Simplified) */}
					<div className={cn(
						"absolute top-0 w-2 h-2",
						isOwn 
							? "right-[-4px] border-t-[8px] border-t-[#005c4b] border-r-[8px] border-r-transparent" 
							: "left-[-4px] border-t-[8px] border-t-[#202c33] border-l-[8px] border-l-transparent"
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
						<div className="relative w-full max-h-[75dvh] overflow-hidden rounded-xl border border-white/10 bg-black/40">
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
										className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center disabled:opacity-30"
										aria-label="Anterior"
										title="Anterior"
									>
										<ChevronLeft className="h-6 w-6" />
									</button>
									<button
										type="button"
										onClick={() => canNext && setLightboxIndex((i) => (i === null ? i : i + 1))}
										disabled={!canNext}
										className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center disabled:opacity-30"
										aria-label="Siguiente"
										title="Siguiente"
									>
										<ChevronRight className="h-6 w-6" />
									</button>

									<div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 border border-white/10 px-3 py-1 text-[12px] text-white/90">
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
