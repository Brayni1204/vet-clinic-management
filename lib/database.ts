import { supabase, handleSupabaseError } from "./db"

// Database helper functions with proper error handling
export class DatabaseService {
  // Users/Staff operations
  static async getUsers() {
    try {
      const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  }

  static async createUser(userData: any) {
    try {
      const { data, error } = await supabase.from("users").insert([userData]).select().single()

      if (error) throw error
      return data
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  }

  // Owners/Clients operations
  static async getOwners() {
    try {
      const { data, error } = await supabase.from("owners").select("*").order("created_at", { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  }

  static async createOwner(ownerData: any) {
    try {
      const { data, error } = await supabase.from("owners").insert([ownerData]).select().single()

      if (error) throw error
      return data
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  }

  // Pets operations
  static async getPets() {
    try {
      const { data, error } = await supabase
        .from("pets")
        .select(`
          *,
          owners (
            id,
            name,
            email,
            phone
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  }

  static async createPet(petData: any) {
    try {
      const { data, error } = await supabase.from("pets").insert([petData]).select().single()

      if (error) throw error
      return data
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  }

  // Appointments operations
  static async getAppointments() {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          pets (
            id,
            name,
            species,
            breed,
            owners (
              id,
              name,
              phone
            )
          ),
          users (
            id,
            name,
            role
          )
        `)
        .order("appointment_date", { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  }

  static async createAppointment(appointmentData: any) {
    try {
      const { data, error } = await supabase.from("appointments").insert([appointmentData]).select().single()

      if (error) throw error
      return data
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  }

  // Products operations
  static async getProducts() {
    try {
      const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  }

  static async createProduct(productData: any) {
    try {
      const { data, error } = await supabase.from("products").insert([productData]).select().single()

      if (error) throw error
      return data
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  }

  // Medical Records operations
  static async getMedicalRecords(petId?: string) {
    try {
      let query = supabase
        .from("medical_records")
        .select(`
          *,
          pets (
            id,
            name,
            owners (
              id,
              name
            )
          ),
          users (
            id,
            name
          )
        `)
        .order("visit_date", { ascending: false })

      if (petId) {
        query = query.eq("pet_id", petId)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  }

  static async createMedicalRecord(recordData: any) {
    try {
      const { data, error } = await supabase.from("medical_records").insert([recordData]).select().single()

      if (error) throw error
      return data
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  }

  // Invoices operations
  static async getInvoices() {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          owners (
            id,
            name,
            email
          ),
          invoice_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products (
              id,
              name,
              category
            )
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  }

  static async createInvoice(invoiceData: any, items: any[]) {
    try {
      // Start a transaction
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert([invoiceData])
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Insert invoice items
      const itemsWithInvoiceId = items.map((item) => ({
        ...item,
        invoice_id: invoice.id,
      }))

      const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId)

      if (itemsError) throw itemsError

      return invoice
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  }
}
