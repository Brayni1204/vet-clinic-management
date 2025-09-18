"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface AuthGuardProps {
  children: React.ReactNode
  requiredPermission?: string
  fallback?: React.ReactNode
}

export function AuthGuard({ children, requiredPermission, fallback }: AuthGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [requiredPermission])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me")

      if (!response.ok) {
        router.push("/login")
        return
      }

      const userData = await response.json()
      setUser(userData)

      if (requiredPermission) {
        const hasPermission =
          userData.role === "admin" ||
          userData.permissions?.includes("all") ||
          userData.permissions?.includes(requiredPermission)

        if (!hasPermission) {
          setIsAuthorized(false)
          return
        }
      }

      setIsAuthorized(true)
    } catch (error) {
      console.error("Auth check failed:", error)
      router.push("/login")
    }
  }

  if (isAuthorized === null) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (isAuthorized === false) {
    return (
      fallback || (
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h2>
            <p className="text-gray-600 mb-4">No tienes permisos para acceder a esta sección.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      )
    )
  }

  return <>{children}</>
}
