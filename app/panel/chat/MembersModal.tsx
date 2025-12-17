"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { Edit2, X, Check } from "lucide-react";

type Member = {
	userId: string;
	displayName: string;
	role: "member" | "admin";
	joinedAt: string;
	profilePhotoUrl?: string;
};

type MembersModalProps = {
	isOpen: boolean;
	onClose: () => void;
	members: Member[];
	conversationName: string;
	currentUserId: string | null;
	onSetNickname?: (targetUserId: string, nickname: string) => Promise<void>;
};

export function MembersModal({
	isOpen,
	onClose,
	members,
	conversationName,
	currentUserId,
	onSetNickname,
}: MembersModalProps) {
	const [editingNickname, setEditingNickname] = useState<string | null>(null);
	const [nicknameValue, setNicknameValue] = useState("");

	const handleSetNickname = async (targetUserId: string) => {
		if (!onSetNickname || !nicknameValue.trim()) {
			setEditingNickname(null);
			return;
		}
		try {
			await onSetNickname(targetUserId, nicknameValue.trim());
			setEditingNickname(null);
			setNicknameValue("");
		} catch (err) {
			console.error("[MembersModal] Error al establecer apodo:", err);
		}
	};
	return (
		<Modal isOpen={isOpen} onClose={onClose} title={`Miembros de ${conversationName}`} size="md">
			<div className="space-y-2">
				{members.length === 0 ? (
					<p className="text-sm text-[var(--text-secondary)] text-center py-4">No hay miembros en esta conversación</p>
				) : (
					members.map((member) => {
						const isCurrentUser = member.userId === currentUserId;
						return (
							<div
								key={member.userId}
								className={cn(
									"flex items-center gap-3 rounded-xl border px-3 py-2 transition-smooth",
									isCurrentUser ? "border-[#3A6DFF]/30 bg-[#3A6DFF]/5" : "border-white/10"
								)}
							>
								<Avatar
									src={member.profilePhotoUrl}
									name={member.displayName}
									size="sm"
									className="flex-shrink-0"
								/>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										{editingNickname === member.userId ? (
											<div className="flex items-center gap-1 flex-1">
												<input
													type="text"
													value={nicknameValue}
													onChange={(e) => setNicknameValue(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															void handleSetNickname(member.userId);
														} else if (e.key === "Escape") {
															setEditingNickname(null);
															setNicknameValue("");
														}
													}}
													autoFocus
													placeholder="Apodo..."
													className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#3A6DFF]"
												/>
												<button
													onClick={() => void handleSetNickname(member.userId)}
													className="p-1 rounded text-green-400 hover:bg-green-500/10"
												>
													<Check className="h-3 w-3" />
												</button>
												<button
													onClick={() => {
														setEditingNickname(null);
														setNicknameValue("");
													}}
													className="p-1 rounded text-red-400 hover:bg-red-500/10"
												>
													<X className="h-3 w-3" />
												</button>
											</div>
										) : (
											<>
												<p className="text-sm text-white font-medium truncate">
													{member.displayName}
													{isCurrentUser && (
														<span className="ml-2 text-[10px] text-[#3A6DFF] font-normal">(Tú)</span>
													)}
												</p>
												{!isCurrentUser && onSetNickname && (
													<button
														onClick={() => {
															setEditingNickname(member.userId);
															setNicknameValue("");
														}}
														className="p-1 rounded text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-smooth"
														title="Añadir apodo"
													>
														<Edit2 className="h-3 w-3" />
													</button>
												)}
											</>
										)}
									</div>
									<div className="flex items-center gap-2 mt-0.5">
										<span
											className={cn(
												"px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
												member.role === "admin"
													? "bg-[#FF7AB61a] text-[#FF7AB6]"
													: "bg-white/10 text-[var(--text-secondary)]"
											)}
										>
											{member.role === "admin" ? "Admin" : "Miembro"}
										</span>
										<span className="text-[10px] text-[var(--text-secondary)]">
											Se unió {new Date(member.joinedAt).toLocaleDateString("es-ES", {
												day: "2-digit",
												month: "short",
												year: "numeric",
											})}
										</span>
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</Modal>
	);
}

