'use client';

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, RefreshCw, TrendingUp, Clock, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Card, Button, Spinner, EmptyState, Alert, TitleBar } from "@/components/ui";
import { cn } from "@/lib/utils";

type Balance = {
  pending: number;
  available: number;
  currency: string;
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  fee: number;
  net: number;
  status: string;
  created: string;
  description: string | null;
};

type Payout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: string;
  created: string;
  description: string | null;
  method: string;
  type: string;
};

export default function MonederoPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'balance' | 'transactions' | 'payouts'>('balance');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Cargar balance
      const balanceRes = await fetch("/api/payments/wallet/balance");
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData);
      } else {
        const errorData = await balanceRes.json();
        throw new Error(errorData.error || "Error al cargar balance");
      }

      // Cargar transacciones
      const transactionsRes = await fetch("/api/payments/wallet/transactions?limit=20");
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData.transactions || []);
      }

      // Cargar payouts
      const payoutsRes = await fetch("/api/payments/wallet/payouts?limit=10");
      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json();
        setPayouts(payoutsData.payouts || []);
      }
    } catch (err: any) {
      setError(err?.message || "Error al cargar datos del monedero");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      charge: "Pago",
      refund: "Reembolso",
      payout: "Payout",
      dispute: "Disputa",
      adjustment: "Ajuste",
      fee: "Comisión",
    };
    return labels[type] || type;
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
      succeeded: {
        label: "Completado",
        className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        icon: CheckCircle2,
      },
      paid: {
        label: "Pagado",
        className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        icon: CheckCircle2,
      },
      pending: {
        label: "Pendiente",
        className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        icon: Clock,
      },
      failed: {
        label: "Fallido",
        className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        icon: AlertCircle,
      },
      in_transit: {
        label: "En tránsito",
        className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
        icon: Clock,
      },
      canceled: {
        label: "Cancelado",
        className: "bg-stone-500/15 text-stone-300 border-stone-500/30",
        icon: AlertCircle,
      },
    };
    return configs[status] || {
      label: status,
      className: "bg-stone-500/15 text-stone-300 border-stone-500/30",
      icon: Info,
    };
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: "easeOut" as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" padding="md">
          <TitleBar
            title="Monedero"
            subtitle="Balance y movimientos de tu cuenta Stripe"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(true)}
              isLoading={refreshing}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Actualizar
            </Button>
          </TitleBar>
        </Card>
      </motion.div>

      {/* Error Alert */}
      {error && (
        <motion.div variants={itemVariants}>
          <Alert type="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      {/* Balance Cards */}
      {balance && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card variant="default" className="relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-[var(--radius-md)] bg-amber-500/15 border border-amber-500/30 p-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Pendiente
                  </span>
                </div>
                <p
                  className="text-3xl font-semibold mb-1"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text-primary)",
                  }}
                >
                  {formatCurrency(balance.pending, balance.currency)}
                </p>
                <p
                  className="text-xs"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Dinero retenido temporalmente (24-48h)
                </p>
              </div>
            </div>
          </Card>

          <Card variant="default" className="relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-[var(--radius-md)] bg-emerald-500/15 border border-emerald-500/30 p-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Disponible
                  </span>
                </div>
                <p
                  className="text-3xl font-semibold mb-1"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text-primary)",
                  }}
                >
                  {formatCurrency(balance.available, balance.currency)}
                </p>
                <p
                  className="text-xs"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Listo para payout
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" padding="none">
          <div className="border-b border-[var(--glass-border)]">
            <nav className="flex space-x-1 px-4">
              <button
                onClick={() => setActiveTab('balance')}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors",
                  "border-b-2 border-transparent",
                  activeTab === 'balance'
                    ? "text-[var(--text-primary)] border-[var(--accent-aqua)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
                style={{
                  fontFamily: "var(--font-heading)",
                }}
              >
                Balance
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors",
                  "border-b-2 border-transparent",
                  activeTab === 'transactions'
                    ? "text-[var(--text-primary)] border-[var(--accent-aqua)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
                style={{
                  fontFamily: "var(--font-heading)",
                }}
              >
                Movimientos {transactions.length > 0 && `(${transactions.length})`}
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors",
                  "border-b-2 border-transparent",
                  activeTab === 'payouts'
                    ? "text-[var(--text-primary)] border-[var(--accent-aqua)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
                style={{
                  fontFamily: "var(--font-heading)",
                }}
              >
                Payouts {payouts.length > 0 && `(${payouts.length})`}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'balance' && balance && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2">
                    <span
                      className="text-sm"
                      style={{
                        fontFamily: "var(--font-body)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Total Pendiente
                    </span>
                    <span
                      className="font-semibold"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatCurrency(balance.pending, balance.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span
                      className="text-sm"
                      style={{
                        fontFamily: "var(--font-body)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Total Disponible
                    </span>
                    <span
                      className="font-semibold"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatCurrency(balance.available, balance.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-[var(--glass-border)]">
                    <span
                      className="text-sm font-medium"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Total
                    </span>
                    <span
                      className="text-lg font-semibold"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatCurrency(balance.pending + balance.available, balance.currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <>
                {transactions.length === 0 ? (
                  <EmptyState
                    title="No hay transacciones aún"
                    description="Las transacciones aparecerán aquí cuando recibas pagos"
                    icon={<Wallet className="h-8 w-8" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => {
                      const statusConfig = getStatusConfig(tx.status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <Card key={tx.id} variant="default" padding="compact" className="cursor-default">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={cn(
                                  "rounded-[var(--radius-md)] p-1.5",
                                  "bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)]"
                                )}>
                                  <TrendingUp className="h-3.5 w-3.5 text-[var(--accent-aqua)]" />
                                </div>
                                <span
                                  className="font-medium truncate"
                                  style={{
                                    fontFamily: "var(--font-heading)",
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {getTransactionTypeLabel(tx.type)}
                                </span>
                                <span className={cn(
                                  "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-semibold",
                                  statusConfig.className
                                )}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig.label}
                                </span>
                              </div>
                              {tx.description && (
                                <p
                                  className="text-sm mb-1 truncate"
                                  style={{
                                    fontFamily: "var(--font-body)",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  {tx.description}
                                </p>
                              )}
                              <p
                                className="text-xs"
                                style={{
                                  fontFamily: "var(--font-body)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {formatDate(tx.created)}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p
                                className={cn(
                                  "font-semibold mb-1",
                                  tx.net >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}
                                style={{
                                  fontFamily: "var(--font-heading)",
                                }}
                              >
                                {formatCurrency(tx.net, tx.currency)}
                              </p>
                              {tx.fee > 0 && (
                                <p
                                  className="text-xs mb-1"
                                  style={{
                                    fontFamily: "var(--font-body)",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  Comisión: {formatCurrency(tx.fee, tx.currency)}
                                </p>
                              )}
                              <p
                                className="text-xs font-mono"
                                style={{
                                  fontFamily: "var(--font-body)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {tx.id.substring(0, 12)}...
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'payouts' && (
              <>
                {payouts.length === 0 ? (
                  <EmptyState
                    title="No hay payouts aún"
                    description="Los payouts aparecerán aquí cuando se procesen transferencias a tu cuenta bancaria"
                    icon={<Wallet className="h-8 w-8" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {payouts.map((payout) => {
                      const statusConfig = getStatusConfig(payout.status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <Card key={payout.id} variant="default" padding="compact" className="cursor-default">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={cn(
                                  "rounded-[var(--radius-md)] p-1.5",
                                  "bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)]"
                                )}>
                                  <Wallet className="h-3.5 w-3.5 text-[var(--accent-aqua)]" />
                                </div>
                                <span
                                  className="font-medium"
                                  style={{
                                    fontFamily: "var(--font-heading)",
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  Payout
                                </span>
                                <span className={cn(
                                  "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-semibold",
                                  statusConfig.className
                                )}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig.label}
                                </span>
                              </div>
                              {payout.description && (
                                <p
                                  className="text-sm mb-1 truncate"
                                  style={{
                                    fontFamily: "var(--font-body)",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  {payout.description}
                                </p>
                              )}
                              <div className="space-y-1">
                                <p
                                  className="text-xs"
                                  style={{
                                    fontFamily: "var(--font-body)",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  Llegada: {formatDate(payout.arrival_date)}
                                </p>
                                <p
                                  className="text-xs"
                                  style={{
                                    fontFamily: "var(--font-body)",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  Creado: {formatDate(payout.created)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p
                                className="font-semibold mb-1 text-emerald-400"
                                style={{
                                  fontFamily: "var(--font-heading)",
                                }}
                              >
                                {formatCurrency(payout.amount, payout.currency)}
                              </p>
                              <p
                                className="text-xs mb-1"
                                style={{
                                  fontFamily: "var(--font-body)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {payout.method} · {payout.type}
                              </p>
                              <p
                                className="text-xs font-mono"
                                style={{
                                  fontFamily: "var(--font-body)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {payout.id.substring(0, 12)}...
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Info Box */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" padding="md">
          <div className="flex items-start gap-3">
            <div className="rounded-[var(--radius-md)] bg-blue-500/15 border border-blue-500/30 p-2 flex-shrink-0">
              <Info className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3
                className="text-sm font-semibold mb-2"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-primary)",
                }}
              >
                Información importante
              </h3>
              <ul
                className="text-sm space-y-1.5 list-disc list-inside"
                style={{
                  fontFamily: "var(--font-body)",
                  color: "var(--text-secondary)",
                }}
              >
                <li>Los pagos se retienen 24-48 horas antes de estar disponibles</li>
                <li>Los payouts se realizan según tu configuración en Stripe</li>
                <li>Las comisiones de Stripe se deducen automáticamente</li>
                <li>Puedes ver más detalles en tu dashboard de Stripe</li>
              </ul>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
