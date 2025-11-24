'use client';

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Eye,
  Copy,
  ExternalLink
} from "lucide-react";
import { Button, Card } from "@/components/ui";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  fee: number;
  net: number;
  status: string;
  created: string;
  description: string | null;
  source?: any;
}

interface TransactionItemProps {
  transaction: Transaction;
  isExpanded?: boolean;
  onToggle?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function TransactionItem({
  transaction,
  isExpanded = false,
  onToggle,
  showDetails = true,
  className
}: TransactionItemProps) {
  const [copiedId, setCopiedId] = useState(false);

  const formatCurrency = (amount: number, currency: string = "eur") => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionTypeInfo = (type: string) => {
    const types = {
      charge: { label: "Pago", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
      refund: { label: "Reembolso", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
      payout: { label: "Payout", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
      fee: { label: "Comisión", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
      adjustment: { label: "Ajuste", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
    };
    return types[type as keyof typeof types] || { label: type, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30" };
  };

  const getStatusInfo = (status: string) => {
    const statuses = {
      succeeded: { label: "Completado", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
      paid: { label: "Pagado", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
      pending: { label: "Pendiente", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" },
      failed: { label: "Fallido", icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" },
      in_transit: { label: "En tránsito", icon: Clock, color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30" },
      canceled: { label: "Cancelado", icon: AlertCircle, color: "text-slate-400", bg: "bg-slate-500/15", border: "border-slate-500/30" },
    };
    return statuses[status as keyof typeof statuses] || { label: status, icon: Info, color: "text-slate-400", bg: "bg-slate-500/15", border: "border-slate-500/30" };
  };

  const typeInfo = getTransactionTypeInfo(transaction.type);
  const statusInfo = getStatusInfo(transaction.status);
  const StatusIcon = statusInfo.icon;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        variant="default"
        padding="compact"
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-md",
          isExpanded && "ring-1 ring-blue-500/50",
          className
        )}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              {/* Type indicator */}
              <div className={cn(
                "rounded-lg p-2 border flex-shrink-0",
                typeInfo.bg,
                typeInfo.border
              )}>
                <TrendingUp className={cn("h-4 w-4", typeInfo.color)} />
              </div>

              {/* Type and status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white truncate">
                    {typeInfo.label}
                  </span>
                  <div className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium flex-shrink-0",
                    statusInfo.bg,
                    statusInfo.border,
                    statusInfo.color
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">{statusInfo.label}</span>
                    <span className="sm:hidden">✓</span>
                  </div>
                </div>

                {/* Description and date */}
                {transaction.description && (
                  <p className="text-sm text-slate-400 mb-1 truncate">
                    {transaction.description}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  {formatDate(transaction.created)}
                </p>
              </div>
            </div>
          </div>

          {/* Right side - Amount and actions */}
          <div className="flex items-start gap-3 flex-shrink-0">
            {/* Amount */}
            <div className="text-right">
              <p className={cn(
                "font-bold text-lg mb-1",
                transaction.net >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {formatCurrency(transaction.net, transaction.currency)}
              </p>

              {transaction.fee > 0 && (
                <p className="text-xs text-slate-400">
                  Comisión: {formatCurrency(transaction.fee, transaction.currency)}
                </p>
              )}

              {/* Transaction ID */}
              <div className="flex items-center gap-1 mt-2">
                <code className="text-xs text-slate-500 font-mono bg-slate-800/50 px-2 py-0.5 rounded">
                  {transaction.id.substring(0, 8)}...
                </code>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(transaction.id);
                  }}
                  className="p-1 rounded hover:bg-slate-700/50 transition-colors"
                  title="Copiar ID"
                >
                  <Copy className="h-3 w-3 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Expand toggle */}
            {showDetails && (
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle?.();
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {isExpanded && showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 pt-4 border-t border-slate-700/50"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-white mb-2">Detalles de la transacción</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">ID:</span>
                      <code className="text-slate-300 font-mono text-xs bg-slate-800/50 px-2 py-1 rounded">
                        {transaction.id}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tipo:</span>
                      <span className="text-white">{typeInfo.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estado:</span>
                      <span className={statusInfo.color}>{statusInfo.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fecha:</span>
                      <span className="text-white">{formatDate(transaction.created)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Montos</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bruto:</span>
                      <span className="text-white">{formatCurrency(transaction.amount, transaction.currency)}</span>
                    </div>
                    {transaction.fee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Comisión:</span>
                        <span className="text-red-400">-{formatCurrency(transaction.fee, transaction.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-700/50 pt-2">
                      <span className="text-slate-400 font-medium">Neto:</span>
                      <span className={cn(
                        "font-medium",
                        transaction.net >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {formatCurrency(transaction.net, transaction.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Open Stripe dashboard
                    window.open(`https://dashboard.stripe.com/payments/${transaction.id}`, '_blank');
                  }}
                  icon={<ExternalLink className="h-3 w-3" />}
                >
                  Ver en Stripe
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

interface TransactionListProps {
  transactions: Transaction[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  showDetails?: boolean;
  virtualized?: boolean;
}

export function TransactionList({
  transactions,
  loading = false,
  emptyMessage = "No hay transacciones para mostrar",
  className,
  showDetails = true,
  virtualized = false
}: TransactionListProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (transactionId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedItems(newExpanded);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} variant="default" padding="compact" className="animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-slate-700 rounded"></div>
                  <div className="w-32 h-3 bg-slate-700 rounded"></div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="w-20 h-5 bg-slate-700 rounded"></div>
                <div className="w-16 h-3 bg-slate-700 rounded"></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">Sin transacciones</h3>
        <p className="text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {transactions.map((transaction) => (
        <TransactionItem
          key={transaction.id}
          transaction={transaction}
          isExpanded={expandedItems.has(transaction.id)}
          onToggle={() => toggleExpanded(transaction.id)}
          showDetails={showDetails}
        />
      ))}
    </div>
  );
}
