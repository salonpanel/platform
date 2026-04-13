'use client';

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useProgressivePreload } from "@/hooks/useProgressivePreload";
import { useWebAuthn } from "@/hooks/useWebAuthn";

// Face ID icon (inline SVG — no external dep)
function FaceIdIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v4" />
      <path d="M15 3h4a2 2 0 0 1 2 2v4" />
      <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
      <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
      <path d="M9 9v1" />
      <path d="M15 9v1" />
      <path d="M9 14s1 1 3 1 3-1 3-1" />
      <path d="M12 9v4" />
    </svg>
  );
}

function LoginContent() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);

  // 🔥 PRECARGA PROGRESIVA
  const { preloadUserData } = useProgressivePreload();

  // 🔐 FACE ID / TOUCH ID
  const {
    isSupported: webAuthnSupported,
    hasCredential,
    status: webAuthnStatus,
    error: webAuthnError,
    authenticate,
    getStoredEmail,
  } = useWebAuthn();

  // ✅ FIX: If session exists → redirect directly to panel
  // Previously this called signOut() which destroyed the saved session — bug fixed
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = '/panel';
          return;
        }
      } catch (err) {
        console.warn("[Login] No active session:", err);
      } finally {
        setCheckingSession(false);
      }
    };
    checkExistingSession();
  }, [supabase]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Handle Face ID login
  const handleFaceId = async () => {
    const result = await authenticate();
    if (result) {
      window.location.href = '/panel';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown > 0) return;
    setError(null);
    setLoading(true);

    try {
      const sendRes = await fetch("/api/auth/send-otp-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const sendData = await sendRes.json();

      if (!sendRes.ok || !sendData.ok) {
        const errorMsg = sendData?.error || "No se pudo enviar el código.";
        if (sendRes.status === 429) {
          const retryAfter = sendData?.retryAfter || 60;
          setCooldown(retryAfter);
          setError(`Por favor espera ${retryAfter} segundos antes de solicitar otro código.`);
        } else {
          setError(errorMsg);
        }
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
      setCooldown(60);

      try {
        preloadUserData(email).catch((err) => {
          console.warn('[Login] Error en precarga:', err);
        });
      } catch {
        // Non-critical
      }

      router.push(`/login/verify-code?email=${encodeURIComponent(email.toLowerCase().trim())}`);
    } catch (err: any) {
      setError(err?.message || "Error al enviar el código. Por favor, intenta de nuevo.");
      setLoading(false);
    }
  };

  // Show subtle spinner while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }

  const storedEmail = getStoredEmail();
  const showFaceId = webAuthnSupported && hasCredential && !!storedEmail;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

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
              {showFaceId
                ? `Bienvenido de nuevo, ${storedEmail}`
                : "Ingresa tu correo para recibir un código de acceso"}
            </p>
          </motion.div>

          {/* Face ID button — only shown when device has a registered credential */}
          <AnimatePresence>
            {showFaceId && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6"
              >
                <motion.button
                  id="faceid-login-btn"
                  onClick={handleFaceId}
                  disabled={webAuthnStatus === 'authenticating'}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-slate-700 to-slate-600 border border-white/10 text-white font-semibold font-satoshi shadow-lg hover:shadow-xl hover:from-slate-600 hover:to-slate-500 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  style={{ borderRadius: "12px" }}
                >
                  {webAuthnStatus === 'authenticating' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verificando identidad...</span>
                    </>
                  ) : (
                    <>
                      <FaceIdIcon className="w-6 h-6 text-blue-400" />
                      <span>Entrar con Face ID</span>
                    </>
                  )}
                </motion.button>

                {(webAuthnError || webAuthnStatus === 'error') && (
                  <p className="text-xs text-red-400 mt-2 text-center">
                    {webAuthnError || "Error con Face ID. Usa el código por email."}
                  </p>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3 mt-6">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-slate-500 font-medium">o usa tu correo</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
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

          {/* Email form */}
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
                      autoFocus={!showFaceId}
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
