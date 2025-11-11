'use client';

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (!error) setSent(true);
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-4">Acceso</h1>
      {!sent ? (
        <form onSubmit={sendLink} className="space-y-3">
          <input
            className="w-full border p-2 rounded"
            type="email"
            required
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="w-full rounded bg-black text-white py-2">
            Enviar enlace mágico
          </button>
        </form>
      ) : (
        <p>Te hemos enviado un enlace de acceso. Revisa tu email.</p>
      )}
    </div>
  );
}

