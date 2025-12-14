"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        <>
            {memberships.map((m) => {
                const tenant = m.tenants;
                if (!tenant) return null;
                return (
                    <button
                        key={tenant.id}
                        onClick={() => handleSelect(tenant.id)}
                        disabled={loading !== null}
                        className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <span className="font-medium text-white">{tenant.name}</span>
                        <span className="text-xs text-slate-500 uppercase">{tenant.slug}</span>
                    </button>
                );
            })}
        </>
    );
}
