"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { Calendar, PawPrint, DollarSign, Package, Users, TrendingUp, Clock, AlertCircle, Activity } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

interface RecentActivity {
  id: string
  message: string
  time: string
  icon: any
  color: string
}

interface DashboardStats {
  todayAppointments: number
  totalPets: number
  monthlyRevenue: number
  lowStockItems: number
  pendingOrders: number
  activeUsers: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    totalPets: 0,
    monthlyRevenue: 0,
    lowStockItems: 0,
    pendingOrders: 0,
    activeUsers: 0,
  })
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetchDashboardData()
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

  const fetchDashboardData = async () => {
    try {
      const today = new Date()
      const todayStr = today.toISOString().split("T")[0]
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthStartStr = firstDay.toISOString().split("T")[0]

      // Citas de hoy
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split("T")[0]

      const { data: appts } = await supabase
        .from("appointments")
        .select("id, pet_id, appointment_date")
        .gte("appointment_date", todayStr)
        .lt("appointment_date", tomorrowStr)
      const todayAppointments = (appts || []).length

      // Total de mascotas
      const { data: pets } = await supabase.from("pets").select("id")
      const totalPets = (pets || []).length

      // Ingresos del mes
      const { data: invoicesMonth } = await supabase
        .from("invoices")
        .select("total_amount")
        .gte("invoice_date", monthStartStr)
        .lte("invoice_date", todayStr)
      const monthlyRevenue = (invoicesMonth || []).reduce((acc, inv) => acc + (inv.total_amount || 0), 0)

      // Productos con poco stock
      const { data: lowStock } = await supabase
        .from("products")
        .select("id, stock_quantity, low_stock_threshold")
      const lowStockItems = (lowStock || []).filter((p: any) => p.stock_quantity <= (p.low_stock_threshold ?? 10)).length

      // Pedidos pendientes
      const { data: pending } = await supabase
        .from("client_orders")
        .select("id")
        .eq("status", "pending")
      const pendingOrders = (pending || []).length

      // Actividad reciente (últimas 10 acciones)
      const activities: RecentActivity[] = []
      // últimas citas
      const { data: lastAppts } = await supabase
        .from("appointments")
        .select(`id, appointment_date, pets ( name )`)
        .order("appointment_date", { ascending: false })
        .limit(3)
      if (lastAppts) {
        lastAppts.forEach((a: any) => {
          activities.push({
            id: `appt-${a.id}`,
            message: `Cita creada para ${a.pets?.name ?? "Mascota"}`,
            time: new Date(a.appointment_date).toLocaleString("es-ES"),
            icon: Calendar,
            color: "text-blue-600",
          })
        })
      }
      // últimas ventas
      const { data: lastInvoices } = await supabase
        .from("invoices")
        .select("id, invoice_date, total_amount")
        .order("invoice_date", { ascending: false })
        .limit(3)
      if (lastInvoices) {
        lastInvoices.forEach((inv: any) => {
          activities.push({
            id: `inv-${inv.id}`,
            message: `Venta realizada S/.${inv.total_amount}`,
            time: new Date(inv.invoice_date).toLocaleDateString("es-ES"),
            icon: DollarSign,
            color: "text-green-600",
          })
        })
      }
      // nuevas mascotas
      const { data: lastPets } = await supabase
        .from("pets")
        .select("id, name, species, created_at")
        .order("created_at", { ascending: false })
        .limit(3)
      if (lastPets) {
        lastPets.forEach((p: any) => {
          activities.push({
            id: `pet-${p.id}`,
            message: `Nueva mascota: ${p.name} (${p.species})`,
            time: new Date(p.created_at).toLocaleDateString("es-ES"),
            icon: PawPrint,
            color: "text-purple-600",
          })
        })
      }

      activities.sort((a, b) => (a.time < b.time ? 1 : -1))
      setRecentActivities(activities.slice(0, 10))

      // Usuarios activos
      const { data: activeUsersData } = await supabase.from("users").select("id").eq("status", "active")
      const activeUsers = (activeUsersData || []).length

      setStats({
        todayAppointments,
        totalPets,
        monthlyRevenue,
        lowStockItems,
        pendingOrders,
        activeUsers,
      })
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Buenos días"
    if (hour < 18) return "Buenas tardes"
    return "Buenas noches"
  }

  const quickActions = [
    {
      title: "Nueva Cita",
      description: "Agendar una nueva cita",
      href: "/appointments",
      icon: Calendar,
      color: "bg-blue-500",
    },
    {
      title: "Registrar Mascota",
      description: "Agregar nueva mascota",
      href: "/pets",
      icon: PawPrint,
      color: "bg-green-500",
    },
    {
      title: "Nueva Venta",
      description: "Procesar venta",
      href: "/ventas",
      icon: DollarSign,
      color: "bg-yellow-500",
    },
    {
      title: "Inventario",
      description: "Gestionar productos",
      href: "/inventario",
      icon: Package,
      color: "bg-purple-500",
    },
  ]

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 ml-0 md:ml-64 p-8">
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-0 md:ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                {getGreeting()}, {user?.full_name || "Usuario"}
              </h1>
              <p className="text-gray-600 mt-2">Aquí tienes un resumen de la actividad de tu clínica veterinaria</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Citas Hoy</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.todayAppointments}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Mascotas</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalPets}</p>
                    </div>
                    <PawPrint className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ingresos Mes</p>
                      <p className="text-2xl font-bold text-gray-900">S/.{stats.monthlyRevenue.toLocaleString()}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.lowStockItems}</p>
                    </div>
                    <Package className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pedidos Pendientes</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.pendingOrders}</p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Acciones Rápidas
                  </CardTitle>
                  <CardDescription>Accede rápidamente a las funciones más utilizadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {quickActions.map((action) => {
                      const Icon = action.icon
                      return (
                        <Link key={action.href} href={action.href}>
                          <Button
                            variant="outline"
                            className="h-auto p-4 flex flex-col items-center gap-2 w-full bg-transparent"
                          >
                            <div className={`p-2 rounded-full ${action.color} text-white`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="text-center">
                              <p className="font-medium text-sm">{action.title}</p>
                              <p className="text-xs text-gray-600">{action.description}</p>
                            </div>
                          </Button>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>Últimas actividades en el sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivities.map((activity) => {
                      const Icon = activity.icon
                      return (
                        <div key={activity.id} className="flex items-start gap-3">
                          <Icon className={`h-5 w-5 mt-0.5 ${activity.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                            <p className="text-xs text-gray-500">{activity.time}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
