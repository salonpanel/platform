import { getInitialChatPageData } from "@/lib/chat-page-data";
import ChatPageClient from "./ChatPageClient";

export default async function ChatPage({
	searchParams,
}: {
	searchParams?: Promise<{ impersonate?: string }>;
}) {
	const resolved = (await searchParams) ?? {};
	const impersonateOrgId = resolved.impersonate ?? null;

	const result = await getInitialChatPageData(impersonateOrgId);

	return (
		<ChatPageClient
			initialData={result.data}
			serverError={result.error}
			impersonateOrgId={impersonateOrgId}
		/>
	);
}
