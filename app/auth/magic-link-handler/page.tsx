"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MagicLinkHandlerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleMagicLink = async () => {
      try {
        // Leer parámetros de la URL
        const requestId = searchParams?.get("request_id");
        const secretToken = searchParams?.get("token");
        const code = searchParams?.get("code");
        const type = searchParams?.get("type");
        
        // También buscar en el hash (por si Supabase redirige con tokens en hash)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashCode = hashParams.get("code") || code;

        console.log("[MagicLinkHandler] Params:", {
          requestId: requestId || null,
          secretToken: secretToken ? "present" : "missing",
          hasCode: !!hashCode,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type: type || null,
        });

        // Validar que tenemos request_id y token
        if (!requestId || !secretToken) {
          console.error("[MagicLinkHandler] Missing request_id or token");
          setStatus("error");
          setErrorMessage("Enlace inválido: faltan parámetros requeridos");
          return;
        }

        // Si no tenemos code ni tokens, error
        if (!hashCode && !accessToken) {
          console.error("[MagicLinkHandler] Missing code or tokens");
          setStatus("error");
          setErrorMessage("Enlace inválido: no se encontraron tokens de autenticación");
          return;
        }

        // Llamar al endpoint de aprobación
        console.log("[MagicLinkHandler] Calling /api/auth/login/approve...");
        const response = await fetch("/api/auth/login/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            secretToken,
            code: hashCode,
            accessToken,
            refreshToken,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
          console.error("[MagicLinkHandler] Approve API error:", errorData);
          setStatus("error");
          setErrorMessage(errorData.error || "Error al aprobar el login");
          return;
        }

        console.log("[MagicLinkHandler] Login approved successfully");
        setStatus("success");
      } catch (err: any) {
        console.error("[MagicLinkHandler] Unexpected error:", err);
        setStatus("error");
        setErrorMessage(err?.message || "Error inesperado");
      }
    };

    handleMagicLink();
  }, [searchParams, router]);

  if (status === "processing") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">Procesando aprobación de login...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-4 text-red-600">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{errorMessage || "Ocurrió un error al procesar el login"}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  // Success
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-4 text-green-600">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Login aprobado</h2>
        <p className="text-gray-600 mb-4">
          El login ha sido aprobado correctamente. Ya puedes volver a tu ordenador.
        </p>
        <p className="text-sm text-gray-500">
          Esta ventana se puede cerrar.
        </p>
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
