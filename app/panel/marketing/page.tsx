"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, GlassButton, GlassToast } from "@/components/ui/glass";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { useCurrentTenantWithImpersonation } from "@/hooks/useCurrentTenantWithImpersonation";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Megaphone, Users, Mail, CheckCircle2, XCircle,
  Loader2, Search, X, ChevronDown, ChevronUp,
  Sparkles, Send, Eye, EyeOff, RefreshCw, Filter, History, AlertCircle
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

interface InactiveClient {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  last_booking_at?: string | null;
  visits_count?: number | null;
  total_spent_cents?: number | null;
  marketing_opt_in?: boolean | null;
  tags?: string[] | null;
}

interface CampaignRecord {
  id: string;
  name: string;
  subject: string;
  sent_count: number;
  failed_count: number;
  target_client_count: number;
  status: string;
  sent_at: string | null;
  created_at: string;
}

// ─── Predefined campaign templates ───────────────────────────────────────────

const TEMPLATES = [
  {
    id: "win_back",
    label: "Recuperación",
    icon: "🔄",
    subject: "¡Te echamos de menos en {{negocio}}!",
    body: `<p>Hola {{nombre}},</p>
<p>Hace un tiempo que no te vemos por {{negocio}} y queremos que sepas que te echamos de menos.</p>
<p>Para celebrar tu regreso, te ofrecemos un <strong>10% de descuento</strong> en tu próxima visita. Solo tienes que mencionarlo al reservar.</p>
<p>Reserva fácilmente desde nuestra app o llámanos directamente.</p>
<p>¡Hasta pronto!</p>
<p>El equipo de {{negocio}}</p>`,
  },
  {
    id: "promo_last_minute",
    label: "Última hora",
    icon: "⚡",
    subject: "¡Huecos disponibles hoy en {{negocio}}!",
    body: `<p>Hola {{nombre}},</p>
<p>Tenemos huecos libres <strong>esta semana</strong> y nos gustaría verte pronto.</p>
<p>Reserva ahora y te aseguramos la mejor atención de siempre.</p>
<p>¡No lo dejes pasar!</p>
<p>{{negocio}}</p>`,
  },
  {
    id: "newsletter",
    label: "Novedades",
    icon: "📰",
    subject: "Novedades en {{negocio}} — no te las pierdas",
    body: `<p>Hola {{nombre}},</p>
<p>Tenemos novedades que te van a encantar. Nuevos servicios, horarios ampliados y mucho más.</p>
<p>Pasa a visitarnos o reserva online. ¡Siempre es un placer verte!</p>
<p>Un saludo,</p>
<p>{{negocio}}</p>`,
  },
  {
    id: "custom",
    label: "Personalizada",
    icon: "✏️",
    subject: "",
    body: "",
  },
];

// ─── Marketing Content ────────────────────────────────────────────────────────

