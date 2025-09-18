export interface PurchaseItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}
