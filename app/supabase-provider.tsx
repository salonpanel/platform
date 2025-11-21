'use client';

import { PropsWithChildren, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseContext } from "@/lib/supabase-context";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function SupabaseProvider({ children }: PropsWithChildren) {
	const [supabase] = useState<SupabaseClient>(() => getSupabaseBrowser());
	const router = useRouter();
	const pathname = usePathname();

	// Configurar listener global de cambios de autenticación
	// Esto detecta cambios de sesión en todas las pestañas del mismo dominio
	useEffect(() => {
		console.log("[SupabaseProvider] Setting up global auth state listener");

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			console.log("[SupabaseProvider] Auth state changed:", event, {
				hasSession: !!session,
				userId: session?.user?.id,
				pathname,
			});

			// Si el usuario se autentica en otra pestaña, redirigir al panel si está en login
			if (event === 'SIGNED_IN' && session) {
				// Solo redirigir si estamos en la página de login
				if (pathname === '/login' || pathname?.startsWith('/login')) {
					console.log("[SupabaseProvider] User signed in, redirecting from login to panel");
					router.replace('/panel');
				}
			}

			// Si el usuario cierra sesión, redirigir a login (excepto si ya estamos en login)
			if (event === 'SIGNED_OUT') {
				if (pathname?.startsWith('/panel')) {
					console.log("[SupabaseProvider] User signed out, redirecting to login");
					router.replace('/login');
				}
			}

			// Si el token se refresca, no hacer nada (es normal)
			if (event === 'TOKEN_REFRESHED') {
				console.log("[SupabaseProvider] Token refreshed");
			}
		});

		return () => {
			console.log("[SupabaseProvider] Cleaning up auth state listener");
			subscription.unsubscribe();
		};
	}, [supabase, router, pathname]);

	return (
		<SupabaseContext.Provider value={supabase}>
			{children}
		</SupabaseContext.Provider>
	);
}

export default SupabaseProvider;


