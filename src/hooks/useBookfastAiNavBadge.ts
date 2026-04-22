"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BOOKFAST_AI_PENDING_EVENT,
  BOOKFAST_AI_STORAGE_EVENT,
  getBookfastAiPending,
  getBookfastAiUnreadReply,
} from "@/lib/bookfast-ai-chat";

/**
 * Indicadores en el acceso a BookFast AI (header móvil + sidebar).
 * En la propia ruta del asistente se ocultan para no duplicar el estado de “pensando”.
 */
export function useBookfastAiNavBadge() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUnread(getBookfastAiUnreadReply());
      setPending(getBookfastAiPending() !== null);
    };
    sync();
    window.addEventListener(BOOKFAST_AI_STORAGE_EVENT, sync);
    window.addEventListener(BOOKFAST_AI_PENDING_EVENT, sync);
    return () => {
      window.removeEventListener(BOOKFAST_AI_STORAGE_EVENT, sync);
      window.removeEventListener(BOOKFAST_AI_PENDING_EVENT, sync);
    };
  }, []);

  const isAiPage = pathname?.startsWith("/panel/bookfast-ai") ?? false;

  return {
    showUnread: unread && !isAiPage,
    showPending: pending && !isAiPage,
  };
}
