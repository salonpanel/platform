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
	// CRÍTICO: Este listener se dispara cuando:
	// - El usuario se autentica en cualquier pestaña (SIGNED_IN)
	// - El usuario cierra sesión en cualquier pestaña (SIGNED_OUT)
	// - El token se refresca automáticamente (TOKEN_REFRESHED)
	// - La sesión cambia en otra pestaña (gracias a multiTab)
	useEffect(() => {
		console.log("[SupabaseProvider] Setting up global auth state listener");

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log("[SupabaseProvider] Auth state changed:", event, {
				hasSession: !!session,
				userId: session?.user?.id,
				email: session?.user?.email,
				pathname,
			});

			// Log adicional para depuración: verificar sesión directamente después del evento
			try {
				const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
				console.log("[SupabaseProvider] getSession() after event:", {
					hasSession: !!currentSession,
					userId: currentSession?.user?.id,
					hasError: !!sessionError,
					errorMessage: sessionError?.message,
				});
			} catch (err) {
				console.warn("[SupabaseProvider] Error calling getSession() after event:", err);
			}

			// Si el usuario se autentica (en esta pestaña o en otra)
			if (event === 'SIGNED_IN' && session) {
				console.log("[SupabaseProvider] User signed in, session active", {
					pathname,
					userId: session.user?.id,
				});
				
				// IMPORTANTE: Esperar un momento antes de redirigir para asegurar que las cookies se establezcan
				// Esto es crítico porque el servidor necesita leer las cookies en la siguiente request
				// NO redirigir desde aquí si estamos en verify-code, ya que esa página maneja su propia redirección
				// Esto evita múltiples redirecciones compitiendo
				if (pathname === '/login' && !pathname.startsWith('/login/verify-code')) {
					setTimeout(() => {
						// Solo redirigir desde /login (no desde verify-code)
						if (!window.location.pathname.startsWith('/panel') &&
						    !window.location.pathname.startsWith('/admin')) {
							// Obtener redirect de query params si existe
							const searchParams = new URLSearchParams(window.location.search);
							const redirectParam = searchParams.get('redirect');
							const redirectPath = redirectParam || '/panel';
							
							console.log("[SupabaseProvider] Redirecting from login to:", redirectPath);
							// Usar window.location para forzar una navegación completa y asegurar que la sesión se persista
							window.location.href = redirectPath;
						}
					}, 500); // Delay aumentado para asegurar que las cookies se establezcan
				}
			}

			// Si el usuario cierra sesión (en esta pestaña o en otra)
			if (event === 'SIGNED_OUT') {
				console.log("[SupabaseProvider] User signed out");
				
				// Redirigir a login si estamos en una ruta protegida
				// No redirigir si ya estamos en login o en rutas públicas
				if (pathname?.startsWith('/panel') || pathname?.startsWith('/admin')) {
					console.log("[SupabaseProvider] Redirecting to login from protected route");
					router.replace('/login');
				}
			}

			// Si el token se refresca, no hacer nada (es normal y automático)
			if (event === 'TOKEN_REFRESHED') {
				console.log("[SupabaseProvider] Token refreshed successfully");
			}

			// Si el usuario cambia (raro, pero puede pasar con impersonación)
			if (event === 'USER_UPDATED') {
				console.log("[SupabaseProvider] User data updated");
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


