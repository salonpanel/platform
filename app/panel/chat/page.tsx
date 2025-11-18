"use client";

import { Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { TeamChat } from "./TeamChat";

export default function ChatPage() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center py-12">
					<Spinner size="lg" />
				</div>
			}
		>
			<TeamChat />
		</Suspense>
	);
}

