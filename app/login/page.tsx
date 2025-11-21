'use client';

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, CheckCircle2, AlertCircle, Loader2, Sparkles, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

function LoginContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [loginRequestId, setLoginRequestId] = useState<string | null>(null);
  const [secretToken, setSecretToken] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeSubscriptionRef = useRef<any>(null);

  // Limpiar cualquier sesión previa para evitar errores de refresh token reciclado
  useEffect(() => {
    let cancelled = false;
    const clearStaleSession = async () => {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (signOutError) {
        if (!cancelled) {
          console.warn("No se pudo limpiar la sesión local:", signOutError);
        }
      }
    };
    void clearStaleSession();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Limpiar polling y realtime al desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "unauthorized") {
      setError(
        "No tienes permisos para acceder a esa sección. Contacta con un administrador."
      );
    }
  }, [searchParams]);

  // Polling para verificar estado de la request (fallback si Realtime falla)
  const pollRequestStatus = async (requestId: string) => {
    try {
      const response = await fetch(`/api/auth/login-request/status?requestId=${encodeURIComponent(requestId)}`);
      if (!response.ok) {
        console.warn("[Polling] Response not OK:", response.status);
        return;
      }

      const data = await response.json();
      console.log("[Polling] Status check:", { 
        status: data.status, 
        hasAccessToken: !!data.accessToken,
        hasRefreshToken: !!data.refreshToken,
        redirectPath: data.redirectPath 
      });
      
      if (data.status === "approved" && data.accessToken && data.refreshToken) {
        // Request aprobada, establecer sesión
        console.log("[Polling] Request approved, setting session with tokens...");
        await handleApprovedRequest(data.accessToken, data.refreshToken, data.redirectPath || "/panel");
      } else if (data.status === "expired" || data.status === "cancelled") {
        // Request expirada o cancelada
        console.log("[Polling] Request expired or cancelled:", data.status);
        setWaitingForApproval(false);
        setSent(false);
        setError(data.status === "expired" ? "El enlace ha expirado. Por favor, solicita uno nuevo." : "Login cancelado.");
      }
    } catch (err) {
      console.error("[Polling] Error polling request status:", err);
    }
  };

  // Manejar request aprobada
  const handleApprovedRequest = async (accessToken: string, refreshToken: string, redirectPath: string) => {
    try {
      console.log("[handleApprovedRequest] Setting session with tokens...", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        redirectPath,
      });
      
      // Limpiar polling y realtime ANTES de establecer la sesión para evitar múltiples llamadas
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe();
        realtimeSubscriptionRef.current = null;
      }

      // Establecer sesión con los tokens usando el cliente del navegador
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("[handleApprovedRequest] Error setting session:", error);
        setError("Error al establecer la sesión. Por favor, intenta de nuevo.");
        setWaitingForApproval(false);
        setSent(false);
        return;
      }

      if (!data.session) {
        console.error("[handleApprovedRequest] No session returned after setSession");
        setError("No se pudo establecer la sesión. Por favor, intenta de nuevo.");
        setWaitingForApproval(false);
        setSent(false);
        return;
      }

      console.log("[handleApprovedRequest] Session established successfully:", { 
        userId: data.session.user?.id,
        email: data.session.user?.email,
      });

      // Limpiar tokens del servidor (seguridad) - no crítico si falla
      if (loginRequestId) {
        try {
          await fetch("/api/auth/login-request/consume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: loginRequestId }),
          });
          console.log("[handleApprovedRequest] Tokens consumed from server");
        } catch (err) {
          console.warn("[handleApprovedRequest] Error consuming tokens (non-critical):", err);
        }
      }

      // Redirigir al panel
      const finalRedirectPath = redirectPath || "/panel";
      console.log("[handleApprovedRequest] Redirecting to:", finalRedirectPath);
      router.replace(finalRedirectPath);
    } catch (err: any) {
      console.error("[handleApprovedRequest] Unexpected error:", err);
      setError("Error al procesar la aprobación. Por favor, intenta de nuevo.");
      setWaitingForApproval(false);
      setSent(false);
    }
  };

  // Configurar Realtime subscription para detectar cambios
  const setupRealtimeSubscription = (requestId: string) => {
    // Limpiar subscription anterior si existe
    if (realtimeSubscriptionRef.current) {
      realtimeSubscriptionRef.current.unsubscribe();
    }

    console.log("[Realtime] Setting up subscription for request:", requestId);

    // Suscribirse a cambios en auth_login_requests
    const channel = supabase
      .channel(`login-request-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auth_login_requests",
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          console.log("[Realtime] Change detected:", payload);
          const newData = payload.new as any;
          
          if (newData.status === "approved" && newData.supabase_access_token && newData.supabase_refresh_token) {
            console.log("[Realtime] Request approved, setting session...");
            handleApprovedRequest(
              newData.supabase_access_token,
              newData.supabase_refresh_token,
              newData.redirect_path || "/panel"
            );
          } else if (newData.status === "expired" || newData.status === "cancelled") {
            console.log("[Realtime] Request expired or cancelled:", newData.status);
            setWaitingForApproval(false);
            setSent(false);
            setError(newData.status === "expired" ? "El enlace ha expirado. Por favor, solicita uno nuevo." : "Login cancelado.");
          }
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Successfully subscribed to changes");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Channel error, falling back to polling");
        }
      });

    realtimeSubscriptionRef.current = channel;
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const redirectParam = searchParams.get("redirect");
    const redirectPath = redirectParam || "/panel";
    
    // Auto-login para email de desarrollo (sin verificación)
    const DEV_EMAIL = "u0136986872@gmail.com";
    const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
    
    if (isDevelopment && email.toLowerCase() === DEV_EMAIL.toLowerCase()) {
      try {
        // Llamar al endpoint de dev-login
        const response = await fetch("/api/auth/dev-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.toLowerCase() }),
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("Respuesta no es JSON:", text.substring(0, 200));
          throw new Error(`El servidor devolvió un error (${response.status}). Verifica la consola del servidor.`);
        }

        const data = await response.json();

        if (data.error === "USE_NORMAL_FLOW") {
          console.log("Usando flujo normal de magic link");
          // Continuar con el flujo normal
        } else if (data.magicLink) {
          window.location.href = data.magicLink;
          setLoading(false);
          return;
        } else if (data.success && data.session) {
          const redirectTo = redirectParam || "/panel";
          window.location.href = redirectTo;
          setLoading(false);
          return;
        } else if (data.magicLink) {
          window.location.href = data.magicLink;
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.error("Error en auto-login:", err);
        const errorMessage = err?.message || "No se pudo iniciar sesión automáticamente. El usuario puede no existir o hay un problema con la base de datos. Verifica los logs del servidor.";
        setError(errorMessage);
        setSent(false);
        setLoading(false);
        return;
      }
    }
    
    // FLUJO DE APROBACIÓN REMOTA
    try {
      // 1. Crear login request
      const createResponse = await fetch("/api/auth/login-request/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          redirectPath: redirectPath,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Error al crear la solicitud de login");
      }

      const { requestId, secretToken: token } = await createResponse.json();
      setLoginRequestId(requestId);
      setSecretToken(token);

      // 2. Enviar magic link con callback a remote-callback
      // IMPORTANTE: Asegurar que baseUrl no tenga espacios y esté correctamente formateado
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 
        (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")).trim();
      
      // Construir URL de callback sin espacios - asegurar que no haya espacios en ninguna parte
      const callbackUrl = new URL("/auth/remote-callback", baseUrl);
      callbackUrl.searchParams.set("request_id", requestId);
      callbackUrl.searchParams.set("token", token);
      
      const finalCallbackUrl = callbackUrl.toString();
      console.log("[Login] emailRedirectTo URL:", finalCallbackUrl);

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: finalCallbackUrl,
          shouldCreateUser: true,
        },
      });

      if (authError) {
        console.error("Error al enviar Magic Link:", authError);
        setError(authError.message || "Error al enviar el enlace mágico");
        setLoading(false);
        return;
      }

      // 3. Cambiar a pantalla de espera
      setSent(true);
      setWaitingForApproval(true);
      setLoading(false);

      // 4. Configurar Realtime subscription
      setupRealtimeSubscription(requestId);

      // 5. Configurar polling como fallback (cada 3 segundos)
      pollingIntervalRef.current = setInterval(() => {
        pollRequestStatus(requestId);
      }, 3000);

    } catch (err: any) {
      console.error("Error en flujo de aprobación remota:", err);
      setError(err?.message || "Error al iniciar el proceso de login");
      setLoading(false);
      setSent(false);
    }
  };

  const cancelLogin = async () => {
    if (loginRequestId) {
      try {
        await fetch("/api/auth/login-request/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: loginRequestId }),
        });
      } catch (err) {
        console.warn("Error cancelando login (no crítico):", err);
      }
    }

    // Limpiar polling y realtime
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (realtimeSubscriptionRef.current) {
      realtimeSubscriptionRef.current.unsubscribe();
    }

    setWaitingForApproval(false);
    setSent(false);
    setLoginRequestId(null);
    setSecretToken(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo con gradiente animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Efectos de luz decorativos */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Contenido principal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass rounded-2xl border border-white/10 p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 mb-4 shadow-lg shadow-blue-500/25">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 font-satoshi tracking-tight">
              Bienvenido
            </h1>
            <p className="text-slate-400 text-sm">
              Ingresa tu correo para recibir un enlace de acceso
            </p>
          </motion.div>

          {/* Mensaje de error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 font-medium">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulario, mensaje de confirmación o pantalla de espera */}
          <AnimatePresence mode="wait">
            {waitingForApproval ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4"
                >
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-3 font-satoshi">
                  Esperando confirmación de login...
                </h2>
                <p className="text-slate-400 text-sm mb-2">
                  Hemos enviado un enlace a <span className="font-semibold text-white">{email}</span>
                </p>
                <p className="text-slate-500 text-xs mb-6">
                  Puedes abrirlo desde cualquier dispositivo. Esta ventana se actualizará automáticamente cuando confirmes el login.
                </p>
                <button
                  onClick={cancelLogin}
                  className="text-sm text-slate-400 hover:text-slate-300 font-medium transition-colors flex items-center gap-2 mx-auto"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              </motion.div>
            ) : !sent ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={sendLink}
                className="space-y-6"
              >
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2 font-satoshi">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 font-medium backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="tu@correo.com"
                      style={{ borderRadius: "12px" }}
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading || !email}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold font-satoshi shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  style={{ borderRadius: "12px" }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      <span>Enviar enlace mágico</span>
                    </>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4"
                >
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2 font-satoshi">
                  ¡Enlace enviado!
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                  Revisa tu correo electrónico <span className="font-semibold text-white">{email}</span> y haz clic en el enlace para acceder.
                </p>
                <button
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                    setError(null);
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Enviar a otro correo
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 pt-6 border-t border-white/5 text-center"
          >
            <p className="text-xs text-slate-500">
              Al continuar, aceptas nuestros términos de servicio y política de privacidad
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