function MarketingContent() {
  const { tenantId, loadingTenant } = useCurrentTenantWithImpersonation();

  // Inactive clients
  const [clients, setClients] = useState<InactiveClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(60);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Campaign builder
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [bodyHtml, setBodyHtml] = useState(TEMPLATES[0].body);
  const [previewMode, setPreviewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Campaign sending
  const [sending, setSending] = useState(false);
  const [campaignResult, setCampaignResult] = useState<{ sent: number; failed: number } | null>(null);

  // Campaign history
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; tone: "success" | "danger" } | null>(null);

  const loadCampaigns = useCallback(async () => {
    if (!tenantId) return;
    setLoadingCampaigns(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("id, name, subject, sent_count, failed_count, target_client_count, status, sent_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10) as any;
      if (error) throw error;
      setCampaigns(data || []);
    } catch {
      // silently fail — history is non-critical
    } finally {
      setLoadingCampaigns(false);
    }
  }, [tenantId]);

  const loadInactiveClients = useCallback(async () => {
    if (!tenantId) return;
    setLoadingClients(true);
    try {
      const res = await fetch(`/api/panel/marketing/inactive-clients?tenant_id=${tenantId}&days=${inactiveDays}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClients(data.clients || []);
      setSelectedIds(new Set()); // Reset selection on refresh
    } catch (err: any) {
      setToast({ message: err.message || "Error al cargar clientes", tone: "danger" });
    } finally {
      setLoadingClients(false);
    }
  }, [tenantId, inactiveDays]);

  useEffect(() => {
    if (tenantId) loadInactiveClients();
  }, [tenantId, inactiveDays]);

  useEffect(() => {
    if (tenantId) loadCampaigns();
  }, [tenantId, loadCampaigns]);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const q = searchTerm.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [clients, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredClients.map(c => c.id)));
  const clearAll = () => setSelectedIds(new Set());

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setBodyHtml(template.body);
  };

  const sendCampaign = async () => {
    if (!tenantId || selectedIds.size === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/panel/marketing/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          subject,
          body_html: bodyHtml,
          client_ids: Array.from(selectedIds),
          campaign_name: selectedTemplate.label,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCampaignResult({ sent: data.sent, failed: data.failed });
      setToast({ message: `Campaña enviada: ${data.sent} emails enviados`, tone: "success" });
      setShowBuilder(false);
      setSelectedIds(new Set());
      // Refresh history
      loadCampaigns();
    } catch (err: any) {
      setToast({ message: err.message || "Error al enviar campaña", tone: "danger" });
    } finally {
      setSending(false);
    }
  };

  const optInCount = clients.filter(c => c.marketing_opt_in !== false).length;
  const withEmailCount = clients.filter(c => !!c.email).length;

  if (loadingTenant) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Campaign CTA — only shown when clients are selected */}
      {selectedIds.size > 0 && (
        <div className="flex justify-end pt-1">
          <GlassButton onClick={() => setShowBuilder(true)} className="shrink-0 h-10 px-5">
            <Send className="w-4 h-4 mr-2" />
            Crear campaña ({selectedIds.size})
          </GlassButton>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Inactivos detectados", value: clients.length, icon: Users, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Con email", value: withEmailCount, icon: Mail, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Opt-in marketing", value: optInCount, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Último envío", value: campaignResult ? `${campaignResult.sent} ✉` : "—", icon: Megaphone, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map((kpi) => (
          <GlassCard key={kpi.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium leading-tight">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{kpi.value}</div>
          </GlassCard>
        ))}
      </div>

      {/* Campaign history */}
      {(campaigns.length > 0 || loadingCampaigns) && (
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-sm font-semibold text-white">Historial de campañas</h2>
            </div>
            <GlassButton variant="ghost" size="sm" onClick={loadCampaigns} isLoading={loadingCampaigns}>
              <RefreshCw className="w-3 h-3" />
            </GlassButton>
          </div>

          {loadingCampaigns ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{c.name}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        c.status === "sent" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {c.status === "sent" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                        {c.status === "sent" ? "Enviada" : "Fallida"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{c.subject}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-white">{c.sent_count} enviados</p>
                    {c.failed_count > 0 && (
                      <p className="text-xs text-red-400">{c.failed_count} fallidos</p>
                    )}
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      {c.sent_at
                        ? formatDistanceToNow(parseISO(c.sent_at), { addSuffix: true, locale: es })
                        : format(parseISO(c.created_at), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Inactive clients table */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">Clientes inactivos</h2>
            <span className="text-xs text-[var(--text-secondary)] bg-white/5 px-2 py-0.5 rounded-lg">
              +{inactiveDays} días sin reserva
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Days filter pills */}
            <div className="flex gap-1">
              {[30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setInactiveDays(d)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    inactiveDays === d
                      ? "bg-[var(--accent-blue)] text-white"
                      : "bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
                  }`}
                >
                  +{d}d
                </button>
              ))}
            </div>
            <button
              onClick={loadInactiveClients}
              disabled={loadingClients}
              className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingClients ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search + select all */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full h-9 pl-9 pr-9 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-blue)]/40 transition-colors"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {filteredClients.length > 0 && (
            <button
              onClick={selectedIds.size === filteredClients.length ? clearAll : selectAll}
              className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-xs text-[var(--text-secondary)] hover:text-white hover:bg-white/8 transition-colors whitespace-nowrap"
            >
              {selectedIds.size === filteredClients.length ? "Deselec. todos" : "Selec. todos"}
            </button>
          )}
        </div>

        {/* Client list */}
        {loadingClients ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-white/20" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
            {clients.length === 0
              ? `No hay clientes inactivos de más de ${inactiveDays} días. ¡Buena señal! 🎉`
              : "Ningún cliente coincide con la búsqueda."
            }
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            <AnimatePresence>
              {filteredClients.map((client) => {
                const isSelected = selectedIds.has(client.id);
                const lastVisit = client.last_booking_at
                  ? formatDistanceToNow(parseISO(client.last_booking_at), { locale: es, addSuffix: true })
                  : "Nunca";

                return (
                  <motion.div
                    key={client.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => toggleSelect(client.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${
                      isSelected
                        ? "bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/30"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? "bg-[var(--accent-blue)] border-[var(--accent-blue)]"
                        : "border-white/20"
                    }`}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {client.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{client.name}</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate">{client.email}</p>
                    </div>

                    {/* Meta */}
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-xs text-[var(--text-secondary)]">{lastVisit}</p>
                      {client.visits_count !== null && client.visits_count !== undefined && (
                        <p className="text-[10px] text-white/30">{client.visits_count} visitas</p>
                      )}
                    </div>

                    {/* Opt-in indicator */}
                    {client.marketing_opt_in === false && (
                      <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                        No opt-in
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="text-white font-medium">{selectedIds.size}</span> cliente{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}
            </p>
            <GlassButton onClick={() => setShowBuilder(true)} className="h-9 px-4">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Crear campaña
            </GlassButton>
          </div>
        )}
      </GlassCard>

      {/* Campaign builder modal */}
      <AnimatePresence>
        {showBuilder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowBuilder(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1117] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Nueva campaña</h2>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                      Enviando a <span className="text-white">{selectedIds.size}</span> clientes
                    </p>
                  </div>
                  <button
                    onClick={() => setShowBuilder(false)}
                    className="text-[var(--text-secondary)] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Templates */}
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                    Plantilla
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TEMPLATES.map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => applyTemplate(tmpl)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selectedTemplate.id === tmpl.id
                            ? "bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/30"
                            : "bg-white/3 border-white/8 hover:bg-white/6"
                        }`}
                      >
                        <div className="text-lg mb-0.5">{tmpl.icon}</div>
                        <div className="text-xs font-medium text-white">{tmpl.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
                    Asunto del email
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25 focus:border-[var(--accent-blue)]/40 focus:outline-none transition-colors"
                    placeholder="Asunto del email..."
                  />
                  <p className="text-[10px] text-[var(--text-secondary)]/60 mt-1">
                    Usa <code className="bg-white/5 px-1 rounded">{"{{nombre}}"}</code> y <code className="bg-white/5 px-1 rounded">{"{{negocio}}"}</code> para personalizar
                  </p>
                </div>

                {/* Body editor / preview toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                      Cuerpo del email
                    </label>
                    <button
                      onClick={() => setPreviewMode(!previewMode)}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
                    >
                      {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {previewMode ? "Editar" : "Previsualizar"}
                    </button>
                  </div>
                  {previewMode ? (
                    <div
                      className="rounded-xl border border-white/10 bg-white/3 p-4 text-sm text-white/80 min-h-[160px] prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: bodyHtml
                          .replace(/\{\{nombre\}\}/gi, "María García")
                          .replace(/\{\{negocio\}\}/gi, "Mi Barbería")
                      }}
                    />
                  ) : (
                    <textarea
                      value={bodyHtml}
                      onChange={e => setBodyHtml(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25 focus:border-[var(--accent-blue)]/40 focus:outline-none transition-colors resize-none font-mono text-xs"
                      placeholder="<p>Cuerpo del email en HTML...</p>"
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setShowBuilder(false)}
                    className="flex-1 h-11"
                  >
                    Cancelar
                  </GlassButton>
                  <GlassButton
                    onClick={sendCampaign}
                    disabled={sending || !subject.trim() || !bodyHtml.trim()}
                    className="flex-1 h-11"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar campaña
                      </>
                    )}
                  </GlassButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <GlassToast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  return (
    <ProtectedRoute requiredPermission="marketing">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/20" />
          </div>
        }
      >
        <MarketingContent />
      </Suspense>
    </ProtectedRoute>
  );
}
