"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Bell } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

interface MessagesWidgetProps {
  tenantId: string | null;
}

export function MessagesWidget({ tenantId }: MessagesWidgetProps) {
  const supabase = getSupabaseBrowser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const loadUnreadMessages = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Contar mensajes no leídos para el tenant actual
        // Mensajes donde el usuario es destinatario (privados) o mensajes grupales (recipient_id IS NULL)
        // y que no fueron enviados por el usuario actual
        const { count, error } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .neq("sender_id", user.id) // Excluir mensajes enviados por el usuario actual
          .or(`recipient_id.is.null,recipient_id.eq.${user.id}`); // Mensajes grupales o privados al usuario

        if (error) {
          console.error("Error al cargar mensajes:", error);
        } else {
          setUnreadCount(count || 0);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadUnreadMessages();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadUnreadMessages();
        }
      )
      .subscribe();

    // Recargar cada 30 segundos como fallback
    const interval = setInterval(loadUnreadMessages, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [tenantId, supabase]);

  if (loading) {
    return null;
  }

  return (
    <Link href="/panel/chat">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative rounded-2xl border border-white/5 cursor-pointer group overflow-hidden",
          "bg-[rgba(15,23,42,0.85)] backdrop-blur-xl",
          "shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
          "px-4 py-3 sm:px-5 sm:py-4",
          "transition-transform transition-shadow duration-150 ease-out",
          "hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)]"
        )}
      >
        <motion.div
          className="absolute inset-0 gradient-aurora-1 opacity-0 group-hover:opacity-5 transition-opacity duration-300"
        />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
                <MessageSquare className="h-4 w-4 text-[var(--text-primary)]" />
              </div>
              {unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full bg-gradient-to-r from-[#FF6DA3] to-[#FF6F91] text-white text-[10px] font-semibold font-satoshi shadow-lg border-2 border-[var(--bg-primary)]"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)] font-satoshi mb-0.5">
                Chats
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {unreadCount === 0
                  ? "No hay mensajes nuevos"
                  : unreadCount === 1
                  ? "1 mensaje nuevo"
                  : `${unreadCount} mensajes nuevos`}
              </p>
            </div>
          </div>

          <Bell className={cn(
            "h-4 w-4 text-[var(--text-secondary)] transition-colors",
            unreadCount > 0 && "text-[#3A6DFF]"
          )} />
        </div>
      </motion.div>
    </Link>
  );
}

