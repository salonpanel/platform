"use client";

import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

/**
 * Hook para obtener la sesión actual del usuario
 * Incluye estado de carga para evitar redirecciones prematuras
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let mounted = true;

    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (sessionError) {
          setError(sessionError);
          setSession(null);
        } else {
          setSession(session);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setSession(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    getInitialSession();

    // Escuchar cambios de sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setIsLoading(false);
      setError(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, isLoading, error };
}



