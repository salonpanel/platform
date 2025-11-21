"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

function RemoteConfirmedContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full bg-slate-900 rounded-2xl p-8 text-center border border-slate-800"
      >
        {error === "already_approved" ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4"
            >
              <XCircle className="w-8 h-8 text-amber-400" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Solicitud ya procesada
            </h1>
            <p className="text-slate-400 mb-6">
              Esta solicitud de login ya fue procesada anteriormente. Vuelve a la ventana donde estabas iniciando sesión.
            </p>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Login confirmado
            </h1>
            <p className="text-slate-400 mb-2">
              Tu login ha sido confirmado correctamente.
            </p>
            <p className="text-slate-500 text-sm mb-6">
              Vuelve a la ventana donde estabas iniciando sesión. Esta página se puede cerrar.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function RemoteConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-r-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-slate-400">Cargando...</p>
          </div>
        </div>
      }
    >
      <RemoteConfirmedContent />
    </Suspense>
  );
}

