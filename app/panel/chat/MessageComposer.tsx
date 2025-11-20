"use client";

import { useState } from "react";
import { Send } from "lucide-react";

type MessageComposerProps = {
	disabled?: boolean;
	onSend: (message: string) => Promise<void>;
};

export function MessageComposer({ disabled = false, onSend }: MessageComposerProps) {
	const [value, setValue] = useState("");
	const [sending, setSending] = useState(false);

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

	return (
		<div className="border-t border-white/5 p-4">
			<div className="flex items-end gap-2">
				<textarea
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Escribe un mensaje..."
					rows={1}
					disabled={disabled || sending}
					className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#3A6DFF] resize-none max-h-32 overflow-y-auto scrollbar-hide disabled:opacity-50"
				/>
				<button
					onClick={handleSend}
					disabled={!value.trim() || sending || disabled}
					className="p-2 rounded-lg bg-gradient-to-r from-[#3A6DFF] to-[#7B5CFF] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-smooth"
				>
					<Send className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}



