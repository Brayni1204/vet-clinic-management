"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Calendar,
  PawPrint,
  DollarSign,
  Package,
  Settings,
  Home,
  Menu,
  X,
  UserCheck,
  BarChart3,
  Stethoscope,
  LogOut,
  ShoppingCart,
} from "lucide-react"
import { useAppConfig } from "@/context/AppConfigContext"

interface SidebarProps {
  userRole?: string
}

const menuItems = [
  {
    title: "Panel Principal",
    href: "/dashboard",
    icon: Home,
    roles: ["admin", "veterinarian", "receptionist"],
    permission: "dashboard",
  },
  {
    title: "Citas",
    href: "/appointments",
    icon: Calendar,
    roles: ["admin", "veterinarian", "receptionist"],
    permission: "appointments",
  },
  {
    title: "Mascotas y Dueños",
    href: "/pets",
    icon: PawPrint,
    roles: ["admin", "veterinarian", "receptionist"],
    permission: "pets",
  },
  {
    title: "Historiales Médicos",
    href: "/historiales",
    icon: Stethoscope,
    roles: ["admin", "veterinarian"],
    permission: "medical_records",
  },
  {
    title: "Ventas",
    href: "/ventas",
    icon: DollarSign,
    roles: ["admin", "receptionist"],
    permission: "sales",
  },
  {
    title: "Compras",
    href: "/compras",
    icon: ShoppingCart,
    roles: ["admin", "receptionist"],
    permission: "purchases",
  },
  {
    title: "Inventario",
    href: "/inventario",
    icon: Package,
    roles: ["admin", "receptionist"],
    permission: "inventory",
  },
  {
    title: "Pedidos Online",
    href: "/pedidos-online",
    icon: ShoppingCart,
    roles: ["admin", "receptionist"],
    permission: "client_orders",
  },
  {
    title: "Reportes",
    href: "/reportes",
    icon: BarChart3,
    roles: ["admin"],
    permission: "reports",
  },
  {
    title: "Personal",
    href: "/personal",
    icon: UserCheck,
    roles: ["admin"],
    permission: "staff_management",
  },
  {
    title: "Configuración",
    href: "/configuracion",
    icon: Settings,
    roles: ["admin"],
    permission: "configuration",
  },
]

export function Sidebar({ userRole = "admin" }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { clinicName } = useAppConfig()
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/auth/me")
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      }
    } catch (error) {
      console.error("Failed to fetch user:", error)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (response.ok) {
        router.push("/login")
      }
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const hasPermission = (permission: string) => {
    if (!user) return false
    return user.role === "admin" || user.permissions?.includes("all") || user.permissions?.includes(permission)
  }

  const filteredMenuItems = menuItems.filter(
    (item) => item.roles.includes(user?.role || userRole) && hasPermission(item.permission),
  )

  const toggleSidebar = () => setIsOpen(!isOpen)

  return (
    <>
      {/* Mobile menu button */}
      <Button variant="ghost" size="sm" className="fixed top-4 left-4 z-50 md:hidden" onClick={toggleSidebar}>
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={toggleSidebar} />}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <PawPrint className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">{clinicName}</h1>
                <p className="text-sm text-gray-600">Sistema Veterinario</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.title}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">{user?.full_name || "Usuario"}</p>
                <p className="text-xs capitalize">{user?.role || userRole}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="w-full bg-transparent">
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
