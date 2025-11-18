"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function MagicLinkHandlerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient({
    options: {
      auth: {
        storageKey: "sb-magic-link-handler",
      },
    },
  });

  useEffect(() => {
    const handleMagicLink = async () => {
      try {
        // Leer el hash de la URL (solo disponible en el cliente)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const code = hashParams.get("code");
        
        console.log("Magic link handler - access_token:", accessToken ? "presente" : "no presente");
        console.log("Magic link handler - code:", code ? "presente" : "no presente");
        
        if (accessToken) {
          // Establecer sesión con access_token
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (sessionError) {
            console.error("Error al establecer sesión:", sessionError);
            router.push("/login?error=session_error");
            return;
          }
          
          // Sesión establecida, redirigir
          const redirectTo = searchParams?.get("redirect") || "/panel";
          console.log("Sesión establecida, redirigiendo a:", redirectTo);
          router.push(redirectTo);
          return;
        } else if (code) {
          // Si hay código, intercambiarlo por sesión
          const { data, error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (codeError || !data.session) {
            console.error("Error al intercambiar código:", codeError);
            router.push("/login?error=code_error");
            return;
          }
          
          // Sesión establecida, redirigir
          const redirectTo = searchParams?.get("redirect") || "/panel";
          router.push(redirectTo);
          return;
        } else {
          // No hay token ni código
          console.error("No se encontró access_token ni code en el hash");
          router.push("/login?error=no_token");
          return;
        }
      } catch (err: any) {
        console.error("Error inesperado en magic link handler:", err);
        router.push("/login?error=unexpected");
      }
    };

    handleMagicLink();
  }, [router, searchParams, supabase]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="text-gray-600">Iniciando sesión...</p>
      </div>
    </div>
  );
}





