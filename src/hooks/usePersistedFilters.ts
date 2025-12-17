'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { WalletFilters } from '@/components/ui/WalletFilters';

interface FilterState extends WalletFilters {
  // Additional URL-specific state
  tab?: string;
}

export function usePersistedFilters(initialFilters?: Partial<WalletFilters>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Initialize filters from URL params or defaults
  const [filters, setFilters] = useState<WalletFilters>(() => {
    const urlFilters: Partial<WalletFilters> = {};
    
    // Parse URL parameters
    const search = searchParams.get('search');
    if (search) urlFilters.search = search;
    
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    if (dateFrom || dateTo) {
      urlFilters.dateRange = {
        from: dateFrom ? new Date(dateFrom) : undefined,
        to: dateTo ? new Date(dateTo) : undefined,
      };
    }
    
    const amountMin = searchParams.get('amountMin');
    const amountMax = searchParams.get('amountMax');
    if (amountMin || amountMax) {
      urlFilters.amountRange = {
        min: amountMin ? Number(amountMin) : undefined,
        max: amountMax ? Number(amountMax) : undefined,
      };
    }
    
    const status = searchParams.get('status');
    if (status) urlFilters.status = status.split(',');
    
    const type = searchParams.get('type');
    if (type) urlFilters.type = type.split(',');
    
    const sortBy = searchParams.get('sortBy');
    if (sortBy) urlFilters.sortBy = sortBy as WalletFilters['sortBy'];
    
    const sortOrder = searchParams.get('sortOrder');
    if (sortOrder) urlFilters.sortOrder = sortOrder as WalletFilters['sortOrder'];
    
    return {
      search: '',
      dateRange: { from: undefined, to: undefined },
      amountRange: { min: undefined, max: undefined },
      status: [],
      type: [],
      sortBy: 'date',
      sortOrder: 'desc',
      ...initialFilters,
      ...urlFilters,
    };
  });
  
  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    // Only add non-default values to URL
    if (filters.search) params.set('search', filters.search);
    
    if (filters.dateRange.from) {
      params.set('dateFrom', filters.dateRange.from.toISOString().split('T')[0]);
    }
    if (filters.dateRange.to) {
      params.set('dateTo', filters.dateRange.to.toISOString().split('T')[0]);
    }
    
    if (filters.amountRange.min !== undefined) {
      params.set('amountMin', filters.amountRange.min.toString());
    }
    if (filters.amountRange.max !== undefined) {
      params.set('amountMax', filters.amountRange.max.toString());
    }
    
    if (filters.status.length > 0) {
      params.set('status', filters.status.join(','));
    }
    
    if (filters.type.length > 0) {
      params.set('type', filters.type.join(','));
    }
    
    if (filters.sortBy !== 'date') {
      params.set('sortBy', filters.sortBy);
    }
    
    if (filters.sortOrder !== 'desc') {
      params.set('sortOrder', filters.sortOrder);
    }
    
    // Update URL without page reload
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [filters, pathname, router]);
  
  // Helper function to clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      dateRange: { from: undefined, to: undefined },
      amountRange: { min: undefined, max: undefined },
      status: [],
      type: [],
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };
  
  // Helper function to check if filters are active
  const hasActiveFilters = () => {
    return (
      filters.search ||
      filters.dateRange.from ||
      filters.dateRange.to ||
      filters.amountRange.min !== undefined ||
      filters.amountRange.max !== undefined ||
      filters.status.length > 0 ||
      filters.type.length > 0
    );
  };
  
  return {
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
  };
}

// Helper to get tab from URL
export function usePersistedTab(defaultTab: string = 'overview') {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || defaultTab;
  });
  
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    if (activeTab === defaultTab) {
      params.delete('tab');
    } else {
      params.set('tab', activeTab);
    }
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [activeTab, defaultTab, pathname, router, searchParams]);
  
  return { activeTab, setActiveTab };
}
