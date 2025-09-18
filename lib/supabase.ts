import { createClient } from "@supabase/supabase-js"

// Get environment variables with fallbacks for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn("⚠️ Supabase environment variables are not configured properly")
  console.warn("Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Error handling helper
export const handleSupabaseError = (error: any) => {
  console.error("Supabase error:", error)

  if (error?.message?.includes("Invalid API key")) {
    throw new Error("Configuración de Supabase incorrecta. Verifica tus variables de entorno.")
  }

  if (error?.message?.includes("Network")) {
    throw new Error("Error de conexión. Verifica tu conexión a internet.")
  }

  throw error
}

// Database helper functions
export const db = {
  // Users
  async getUsers() {
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

    if (error) handleSupabaseError(error)
    return data || []
  },

  async createUser(userData: any) {
    const { data, error } = await supabase.from("users").insert([userData]).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  async updateUser(id: string, userData: any) {
    const { data, error } = await supabase.from("users").update(userData).eq("id", id).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  // Owners
  async getOwners() {
    const { data, error } = await supabase.from("owners").select("*").order("last_name", { ascending: true })

    if (error) handleSupabaseError(error)
    return data || []
  },

  async createOwner(ownerData: any) {
    const { data, error } = await supabase.from("owners").insert([ownerData]).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  async updateOwner(id: string, ownerData: any) {
    const { data, error } = await supabase.from("owners").update(ownerData).eq("id", id).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  // Pets
  async getPets() {
    const { data, error } = await supabase
      .from("pets")
      .select(`
        *,
        owners (
          id,
          first_name,
          last_name,
          phone,
          email
        )
      `)
      .order("name", { ascending: true })

    if (error) handleSupabaseError(error)
    return data || []
  },

  async createPet(petData: any) {
    const { data, error } = await supabase.from("pets").insert([petData]).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  async updatePet(id: string, petData: any) {
    const { data, error } = await supabase.from("pets").update(petData).eq("id", id).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  // Appointments
  async getAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        pets (
          name,
          species,
          owners (
            first_name,
            last_name
          )
        ),
        users (
          full_name
        )
      `)
      .order("appointment_date", { ascending: true })

    if (error) handleSupabaseError(error)
    return data || []
  },

  async createAppointment(appointmentData: any) {
    const { data, error } = await supabase.from("appointments").insert([appointmentData]).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  async updateAppointment(id: string, appointmentData: any) {
    const { data, error } = await supabase.from("appointments").update(appointmentData).eq("id", id).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  // Medical Records
  async getMedicalRecords() {
    const { data, error } = await supabase
      .from("medical_records")
      .select(`
        *,
        pets (
          name,
          species,
          owners (
            first_name,
            last_name
          )
        ),
        users (
          full_name
        )
      `)
      .order("visit_date", { ascending: false })

    if (error) handleSupabaseError(error)
    return data || []
  },

  async createMedicalRecord(recordData: any) {
    const { data, error } = await supabase.from("medical_records").insert([recordData]).select().single()

    if (error) handleSupabaseError(error)
    return data
  },

  // Products
  async getProducts() {
    const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true })

    if (error) handleSupabaseError(error)
    return data || []
  },

  // Configuration
  async getConfiguration() {
    const { data, error } = await supabase.from("clinic_configuration").select("*").single()

    if (error && error.code !== "PGRST116") {
      // Not found error
      handleSupabaseError(error)
    }
    return data
  },

  async saveConfiguration(configData: any) {
    // First try to update existing configuration
    const { data: existing } = await supabase.from("clinic_configuration").select("id").single()

    if (existing) {
      const { data, error } = await supabase
        .from("clinic_configuration")
        .update(configData)
        .eq("id", existing.id)
        .select()
        .single()

      if (error) handleSupabaseError(error)
      return data
    } else {
      // Create new configuration
      const { data, error } = await supabase.from("clinic_configuration").insert([configData]).select().single()

      if (error) handleSupabaseError(error)
      return data
    }
  },

  // Client Orders
  async getClientOrders() {
    const { data, error } = await supabase
      .from("client_orders")
      .select(`
        *,
        owners (
          first_name,
          last_name,
          email,
          phone
        ),
        order_items (
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          products (
            name,
            category
          )
        )
      `)
      .order("created_at", { ascending: false })

    if (error) handleSupabaseError(error)
    return data || []
  },

  async updateOrderStatus(id: string, status: string) {
    const { data, error } = await supabase.from("client_orders").update({ status }).eq("id", id).select().single()

    if (error) handleSupabaseError(error)
    return data
  },
}
