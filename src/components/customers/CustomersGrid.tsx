"use client";

import { GlassCard } from "@/components/ui/glass/GlassCard";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { Calendar, Edit2, Trash2, LayoutList, Phone, Mail, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    segment: "normal" | "vip" | "banned" | "marketing" | "no_contact";
    visitCount: number;
    lastVisit?: string;
    totalSpent?: number;
    created_at: string;
}

interface CustomersGridProps {
    customers: Customer[];
    selectedCustomers: string[];
    onSelectCustomer: (id: string, selected: boolean) => void;
    onSelectAll: (selected: boolean) => void;
    onViewHistory: (id: string) => void;
    onEdit: (customer: Customer) => void;
    onDelete: (id: string) => void;
}

export function CustomersGrid({
    customers,
    selectedCustomers,
    onSelectCustomer,
    onSelectAll,
    onViewHistory,
    onEdit,
    onDelete,
}: CustomersGridProps) {
    const allSelected = customers.length > 0 && selectedCustomers.length === customers.length;

    if (customers.length === 0) {
        return (
            <GlassCard className="p-12 flex flex-col items-center justify-center text-center opacity-80">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <LayoutList className="w-8 h-8 text-[var(--text-secondary)]" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No hay clientes</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-sm">
                    No se encontraron clientes que coincidan con los filtros seleccionados o tu base de datos está vacía.
                </p>
            </GlassCard>
        );
    }

    return (
        <div className="space-y-4">
            {/* Desktop Header Row */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
                <div className="col-span-1 flex items-center">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => onSelectAll(e.target.checked)}
                        className="rounded border-white/20 bg-white/5 text-[var(--gradient-primary-start)] focus:ring-1 focus:ring-[var(--gradient-primary-start)]/50 cursor-pointer"
                    />
                </div>
                <div className="col-span-3">Cliente</div>
                <div className="col-span-2">Contacto</div>
                <div className="col-span-2">Segmento</div>
                <div className="col-span-2">Última Visita</div>
                <div className="col-span-2 text-right">Acciones</div>
            </div>

            <div className="space-y-4 md:space-y-2">
                {customers.map((customer) => {
                    const isSelected = selectedCustomers.includes(customer.id);

                    return (
                        <GlassCard
                            key={customer.id}
                            className={`p-4 md:py-3 transition-all duration-200 group ${isSelected ? "border-[var(--gradient-primary-start)]/30 bg-[var(--gradient-primary-start)]/5" : "hover:border-white/20"
                                }`}
                            noPadding={false}
                        >
                            {/* Desktop Layout (Grid) */}
                            <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-1">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => onSelectCustomer(customer.id, e.target.checked)}
                                        className="rounded border-white/20 bg-white/5 text-[var(--gradient-primary-start)] focus:ring-1 focus:ring-[var(--gradient-primary-start)]/50 cursor-pointer"
                                    />
                                </div>

                                <div className="col-span-3">
                                    <div className="font-bold text-white text-sm truncate">{customer.name}</div>
                                    <div className="text-xs text-[var(--text-secondary)] truncate flex items-center gap-1">
                                        <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{customer.visitCount} citas</span>
                                        {customer.totalSpent !== undefined && customer.totalSpent > 0 && (
                                            <span className="text-emerald-400">{(customer.totalSpent / 100).toFixed(0)}€</span>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-2 flex flex-col justify-center text-xs text-[var(--text-secondary)] truncate">
                                    {customer.email && (
                                        <div className="flex items-center gap-1.5 truncate" title={customer.email}>
                                            <Mail className="w-3 h-3 opacity-70" />
                                            <span className="truncate">{customer.email}</span>
                                        </div>
                                    )}
                                    {customer.phone && (
                                        <div className="flex items-center gap-1.5 truncate mt-0.5" title={customer.phone}>
                                            <Phone className="w-3 h-3 opacity-70" />
                                            <span>{customer.phone}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-2">
                                    <GlassBadge
                                        variant={
                                            customer.segment === "vip" ? "warning" :
                                                customer.segment === "banned" ? "danger" :
                                                    customer.segment === "marketing" ? "info" :
                                                        customer.segment === "no_contact" ? "neutral" : "default"
                                        }
                                        size="sm"
                                    >
                                        {customer.segment === "no_contact" ? "Sin contacto" : customer.segment}
                                    </GlassBadge>
                                </div>

                                <div className="col-span-2 text-xs text-[var(--text-secondary)]">
                                    {customer.lastVisit ? (
                                        <div className="flex flex-col">
                                            <span className="text-white">{format(new Date(customer.lastVisit), "d MMM yyyy", { locale: es })}</span>
                                            <span className="text-[10px] opacity-60">hace {Math.floor((new Date().getTime() - new Date(customer.lastVisit).getTime()) / (1000 * 60 * 60 * 24))} días</span>
                                        </div>
                                    ) : (
                                        <span className="opacity-50 italic">Sin visitas</span>
                                    )}
                                </div>

                                <div className="col-span-2 flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GlassButton variant="ghost" size="sm" onClick={() => onViewHistory(customer.id)} className="h-8 w-8 p-0">
                                        <Calendar className="w-3.5 h-3.5" />
                                    </GlassButton>
                                    <GlassButton variant="ghost" size="sm" onClick={() => onEdit(customer)} className="h-8 w-8 p-0">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </GlassButton>
                                    <GlassButton variant="ghost" size="sm" onClick={() => onDelete(customer.id)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </GlassButton>
                                </div>
                            </div>

                            {/* Mobile Layout (Flex Column) */}
                            <div className="flex md:hidden flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => onSelectCustomer(customer.id, e.target.checked)}
                                            className="mt-1 rounded border-white/20 bg-white/5 text-[var(--gradient-primary-start)] focus:ring-1 focus:ring-[var(--gradient-primary-start)]/50 cursor-pointer"
                                        />
                                        <div>
                                            <div className="font-bold text-white mb-0.5">{customer.name}</div>
                                            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                <GlassBadge
                                                    variant={
                                                        customer.segment === "vip" ? "warning" :
                                                            customer.segment === "banned" ? "danger" :
                                                                customer.segment === "marketing" ? "info" :
                                                                    customer.segment === "no_contact" ? "neutral" : "default"
                                                    }
                                                    size="sm"
                                                >
                                                    {customer.segment === "no_contact" ? "Sin contacto" : customer.segment}
                                                </GlassBadge>
                                                <span className="bg-white/5 px-1.5 py-0.5 rounded">{customer.visitCount} citas</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)] bg-white/[0.02] p-2 rounded-lg">
                                    {customer.email && (
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Mail className="w-3 h-3 opacity-70" />
                                            <span className="truncate">{customer.email}</span>
                                        </div>
                                    )}
                                    {customer.phone && (
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Phone className="w-3 h-3 opacity-70" />
                                            <span>{customer.phone}</span>
                                        </div>
                                    )}
                                    <div className="col-span-2 flex items-center gap-1.5 border-t border-white/5 pt-2 mt-0.5">
                                        <Clock className="w-3 h-3 opacity-70" />
                                        {customer.lastVisit ? format(new Date(customer.lastVisit), "d MMM yyyy", { locale: es }) : "Sin visitas"}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 border-t border-white/5 pt-2">
                                    <GlassButton variant="secondary" size="sm" onClick={() => onViewHistory(customer.id)} className="flex-1">
                                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                        Historial
                                    </GlassButton>
                                    <GlassButton variant="secondary" size="sm" onClick={() => onEdit(customer)} className="flex-1">
                                        <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                                        Editar
                                    </GlassButton>
                                    <GlassButton variant="ghost" size="sm" onClick={() => onDelete(customer.id)} className="text-red-400 hover:text-red-300 px-3">
                                        <Trash2 className="w-4 h-4" />
                                    </GlassButton>
                                </div>
                            </div>
                        </GlassCard>
                    );
                })}
            </div>
        </div>
    );
}
