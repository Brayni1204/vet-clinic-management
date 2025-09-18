export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}
