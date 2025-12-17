"use client";

import { createContext, useContext, ReactNode } from "react";

// Define TenantInfo interface matching what's used in Layout/Supabase
export type TenantInfo = {
    id: string;
    name: string;
    slug: string;
    timezone: string;
};

type TenantContextType = {
    tenant: TenantInfo | null;
    isLoading: boolean;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({
    children,
    tenant,
    isLoading = false,
}: {
    children: ReactNode;
    tenant: TenantInfo | null;
    isLoading?: boolean;
}) {
    return (
        <TenantContext.Provider value={{ tenant, isLoading }}>
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error("useTenant must be used within a TenantProvider");
    }
    return context;
}
