"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useParams, useRouter } from "next/navigation";

export default function LoginPage() {
    const { tenantId } = useParams();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);

    // Use "sb-customer-auth" cookie to keep separate from "sb-panel-auth"
    const supabase = getSupabaseBrowser({ cookieName: "sb-customer-auth" });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // Redirect back to "mis-citas" after login
                emailRedirectTo: `${window.location.origin}/r/${tenantId}/mis-citas`,
            },
        });

        if (error) {
            alert("Error: " + error.message);
        } else {
            setMagicLinkSent(true);
        }
        setLoading(false);
    };

    if (magicLinkSent) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">¡Revisa tu correo!</h2>
                <p className="text-slate-600 max-w-sm">
                    Hemos enviado un enlace mágico a <strong>{email}</strong>. Haz clic en él para acceder a tus citas.
                </p>
                <button
                    onClick={() => setMagicLinkSent(false)}
                    className="mt-8 text-sm text-slate-400 hover:text-slate-600"
                >
                    Intentar con otro correo
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Acceso Clientes</h1>
                <p className="text-slate-500 text-center mb-8">Introduce tu email para gestionar tus citas.</p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

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
