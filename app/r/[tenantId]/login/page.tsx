"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useParams } from "next/navigation";

const RESEND_COOLDOWN = 60;

export default function LoginPage() {
    const { tenantId } = useParams();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const supabase = getSupabaseBrowser({ cookieName: "sb-customer-auth" });

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const sendLink = async (emailAddr: string) => {
        const { error } = await supabase.auth.signInWithOtp({
            email: emailAddr,
            options: {
                emailRedirectTo: `${window.location.origin}/r/${tenantId}/mis-citas`,
            },
        });
        return error;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const err = await sendLink(email);
        if (err) {
            setError("No pudimos enviarte el enlace. Comprueba el email e inténtalo de nuevo.");
        } else {
            setMagicLinkSent(true);
            setResendCooldown(RESEND_COOLDOWN);
        }
        setLoading(false);
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setLoading(true);
        setError(null);
        const err = await sendLink(email);
        if (err) {
            setError("No pudimos reenviar el enlace. Inténtalo de nuevo.");
        } else {
            setResendCooldown(RESEND_COOLDOWN);
        }
        setLoading(false);
    };

    if (magicLinkSent) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">¡Revisa tu correo!</h2>
                <p className="text-slate-600 max-w-sm">
                    Hemos enviado un enlace de acceso a <strong className="break-all">{email}</strong>. Haz clic en él para ver tus citas.
                </p>

                {error && (
                    <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-sm w-full">
                        {error}
                    </p>
                )}

                <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || loading}
                    className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                    {loading
                        ? "Reenviando..."
                        : resendCooldown > 0
                        ? `Reenviar en ${resendCooldown}s`
                        : "Reenviar enlace"}
                </button>

                <button
                    onClick={() => { setMagicLinkSent(false); setError(null); }}
                    className="mt-3 text-sm text-slate-400 hover:text-slate-600"
                >
                    Usar otro correo
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
                <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Acceso Clientes</h1>
                <p className="text-slate-500 text-center mb-8">Introduce tu email para gestionar tus citas.</p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            id="email"
                            type="email"
                            required
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(null); }}
                        />
                    </div>

                    {error && (
                        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-70 transition-transform active:scale-[0.98]"
                        style={{ backgroundColor: "var(--tenant-brand)" }}
                    >
                        {loading ? "Enviando..." : "Enviar enlace de acceso"}
                    </button>
                </form>
            </div>
        </div>
    );
}
