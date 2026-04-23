"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { ArchiveRestore } from "lucide-react";

type ConvRow = {
	id: string;
	type: "direct" | "group" | "all";
	name: string;
	lastMessageBody: string | null;
	lastMessageAt: string | null;
	unreadCount: number;
	lastMessageSenderId: string | null;
	lastMessageSenderName: string | null;
	targetUserId: string | null;
};

type MemberDir = Record<string, { displayName: string }>;

function readSupabaseClientError(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (err && typeof err === "object") {
		const o = err as Record<string, unknown>;
		if (typeof o.message === "string" && o.message.length > 0) return o.message;
	}
	if (typeof err === "string") return err;
	return "Error desconocido";
}

function formatListConversationTime(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const dayMs = 24 * 60 * 60 * 1000;
	if (diffMs < dayMs) {
		return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
	}
	const days = Math.max(1, Math.floor(diffMs / dayMs));
	if (days === 1) return "Hace 1 día";
	return `Hace ${days} días`;
}

function previewLine(
	conv: ConvRow,
	currentUserId: string | null,
	membersDirectory?: MemberDir
): string {
	const raw = conv.lastMessageBody?.trim() ?? "";
	if (!raw) return "Sin mensajes";
	if (conv.type === "direct") return raw;
	const sid = conv.lastMessageSenderId;
	if (sid && currentUserId && sid === currentUserId) return `Tú: ${raw}`;
	const sender =
		conv.lastMessageSenderName?.trim() ||
		(sid && membersDirectory?.[sid]?.displayName) ||
		"";
	const label = sender || "Grupo";
	return `${label}: ${raw}`;
}

type ArchivedChatsModalProps = {
	isOpen: boolean;
	onClose: () => void;
	tenantId: string | null;
	currentUserId: string | null;
	membersDirectory: MemberDir;
	/** Tras desarchivar, refrescar lista principal */
	onDidUnarchive: () => void | Promise<void>;
};

export function ArchivedChatsModal({
	isOpen,
	onClose,
	tenantId,
	currentUserId,
	membersDirectory,
	onDidUnarchive,
}: ArchivedChatsModalProps) {
	const supabase = getSupabaseBrowser();
	const [loading, setLoading] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [rows, setRows] = useState<ConvRow[]>([]);

	const loadArchived = useCallback(async () => {
		if (!tenantId || !currentUserId) {
			setRows([]);
			setLoading(false);
			setError(null);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const { data, error: rpcError } = await supabase.rpc("get_user_archived_conversations", {
				p_user_id: currentUserId,
				p_tenant_id: tenantId,
			});
			if (rpcError) throw rpcError;
			const list = (data || []).map((conv: Record<string, unknown>) => {
				const targetUserId = (conv.target_user_id as string) ?? null;
				let name = (conv.name as string) || "";
				if (conv.type === "direct" && targetUserId && membersDirectory[targetUserId]) {
					name = membersDirectory[targetUserId].displayName;
				}
				return {
					id: conv.id as string,
					type: conv.type as ConvRow["type"],
					name: name || "Chat",
					lastMessageBody: (conv.last_message_body as string) ?? null,
					lastMessageAt: (conv.last_message_at as string) ?? null,
					unreadCount: (conv.unread_count as number) || 0,
					lastMessageSenderId: (conv.last_message_sender_id as string) ?? null,
					lastMessageSenderName: (conv.last_message_sender_name as string) ?? null,
					targetUserId,
				};
			});
			list.sort((a: ConvRow, b: ConvRow) => {
				const ta = a.lastMessageAt ?? "";
				const tb = b.lastMessageAt ?? "";
				return tb.localeCompare(ta);
			});
			setRows(list);
		} catch (e) {
			setError(readSupabaseClientError(e));
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, [supabase, tenantId, currentUserId, membersDirectory]);

	useEffect(() => {
		if (!isOpen) return;
		void loadArchived();
	}, [isOpen, loadArchived]);

	const handleUnarchive = async (conversationId: string) => {
		setBusyId(conversationId);
		setError(null);
		try {
			const { data, error: rpcError } = await supabase.rpc(
				"user_unarchive_team_conversation",
				{ p_conversation_id: conversationId }
			);
			if (rpcError) throw rpcError;
			if (!data) {
				setError("No se pudo restaurar el chat.");
				return;
			}
			setRows((prev) => prev.filter((r) => r.id !== conversationId));
			await onDidUnarchive();
		} catch (e) {
			setError(readSupabaseClientError(e));
		} finally {
			setBusyId(null);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Chats archivados" size="md">
			<div className="flex min-h-[200px] flex-col gap-3">
				{error && (
					<p className="text-sm text-[var(--bf-danger)]" style={{ fontFamily: "var(--font-sans)" }}>
						{error}
					</p>
				)}
				{loading ? (
					<div className="flex flex-1 items-center justify-center py-12">
						<Spinner size="lg" />
					</div>
				) : rows.length === 0 ? (
					<p
						className="py-8 text-center text-sm text-[var(--bf-ink-400)]"
						style={{ fontFamily: "var(--font-sans)" }}
					>
						No tienes chats archivados.
					</p>
				) : (
					<ul className="max-h-[min(60dvh,420px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
						{rows.map((conv) => {
							const busy = busyId === conv.id;
							return (
								<li key={conv.id}>
									<button
										type="button"
										disabled={busy || !!busyId}
										onClick={() => void handleUnarchive(conv.id)}
										className={cn(
											"flex w-full items-center gap-3 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)]/80 px-3 py-2.5 text-left",
											"transition-[background-color,border-color,transform] duration-200 hover:border-[var(--bf-primary)]/35 hover:bg-[var(--bf-surface)]/90",
											"focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bf-bg)]",
											"active:scale-[0.99] disabled:opacity-60"
										)}
									>
										<Avatar size="lg" name={conv.name} className="flex-shrink-0 border-none shadow-none" />
										<div className="min-w-0 flex-1">
											<div className="flex items-baseline justify-between gap-2">
												<span
													className="truncate text-[15px] font-medium text-[var(--bf-ink-50)]"
													style={{ fontFamily: "var(--font-sans)" }}
												>
													{conv.name}
												</span>
												{conv.lastMessageAt && (
													<span
														className="shrink-0 text-[11px] text-[var(--bf-ink-400)] tabular-nums"
														style={{ fontFamily: "var(--font-mono)" }}
													>
														{formatListConversationTime(conv.lastMessageAt)}
													</span>
												)}
											</div>
											<p
												className="truncate text-[13px] text-[var(--bf-ink-400)]"
												style={{ fontFamily: "var(--font-sans)" }}
											>
												{previewLine(conv, currentUserId, membersDirectory)}
											</p>
											<p
												className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[var(--bf-primary)]"
												style={{ fontFamily: "var(--font-sans)" }}
											>
												<ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
												{busy ? "Restaurando…" : "Toca para desarchivar"}
											</p>
										</div>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</Modal>
	);
}
