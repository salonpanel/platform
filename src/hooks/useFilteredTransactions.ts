'use client';

import { useMemo } from 'react';
import { Transaction } from '@/types/wallet';
import { WalletFilters } from '@/components/ui/WalletFilters';

export function useFilteredTransactions(transactions: Transaction[], filters: WalletFilters) {
  return useMemo(() => {
    let filtered = [...transactions];

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.description?.toLowerCase().includes(searchTerm) ||
        tx.type.toLowerCase().includes(searchTerm) ||
        tx.id.toLowerCase().includes(searchTerm)
      );
    }

    // Date range filter
    if (filters.dateRange.from || filters.dateRange.to) {
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.created);
        const fromDate = filters.dateRange.from ? new Date(filters.dateRange.from) : null;
        const toDate = filters.dateRange.to ? new Date(filters.dateRange.to) : null;
        
        if (fromDate && txDate < fromDate) return false;
        if (toDate && txDate > toDate) return false;
        
        return true;
      });
    }

    // Amount range filter
    if (filters.amountRange.min !== undefined || filters.amountRange.max !== undefined) {
      filtered = filtered.filter(tx => {
        const netAmount = tx.net;
        if (filters.amountRange.min !== undefined && netAmount < filters.amountRange.min) return false;
        if (filters.amountRange.max !== undefined && netAmount > filters.amountRange.max) return false;
        return true;
      });
    }

    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(tx => filters.status.includes(tx.status));
    }

    // Type filter
    if (filters.type.length > 0) {
      filtered = filtered.filter(tx => filters.type.includes(tx.type));
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(b.created).getTime() - new Date(a.created).getTime();
          break;
        case 'amount':
          comparison = b.net - a.net;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        default:
          comparison = new Date(b.created).getTime() - new Date(a.created).getTime();
      }
      
      return filters.sortOrder === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }, [transactions, filters]);
}
