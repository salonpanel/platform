"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

type MessageComposerProps = {
	disabled?: boolean;
	onSend: (message: string) => Promise<void>;
	onAttach?: () => void;
	onTyping?: () => void;
	replyTo?: {
		id: string;
		body: string;
		author_name?: string;
	} | null;
	onCancelReply?: () => void;
	typingUsers?: string[];
	membersDirectory?: Record<string, { displayName: string }>;
};

export function MessageComposer({
	disabled = false,
	onSend,
	onAttach,
	onTyping,
	replyTo,
	onCancelReply,
	typingUsers = [],
	membersDirectory = {}
}: MessageComposerProps) {
	const [value, setValue] = useState("");
	const [sending, setSending] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
		}
	}, [value]);

	const handleSend = async () => {
		const trimmed = value.trim();
		if (!trimmed || sending || disabled) return;
		setSending(true);
		try {
			await onSend(trimmed);
			setValue("");
		} catch (err) {
			console.error("[MessageComposer] Error al enviar:", err);
		} finally {
			setSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void handleSend();
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		onTyping?.();
	};

	const getTypingText = () => {
		if (typingUsers.length === 0) return null;
		if (typingUsers.length === 1) {
			const name = membersDirectory[typingUsers[0]]?.displayName || "Alguien";
			return `${name} está escribiendo...`;
		}
		if (typingUsers.length === 2) {
			const name1 = membersDirectory[typingUsers[0]]?.displayName || "Alguien";
			const name2 = membersDirectory[typingUsers[1]]?.displayName || "Alguien";
			return `${name1} y ${name2} están escribiendo...`;
		}
		return "Varios miembros están escribiendo...";
	};

	return (
		<div className="relative border-t border-[var(--bf-border)] bg-[var(--bf-bg)] p-3 md:p-4">
			{/* Indicador de escritura */}
			{typingUsers.length > 0 && (
				<div className="absolute -top-6 left-6 animate-in fade-in slide-in-from-bottom-1 duration-300">
					<p className="text-[10px] text-[var(--bf-primary)] font-bold italic tracking-tight bg-[var(--bf-surface)] px-2 py-0.5 rounded-[var(--r-full)] border border-[rgba(79,161,216,0.25)]" style={{ fontFamily: "var(--font-mono)" }}>
						{getTypingText()}
					</p>
				</div>
			)}

			{/* Preview de respuesta */}
			{replyTo && (
				<div className="mb-2 animate-in slide-in-from-bottom-2 duration-200">
					<div className="flex items-center gap-3 bg-[var(--bf-surface)] rounded-[var(--r-md)] border border-[var(--bf-border)] p-2 pr-1 select-none">
						<div className="w-1.5 self-stretch bg-[var(--bf-primary)] rounded-full" />
						<div className="flex-1 min-w-0">
							<p className="text-[10px] font-bold text-[var(--bf-primary)] uppercase tracking-tighter" style={{ fontFamily: "var(--font-mono)" }}>
								Respondiendo a {replyTo.author_name || "Usuario"}
							</p>
							<p className="text-xs text-[var(--bf-ink-400)] truncate">
								{replyTo.body}
							</p>
						</div>
						<button
							onClick={onCancelReply}
							className="p-1.5 rounded-full hover:bg-[var(--bf-bg-elev)] text-[var(--bf-ink-400)] transition-colors"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}

			<div className="flex items-end gap-2 pr-1">
				{/* Botón adjuntar */}
				<button
					onClick={onAttach}
					disabled={disabled || sending}
					className="p-2.5 rounded-full text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-surface)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					title="Adjuntar archivo"
					type="button"
				>
					<Paperclip className="h-5 w-5" />
				</button>

				{/* Textarea */}
				<div className="flex-1 relative">
					<textarea
						ref={textareaRef}
						value={value}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						placeholder="Escribe un mensaje..."
						rows={1}
						disabled={disabled || sending}
						className={cn(
							"w-full rounded-[var(--r-full)] border border-[var(--bf-border-2)] bg-[var(--bf-surface)] px-4 py-2.5 text-sm text-[var(--bf-ink-50)] placeholder:text-[var(--bf-ink-400)]",
							"focus:outline-none focus:border-[var(--bf-primary)] focus:bg-[var(--bf-surface-2)] transition-all",
							"resize-none max-h-32 overflow-y-auto scrollbar-hide disabled:opacity-50"
						)}
						style={{ fontFamily: "var(--font-sans)" }}
					/>
				</div>

				{/* Botón enviar */}
				<button
					onClick={handleSend}
					disabled={!value.trim() || sending || disabled}
					className={cn(
						"flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg",
						value.trim()
							? "bg-[var(--bf-primary)] text-[var(--bf-ink)] scale-100 opacity-100 shadow-[var(--bf-shadow-glow)]"
							: "bg-[var(--bf-surface)] text-[var(--bf-ink-400)]/40 scale-90 opacity-50 cursor-not-allowed"
					)}
				>
					<Send className={cn("h-5 w-5", value.trim() ? "translate-x-0.5 -translate-y-0.5" : "")} />
				</button>
			</div>
		</div>
	);
}
