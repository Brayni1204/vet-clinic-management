// Environment variables validation and configuration
export const env = {
  // Supabase configuration
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,

  // App configuration
  NODE_ENV: process.env.NODE_ENV || "development",

  // Validation
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
}

// Validate required environment variables
export function validateEnv() {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n\n` +
        "Please create a .env.local file with the following variables:\n" +
        missing.map((key) => `${key}=your_value_here`).join("\n"),
    )
  }
}

// Check if we're in a server environment
export const isServer = typeof window === "undefined"
