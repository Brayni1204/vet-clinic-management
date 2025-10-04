"use client"

import { useState, useEffect } from "react"
import { formatPeruTime } from "@/lib/dateUtils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  FileText,
  FileDown,
} from "lucide-react"
import { supabase } from "@/lib/db"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
// @ts-ignore - jsPDF types are not available
import jsPDF from "jspdf"
import "jspdf-autotable"

interface ClientOrder {
  id: string
  order_number: string
  client_name: string
  client_email: string
  client_phone: string
  delivery_address: string
  subtotal: number
  tax_amount: number
  total_amount: number
  status: string
  payment_method: string
  payment_status?: string
  estimated_delivery_date?: string
  notes?: string
  order_date: string
  order_time?: string
  created_at: string
  updated_at?: string
  order_items?: Array<{
    id: string
    product_id: string
    quantity: number
    unit_price: number
    total_price: number
    products: {
      name: string
      category: string
    }
  }>
  payment_receipts?: Array<{
    fileName: string
    fileType: string
    data: string
    timestamp: string
  }>
}

export default function PedidosOnlinePage() {
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")

  const [selectedOrder, setSelectedOrder] = useState<ClientOrder | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      console.log("Fetching orders from client_orders table...")

      // Obtener todos los comprobantes guardados en localStorage
      const receipts: Record<string, any[]> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('receipt_')) {
          try {
            const receiptData = JSON.parse(localStorage.getItem(key) || '{}');
            // Agrupar por orderId si existe, de lo contrario usar una clave por defecto
            const orderId = receiptData.orderId || 'default';
            if (!receipts[orderId]) {
              receipts[orderId] = [];
            }
            receipts[orderId].push(receiptData);
          } catch (e) {
            console.error('Error al procesar recibo:', e);
          }
        }
      }

      const { data, error } = await supabase
        .from("client_orders")
        .select(`
          *,
          order_items (
            *,
            products (
              name,
              category
            )
          )
        `)
        .order("created_at", { ascending: false })

      console.log("Orders fetch result:", { data, error })

      // Combinar los pedidos con sus comprobantes
      if (data) {
        data.forEach(order => {
          const orderReceipts = receipts[order.id] || [];
          if (orderReceipts.length > 0) {
            order.payment_receipts = orderReceipts;
          }
        });
      }

      if (error) {
        console.error("Supabase error:", error)
      } else {
        console.log("Orders fetched successfully:", data?.length || 0, "orders")
        setOrders(data || [])
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      console.log("Updating order status:", { orderId, newStatus })

      // Si el nuevo estado es 'shipped', lo cambiamos a 'delivered' para saltar el estado de envío
      const statusToUpdate = newStatus === 'shipped' ? 'delivered' : newStatus;

      const { error } = await supabase.from("client_orders").update({ status: statusToUpdate }).eq("id", orderId)

      if (error) {
        console.error("Error updating order status:", error)
        alert("Error al actualizar el estado del pedido")
      } else {
        console.log("Order status updated successfully")
        setOrders(orders.map((order) => (order.id === orderId ? { ...order, status: statusToUpdate } : order)))
      }
    } catch (error) {
      console.error("Error updating order status:", error)
      alert("Error al actualizar el estado del pedido")
    }
  }

  const handleViewDetails = (order: ClientOrder) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client_email?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "confirmed":
        return "bg-blue-100 text-blue-800"
      case "preparing":
        return "bg-purple-100 text-purple-800"
      case "shipped":
        return "bg-indigo-100 text-indigo-800"
      case "delivered":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente"
      case "confirmed":
        return "Confirmado"
      case "preparing":
        return "Preparando"
      case "shipped":
        return "Enviado"
      case "delivered":
        return "Entregado"
      case "cancelled":
        return "Cancelado"
      default:
        return status
    }
  }

  const getPaymentStatusColor = (status: string | undefined) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPaymentStatusText = (status: string | undefined) => {
    switch (status) {
      case "paid":
        return "Pagado"
      case "pending":
        return "Pendiente de pago"
      case "failed":
        return "Pago fallido"
      default:
        return status || "No especificado"
    }
  }

  const getPaymentMethodText = (method: string | undefined) => {
    switch (method) {
      case "efectivo":
        return "Efectivo"
      case "yape":
        return "Yape"
      case "plin":
        return "Plin"
      case "tarjeta":
        return "Tarjeta"
      default:
        return method || "-"
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando pedidos online...</p>
        </div>
      </div>
    )
  }

  const generatePdfReport = async () => {
    try {
      setGeneratingPdf(true)

      // Crear un nuevo documento PDF
      const doc = new jsPDF()

      // Título del reporte
      const title = 'Reporte de Pedidos Online'
      const date = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })

      // Configuración del título
      doc.setFontSize(18)
      doc.setFont(undefined, 'bold')
      doc.text(title, 14, 22)

      // Fecha del reporte
      doc.setFontSize(11)
      doc.setFont(undefined, 'normal')
      doc.text(`Generado el: ${date}`, 14, 30)

      // Tabla de pedidos
      const tableColumn = [
        'N° Pedido',
        'Cliente',
        'Fecha',
        'Estado',
        'Método Pago',
        'Total (S/)'
      ]

      const tableRows = orders.map(order => [
        order.order_number || '-',
        order.client_name || 'Sin nombre',
        order.order_date ? format(new Date(order.order_date), 'dd/MM/yyyy HH:mm', { locale: es }) : '-',
        getStatusText(order.status),
        getPaymentMethodText(order.payment_method),
        order.total_amount?.toFixed(2) || '0.00'
      ])

        // Añadir la tabla al documento
        ; (doc as any).autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: 40,
          headStyles: {
            fillColor: [59, 130, 246], // azul-500
            textColor: 255,
            fontStyle: 'bold',
          },
          didDrawPage: function (data: any) {
            // Pie de página
            const pageSize = doc.internal.pageSize
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight()
            doc.text('Página ' + data.pageCount, data.settings.margin.left, pageHeight - 10)
          }
        })

      // Resumen
      const finalY = (doc as any).lastAutoTable?.finalY || 50

      // Total de pedidos
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('Resumen de Pedidos', 14, finalY + 15)

      doc.setFont(undefined, 'normal')
      doc.text(`Total de pedidos: ${orders.length}`, 20, finalY + 25)

      // Guardar el PDF
      doc.save(`reporte-pedidos-${format(new Date(), 'yyyy-MM-dd')}.pdf`)

      toast.success('Reporte generado exitosamente')
    } catch (error) {
      console.error('Error al generar el reporte:', error)
      toast.error('No se pudo generar el reporte')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <AuthGuard requiredPermission="client_orders">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />

        <div className="flex-1 md:ml-64">
          <header className="bg-white shadow-sm border-b">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="ml-12 md:ml-0">
                  <h1 className="text-2xl font-bold text-gray-900">Pedidos Online</h1>
                  <p className="text-sm text-gray-600">Gestiona los pedidos realizados por los clientes</p>
                </div>
                <Button onClick={fetchOrders} variant="outline">
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6">
            <Tabs defaultValue="orders" className="space-y-6">
              <TabsList>
                <TabsTrigger value="orders">Pedidos</TabsTrigger>
                <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
              </TabsList>

              <TabsContent value="orders" className="space-y-6">
                {/* Debug info */}
                <div className="text-sm text-gray-500 mb-4">
                  Total de pedidos: {orders.length} | Pedidos filtrados: {filteredOrders.length}
                </div>

                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar pedidos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="confirmed">Confirmado</SelectItem>
                      <SelectItem value="preparing">Preparando</SelectItem>
                      <SelectItem value="shipped">Enviado</SelectItem>
                      <SelectItem value="delivered">Entregado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Pedidos de Clientes</CardTitle>
                      <CardDescription>Lista de todos los pedidos realizados online</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generatePdfReport}
                      disabled={generatingPdf || orders.length === 0}
                      className="flex items-center gap-2"
                    >
                      <FileDown className={`h-4 w-4 ${generatingPdf ? 'animate-spin' : ''}`} />
                      {generatingPdf ? 'Generando...' : 'Generar Reporte'}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número de Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">
                              {order.order_number || `ORD-${order.id.slice(0, 8)}`}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{order.client_name}</p>
                                <p className="text-sm text-gray-600">{order.client_email}</p>
                                <p className="text-sm text-gray-600">{order.client_phone}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {formatPeruTime(order.created_at).time}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatPeruTime(order.created_at).date}
                              </div>
                            </TableCell>
                            <TableCell>{order.total_amount?.toFixed(2) || "0.00"}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>{getStatusText(order.status)}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {getPaymentMethodText(order.payment_method)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleViewDetails(order)}>
                                  <Eye className="h-3 w-3" />
                                </Button>
                                {order.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateOrderStatus(order.id, "confirmed")}
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    Confirmar
                                  </Button>
                                )}
                                {order.status === "confirmed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateOrderStatus(order.id, "preparing")}
                                  >
                                    <Package className="h-3 w-3 mr-1" />
                                    Preparar
                                  </Button>
                                )}
                                {order.status === "preparing" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateOrderStatus(order.id, "delivered")}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Marcar como Entregado
                                  </Button>
                                )}
                                {(order.status === "pending" || order.status === "confirmed") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateOrderStatus(order.id, "cancelled")}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Cancelar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {filteredOrders.length === 0 && (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron pedidos</h3>
                        <p className="text-gray-600">
                          {orders.length === 0
                            ? "No hay pedidos registrados en el sistema."
                            : "No hay pedidos que coincidan con los filtros seleccionados."}
                        </p>
                        <Button onClick={fetchOrders} className="mt-4 bg-transparent" variant="outline">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Recargar Pedidos
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="statistics" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pedidos Hoy</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {
                          orders.filter((order) => {
                            const orderDate = new Date(order.order_date || order.created_at)
                            const today = new Date()
                            return orderDate.toDateString() === today.toDateString()
                          }).length
                        }
                      </div>
                      <p className="text-xs text-muted-foreground">Pedidos del día</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pedidos Pendientes</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {orders.filter((order) => order.status === "pending").length}
                      </div>
                      <p className="text-xs text-muted-foreground">Requieren atención</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        S/.
                        {orders
                          .filter((order) => {
                            const orderDate = new Date(order.order_date || order.created_at)
                            const now = new Date()
                            return (
                              orderDate.getMonth() === now.getMonth() &&
                              orderDate.getFullYear() === now.getFullYear() &&
                              (order.payment_status === "paid" || order.status === "delivered")
                            )
                          })
                          .reduce((sum, order) => sum + (order.total_amount || 0), 0)
                          .toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">Pedidos pagados</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {new Set(orders.map((order) => order.client_email)).size}
                      </div>
                      <p className="text-xs text-muted-foreground">Han realizado pedidos</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </main>

          {/* Detalles del pedido */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalles del Pedido</DialogTitle>
                <DialogDescription>Información completa del pedido seleccionado</DialogDescription>
              </DialogHeader>

              {selectedOrder && (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Pedido #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-600">
                        {formatPeruTime(selectedOrder.created_at).date}
                      </p>
                    </div>
                    <div className="bg-gray-100 px-3 py-1 rounded-md">
                      <p className="font-medium text-gray-700">
                        {formatPeruTime(selectedOrder.created_at).time}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold mb-2">Cliente</h3>
                      <p>{selectedOrder.client_name}</p>
                      <p className="text-sm text-gray-600">{selectedOrder.client_email}</p>
                      <p className="text-sm text-gray-600">{selectedOrder.client_phone}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Envío</h3>
                      <p>{selectedOrder.delivery_address}</p>
                      {selectedOrder.estimated_delivery_date && (
                        <p>Entrega estimada: {new Date(selectedOrder.estimated_delivery_date).toLocaleDateString("es-ES")}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Artículos</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Precio Unit.</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.order_items?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.products?.name}</TableCell>
                            <TableCell>{item.products?.category}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>S/. {item.unit_price.toFixed(2)}</TableCell>
                            <TableCell>S/. {item.total_price.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="text-right space-y-1 mb-6">
                    <p>Subtotal: S/. {selectedOrder.subtotal.toFixed(2)}</p>
                    <p>Impuesto: S/. {selectedOrder.tax_amount.toFixed(2)}</p>
                    <p className="font-semibold">Total: S/. {selectedOrder.total_amount.toFixed(2)}</p>
                  </div>

                  {/* Comprobantes de pago */}
                  {selectedOrder.payment_receipts && selectedOrder.payment_receipts.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-3">Comprobantes de Pago</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedOrder.payment_receipts.map((receipt, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium truncate">
                                {receipt.fileName || `Comprobante ${index + 1}`}
                              </span>
                              <a
                                href={receipt.data}
                                download={receipt.fileName || `comprobante-${index + 1}`}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Descargar
                              </a>
                            </div>
                            <div className="aspect-w-16 aspect-h-9 mt-2">
                              {receipt.fileType.startsWith('image/') ? (
                                <img
                                  src={receipt.data}
                                  alt={`Comprobante ${index + 1}`}
                                  className="w-full h-auto max-h-40 object-contain rounded"
                                />
                              ) : (
                                <div className="bg-gray-100 p-4 rounded flex flex-col items-center justify-center h-40">
                                  <FileText className="h-10 w-10 text-gray-400 mb-2" />
                                  <span className="text-sm text-gray-500">Vista previa no disponible</span>
                                  <span className="text-xs text-gray-400">{receipt.fileType}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Subido: {new Date(receipt.timestamp).toLocaleString('es-PE')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AuthGuard>
  )
}
