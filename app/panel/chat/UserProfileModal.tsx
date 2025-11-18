"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type UserProfileModalProps = {
	isOpen: boolean;
	onClose: () => void;
	currentUserId: string;
	tenantId: string;
	onProfileUpdated?: () => void;
};

export function UserProfileModal({
	isOpen,
	onClose,
	currentUserId,
	tenantId,
	onProfileUpdated,
}: UserProfileModalProps) {
	const supabase = getSupabaseBrowser();
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [form, setForm] = useState({
		displayName: "",
		bio: "",
		profilePhotoUrl: "",
	});

	useEffect(() => {
		if (isOpen && currentUserId) {
			void loadProfile();
		}
	}, [isOpen, currentUserId]);

	const loadProfile = async () => {
		setLoading(true);
		setError(null);
		try {
			const { data, error: fetchError } = await supabase
				.from("profiles")
				.select("display_name, bio, profile_photo_url")
				.eq("user_id", currentUserId)
				.single();

			if (fetchError && fetchError.code !== "PGRST116") {
				throw fetchError;
			}

			setForm({
				displayName: data?.display_name ?? "",
				bio: data?.bio ?? "",
				profilePhotoUrl: data?.profile_photo_url ?? "",
			});
		} catch (err) {
			console.error("[UserProfileModal] Error al cargar perfil:", err);
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		setSaving(true);
		setError(null);
		try {
			const { error: updateError } = await supabase
				.from("profiles")
				.upsert(
					{
						user_id: currentUserId,
						display_name: form.displayName.trim() || null,
						bio: form.bio.trim() || null,
						profile_photo_url: form.profilePhotoUrl.trim() || null,
					},
					{
						onConflict: "user_id",
					}
				);

			if (updateError) throw updateError;

			onProfileUpdated?.();
			onClose();
		} catch (err) {
			console.error("[UserProfileModal] Error al guardar perfil:", err);
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Mi perfil"
			size="md"
			footer={
				<>
					<button
						onClick={onClose}
						className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-smooth"
					>
						Cancelar
					</button>
					<button
						onClick={handleSave}
						disabled={saving}
						className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#3A6DFF] to-[#7B5CFF] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(66,92,255,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? "Guardando..." : "Guardar"}
					</button>
				</>
			}
		>
			{loading ? (
				<div className="flex items-center justify-center py-8">
					<Spinner />
				</div>
			) : (
				<div className="space-y-4">
					{error && (
						<div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
					)}

					{/* Avatar y foto de perfil */}
					<div className="flex flex-col items-center gap-4">
						<Avatar
							src={form.profilePhotoUrl || undefined}
							name={form.displayName || "Usuario"}
							size="xl"
						/>
						<div className="w-full">
							<label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">
								URL de foto de perfil
							</label>
							<input
								type="url"
								value={form.profilePhotoUrl}
								onChange={(e) => setForm((prev) => ({ ...prev, profilePhotoUrl: e.target.value }))}
								placeholder="https://ejemplo.com/foto.jpg"
								className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#3A6DFF]"
							/>
							<p className="text-[11px] text-[var(--text-secondary)] mt-1">
								Pega la URL de tu foto de perfil (por ahora solo URLs, subida de archivos próximamente)
							</p>
						</div>
					</div>

					{/* Nombre */}
					<div>
						<label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">
							Nombre a mostrar
						</label>
						<input
							type="text"
							value={form.displayName}
							onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
							placeholder="Tu nombre"
							className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#3A6DFF]"
						/>
						<p className="text-[11px] text-[var(--text-secondary)] mt-1">
							Este nombre aparecerá en los chats y en el panel
						</p>
					</div>

					{/* Bio */}
					<div>
						<label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">
							Biografía (opcional)
						</label>
						<textarea
							value={form.bio}
							onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
							placeholder="Cuéntanos sobre ti..."
							rows={3}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#3A6DFF] resize-none"
						/>
					</div>
				</div>
			)}
		</Modal>
	);
}

