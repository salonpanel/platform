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
	const isDevelopment = process.env.NODE_ENV === 'development';

	// Configurar listener global de cambios de autenticación
	// Esto detecta cambios de sesión en todas las pestañas del mismo dominio
	// CRÍTICO: Este listener se dispara cuando:
	// - El usuario se autentica en cualquier pestaña (SIGNED_IN)
	// - El usuario cierra sesión en cualquier pestaña (SIGNED_OUT)
	// - El token se refresca automáticamente (TOKEN_REFRESHED)
	// - La sesión cambia en otra pestaña (gracias a multiTab)
	useEffect(() => {
		if (isDevelopment) {
			console.log("[SupabaseProvider] Setting up global auth state listener");
		}

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			if (isDevelopment) {
				console.log("[SupabaseProvider] Auth state changed:", event, {
					hasSession: !!session,
					userId: session?.user?.id,
					email: session?.user?.email,
					pathname,
				});
			}

			// Log adicional para depuración: verificar sesión directamente después del evento
			if (isDevelopment) {
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
			}

			// Si el usuario se autentica (en esta pestaña o en otra)
			if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
				const currentPath = window.location.pathname;
				if (isDevelopment) {
					console.log("[SupabaseProvider] User signed in or token refreshed, session active", {
						event,
						pathname,
						currentPath,
						userId: session.user?.id,
						isOnLogin: pathname === '/login' || pathname === '/login/verify-code',
						isOnLoginWindow: currentPath === '/login' || currentPath === '/login/verify-code',
					});
				}

				// IMPORTANTE: Redirigir inmediatamente si estamos en login y hay sesión
				// No esperar delay porque las cookies ya están establecidas por el servidor
				const isOnLoginPage = pathname === '/login' || pathname === '/login/verify-code' ||
					currentPath === '/login' || currentPath === '/login/verify-code';
				const isOnProtectedRoute = currentPath.startsWith('/panel') || currentPath.startsWith('/admin');

				if (isOnLoginPage && !isOnProtectedRoute) {
					// Obtener redirect de query params si existe
					const searchParams = new URLSearchParams(window.location.search);
					const redirectParam = searchParams.get('redirect');
					const redirectPath = redirectParam || '/panel';

					if (isDevelopment) {
						console.log("[SupabaseProvider] Redirecting immediately from", currentPath, "to:", redirectPath, {
							event,
							hasSession: !!session,
							userId: session?.user?.id,
						});
					}

					// Redirigir inmediatamente sin delay
					// Usar window.location para forzar una navegación completa y asegurar que la sesión se persista
					window.location.href = redirectPath;
					return; // Salir temprano para evitar procesamiento adicional
				} else if (isDevelopment) {
					console.log("[SupabaseProvider] Not redirecting:", {
						isOnLoginPage,
						isOnProtectedRoute,
						currentPath,
						pathname,
					});
				}
			}

			// Si el usuario cierra sesión (en esta pestaña o en otra)
			if (event === 'SIGNED_OUT') {
				if (isDevelopment) {
					console.log("[SupabaseProvider] User signed out");
				}

				// Redirigir a login si estamos en una ruta protegida
				// No redirigir si ya estamos en login o en rutas públicas
				if (pathname?.startsWith('/panel') || pathname?.startsWith('/admin')) {
					if (isDevelopment) {
						console.log("[SupabaseProvider] Redirecting to login from protected route");
					}
					router.replace('/login');
				}
			}

			// TOKEN_REFRESHED ahora se maneja arriba junto con SIGNED_IN

			// Si el usuario cambia (raro, pero puede pasar con impersonación)
			if (event === 'USER_UPDATED' && isDevelopment) {
				console.log("[SupabaseProvider] User data updated");
			}
		});

		return () => {
			if (isDevelopment) {
				console.log("[SupabaseProvider] Cleaning up auth state listener");
			}
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


