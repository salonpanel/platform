'use client';

import { PropsWithChildren, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseContext } from "@/lib/supabase-context";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function SupabaseProvider({ children }: PropsWithChildren) {
	const [supabase] = useState<SupabaseClient>(() => getSupabaseBrowser());

	return (
		<SupabaseContext.Provider value={supabase}>
			{children}
		</SupabaseContext.Provider>
	);
}

export default SupabaseProvider;


