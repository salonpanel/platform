"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GlassCard } from "@/components/ui/glass";
import { Loader2, ArrowRight } from "lucide-react";

export default function SelectBusinessClient({ memberships }: { memberships: any[] }) {
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);

    const handleSelect = (tenantId: string) => {
        setLoading(tenantId);
        // Set cookie for preference
        document.cookie = `last_tenant_id=${tenantId}; path=/; max-age=31536000`;
        // Force refresh to trigger layout server-side logic
        router.refresh();
        router.push("/panel");
    };

    return (
        <div className="grid gap-4">
            {memberships.map((m) => {
                const tenant = m.tenants;
                if (!tenant) return null;
                const isLoading = loading === tenant.id;

                return (
                    <GlassCard
                        key={tenant.id}
                        variant="clickable"
                        onClick={() => !isLoading && handleSelect(tenant.id)}
                        className={`flex items-center justify-between p-5 group ${isLoading ? "opacity-70 pointer-events-none" : ""}`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (!isLoading) handleSelect(tenant.id);
                            }
                        }}
                    >
                        <div className="flex flex-col items-start gap-1">
                            <span className="font-semibold text-lg text-white group-hover:text-[var(--color-accent)] transition-colors">
                                {tenant.name}
                            </span>
                            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-medium">
                                {tenant.slug}
                            </span>
                        </div>

                        {isLoading ? (
                            <Loader2 className="h-5 w-5 text-[var(--text-secondary)] animate-spin" />
                        ) : (
                            <ArrowRight className="h-5 w-5 text-[var(--text-secondary)] group-hover:text-white group-hover:translate-x-1 transition-all" />
                        )}
                    </GlassCard>
                );
            })}
        </div>
    );
}
