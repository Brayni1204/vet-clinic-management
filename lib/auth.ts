"use server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function signIn(email: string, password: string) {
  // Demo users with proper role-based access
  const demoUsers = [
    {
      email: "admin@veterinaria.com",
      password: "password",
      role: "admin",
      full_name: "Administrador Principal",
      permissions: ["all"],
    },
    {
      email: "vet1@veterinaria.com",
      password: "password",
      role: "veterinarian",
      full_name: "Dr. María García",
      permissions: ["appointments", "pets", "medical_records", "reports"],
    },
    {
      email: "vet2@veterinaria.com",
      password: "password",
      role: "veterinarian",
      full_name: "Dr. Carlos López",
      permissions: ["appointments", "pets", "medical_records", "reports"],
    },
    {
      email: "recepcion@veterinaria.com",
      password: "password",
      role: "receptionist",
      full_name: "Ana Martínez",
      permissions: ["appointments", "pets", "sales", "inventory", "client_orders"],
    },
  ]

  const user = demoUsers.find((u) => u.email === email && u.password === password)

  if (!user) {
    return { error: "Correo electrónico o contraseña incorrectos" }
  }

  // Set session cookie with user data
  const cookieStore = await cookies()
  const sessionData = {
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    permissions: user.permissions,
    loginTime: new Date().toISOString(),
  }

  cookieStore.set("session", JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    sameSite: "lax",
  })

  return {
    success: true,
    user: {
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      permissions: user.permissions,
    },
  }
}

export async function signOut() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
  redirect("/login")
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get("session")

  if (!session) {
    return null
  }

  try {
    const userData = JSON.parse(session.value)

    // Check if session is expired (optional)
    const loginTime = new Date(userData.loginTime)
    const now = new Date()
    const hoursSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLogin > 24 * 7) {
      // 7 days
      return null
    }

    return userData
  } catch {
    return null
  }
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

export async function requirePermission(permission: string) {
  const user = await requireAuth()

  if (user.role === "admin" || user.permissions.includes("all") || user.permissions.includes(permission)) {
    return user
  }

  redirect("/dashboard?error=unauthorized")
}
