"use client";

import { useState, useMemo, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { Search, Users } from "lucide-react";

type TenantMemberProfile = {
	userId: string;
	displayName: string;
	tenantRole: string;
};

type CreateGroupModalProps = {
	isOpen: boolean;
	onClose: () => void;
	availableMembers: TenantMemberProfile[];
	/** Crea el grupo: nombre + user ids distintos al usuario actual (mín. 1) */
	onCreate: (name: string, otherMemberUserIds: string[]) => Promise<void>;
};

export function CreateGroupModal({
	isOpen,
	onClose,
	availableMembers,
	onCreate,
}: CreateGroupModalProps) {
	const [groupName, setGroupName] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [creating, setCreating] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const reset = useCallback(() => {
		setGroupName("");
		setSearchQuery("");
		setSelectedUserIds([]);
		setFormError(null);
	}, []);

	const handleClose = useCallback(() => {
		if (creating) return;
		reset();
		onClose();
	}, [creating, onClose, reset]);

	const filteredMembers = useMemo(() => {
		if (!searchQuery.trim()) return availableMembers;
		const q = searchQuery.toLowerCase();
		return availableMembers.filter(
			(m) =>
				m.displayName.toLowerCase().includes(q) || m.tenantRole.toLowerCase().includes(q)
		);
	}, [availableMembers, searchQuery]);

	const toggleUser = (userId: string) => {
		setFormError(null);
		setSelectedUserIds((prev) =>
			prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
		);
	};

	const handleSubmit = async () => {
		if (creating) return;
		const name = groupName.trim();
		if (name.length === 0) {
			setFormError("Escribe un nombre para el grupo.");
			return;
		}
		if (selectedUserIds.length === 0) {
			setFormError("Selecciona al menos un miembro del equipo.");
			return;
		}
		setCreating(true);
		setFormError(null);
		try {
			await onCreate(name, selectedUserIds);
			reset();
			onClose();
		} catch (e) {
			const msg = e instanceof Error ? e.message : "No se pudo crear el grupo.";
			setFormError(msg);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Nuevo grupo"
			size="md"
			footer={
				<>
					<button
						type="button"
						onClick={handleClose}
						disabled={creating}
						className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-smooth disabled:opacity-50"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={creating}
						className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#4FA1D8] to-[#7B5CFF] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(66,92,255,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{creating ? "Creando…" : "Crear grupo"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				<p className="text-sm text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-sans)" }}>
					Elige un nombre y los miembros. Tú entras en el grupo automáticamente.
				</p>
				<div>
					<label
						className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Nombre del grupo
					</label>
					<input
						type="text"
						value={groupName}
						onChange={(e) => {
							setGroupName(e.target.value);
							setFormError(null);
						}}
						placeholder="Ej. Reservas fin de semana"
						maxLength={120}
						className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#4FA1D8]"
					/>
				</div>
				{formError && (
					<p className="text-sm text-[#e06072]" style={{ fontFamily: "var(--font-sans)" }} role="alert">
						{formError}
					</p>
				)}
				<div>
					<label
						className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Participantes
					</label>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Buscar por nombre o rol…"
							className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#4FA1D8]"
						/>
					</div>
				</div>
				<div className="max-h-56 space-y-2 overflow-y-auto pr-1">
					{filteredMembers.length === 0 ? (
						<p className="py-4 text-center text-sm text-[var(--text-secondary)]">
							{searchQuery ? "No se encontró nadie" : "No hay más miembros en el equipo"}
						</p>
					) : (
						filteredMembers.map((member) => (
							<label
								key={member.userId}
								className={cn(
									"flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-smooth",
									selectedUserIds.includes(member.userId)
										? "border-[#4FA1D8] bg-[#4FA1D8]/10"
										: "border-white/10 hover:border-white/20"
								)}
							>
								<input
									type="checkbox"
									className="accent-[#4FA1D8]"
									checked={selectedUserIds.includes(member.userId)}
									onChange={() => toggleUser(member.userId)}
								/>
								<Avatar name={member.displayName} size="sm" className="flex-shrink-0" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium text-white">{member.displayName}</p>
									<p className="text-[11px] capitalize text-[var(--text-secondary)]">
										{member.tenantRole}
									</p>
								</div>
							</label>
						))
					)}
				</div>
				{selectedUserIds.length > 0 && (
					<p className="text-[11px] text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-mono)" }}>
						{selectedUserIds.length} {selectedUserIds.length === 1 ? "persona" : "personas"} + tú
					</p>
				)}
			</div>
		</Modal>
	);
}

export function CreateGroupListButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bf-border)]",
				"bg-[var(--bf-surface)]/80 px-3 py-2.5 text-sm font-medium text-[var(--bf-ink-50)]",
				"transition-[background-color,box-shadow,border-color,transform] duration-200",
				"hover:border-[var(--bf-primary)]/40 hover:bg-[var(--bf-surface)]",
				"active:scale-[0.99]",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bf-bg)]"
			)}
			style={{ fontFamily: "var(--font-sans)" }}
		>
			<Users className="h-4 w-4 text-[var(--bf-primary)]" aria-hidden />
			Crear nuevo grupo
		</button>
	);
}
