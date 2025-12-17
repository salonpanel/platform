'use client';

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useProgressivePreload } from "@/hooks/useProgressivePreload";

function LoginContent() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0); // Cooldown en segundos

  // 🔥 PRECARGA PROGRESIVA: Componentes mientras login, datos después de email
  const { preloadUserData } = useProgressivePreload();

  // Limpiar cookies viejas al entrar en login para evitar conflictos
  useEffect(() => {
    const cleanupStaleCookies = async () => {
      try {
        // Si hay una sesión antigua, hacer signOut para limpiar cookies
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log("[Login] Sesión antigua detectada, limpiando...");
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch (err) {
        console.warn("[Login] Error limpiando cookies viejas (no crítico):", err);
        // No es crítico si esto falla
      }
    };
    
    cleanupStaleCookies();
  }, [supabase]);

  // Efecto para ir bajando el cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiples llamadas y respetar cooldown
    if (loading || cooldown > 0) return;
    
    setError(null);
    setLoading(true);

    try {
      console.log("[Login] Enviando código vía Resend...");

      // Llamar al endpoint Resend que genera el token y envía el email
      const sendRes = await fetch("/api/auth/send-otp-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
        }),
      });

      const sendData = await sendRes.json();

      console.log("[Login] Respuesta de /api/auth/send-otp-resend:", sendData);

      if (!sendRes.ok || !sendData.ok) {
        const errorMsg = sendData?.error || "No se pudo enviar el código.";
        console.error("Error al enviar OTP:", errorMsg);

        if (sendRes.status === 429) {
          const retryAfter = sendData?.retryAfter || 60;
          setCooldown(retryAfter);
          setError(
            `Por favor espera ${retryAfter} segundos antes de solicitar otro código.`
          );
        } else {
          setError(errorMsg);
        }
        setLoading(false);
        return;
      }

      // Éxito: el código fue enviado vía Resend
      setSent(true);
      setLoading(false);
      setCooldown(60);

      // 🔥 PRECARGA DE DATOS: Una vez sabemos el email, preparamos la sesión
      try {
        preloadUserData(email).catch((err) => {
          console.warn('[Login] Error en precarga de datos:', err);
          // No es crítico, continuar normalmente
        });
      } catch (preloadError) {
        console.warn('[Login] Error iniciando precarga:', preloadError);
        // Continuar sin precarga si falla
      }
      // Redirigir a la página de verificación con el email
      router.push(`/login/verify-code?email=${encodeURIComponent(email.toLowerCase().trim())}`);
    } catch (err: any) {
      console.error("Error inesperado:", err);
      setError(err?.message || "Error al enviar el código. Por favor, intenta de nuevo.");
      setLoading(false);
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
              Iniciar sesión
            </h1>
            <p className="text-slate-400 text-sm">
              Ingresa tu correo para recibir un código de acceso
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

          {/* Formulario */}
          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
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
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Te enviaremos un código de 8 dígitos que expira en 10 minutos
                  </p>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading || !email || cooldown > 0}
                  whileHover={loading || cooldown > 0 ? undefined : { scale: 1.02 }}
                  whileTap={loading || cooldown > 0 ? undefined : { scale: 0.98 }}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold font-satoshi shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  style={{ borderRadius: "12px" }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Espera {cooldown}s</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      <span>Enviar código</span>
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
                  <Mail className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2 font-satoshi">
                  ¡Código enviado!
                </h2>
                <p className="text-slate-400 text-sm">
                  Revisa tu correo electrónico <span className="font-semibold text-white">{email}</span> para obtener el código de acceso.
                </p>
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
