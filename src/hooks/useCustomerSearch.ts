import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export interface CustomerLite {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    notes?: string | null;
    created_at?: string;
}

interface UseCustomerSearchResult {
    query: string;
    setQuery: (q: string) => void;
    results: CustomerLite[];
    loading: boolean;
    error: string | null;
    search: (term: string) => Promise<void>;
}

export function useCustomerSearch(tenantId: string): UseCustomerSearchResult {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<CustomerLite[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const supabase = getSupabaseBrowser();
    const abortControllerRef = useRef<AbortController | null>(null);

    const search = useCallback(async (term: string) => {
        if (!term.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        if (!tenantId) return;

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.rpc('search_customers_v1', {
                p_tenant_id: tenantId,
                p_query: term,
                p_limit: 20
            });

            if (controller.signal.aborted) return;

            if (error) {
                throw error;
            }

            setResults(data || []);
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error('Customer search error:', err);
            setError('Error al buscar clientes');
            setResults([]);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [tenantId, supabase]);

    // Debounce effect
    useEffect(() => {
        const timer = setTimeout(() => {
            search(query);
        }, 300);

        return () => clearTimeout(timer);
    }, [query, search]);

    return {
        query,
        setQuery,
        results,
        loading,
        error,
        search
    };
}
