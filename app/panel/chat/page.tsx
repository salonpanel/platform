"use client";

import { Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useSearchParams } from "next/navigation";
import { useChatPageData } from "@/hooks/useOptimizedData";
import { TeamChatOptimized } from "./TeamChatOptimized";

export default function ChatPage() {
	const searchParams = useSearchParams();
	const impersonateOrgId = searchParams?.get("impersonate") || null;

	// 🔥 Hook optimizado que obtiene tenant + conversaciones + miembros en UNA llamada
	const { data: pageData, isLoading, error } = useChatPageData(impersonateOrgId);

	// Mostrar loading mientras se cargan datos optimizados
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner size="lg" />
			</div>
		);
	}

	// Mostrar error si ocurre
	if (error) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-center max-w-md">
					<p className="text-red-400 mb-2">Error al cargar el chat</p>
					<p className="text-sm text-slate-400">{error.message}</p>
				</div>
			</div>
		);
	}

	// Si no hay datos, mostrar loading
	if (!pageData) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner size="lg" />
			</div>
		);
	}

	// Renderizar componente optimizado con datos precargados
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center py-12">
					<Spinner size="lg" />
				</div>
			}
		>
			<TeamChatOptimized
				initialData={pageData}
				impersonateOrgId={impersonateOrgId}
			/>
		</Suspense>
	);
}

