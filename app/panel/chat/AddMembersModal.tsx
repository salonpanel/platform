"use client";

import { useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type TenantMemberProfile = {
	userId: string;
	displayName: string;
	tenantRole: string;
};

type AddMembersModalProps = {
	isOpen: boolean;
	onClose: () => void;
	conversationId: string;
	existingMemberIds: string[];
	availableMembers: TenantMemberProfile[];
	onAddMembers: (userIds: string[]) => Promise<void>;
};

export function AddMembersModal({
	isOpen,
	onClose,
	conversationId,
	existingMemberIds,
	availableMembers,
	onAddMembers,
}: AddMembersModalProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [adding, setAdding] = useState(false);

	// Filtrar miembros disponibles (excluir los que ya están en la conversación)
	const filteredMembers = useMemo(() => {
		const available = availableMembers.filter((m) => !existingMemberIds.includes(m.userId));
		if (!searchQuery.trim()) return available;
		const query = searchQuery.toLowerCase();
		return available.filter(
			(m) => m.displayName.toLowerCase().includes(query) || m.tenantRole.toLowerCase().includes(query)
		);
	}, [availableMembers, existingMemberIds, searchQuery]);

	const handleToggleUser = (userId: string) => {
		setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
	};

	const handleAdd = async () => {
		if (selectedUserIds.length === 0 || adding) return;
		setAdding(true);
		try {
			await onAddMembers(selectedUserIds);
			setSelectedUserIds([]);
			setSearchQuery("");
			onClose();
		} catch (err) {
			console.error("[AddMembersModal] Error al añadir miembros:", err);
		} finally {
			setAdding(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={() => {
				setSelectedUserIds([]);
				setSearchQuery("");
				onClose();
			}}
			title="Añadir miembros al grupo"
			size="md"
			footer={
				<>
					<button
						onClick={() => {
							setSelectedUserIds([]);
							setSearchQuery("");
							onClose();
						}}
						className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-smooth"
					>
						Cancelar
					</button>
					<button
						onClick={handleAdd}
						disabled={selectedUserIds.length === 0 || adding}
						className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#3A6DFF] to-[#7B5CFF] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(66,92,255,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{adding ? "Añadiendo..." : `Añadir ${selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ""}`}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				{/* Búsqueda */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Buscar por nombre o rol..."
						className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#3A6DFF]"
					/>
				</div>

				{/* Lista de miembros */}
				<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
					{filteredMembers.length === 0 ? (
						<p className="text-sm text-[var(--text-secondary)] text-center py-4">
							{searchQuery ? "No se encontraron miembros" : "No hay miembros disponibles para añadir"}
						</p>
					) : (
						filteredMembers.map((member) => (
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
									type="checkbox"
									className="accent-[#3A6DFF]"
									checked={selectedUserIds.includes(member.userId)}
									onChange={() => handleToggleUser(member.userId)}
								/>
								<Avatar name={member.displayName} size="sm" className="flex-shrink-0" />
								<div className="flex-1 min-w-0">
									<p className="text-sm text-white font-medium truncate">{member.displayName}</p>
									<p className="text-[11px] text-[var(--text-secondary)] capitalize">{member.tenantRole}</p>
								</div>
							</label>
						))
					)}
				</div>
			</div>
		</Modal>
	);
}



