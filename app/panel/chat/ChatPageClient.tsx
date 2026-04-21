"use client";

import { Spinner } from "@/components/ui/Spinner";
import { useChatPageData } from "@/hooks/useOptimizedData";
import type { ChatPageDataset } from "@/lib/chat-page-data";
import { TeamChatOptimized } from "./TeamChatOptimized";

type ChatPageClientProps = {
	initialData: ChatPageDataset | null;
	serverError: string | null;
	impersonateOrgId: string | null;
};

export default function ChatPageClient({
	initialData,
	serverError,
	impersonateOrgId,
}: ChatPageClientProps) {
	const { data: pageData, isLoading, error } = useChatPageData(impersonateOrgId, {
		initialData: initialData ?? undefined,
		enabled: true,
	});

	if (serverError) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-center max-w-md">
					<p className="text-red-400 mb-2">Error al cargar el chat</p>
					<p className="text-sm text-slate-400">{serverError}</p>
				</div>
			</div>
		);
	}

	if (isLoading && !pageData && !initialData) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner size="lg" />
			</div>
		);
	}

	if (error && !pageData && !initialData) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-center max-w-md">
					<p className="text-red-400 mb-2">Error al cargar el chat</p>
					<p className="text-sm text-slate-400">{error.message}</p>
				</div>
			</div>
		);
	}

	const effective = pageData ?? initialData;
	if (!effective) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner size="lg" />
			</div>
		);
	}

	return <TeamChatOptimized initialData={effective} />;
}
