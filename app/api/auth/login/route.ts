import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 })
    }

    // Find user by email
    const { data: user, error } = await supabase.from("users").select("*").eq("email", email).single()

    if (error || !user) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    // Check if user is active
    if (user.status !== "active") {
      return NextResponse.json({ error: "Usuario inactivo" }, { status: 401 })
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: "24h" },
    )

    // Create response
    const response = NextResponse.json({
      message: "Login exitoso",
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    })

    // Set cookie
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24 hours
    })

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
