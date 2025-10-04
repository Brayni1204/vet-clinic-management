"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  PawPrint,
  Users,
  Package,
  FileText,
} from "lucide-react"
import { supabase } from "@/lib/db"
import { Sidebar } from "@/components/sidebar"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface ReporteVentas {
  mes: string
  total_ventas: number
  cantidad_facturas: number
}

interface ProductoMasVendido {
  nombre: string
  categoria: string
  total_vendido: number
  ingresos: number
}

interface VentaDiariaBase {
  fecha: string
  fechaFormateada: string
  fechaCompleta?: string // Opcional, para mostrar en tooltip
  total_ventas: number
  cantidad_facturas: number
  promedio_venta: number
  dia_semana: string
}

interface VentaDiariaConFechaObj extends VentaDiariaBase {
  fechaObj: Date
}

interface VentasAnuales {
  año: number
  total_ventas: number
  cantidad_facturas: number
  promedio_venta: number
}

interface EstadisticasGenerales {
  total_mascotas: number
  total_duenos: number
  total_citas_mes: number
  total_ingresos_mes: number
  facturas_pendientes: number
  productos_stock_bajo: number
}

export default function ReportesPage() {
  const [estadisticas, setEstadisticas] = useState<EstadisticasGenerales | null>(null)
  const [ventasMensuales, setVentasMensuales] = useState<ReporteVentas[]>([])
  const [productosMasVendidos, setProductosMasVendidos] = useState<ProductoMasVendido[]>([])
  const [historialVentas, setHistorialVentas] = useState<VentasAnuales[]>([])
  const [ventasDiarias, setVentasDiarias] = useState<VentaDiariaBase[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [loadingDiario, setLoadingDiario] = useState(false)
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("mes_actual")

  useEffect(() => {
    fetchEstadisticas()
    fetchVentasMensuales()
    fetchProductosMasVendidos()
    fetchHistorialVentas()
    fetchVentasDiarias()
  }, [periodoSeleccionado])

  const fetchEstadisticas = async () => {
    try {
      const fechaActual = new Date()
      const inicioMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
      const finMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0)

      // Obtener el umbral de stock bajo de la configuración
      const { data: config } = await supabase
        .from('clinic_configuration')
        .select('low_stock_threshold')
        .single()

      const lowStockThreshold = config?.low_stock_threshold || 5

      const [
        { count: totalMascotas },
        { count: totalDuenos },
        { count: totalCitasMes },
        { data: ingresosMes },
        { count: facturasPendientes },
        { count: productosStockBajo },
      ] = await Promise.all([
        supabase.from("pets").select("*", { count: "exact", head: true }),
        supabase.from("owners").select("*", { count: "exact", head: true }),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .gte("appointment_date", inicioMes.toISOString().split("T")[0])
          .lte("appointment_date", finMes.toISOString().split("T")[0]),
        supabase
          .from("invoices")
          .select("total_amount")
          .gte("invoice_date", inicioMes.toISOString().split("T")[0])
          .lte("invoice_date", finMes.toISOString().split("T")[0])
          .eq("payment_status", "paid"),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("payment_status", "pending"),
        supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .lte('stock_quantity', lowStockThreshold)
          .gt('stock_quantity', 0), // Solo mostrar productos con stock mayor a 0
      ])

      const totalIngresosMes = ingresosMes?.reduce((sum, factura) => sum + (factura.total_amount || 0), 0) || 0

      setEstadisticas({
        total_mascotas: totalMascotas || 0,
        total_duenos: totalDuenos || 0,
        total_citas_mes: totalCitasMes || 0,
        total_ingresos_mes: totalIngresosMes,
        facturas_pendientes: facturasPendientes || 0,
        productos_stock_bajo: productosStockBajo || 0,
      })
    } catch (error) {
      console.error("Error fetching estadísticas:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchVentasMensuales = async () => {
    try {
      // Obtemos los últimos 6 meses de facturas
      const endDate = new Date()
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 6) // Últimos 6 meses

      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_date, total_amount, payment_status")
        .gte("invoice_date", startDate.toISOString().split('T')[0])
        .lte("invoice_date", endDate.toISOString().split('T')[0])
        .order("invoice_date", { ascending: false })

      if (error) throw error

      // Inicializar los últimos 6 meses con valores en 0
      const ventasPorMes: { [key: string]: { total: number; cantidad: number } } = {}
      const currentDate = new Date()

      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
        const mesKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
        ventasPorMes[mesKey] = { total: 0, cantidad: 0 }
      }

      // Procesar las facturas
      data?.forEach((factura) => {
        if (factura.invoice_date && factura.payment_status === 'paid') {
          const fecha = new Date(factura.invoice_date)
          const mesKey = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`

          if (ventasPorMes[mesKey]) {
            ventasPorMes[mesKey].total += factura.total_amount || 0
            ventasPorMes[mesKey].cantidad += 1
          }
        }
      })

      // Convertir a array y ordenar por mes
      const ventasArray = Object.entries(ventasPorMes)
        .map(([mes, datos]) => ({
          mes,
          total_ventas: datos.total,
          cantidad_facturas: datos.cantidad,
        }))
        .sort((a, b) => a.mes.localeCompare(b.mes))

      setVentasMensuales(ventasArray)
    } catch (error) {
      console.error("Error fetching ventas mensuales:", error)
    }
  }

  const fetchVentasDiarias = async () => {
    try {
      setLoadingDiario(true)

      // Obtener las facturas pagadas de los últimos 30 días
      const { data: facturas, error } = await supabase
        .from('invoices')
        .select('invoice_date, total_amount, payment_status, created_at')
        .eq('payment_status', 'paid')
        .order('invoice_date', { ascending: false })
        .limit(1000) // Limitar a 1000 registros para evitar sobrecarga

      if (error) throw error

      // Objeto para agrupar por fecha
      const ventasPorDia: { [key: string]: { total: number; cantidad: number } } = {}

      // Procesar solo las facturas que tienen fecha
      facturas?.filter(f => f.invoice_date).forEach(factura => {
        // Usar invoice_date como fecha principal (ya que es DATE en la BD)
        const fechaFactura = factura.invoice_date
        const fechaObj = new Date(fechaFactura)

        // Formatear la fecha como YYYY-MM-DD para usar como clave
        const fechaKey = fechaObj.toISOString().split('T')[0]

        if (!ventasPorDia[fechaKey]) {
          ventasPorDia[fechaKey] = { total: 0, cantidad: 0 }
        }
        ventasPorDia[fechaKey].total += parseFloat(factura.total_amount) || 0
        ventasPorDia[fechaKey].cantidad += 1
      })

      // Convertir a array, formatear y ordenar por fecha (más reciente primero)
      const ventasConFecha: VentaDiariaConFechaObj[] = []

      // Procesar cada entrada
      for (const [fecha, datos] of Object.entries(ventasPorDia)) {
        const fechaObj = new Date(fecha)
        // Saltar fechas inválidas
        if (isNaN(fechaObj.getTime())) continue

        // Formatear fecha como en la sección de ventas
        const diaSemana = fechaObj.toLocaleDateString('es-PE', { weekday: 'short' })
        const fechaFormateada = fechaObj.toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })

        ventasConFecha.push({
          fecha,
          fechaFormateada: fechaObj.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit'
          }),
          fechaCompleta: fechaFormateada, // Para mostrar en tooltip o donde se necesite
          total_ventas: datos.total,
          cantidad_facturas: datos.cantidad,
          promedio_venta: datos.cantidad > 0 ? datos.total / datos.cantidad : 0,
          dia_semana: diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1), // Primera letra mayúscula
          fechaObj: fechaObj
        })
      }

      // Ordenar por fecha (más reciente primero) y limitar a 30 días
      ventasConFecha.sort((a, b) => b.fechaObj.getTime() - a.fechaObj.getTime())
      const ventasRecientes = ventasConFecha.slice(0, 30)

      // Crear array final sin fechaObj
      const ventasDiariasArray: VentaDiariaBase[] = ventasRecientes.map(({ fecha, fechaFormateada, total_ventas, cantidad_facturas, promedio_venta, dia_semana }) => ({
        fecha,
        fechaFormateada,
        total_ventas,
        cantidad_facturas,
        promedio_venta,
        dia_semana
      }))

      setVentasDiarias(ventasDiariasArray)
    } catch (error) {
      console.error('Error al obtener el historial de ventas diarias:', error)
    } finally {
      setLoadingDiario(false)
    }
  }

  const fetchHistorialVentas = async () => {
    try {
      setLoadingHistorial(true)

      // Obtener el año más antiguo de las facturas
      const { data: facturaAntigua, error: errorAntigua } = await supabase
        .from('invoices')
        .select('invoice_date')
        .order('invoice_date', { ascending: true })
        .limit(1)
        .single()

      if (errorAntigua) throw errorAntigua

      if (!facturaAntigua) {
        setHistorialVentas([])
        return
      }

      const añoInicio = new Date(facturaAntigua.invoice_date).getFullYear()
      const añoActual = new Date().getFullYear()

      // Obtener datos de ventas por año
      const { data: ventasPorAño, error } = await supabase
        .from('invoices')
        .select('invoice_date, total_amount, payment_status')
        .eq('payment_status', 'paid')

      if (error) throw error

      // Procesar datos para agrupar por año
      const ventasAnuales: { [key: number]: { total: number; cantidad: number } } = {}

      // Inicializar todos los años con valores en 0
      for (let año = añoInicio; año <= añoActual; año++) {
        ventasAnuales[año] = { total: 0, cantidad: 0 }
      }

      // Procesar las facturas
      ventasPorAño?.forEach(factura => {
        if (factura.invoice_date && factura.payment_status === 'paid') {
          const año = new Date(factura.invoice_date).getFullYear()
          if (ventasAnuales[año]) {
            ventasAnuales[año].total += factura.total_amount || 0
            ventasAnuales[año].cantidad += 1
          }
        }
      })

      // Convertir a array y calcular promedio
      const historial = Object.entries(ventasAnuales)
        .map(([año, datos]) => ({
          año: parseInt(año),
          total_ventas: datos.total,
          cantidad_facturas: datos.cantidad,
          promedio_venta: datos.cantidad > 0 ? datos.total / datos.cantidad : 0
        }))
        .sort((a, b) => b.año - a.año) // Ordenar de más reciente a más antiguo

      setHistorialVentas(historial)
    } catch (error) {
      console.error('Error al obtener el historial de ventas:', error)
    } finally {
      setLoadingHistorial(false)
    }
  }

  const fetchProductosMasVendidos = async () => {
    try {
      // Primero, obtenemos las facturas de los últimos 6 meses
      const endDate = new Date()
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 6) // Últimos 6 meses

      const { data: facturas, error: errorFacturas } = await supabase
        .from("invoices")
        .select("id")
        .gte("invoice_date", startDate.toISOString().split('T')[0])
        .lte("invoice_date", endDate.toISOString().split('T')[0])
        .eq("payment_status", "paid")

      if (errorFacturas) throw errorFacturas

      const facturaIds = facturas?.map(f => f.id) || []

      if (facturaIds.length === 0) {
        setProductosMasVendidos([])
        return
      }

      // Ahora obtenemos los items de factura para las facturas encontradas
      const { data, error } = await supabase
        .from("invoice_items")
        .select(`
          description,
          quantity,
          unit_price,
          total_price,
          product_id,
          products (
            name,
            category
          )
        `)
        .in("invoice_id", facturaIds)
        .limit(1000) // Aumentamos el límite para asegurar que obtenemos todos los items

      if (error) throw error

      if (data) {
        // Agrupar por producto
        const productoStats: {
          [key: string]: {
            total_vendido: number;
            ingresos: number;
            categoria: string
          }
        } = {}

        data.forEach((item) => {
          const productoInfo = Array.isArray(item.products) ? item.products[0] : item.products
          const nombre = productoInfo?.name || item.description || 'Producto sin nombre'
          const categoria = productoInfo?.category || "Sin categoría"
          const cantidad = item.quantity || 0
          const precioTotal = item.total_price || 0

          if (!productoStats[nombre]) {
            productoStats[nombre] = {
              total_vendido: 0,
              ingresos: 0,
              categoria
            }
          }

          productoStats[nombre].total_vendido += cantidad
          productoStats[nombre].ingresos += precioTotal
        })

        // Ordenar por cantidad vendida (de mayor a menor) y limitar a 10
        const productosArray = Object.entries(productoStats)
          .map(([nombre, datos]) => ({
            nombre,
            categoria: datos.categoria,
            total_vendido: datos.total_vendido,
            ingresos: datos.ingresos,
          }))
          .sort((a, b) => b.total_vendido - a.total_vendido)
          .slice(0, 10)

        setProductosMasVendidos(productosArray)
      }
    } catch (error) {
      console.error("Error fetching productos más vendidos:", error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split("-")
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1)
    return date.toLocaleDateString("es-ES", { year: "numeric", month: "long" })
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Cargando reportes...</div>
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 md:ml-64">
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="ml-12 md:ml-0">
                <h1 className="text-2xl font-bold text-gray-900">Reportes y Análisis</h1>
                <p className="text-sm text-gray-600">Estadísticas y métricas del negocio</p>
              </div>
              <Select value={periodoSeleccionado} onValueChange={setPeriodoSeleccionado}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_actual">Mes Actual</SelectItem>
                  <SelectItem value="trimestre">Último Trimestre</SelectItem>
                  <SelectItem value="semestre">Último Semestre</SelectItem>
                  <SelectItem value="ano">Último Año</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Estadísticas Generales */}
          {estadisticas && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Mascotas</CardTitle>
                  <PawPrint className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estadisticas.total_mascotas}</div>
                  <p className="text-xs text-muted-foreground">Registradas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estadisticas.total_duenos}</div>
                  <p className="text-xs text-muted-foreground">Activos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Citas Este Mes</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estadisticas.total_citas_mes}</div>
                  <p className="text-xs text-muted-foreground">Programadas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(estadisticas.total_ingresos_mes)}</div>
                  <p className="text-xs text-muted-foreground">Facturado</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Facturas Pendientes</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estadisticas.facturas_pendientes}</div>
                  <p className="text-xs text-muted-foreground">Por cobrar</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estadisticas.productos_stock_bajo}</div>
                  <p className="text-xs text-muted-foreground">Productos</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ventas Mensuales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Ventas Mensuales
                </CardTitle>
                <CardDescription>Ingresos de los últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...ventasMensuales].reverse()}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="mes"
                        tickFormatter={(value) => {
                          const [year, month] = value.split('-')
                          const date = new Date(Number(year), Number(month) - 1)
                          return date.toLocaleDateString('es-ES', { month: 'short' })
                        }}
                      />
                      <YAxis
                        tickFormatter={(value) => `S/.${value.toLocaleString()}`}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          name === 'total_ventas' ? `S/.${Number(value).toLocaleString()}` : value,
                          name === 'total_ventas' ? 'Total Ventas' : 'Facturas'
                        ]}
                        labelFormatter={(label) => {
                          const [year, month] = label.split('-')
                          const date = new Date(Number(year), Number(month) - 1)
                          return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="total_ventas"
                        name="Total Ventas"
                        fill="#4f46e5"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="cantidad_facturas"
                        name="N° Facturas"
                        fill="#818cf8"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {ventasMensuales.slice(0, 6).map((venta) => (
                    <div key={venta.mes} className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-gray-500">
                        {formatMonth(venta.mes)}
                      </p>
                      <p className="text-lg font-bold">{formatCurrency(venta.total_ventas)}</p>
                      <p className="text-sm text-gray-600">{venta.cantidad_facturas} facturas</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Productos Más Vendidos - Tabla */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {/* Productos Más Vendidos */}
                </CardTitle>
                <CardDescription>
                  {productosMasVendidos.length > 0
                    ? `Top ${Math.min(10, productosMasVendidos.length)} productos por cantidad vendida`
                    : 'No hay datos de productos vendidos en el período seleccionado'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unidades</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productosMasVendidos.length > 0 ? (
                        productosMasVendidos.map((producto, index) => {
                          const isTop3 = index < 3;
                          return (
                            <tr
                              key={index}
                              className={`hover:bg-gray-50 ${isTop3 ? 'bg-gradient-to-r from-blue-50 to-white' : ''}`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 w-12">
                                {isTop3 ? (
                                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-800 font-semibold">
                                    {index + 1}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">{index + 1}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {producto.nombre}
                                  {isTop3 && (
                                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      Top {index + 1}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant="outline" className="text-xs">
                                  {producto.categoria}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                                {producto.total_vendido.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-semibold">
                                {formatCurrency(producto.ingresos)}
                                <div className="text-xs text-gray-500 font-normal">
                                  {producto.total_vendido > 0 && (
                                    <>
                                      {formatCurrency(producto.ingresos / producto.total_vendido)} c/u
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                              <Package className="h-12 w-12 mb-2" />
                              <p className="text-sm">No hay datos de productos vendidos</p>
                              <p className="text-xs mt-1">Los productos vendidos aparecerán aquí</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumen de Rendimiento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Resumen de Rendimiento
              </CardTitle>
              <CardDescription>Métricas clave del negocio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">Crecimiento de Clientes</h3>
                  <p className="text-2xl font-bold text-green-600">+12%</p>
                  <p className="text-sm text-green-700">vs mes anterior</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">Satisfacción del Cliente</h3>
                  <p className="text-2xl font-bold text-blue-600">4.8/5</p>
                  <p className="text-sm text-blue-700">Promedio de calificaciones</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">Eficiencia Operativa</h3>
                  <p className="text-2xl font-bold text-purple-600">94%</p>
                  <p className="text-sm text-purple-700">Citas completadas a tiempo</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historial de Ventas Anuales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Historial de Ventas Anuales
              </CardTitle>
              <CardDescription>Resumen de ventas por año</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistorial ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : historialVentas.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Año</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ventas Totales</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Facturas</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Promedio por Factura</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tendencia</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {historialVentas.map((venta, index, array) => {
                        const esUltimoAño = index === 0;
                        const variacion = index < array.length - 1
                          ? ((venta.total_ventas - array[index + 1].total_ventas) / array[index + 1].total_ventas) * 100
                          : 0;

                        return (
                          <tr key={venta.año} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {venta.año}
                                {esUltimoAño && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    Año Actual
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                              {formatCurrency(venta.total_ventas)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                              {venta.cantidad_facturas.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                              {formatCurrency(venta.promedio_venta)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {index < array.length - 1 ? (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variacion >= 0
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                  }`}>
                                  {variacion >= 0 ? '↑' : '↓'} {Math.abs(variacion).toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No hay datos históricos disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
