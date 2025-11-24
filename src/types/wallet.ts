// Transaction types for wallet components
export interface Transaction {
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

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: string;
  created: string;
  description: string | null;
  method: string;
  type: string;
}

export interface Balance {
  pending: number;
  available: number;
  currency: string;
}
