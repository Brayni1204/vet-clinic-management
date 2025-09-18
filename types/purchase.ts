import type { PurchaseItem } from '@/types/purchaseItem';

export interface Purchase {
  id: string;
  // Campos para compatibilidad con versiones anteriores
  productId?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  
  // Campos para la nueva estructura
  supplier: string;
  invoiceNumber: string;
  purchaseDate: string;
  total: number;
  items?: PurchaseItem[];
  notes?: string;
  createdAt: string;
}
