'use client';

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, RefreshCw, TrendingUp, DollarSign, BarChart3, Clock, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Card, Button, Spinner, EmptyState, Alert, TitleBar } from "@/components/ui";
import { BalanceCard, BalanceGrid } from "@/components/ui/BalanceCard";
import { MetricCard, MetricsGrid } from "@/components/ui/MetricCard";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { Transaction, Payout, Balance } from '@/types/wallet';
import { WalletFiltersComponent, useWalletFilters } from "@/components/ui/WalletFilters";
import { TransactionList } from "@/components/ui/TransactionList";
import { useFilteredTransactions } from "@/hooks/useFilteredTransactions";
import { usePersistedFilters, usePersistedTab } from "@/hooks/usePersistedFilters";
import { cn } from "@/lib/utils";

export default function MonederoPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Hook para filtros con persistencia en URL
  const { filters, setFilters, clearFilters, hasActiveFilters } = usePersistedFilters();
  
  // Hook para tab con persistencia en URL
  const { activeTab, setActiveTab } = usePersistedTab('overview');
  
  // Apply filters to transactions
  const filteredTransactions = useFilteredTransactions(transactions, filters);

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

  // Calculate KPIs from data
  const calculateKPIs = () => {
    if (!balance || transactions.length === 0) return null;
    
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(tx => tx.status === 'succeeded').length;
    const totalRevenue = transactions.filter(tx => tx.status === 'succeeded').reduce((sum, tx) => sum + tx.net, 0);
    const totalFees = transactions.reduce((sum, tx) => sum + tx.fee, 0);
    const averageTransaction = successfulTransactions > 0 ? totalRevenue / successfulTransactions : 0;
    
    // Calculate monthly revenue (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyRevenue = transactions
      .filter(tx => new Date(tx.created) >= thirtyDaysAgo && tx.status === 'succeeded')
      .reduce((sum, tx) => sum + tx.net, 0);
    
    return {
      totalRevenue,
      monthlyRevenue,
      averageTransaction,
      totalFees,
      successRate: totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0,
      totalTransactions,
      successfulTransactions
    };
  };
  
  const kpis = calculateKPIs();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <ProtectedRoute requiredPermission="reportes">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
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
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert type="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      {/* Balance Cards with Premium Design */}
      {balance && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <BalanceGrid>
            <BalanceCard
              title="Pendiente"
              amount={balance.pending}
              currency={balance.currency}
              subtitle="Dinero retenido temporalmente"
              icon={<Clock className="h-5 w-5" />}
              variant="pending"
              tooltip={
                <div className="space-y-2">
                  <p className="text-sm font-medium">Fondos pendientes</p>
                  <p className="text-xs text-slate-300">
                    Los pagos se retienen 24-48 horas antes de estar disponibles para payout.
                  </p>
                  <p className="text-xs text-slate-400">
                    Próxima liberación: {new Date(Date.now() + 86400000).toLocaleDateString('es-ES')}
                  </p>
                </div>
              }
            />
            <BalanceCard
              title="Disponible"
              amount={balance.available}
              currency={balance.currency}
              subtitle="Listo para payout"
              icon={<DollarSign className="h-5 w-5" />}
              variant="available"
              trend={kpis ? {
                value: Math.round((kpis.monthlyRevenue / Math.max(kpis.totalRevenue, 1)) * 100),
                isPositive: kpis.monthlyRevenue > 0,
                label: "vs mes anterior"
              } : undefined}
              tooltip={
                <div className="space-y-2">
                  <p className="text-sm font-medium">Fondos disponibles</p>
                  <p className="text-xs text-slate-300">
                    Dinero listo para transferir a tu cuenta bancaria.
                  </p>
                  <p className="text-xs text-slate-400">
                    Mínimo para payout: €10.00
                  </p>
                </div>
              }
            />
            <BalanceCard
              title="Total Balance"
              amount={balance.pending + balance.available}
              currency={balance.currency}
              subtitle="Balance total"
              icon={<Wallet className="h-5 w-5" />}
              variant="total"
              tooltip={
                <div className="space-y-2">
                  <p className="text-sm font-medium">Balance total</p>
                  <p className="text-xs text-slate-300">
                    Suma de fondos pendientes y disponibles.
                  </p>
                </div>
              }
            />
          </BalanceGrid>
        </motion.div>
      )}

      {/* KPIs Metrics */}
      {kpis && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white mb-1">Métricas Clave</h3>
            <p className="text-sm text-slate-400">Análisis de rendimiento de tu cuenta</p>
          </div>
          <MetricsGrid columns={4}>
            <MetricCard
              title="Ingresos Totales"
              value={formatCurrency(kpis.totalRevenue)}
              subtitle="Todos los tiempos"
              icon={<TrendingUp className="h-4 w-4" />}
              variant="success"
            />
            <MetricCard
              title="Ingresos Mensuales"
              value={formatCurrency(kpis.monthlyRevenue)}
              subtitle="Últimos 30 días"
              icon={<BarChart3 className="h-4 w-4" />}
              variant="info"
              trend={{
                value: Math.round((kpis.monthlyRevenue / Math.max(kpis.totalRevenue, 1)) * 100),
                label: "vs total",
                direction: kpis.monthlyRevenue > 0 ? 'up' : 'neutral'
              }}
            />
            <MetricCard
              title="Transacción Promedio"
              value={formatCurrency(kpis.averageTransaction)}
              subtitle="Por pago exitoso"
              icon={<DollarSign className="h-4 w-4" />}
              variant="default"
            />
            <MetricCard
              title="Tasa de Éxito"
              value={`${Math.round(kpis.successRate)}%`}
              subtitle={`${kpis.successfulTransactions}/${kpis.totalTransactions} pagos`}
              icon={<TrendingUp className="h-4 w-4" />}
              variant={kpis.successRate >= 95 ? 'success' : kpis.successRate >= 85 ? 'warning' : 'danger'}
              trend={{
                value: Math.round(kpis.successRate),
                label: "de transacciones",
                direction: kpis.successRate >= 95 ? 'up' : kpis.successRate >= 85 ? 'neutral' : 'down'
              }}
            />
          </MetricsGrid>
        </motion.div>
      )}

      {/* Filters and Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        {/* Filters */}
        <WalletFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
          compact={activeTab === 'overview'}
          className="mb-6"
        />

        {/* Tabs */}
        <Card variant="glass" padding="none">
          <div className="border-b border-slate-700/50">
            <nav className="flex space-x-1 px-4">
              <button
                onClick={() => setActiveTab('overview')}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors",
                  "border-b-2 border-transparent",
                  activeTab === 'overview'
                    ? "text-white border-blue-500"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Resumen
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors",
                  "border-b-2 border-transparent",
                  activeTab === 'transactions'
                    ? "text-white border-blue-500"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Movimientos {transactions.length > 0 && `(${transactions.length})`}
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors",
                  "border-b-2 border-transparent",
                  activeTab === 'payouts'
                    ? "text-white border-blue-500"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Payouts {payouts.length > 0 && `(${payouts.length})`}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && balance && (
              <div className="space-y-6">
                {/* Balance Summary */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Balance Detallado</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-3 border-b border-slate-700/30">
                      <span className="text-sm text-slate-400">Total Pendiente</span>
                      <span className="font-semibold text-white">
                        {formatCurrency(balance.pending, balance.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-700/30">
                      <span className="text-sm text-slate-400">Total Disponible</span>
                      <span className="font-semibold text-emerald-400">
                        {formatCurrency(balance.available, balance.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                      <span className="text-sm font-medium text-white">Total Balance</span>
                      <span className="text-lg font-semibold text-white">
                        {formatCurrency(balance.pending + balance.available, balance.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                {kpis && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Estadísticas Rápidas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Comisiones Totales</p>
                        <p className="text-lg font-semibold text-red-400">
                          {formatCurrency(kpis.totalFees)}
                        </p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Total Transacciones</p>
                        <p className="text-lg font-semibold text-white">
                          {kpis.totalTransactions}
                        </p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Próximo Payout Estimado</p>
                        <p className="text-lg font-semibold text-emerald-400">
                          {balance.available >= 10 ? formatCurrency(balance.available) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Historial de Transacciones</h3>
                  <div className="flex items-center gap-3">
                    {hasActiveFilters() && (
                      <>
                        <span className="text-sm text-slate-400">
                          {filteredTransactions.length} de {transactions.length} transacciones encontradas
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="text-xs"
                        >
                          Limpiar filtros
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <TransactionList
                  transactions={filteredTransactions}
                  loading={loading}
                  emptyMessage={hasActiveFilters() 
                    ? "No hay transacciones que coincidan con los filtros" 
                    : "No hay transacciones aún"}
                  showDetails={true}
                />
              </div>
            )}

            {activeTab === 'payouts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Historial de Payouts</h3>
                  {payouts.length > 0 && (
                    <span className="text-sm text-slate-400">
                      {payouts.length} payouts
                    </span>
                  )}
                </div>
                
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
                                <div className="rounded-lg bg-purple-500/15 border border-purple-500/30 p-2">
                                  <Wallet className="h-4 w-4 text-purple-400" />
                                </div>
                                <span className="font-medium text-white">
                                  Payout
                                </span>
                                <span className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                                  statusConfig.className
                                )}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig.label}
                                </span>
                              </div>
                              {payout.description && (
                                <p className="text-sm text-slate-400 mb-1 truncate">
                                  {payout.description}
                                </p>
                              )}
                              <div className="space-y-1">
                                <p className="text-xs text-slate-400">
                                  Llegada: {formatDate(payout.arrival_date)}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Creado: {formatDate(payout.created)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-emerald-400 mb-1">
                                {formatCurrency(payout.amount, payout.currency)}
                              </p>
                              <p className="text-xs text-slate-400 mb-1">
                                {payout.method} · {payout.type}
                              </p>
                              <p className="text-xs font-mono text-slate-400">
                                {payout.id.substring(0, 12)}...
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
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
    </ProtectedRoute>
  );
}
