"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

function MagicLinkHandlerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleMagicLink = async () => {
      try {
        // Leer el hash de la URL (solo disponible en el cliente)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        
        // También buscar en query params (por si viene desde Supabase directamente)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const type = urlParams.get("type");
        
        let accessToken = hashParams.get("access_token");
        let refreshToken = hashParams.get("refresh_token");
        let code = hashParams.get("code") || urlParams.get("code");
        
        // Si viene con token de Supabase pero sin hash, necesitamos usar el token
        // En este caso, Supabase debería haber redirigido con el hash, pero si no,
        // podemos intentar usar el token para obtener la sesión
        if (token && type === "magiclink" && !accessToken && !code) {
          console.log("Token de Supabase detectado, pero sin hash. Redirigiendo al callback...");
          // Redirigir al callback con el token para que lo procese
          const callbackUrl = new URL("/auth/callback", window.location.origin);
          urlParams.forEach((value, key) => {
            callbackUrl.searchParams.set(key, value);
          });
          window.location.href = callbackUrl.toString();
          return;
        }
        
        console.log("Magic link handler - access_token:", accessToken ? "presente" : "no presente");
        console.log("Magic link handler - code:", code ? "presente" : "no presente");
        console.log("Magic link handler - token:", token ? "presente" : "no presente");
        
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

export default function MagicLinkHandlerPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <MagicLinkHandlerContent />
    </Suspense>
  );
}





