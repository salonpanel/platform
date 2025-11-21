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
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const authStateChangeSubscriptionRef = useRef<any>(null);
  
  // Estado para modo OTP (código de 6 dígitos)
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

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

  // Limpiar polling, realtime y session check al desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe();
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (authStateChangeSubscriptionRef.current) {
        authStateChangeSubscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Configurar listener de onAuthStateChange para detectar sesión desde otras pestañas
  useEffect(() => {
    if (!waitingForApproval) return;

    console.log("[Login] Setting up onAuthStateChange listener for session detection");
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Login] 🔔 onAuthStateChange event:", event, {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        waitingForApproval,
      });

      // Si se detecta una sesión activa (puede venir de otra pestaña)
      if (event === 'SIGNED_IN' && session) {
        console.log("[Login] ✅ Session detected via onAuthStateChange, redirecting...");
        
        // Limpiar todos los intervalos y subscriptions
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (realtimeSubscriptionRef.current) {
          realtimeSubscriptionRef.current.unsubscribe();
          realtimeSubscriptionRef.current = null;
        }
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
          sessionCheckIntervalRef.current = null;
        }

        // Redirigir al panel
        const redirectParam = searchParams.get("redirect");
        const redirectPath = redirectParam || "/panel";
        console.log("[Login] Redirecting to:", redirectPath);
        router.replace(redirectPath);
      } else if (event === 'SIGNED_OUT') {
        console.log("[Login] ⚠️ User signed out while waiting for approval");
      } else if (event === 'TOKEN_REFRESHED') {
        console.log("[Login] 🔄 Token refreshed");
      }
    });

    authStateChangeSubscriptionRef.current = subscription;

    return () => {
      if (authStateChangeSubscriptionRef.current) {
        authStateChangeSubscriptionRef.current.unsubscribe();
        authStateChangeSubscriptionRef.current = null;
      }
    };
  }, [waitingForApproval, supabase, router, searchParams]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "unauthorized") {
      setError(
        "No tienes permisos para acceder a esa sección. Contacta con un administrador."
      );
    }
  }, [searchParams]);

  // Detectar tokens en el hash cuando Supabase redirige a /login con tokens
  // Esto solo debería pasar como fallback si el middleware no redirigió correctamente
  useEffect(() => {
    const handleHashTokens = async () => {
      // Leer el hash de la URL (solo disponible en el cliente)
      const hash = window.location.hash.substring(1);
      if (!hash) return;

      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const code = hashParams.get("code");
      const type = hashParams.get("type");

      // También buscar request_id en query params (puede venir del middleware)
      const requestId = searchParams?.get("request_id");
      const secretToken = searchParams?.get("token");

      // Si hay tokens en el hash, redirigir al handler apropiado
      if ((accessToken && refreshToken) || code) {
        console.log("[Login] Detected tokens in hash, redirecting to appropriate handler", {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
          hasRequestId: !!requestId,
          type,
        });

        // Si tenemos request_id, es un magic link remoto → redirigir a magic-link-handler
        if (requestId && secretToken) {
          const handlerUrl = new URL("/auth/magic-link-handler", window.location.origin);
          handlerUrl.searchParams.set("request_id", requestId);
          handlerUrl.searchParams.set("token", secretToken);
          if (code) handlerUrl.searchParams.set("code", code);
          if (type) handlerUrl.searchParams.set("type", type);
          window.location.href = handlerUrl.toString();
          return;
        }

        // Si no hay request_id, es un magic link normal → redirigir a callback
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        if (code) callbackUrl.searchParams.set("code", code);
        if (type) callbackUrl.searchParams.set("type", type);
        if (accessToken) callbackUrl.searchParams.set("access_token", accessToken);
        if (refreshToken) callbackUrl.searchParams.set("refresh_token", refreshToken);
        window.location.href = callbackUrl.toString();
        return;
      }
    };

    handleHashTokens();
  }, [searchParams, supabase, router]);

  // Polling para verificar estado de la request (fallback si Realtime falla)
  const pollRequestStatus = async (requestId: string) => {
    try {
      const response = await fetch(`/api/auth/login-request/status?request_id=${encodeURIComponent(requestId)}`);
      if (!response.ok) {
        console.warn("[LoginPolling] Response not OK:", response.status);
        return;
      }

      const data = await response.json();
      console.log("[LoginPolling] status response", {
        status: data.status,
        hasTokens: !!data.accessToken && !!data.refreshToken,
        redirectPath: data.redirectPath,
      });
      
      if (data.status === "approved") {
        if (data.accessToken && data.refreshToken) {
          // Request aprobada con tokens, establecer sesión
          console.log("[LoginPolling] Request approved with tokens, setting session...");
          await handleApprovedRequest(data.accessToken, data.refreshToken, data.redirectPath || "/panel");
        } else {
          // Request aprobada pero sin tokens (webhook marcó como aprobada)
          // Verificar si la sesión ya está establecida en el navegador
          console.log("[LoginPolling] Request approved but no tokens, checking session directly...");
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          console.log("[LoginPolling] Session check result:", {
            hasSession: !!session,
            userId: session?.user?.id,
            email: session?.user?.email,
            hasError: !!sessionError,
            errorMessage: sessionError?.message,
          });
          
          if (session && !sessionError) {
            console.log("[LoginPolling] ✅ Session found, redirecting to panel...");
            const redirectPath = data.redirectPath || "/panel";
            
            // Limpiar intervalos antes de redirigir
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            if (realtimeSubscriptionRef.current) {
              realtimeSubscriptionRef.current.unsubscribe();
              realtimeSubscriptionRef.current = null;
            }
            if (sessionCheckIntervalRef.current) {
              clearInterval(sessionCheckIntervalRef.current);
              sessionCheckIntervalRef.current = null;
            }
            
            setWaitingForApproval(false);
            setSent(false);
            router.replace(redirectPath);
          } else {
            console.log("[LoginPolling] No session found yet, will retry on next check...", {
              reason: sessionError ? `Error: ${sessionError.message}` : "No session in storage",
            });
            // Continuar esperando, el callback puede estar procesándose
          }
        }
      } else if (data.status === "expired" || data.status === "cancelled") {
        // Request expirada o cancelada
        console.log("[LoginPolling] Request expired or cancelled:", data.status);
        setWaitingForApproval(false);
        setSent(false);
        setError(data.status === "expired" ? "El enlace ha expirado. Por favor, solicita uno nuevo." : "Login cancelado.");
      }
    } catch (err) {
      console.error("[LoginPolling] Error polling request status:", err);
    }
  };

  // Verificar sesión directamente usando getSession() (complementa el polling)
  const checkSessionDirectly = async () => {
    // Solo verificar si estamos esperando aprobación
    if (!waitingForApproval) {
      return;
    }
    
    try {
      console.log("[Login] Running direct session check...");
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log("[Login] Direct session check result:", {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        hasError: !!error,
        errorMessage: error?.message,
        waitingForApproval,
      });

      if (session && !error) {
        console.log("[Login] ✅ Session found via direct check, redirecting...");
        
        // Limpiar todos los intervalos y subscriptions
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (realtimeSubscriptionRef.current) {
          realtimeSubscriptionRef.current.unsubscribe();
          realtimeSubscriptionRef.current = null;
        }
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
          sessionCheckIntervalRef.current = null;
        }

        // Redirigir al panel
        const redirectParam = searchParams.get("redirect");
        const redirectPath = redirectParam || "/panel";
        console.log("[Login] Redirecting to:", redirectPath);
        router.replace(redirectPath);
      } else {
        console.log("[Login] No session found yet, will check again in 2s");
      }
    } catch (err) {
      console.error("[Login] Error checking session directly:", err);
    }
  };

  // Manejar request aprobada
  const handleApprovedRequest = async (accessToken: string, refreshToken: string, redirectPath: string) => {
    try {
      console.log("[handleApprovedRequest] Request approved, setting session...", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        redirectPath,
      });
      
      // Limpiar polling, realtime y session check ANTES de establecer la sesión para evitar múltiples llamadas
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe();
        realtimeSubscriptionRef.current = null;
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }

      // Establecer sesión directamente en el cliente
      // onAuthStateChange se disparará automáticamente y redirigirá
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
      // onAuthStateChange también redirigirá, pero hacemos esto explícitamente para asegurar
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
          
          if (newData.status === "approved") {
            if (newData.supabase_access_token && newData.supabase_refresh_token) {
              // Request aprobada con tokens, establecer sesión
              console.log("[Realtime] Request approved with tokens, setting session...");
              handleApprovedRequest(
                newData.supabase_access_token,
                newData.supabase_refresh_token,
                newData.redirect_path || "/panel"
              );
            } else {
              // Request aprobada pero sin tokens (webhook marcó como aprobada)
              // Verificar si la sesión ya está establecida en el navegador
              console.log("[Realtime] Request approved but no tokens, checking session directly...");
              supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
                console.log("[Realtime] Session check result:", {
                  hasSession: !!session,
                  userId: session?.user?.id,
                  email: session?.user?.email,
                  hasError: !!sessionError,
                  errorMessage: sessionError?.message,
                });
                
                if (session && !sessionError) {
                  console.log("[Realtime] ✅ Session found, redirecting to panel...");
                  
                  // Limpiar intervalos antes de redirigir
                  if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                  }
                  if (realtimeSubscriptionRef.current) {
                    realtimeSubscriptionRef.current.unsubscribe();
                    realtimeSubscriptionRef.current = null;
                  }
                  if (sessionCheckIntervalRef.current) {
                    clearInterval(sessionCheckIntervalRef.current);
                    sessionCheckIntervalRef.current = null;
                  }
                  
                  setWaitingForApproval(false);
                  setSent(false);
                  router.replace(newData.redirect_path || "/panel");
                } else {
                  console.log("[Realtime] No session found yet, will retry...", {
                    reason: sessionError ? `Error: ${sessionError.message}` : "No session in storage",
                  });
                }
              });
            }
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
      // IMPORTANTE: Usar el dominio actual dinámicamente para soportar múltiples subdominios
      // Esto permite que funcione en pro.bookfast.es, admin.bookfast.es, etc.
      let baseUrl: string;
      
      if (typeof window !== "undefined") {
        // En el cliente, usar el dominio actual (soporta cualquier subdominio)
        baseUrl = window.location.origin;
      } else {
        // En el servidor, usar NEXT_PUBLIC_APP_URL o fallback
        baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      }
      
      // Limpiar espacios y asegurar formato correcto
      baseUrl = baseUrl.trim().replace(/\s+/g, '');
      
      // Construir URL de callback sin espacios - asegurar que no haya espacios en ninguna parte
      const callbackUrl = new URL("/auth/remote-callback", baseUrl);
      callbackUrl.searchParams.set("request_id", requestId);
      callbackUrl.searchParams.set("token", token);
      
      const finalCallbackUrl = callbackUrl.toString();
      
      // Validar que la URL no tiene espacios codificados
      if (finalCallbackUrl.includes("%20")) {
        console.error("[Login] ERROR: URL contains encoded spaces!", finalCallbackUrl);
        throw new Error("Error al construir la URL de callback. Por favor, recarga la página.");
      }
      
      console.log("[Login] emailRedirectTo URL:", finalCallbackUrl);
      console.log("[Login] baseUrl used:", baseUrl);
      console.log("[Login] Current origin:", typeof window !== "undefined" ? window.location.origin : "server");

      // Si está en modo OTP, enviar OTP en lugar de magic link
      if (otpMode) {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
          options: {
            // Para OTP, no necesitamos emailRedirectTo, solo enviamos el código
            shouldCreateUser: true,
          },
        });

        if (authError) {
          console.error("Error al enviar OTP:", authError);
          setError(authError.message || "Error al enviar el código OTP");
          setLoading(false);
          return;
        }

        // Cambiar a pantalla de entrada de código OTP
        setSent(true);
        setLoading(false);
        return;
      }

      // Modo magic link (por defecto)
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

      // 6. Configurar verificación directa de sesión (cada 2 segundos)
      // Esto detecta cuando la sesión se establece desde otra pestaña o dispositivo
      console.log("[Login] Setting up session check interval (every 2s)");
      sessionCheckIntervalRef.current = setInterval(() => {
        checkSessionDirectly();
      }, 2000);
      
      // Ejecutar una verificación inmediata
      console.log("[Login] Running initial session check...");
      checkSessionDirectly();

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

    // Limpiar polling, realtime y session check
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (realtimeSubscriptionRef.current) {
      realtimeSubscriptionRef.current.unsubscribe();
      realtimeSubscriptionRef.current = null;
    }
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }

    setWaitingForApproval(false);
    setSent(false);
    setLoginRequestId(null);
    setSecretToken(null);
    setError(null);
    setOtpMode(false);
    setOtpCode("");
  };

  // Función para verificar código OTP
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingOtp(true);
    setError(null);

    const redirectParam = searchParams.get("redirect");
    const redirectPath = redirectParam || "/panel";

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: otpCode.trim(),
        type: 'email',
      });

      if (verifyError) {
        console.error("Error verificando OTP:", verifyError);
        setError(verifyError.message || "Código inválido. Por favor, verifica el código e intenta de nuevo.");
        setVerifyingOtp(false);
        return;
      }

      if (!data.session) {
        setError("No se pudo establecer la sesión. Por favor, intenta de nuevo.");
        setVerifyingOtp(false);
        return;
      }

      console.log("[Login] OTP verified successfully:", {
        userId: data.session.user?.id,
        email: data.session.user?.email,
      });

      // Redirigir al panel
      router.replace(redirectPath);
    } catch (err: any) {
      console.error("Error inesperado verificando OTP:", err);
      setError(err?.message || "Error al verificar el código. Por favor, intenta de nuevo.");
      setVerifyingOtp(false);
    }
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
              {otpMode 
                ? "Ingresa el código de 6 dígitos que recibiste por correo"
                : "Ingresa tu correo para recibir un enlace de acceso"}
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
            {otpMode && sent ? (
              <motion.form
                key="otp-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={verifyOtp}
                className="space-y-6"
              >
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-slate-300 mb-2 font-satoshi">
                    Código de verificación
                  </label>
                  <div className="relative">
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => {
                        // Solo permitir números
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtpCode(value);
                      }}
                      disabled={verifyingOtp}
                      className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 font-mono text-2xl text-center tracking-widest backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="000000"
                      style={{ borderRadius: "12px" }}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Ingresa el código de 6 dígitos enviado a <span className="font-semibold text-white">{email}</span>
                  </p>
                </div>

                <motion.button
                  type="submit"
                  disabled={verifyingOtp || otpCode.length !== 6}
                  whileHover={{ scale: verifyingOtp ? 1 : 1.02 }}
                  whileTap={{ scale: verifyingOtp ? 1 : 0.98 }}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold font-satoshi shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  style={{ borderRadius: "12px" }}
                >
                  {verifyingOtp ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <span>Verificar código</span>
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpMode(false);
                    setSent(false);
                    setOtpCode("");
                    setError(null);
                  }}
                  className="text-sm text-slate-400 hover:text-slate-300 font-medium transition-colors w-full"
                >
                  Volver a enviar código o usar enlace mágico
                </button>
              </motion.form>
            ) : waitingForApproval ? (
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
                      <span>{otpMode ? "Enviar código OTP" : "Enviar enlace mágico"}</span>
                    </>
                  )}
                </motion.button>

                <div className="pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpMode(!otpMode);
                      setError(null);
                    }}
                    className="text-sm text-slate-400 hover:text-slate-300 font-medium transition-colors w-full"
                  >
                    {otpMode 
                      ? "Prefiero usar enlace mágico" 
                      : "Prefiero usar código OTP (6 dígitos)"}
                  </button>
                </div>
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



