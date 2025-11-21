'use client';

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, Mail, ArrowLeft } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

function VerifyCodeContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams?.get("email") || "";
  
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // 60 segundos antes de poder reenviar
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);

  // Contador regresivo para reenvío
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Verificar código OTP
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);

    console.log("[VerifyCode] Starting verification...", {
      email: email ? "present" : "missing",
      codeLength: code.length,
    });

    if (code.length !== 8) {
      setError("El código debe tener 8 dígitos");
      setVerifying(false);
      return;
    }

    try {
      console.log("[VerifyCode] Calling verifyOtp...");
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: code.trim(),
        type: 'email',
      });

      console.log("[VerifyCode] verifyOtp response:", {
        hasData: !!data,
        hasSession: !!data?.session,
        hasError: !!verifyError,
        errorMessage: verifyError?.message,
      });

      if (verifyError) {
        console.error("[VerifyCode] Error verificando OTP:", verifyError);
        
        // Manejar diferentes tipos de errores
        if (verifyError.message?.includes('expired') || verifyError.message?.includes('invalid')) {
          setError('Código inválido o expirado. Por favor verifica el código e intenta nuevamente, o solicita uno nuevo.');
        } else {
          setError(verifyError.message || 'Error al verificar el código. Intenta de nuevo.');
        }
        setCode(""); // Limpiar campo por seguridad
        setVerifying(false);
        return;
      }

      if (!data.session) {
        console.error("[VerifyCode] No session in response");
        setError("No se pudo establecer la sesión. Por favor, intenta de nuevo.");
        setVerifying(false);
        return;
      }

      console.log("[VerifyCode] OTP verified successfully:", {
        userId: data.session.user?.id,
        email: data.session.user?.email,
        hasAccessToken: !!data.session.access_token,
        hasRefreshToken: !!data.session.refresh_token,
      });

      // CRÍTICO: Establecer la sesión explícitamente para asegurar que se guarde en cookies
      // Aunque verifyOtp devuelve la sesión, debemos llamar a setSession() para que
      // se persista correctamente en cookies del navegador (necesario para Next.js SSR)
      const { access_token, refresh_token } = data.session;
      
      console.log("[VerifyCode] Setting session explicitly...");
      const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (setSessionError) {
        console.error("[VerifyCode] Error setting session:", setSessionError);
        setError("Error al establecer la sesión. Por favor, intenta de nuevo.");
        setVerifying(false);
        return;
      }

      if (!sessionData.session) {
        console.error("[VerifyCode] No session after setSession");
        setError("La sesión no se estableció correctamente. Por favor, intenta de nuevo.");
        setVerifying(false);
        return;
      }

      console.log("[VerifyCode] Session established successfully:", {
        userId: sessionData.session.user?.id,
        email: sessionData.session.user?.email,
      });

      // Verificar que la sesión se guardó correctamente
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      console.log("[VerifyCode] Current session after setSession:", {
        hasSession: !!currentSession,
        userId: currentSession?.user?.id,
        hasError: !!sessionError,
        errorMessage: sessionError?.message,
      });

      if (!currentSession) {
        console.error("[VerifyCode] Session not persisted after setSession");
        setError("La sesión no se guardó correctamente. Por favor, intenta de nuevo.");
        setVerifying(false);
        return;
      }

      // Éxito: redirigir al panel
      const redirectParam = searchParams?.get("redirect");
      const redirectPath = redirectParam || "/panel";
      console.log("[VerifyCode] Session confirmed, redirecting to:", redirectPath);
      
      // Usar window.location.href para forzar una navegación completa
      // Esto asegura que las cookies se establezcan correctamente
      window.location.href = redirectPath;
    } catch (err: any) {
      console.error("[VerifyCode] Unexpected error verifying OTP:", err);
      setError(err?.message || "Error al verificar el código. Por favor, intenta de nuevo.");
      setCode(""); // Limpiar campo
      setVerifying(false);
    }
  };

  // Reenviar código
  const handleResend = async () => {
    if (timeLeft > 0 || resending) return;

    setResending(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (authError) {
        console.error("Error reenviando OTP:", authError);
        
        if (authError.message?.includes('rate limit') || authError.message?.includes('too many')) {
          setError('Por favor espera un momento antes de reenviar. Puedes solicitar un nuevo código cada 60 segundos.');
        } else {
          setError('No se pudo reenviar el código. Por favor intenta más tarde.');
        }
        setResending(false);
        return;
      }

      // Éxito: reiniciar contador y mostrar mensaje
      setTimeLeft(60);
      setCode(""); // Limpiar código anterior
      setError(null);
      // Mostrar mensaje de éxito temporal
      const successMsg = `Nuevo código enviado a ${email}`;
      setError(null);
      // Podríamos mostrar un toast aquí, por ahora solo reiniciamos el contador
    } catch (err: any) {
      console.error("Error inesperado reenviando OTP:", err);
      setError('Error al reenviar el código. Por favor intenta más tarde.');
      setResending(false);
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Email no proporcionado</h2>
          <p className="text-slate-400 mb-4">Por favor, vuelve a la página de login.</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

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
          {/* Botón volver */}
          <button
            onClick={() => router.push("/login")}
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 mb-4 shadow-lg shadow-blue-500/25">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 font-satoshi tracking-tight">
              Verifica tu código
            </h1>
            <p className="text-slate-400 text-sm">
              Introduce el código de 8 dígitos enviado a
            </p>
            <p className="text-white font-semibold mt-1">{email}</p>
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

          {/* Mensaje de éxito */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-300 font-medium">¡Código verificado! Redirigiendo...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulario de código */}
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleVerify}
                className="space-y-6"
              >
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-slate-300 mb-2 font-satoshi">
                    Código de verificación
                  </label>
                  <div className="relative">
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{8}"
                      maxLength={8}
                      required
                      value={code}
                      onChange={(e) => {
                        // Solo permitir números
                        const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setCode(value);
                        setError(null); // Limpiar error al escribir
                      }}
                      disabled={verifying}
                      className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 font-mono text-2xl text-center tracking-widest backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="00000000"
                      style={{ borderRadius: "12px" }}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    El código de 8 dígitos expira en 10 minutos
                  </p>
                </div>

                <motion.button
                  type="submit"
                  disabled={verifying || code.length !== 8}
                  whileHover={{ scale: verifying ? 1 : 1.02 }}
                  whileTap={{ scale: verifying ? 1 : 0.98 }}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold font-satoshi shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                  style={{ borderRadius: "12px" }}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <span>Verificar código</span>
                  )}
                </motion.button>

                {/* Botón reenviar */}
                <div className="pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={timeLeft > 0 || resending}
                    className="w-full text-sm text-slate-400 hover:text-slate-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Reenviando...</span>
                      </>
                    ) : timeLeft > 0 ? (
                      <span>Reenviar código en {timeLeft}s</span>
                    ) : (
                      <span>Reenviar código</span>
                    )}
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
                  ¡Verificación exitosa!
                </h2>
                <p className="text-slate-400 text-sm">
                  Redirigiendo al panel...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyCodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <VerifyCodeContent />
    </Suspense>
  );
}

