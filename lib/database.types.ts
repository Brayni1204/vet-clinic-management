export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      invoice_items: {
        Row: {
          id: string
          product_id: string
          unit_price: number
          quantity: number
          invoice_id: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          unit_price: number
          quantity: number
          invoice_id: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          unit_price?: number
          quantity?: number
          invoice_id?: string
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          invoice_date: string
          supplier: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          payment_status: string
          payment_method: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          invoice_date: string
          supplier?: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          payment_status: string
          payment_method?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          invoice_date?: string
          supplier?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          payment_status?: string
          payment_method?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          cost: number
          stock: number
          category: string | null
          supplier: string | null
          sku: string | null
          barcode: string | null
          min_stock: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          cost: number
          stock?: number
          category?: string | null
          supplier?: string | null
          sku?: string | null
          barcode?: string | null
          min_stock?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          cost?: number
          stock?: number
          category?: string | null
          supplier?: string | null
          sku?: string | null
          barcode?: string | null
          min_stock?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
