'use client';

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

function LoginContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "unauthorized") {
      setError(
        "No tienes permisos para acceder a esa sección. Contacta con un administrador."
      );
    }
  }, [searchParams]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const redirectParam = searchParams.get("redirect");
    
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

        // Verificar que la respuesta es JSON antes de parsear
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("Respuesta no es JSON:", text.substring(0, 200));
          throw new Error(`El servidor devolvió un error (${response.status}). Verifica la consola del servidor.`);
        }

        const data = await response.json();

        // Si el endpoint indica usar el flujo normal, continuar sin error
        if (data.error === "USE_NORMAL_FLOW") {
          console.log("Usando flujo normal de magic link");
          // Continuar con el flujo normal (no lanzar error)
        } else if (!response.ok) {
          // Mostrar el error detallado
          const errorMsg = data.error || `Error en auto-login (${response.status})`;
          console.error("Error en dev-login:", data);
          throw new Error(errorMsg);
        }

        // Si el endpoint indica usar el flujo normal, continuar sin hacer nada más
        if (data.error === "USE_NORMAL_FLOW") {
          // Continuar con el flujo normal de magic link (no hacer return)
          console.log("Usando flujo normal de magic link");
        } else if (data.magicLink) {
          // Si hay un magic link, redirigir directamente y dejar que Supabase maneje la autenticación
          console.log("Redirigiendo a magic link...");
          window.location.href = data.magicLink;
          setLoading(false);
          return;
        } else if (data.success && data.session) {
          // Si el auto-login fue exitoso con sesión directa, redirigir
          console.log("Auto-login exitoso, redirigiendo...");
          const redirectTo = redirectParam || "/panel";
          window.location.href = redirectTo;
          setLoading(false);
          return;
        } else {
          // Si hay algún otro resultado, también intentar usar el magic link si existe
          if (data.magicLink) {
            window.location.href = data.magicLink;
            setLoading(false);
            return;
          }
        }
      } catch (err: any) {
        console.error("Error en auto-login:", err);
        // Mostrar error más específico
        const errorMessage = err?.message || "No se pudo iniciar sesión automáticamente. El usuario puede no existir o hay un problema con la base de datos. Verifica los logs del servidor.";
        setError(errorMessage);
        setSent(false);
        setLoading(false);
        return;
      }
    }
    
    // Flujo normal de magic link (solo si no es el email de desarrollo o si el auto-login no se ejecutó)
    // Usar URL absoluta para callbacks de auth (Supabase requiere URL completa)
    // En producción: usar NEXT_PUBLIC_APP_URL, en desarrollo: usar el dominio actual
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const callbackBase = redirectParam
      ? `${baseUrl}/auth/callback?redirect=${encodeURIComponent(redirectParam)}`
      : `${baseUrl}/auth/callback`;
    
    // Nota: El hash #email no se envía en emailRedirectTo, solo se usa en el cliente
    const callbackUrl = callbackBase;
    
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
        shouldCreateUser: true,
      },
    });
    
    setLoading(false);
    
    if (authError) {
      console.error("Error al enviar Magic Link:", authError);
      setError(authError.message || "Error al enviar el enlace mágico");
    } else {
      setSent(true);
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

          {/* Formulario o mensaje de confirmación */}
          <AnimatePresence mode="wait">
            {!sent ? (
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
