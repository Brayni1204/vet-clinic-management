"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
// jsPDF se importará dinámicamente solo en el cliente
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus,
  Search,
  ShoppingCart,
  Receipt,
  Package,
  Users,
  TrendingUp,
  Calendar,
  Eye,
  Edit,
  Trash2,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/components/ui/use-toast"
import jsPDF from "jspdf"
import "jspdf-autotable"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { cn } from "@/lib/utils"
import { formatPeruTime } from "@/lib/dateUtils"

// Update interfaces to match unified schema
interface Product {
  id: string
  name: string
  category: string
  price: number
  stock_quantity: number
}

interface Client {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
}

// Item en el carrito (procede del catálogo de productos)
interface CartItem {
  product: Product
  quantity: number
  price: number // precio unitario actual
}

// Item de factura leído desde la base de datos (relación invoice_items -> products)
interface InvoiceItem {
  id?: string
  product_id?: string
  quantity: number
  unit_price?: number
  total_price?: number
  products?: {
    name: string
    category: string
    price?: number
  }
}

interface Sale {
  id: string
  invoice_number: string
  owner_id: string
  owners?: Client
  invoice_date: string
  created_at: string
  created_at_utc?: string
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_status: string
  payment_method?: string
  notes?: string
  items?: InvoiceItem[]
}

export default function VentasPage() {
  const [stats, setStats] = useState({
    salesToday: 0,
    salesMonth: 0,
    productsSoldToday: 0,
    clientsToday: 0,
  })
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isNewSaleDialogOpen, setIsNewSaleDialogOpen] = useState(false)
  
  // Filtrar productos según el término de búsqueda
  const filteredProducts = products.filter((product: Product) => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [saleItems, setSaleItems] = useState<InvoiceItem[]>([])
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null)

  // Formulario de nueva venta
  const [saleForm, setSaleForm] = useState({
    metodoPago: "efectivo",
    notas: "",
  });

  useEffect(() => {
    fetchData()
  }, [])

  // Update all database queries
  const fetchData = async () => {
    try {
      // Obtener productos
      const { data: productsData } = await supabase.from("products").select("*").gt("stock_quantity", 0).order("name")

      // Obtener clientes
      const { data: clientsData } = await supabase.from("owners").select("*").order("first_name")

      // Obtener ventas recientes con la hora correcta
      const { data: salesData } = await supabase
        .from("invoices")
        .select(`
          *,
          created_at,
          invoice_date,
          owners (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);
        
      // Depuración: Mostrar las fechas recibidas
      console.log('Datos de ventas recibidos:', salesData?.map(sale => ({
        id: sale.id,
        invoice_number: sale.invoice_number,
        created_at: sale.created_at,
        invoice_date: sale.invoice_date,
        local_time: new Date(sale.created_at).toString(),
        iso_string: new Date(sale.created_at).toISOString(),
        local_string: new Date(sale.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })
      })));
      
      // Usar los datos sin ajustar (el ajuste se hará en formatSaleDate)
      const dataToUse = salesData || [];

      setProducts(productsData || []);
      setClients(clientsData || []);
      setSales(dataToUse);
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)

      // calcular estadisticas en paralelo
      fetchStats()
    }
  }

  // Obtener estadisticas de ventas
  const fetchStats = async () => {
    try {
      // Obtener la fecha actual en la zona horaria local
      const now = new Date();
      
      // Crear fechas para el inicio del día y mes actual
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Formatear fechas para la consulta
      const todayStartStr = todayStart.toISOString();
      const monthStartStr = monthStart.toISOString();
      const nowStr = now.toISOString();

      // Ventas de hoy y clientes atendidos hoy
      const { data: todayInvoices } = await supabase
        .from("invoices")
        .select("id, total_amount, owner_id, invoice_date, created_at")
        .gte('created_at', todayStartStr)
        .lte('created_at', nowStr);

      const salesToday = (todayInvoices || []).reduce(
        (acc: number, inv: { total_amount?: number }) => acc + (inv.total_amount || 0), 
        0
      );
      
      const clientIds = new Set((todayInvoices || []).map((inv: { owner_id: string }) => inv.owner_id));
      const clientsToday = clientIds.size;

      // Ventas del mes
      const { data: monthInvoices } = await supabase
        .from("invoices")
        .select("total_amount, created_at")
        .gte('created_at', monthStartStr)
        .lte('created_at', nowStr);
        
      const salesMonth = (monthInvoices || []).reduce(
        (acc: number, inv: { total_amount?: number }) => acc + (inv.total_amount || 0), 
        0
      );

      // Productos vendidos hoy
      let productsSoldToday = 0
      if (todayInvoices && todayInvoices.length > 0) {
        const invoiceIds = todayInvoices.map((inv) => inv.id)
        const { data: itemsToday } = await supabase
          .from("invoice_items")
          .select("quantity")
          .in("invoice_id", invoiceIds)
        productsSoldToday = (itemsToday || []).reduce((acc, item) => acc + (item.quantity || 0), 0)
      }

      setStats({ salesToday, salesMonth, productsSoldToday, clientsToday })
    } catch (err) {
      console.error("Error fetching stats", err)
    }
  }

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.product.id === product.id)
      if (existingItem) {
        // Si es un servicio, no hay límite de cantidad
        if (product.category.toLowerCase() === 'servicio') {
          return prevCart.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        }
        // Si no es un servicio, verificar el stock disponible
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) }
            : item,
        )
      }
      return [...prevCart, { product, quantity: 1, price: product.price }]
    })
  }

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId))
      return
    }

    const product = products.find((p) => p.id === productId)
    const maxQuantity = product?.stock_quantity || 1

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.min(quantity, maxQuantity) } : item,
      ),
    )
  }

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId))
  }

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const handleCreateSale = async () => {
    if (!selectedClient || cart.length === 0) {
      alert("Selecciona un cliente y agrega productos al carrito")
      return
    }

    const subtotal = getCartTotal()
    const impuestos = subtotal * 0.16
    const total = subtotal + impuestos
    const numeroFactura = isEditing ? undefined : `FAC-${new Date().getTime()}`;

    try {
      // Usar la fecha y hora actual en formato ISO string para mantener consistencia
      const now = new Date();
      // Asegurar que la fecha se guarde como UTC en la base de datos
      const postgresTimestamp = now.toISOString();
      
      if (isEditing && editingSaleId) {
        // Actualizar venta existente
        const { error: facturaError } = await supabase
          .from("invoices")
          .update({
            owner_id: selectedClient.id,
            subtotal,
            tax_amount: impuestos,
            total_amount: total,
            payment_status: "paid",
            payment_method: saleForm.metodoPago,
            notes: saleForm.notas,
            updated_at: postgresTimestamp
          })
          .eq("id", editingSaleId)

        if (facturaError) throw facturaError

        // Eliminar items antiguos
        await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", editingSaleId)

        // Crear nuevos items de factura
        const facturaItems = cart.map((item) => ({
          invoice_id: editingSaleId,
          product_id: item.product.id,
          description: item.product.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
        }))

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(facturaItems)

        if (itemsError) throw itemsError

        toast.success("Venta actualizada exitosamente");
      } else {
        // Crear nueva venta
        const { data: factura, error: facturaError } = await supabase
          .from("invoices")
          .insert([
            {
              owner_id: selectedClient.id,
              invoice_number: numeroFactura,
              invoice_date: postgresTimestamp,
              subtotal,
              tax_amount: impuestos,
              total_amount: total,
              payment_status: "paid",
              payment_method: saleForm.metodoPago,
              notes: saleForm.notas,
            },
          ])
          .select()
          .single()

        if (facturaError) throw facturaError

        // Crear items de factura
        const facturaItems = cart.map((item) => ({
          invoice_id: factura.id,
          product_id: item.product.id,
          description: item.product.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
        }))

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(facturaItems)

        if (itemsError) throw itemsError

        // Actualizar stock de productos solo para nuevas ventas y solo si no son servicios
        for (const item of cart) {
          // Verificar si el producto es un servicio (no se actualiza stock)
          if (item.product.category.toLowerCase() !== 'servicio') {
            const { error: stockError } = await supabase
              .from("products")
              .update({ stock_quantity: item.product.stock_quantity - item.quantity })
              .eq("id", item.product.id)

            if (stockError) console.error("Error actualizando stock:", stockError)
          } else {
            console.log(`Producto de servicio "${item.product.name}" - No se actualiza el stock`);
          }
        }

        toast.success("Venta creada exitosamente");
      }

      // Limpiar formulario y refrescar datos
      resetSaleForm();
      setIsNewSaleDialogOpen(false);
      fetchData();

    } catch (error) {
      // Mostrar el error crudo en la consola
      console.error("Error crudo al guardar la venta:", error);
      
      // Intentar obtener más información del error
      let errorMessage = 'Error desconocido al guardar la venta';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Mensaje de error:", error.message);
        console.error("Stack trace:", error.stack);
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Intentar extraer información de un objeto de error de Supabase
        const errorObj = error as Record<string, unknown>;
        errorMessage = String(errorObj.message || errorObj.error_description || errorMessage);
        console.error("Detalles del error:", JSON.stringify(errorObj, null, 2));
      }
      
      toast.error(`Error al guardar la venta: ${errorMessage}`);
      
      // Registrar el error completo para depuración
      console.error("Error completo:", {
        error,
        errorString: String(error),
        errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "overdue":
        return "bg-orange-100 text-orange-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Función para formatear fechas usando formatPeruTime
  const formatSaleDate = (dateString: string, includeTime: boolean = true) => {
    if (!dateString) return '--/--/----' + (includeTime ? ' --:--' : '');
    
    const formatted = formatPeruTime(dateString);
    
    if (!includeTime) {
      return formatted.date;
    }
    
    return formatted.full;
  };

  const getStatusText = (estado: string) => {
    switch (estado) {
      case "paid":
        return "Pagada"
      case "pending":
        return "Pendiente"
      case "overdue":
        return "Vencida"
      case "cancelled":
        return "Cancelada"
      default:
        return estado
    }
  }

    const handleViewDetails = async (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailOpen(true)
    // Obtener items de la factura
    const { data } = await supabase
      .from("invoice_items")
      .select(`*, products ( name, category )`)
      .eq("invoice_id", sale.id)
    setSaleItems((data as any) || [])
  }

  const handleEditSale = async (sale: Sale) => {
    try {
      setIsEditing(true)
      setEditingSaleId(sale.id)
      setSelectedClient(sale.owners || null)
      
      // Obtener los items de la factura
      const { data: items } = await supabase
        .from("invoice_items")
        .select(`*, products (*)`)
        .eq("invoice_id", sale.id)
      
      if (items) {
        // Mapear los items al formato del carrito
        const cartItems = items.map(item => ({
          product: item.products,
          quantity: item.quantity,
          price: item.unit_price || item.products?.price || 0
        }))
        
        setCart(cartItems as any)
        
        // Configurar el formulario con los datos de la venta
        setSaleForm({
          metodoPago: sale.payment_method || "efectivo",
          notas: sale.notes || ""
        })
        
        // Abrir el diálogo de nueva venta
        setIsNewSaleDialogOpen(true)
      }
    } catch (error) {
      console.error("Error al cargar la venta para editar:", error)
      toast.error("Error al cargar la venta para editar")
    }
  }

  const resetSaleForm = () => {
    setCart([])
    setSelectedClient(null)
    setSaleForm({
      metodoPago: "efectivo",
      notas: ""
    })
    setIsEditing(false)
    setEditingSaleId(null)
  }

  const generateSalesReport = async () => {
    try {
      // Importación dinámica de jsPDF solo en el cliente
      const { jsPDF } = await import('jspdf')
      
      // Crear un nuevo documento PDF
      const doc = new jsPDF()
      
      // Título del reporte
      doc.setFontSize(20)
      doc.text('Reporte de Ventas', 105, 20, { align: 'center' })
      
      // Fecha del reporte
      doc.setFontSize(10)
      doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 30, { align: 'center' })
      
      // Configuración de la tabla
      const startY = 40
      const pageHeight = doc.internal.pageSize.height
      const rowHeight = 10
      let currentY = startY
      
      // Encabezados de la tabla
      const headers = ['# Factura', 'Cliente', 'Fecha', 'Total', 'Estado', 'Método Pago']
      const colWidths = [25, 40, 40, 25, 25, 30] // Anchos de columna personalizados
      
      // Dibujar encabezados
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      let x = 10
      headers.forEach((header, i) => {
        doc.text(header, x + 2, currentY + 5)
        x += colWidths[i]
      })
      
      // Línea debajo del encabezado
      currentY += 7
      doc.setLineWidth(0.5)
      doc.line(10, currentY, 200, currentY)
      currentY += 5
      
      // Datos de la tabla
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      
      sales.forEach(sale => {
        // Verificar si necesitamos una nueva página
        if (currentY > pageHeight - 20) {
          doc.addPage()
          currentY = 20
          // Volver a dibujar encabezados en la nueva página
          x = 10
          doc.setFont(undefined, 'bold')
          headers.forEach((header, i) => {
            doc.text(header, x + 2, currentY + 5)
            x += colWidths[i]
          })
          currentY += 12
          doc.setFont(undefined, 'normal')
        }
        
        // Datos de la fila
        const rowData = [
          sale.invoice_number || 'N/A',
          sale.owners ? `${sale.owners.first_name} ${sale.owners.last_name}`.substring(0, 15) : 'Cliente eliminado',
          sale.created_at ? format(new Date(sale.created_at), 'dd/MM/yy HH:mm') : format(new Date(sale.invoice_date), 'dd/MM/yy HH:mm'),
          `S/.${sale.total_amount.toFixed(2)}`,
          getStatusText(sale.payment_status),
          sale.payment_method?.substring(0, 10) || 'No espec.'
        ]
        
        // Dibujar fila
        x = 10
        rowData.forEach((cell, i) => {
          doc.text(cell.toString(), x + 2, currentY + 5, { maxWidth: colWidths[i] - 4 })
          x += colWidths[i]
        })
        
        currentY += rowHeight
        // Línea entre filas
        doc.setLineWidth(0.1)
        doc.line(10, currentY, 200, currentY)
        currentY += 2
      })
      
      // Número de página
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        )
      }
      
      // Guardar el PDF
      doc.save(`reporte-ventas-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    } catch (error) {
      console.error('Error al generar el reporte PDF:', error)
      toast({
        title: 'Error',
        description: 'No se pudo generar el reporte PDF',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando datos de ventas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 md:ml-64">
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="ml-12 md:ml-0">
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Ventas</h1>
                <p className="text-sm text-gray-600">Administra las ventas de la clínica</p>
              </div>
              <Dialog open={isNewSaleDialogOpen} onOpenChange={(open) => {
                if (!open) {
                  resetSaleForm();
                }
                setIsNewSaleDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Venta
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>{isEditing ? 'Editar Venta' : 'Crear Nueva Venta'}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? 'Modifica los datos de la venta' : 'Selecciona cliente y productos para crear una nueva venta'}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Selección de cliente y productos */}
                    <div className="space-y-4">
                      <div>
                        <Label>Cliente</Label>
                        <Select
                          value={selectedClient?.id || ""}
                          onValueChange={(value) => {
                            const client = clients.find((c) => c.id === value)
                            setSelectedClient(client || null)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.first_name} {client.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Buscar Productos</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {filteredProducts.map((product) => (
                          <Card key={product.id} className="p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-gray-600">
                                  S/.{product.price.toFixed(2)} - Stock: {product.stock_quantity}
                                </p>
                              </div>
                              <Button size="sm" onClick={() => addToCart(product)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Carrito */}
                    <div className="space-y-4">
                      <h3 className="font-semibold">Carrito de Venta</h3>

                      {cart.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <ShoppingCart className="h-12 w-12 mx-auto mb-2" />
                          <p>Agrega productos al carrito</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {cart.map((item) => (
                              <div
                                key={item.product.id}
                                className="flex justify-between items-center p-2 border rounded"
                              >
                                <div>
                                  <p className="font-medium">{item.product.name}</p>
                                  <p className="text-sm text-gray-600">S/.{item.price.toFixed(2)} c/u</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                                  >
                                    -
                                  </Button>
                                  <span className="w-8 text-center">{item.quantity}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                                  >
                                    +
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => removeFromCart(item.product.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="border-t pt-4 space-y-2">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>S/.{getCartTotal().toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>IGV (18%):</span>
                              <span>S/.{(getCartTotal() * 0.18).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg">
                              <span>Total:</span>
                              <span>S/.{(getCartTotal() * 1.18).toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <Label>Método de Pago</Label>
                              <Select
                                value={saleForm.metodoPago}
                                onValueChange={(value) => setSaleForm({ ...saleForm, metodoPago: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar método" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="efectivo">Efectivo</SelectItem>
                                  <SelectItem value="tarjeta_credito">Tarjeta de Crédito</SelectItem>
                                  <SelectItem value="tarjeta_debito">Tarjeta de Débito</SelectItem>
                                  <SelectItem value="transferencia">Transferencia</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>Notas (Opcional)</Label>
                              <Input
                                value={saleForm.notas}
                                onChange={(e) => setSaleForm({ ...saleForm, notas: e.target.value })}
                                placeholder="Notas adicionales"
                              />
                            </div>

                            <Button 
                              className="w-full" 
                              onClick={handleCreateSale}
                              variant={isEditing ? 'default' : 'default'}
                            >
                              <Receipt className="h-4 w-4 mr-2" />
                              {isEditing ? 'Actualizar Venta' : 'Crear Venta'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Tabs defaultValue="ventas" className="space-y-6">
            <TabsList>
              <TabsTrigger value="ventas">Ventas Recientes</TabsTrigger>
              <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
            </TabsList>

            <TabsContent value="ventas" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                  <div>
                    <CardTitle>Ventas Recientes</CardTitle>
                    <CardDescription>Historial de ventas</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={generateSalesReport}
                    className="flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" x2="8" y1="13" y2="13"/>
                      <line x1="16" x2="8" y1="17" y2="17"/>
                      <line x1="10" x2="8" y1="9" y2="9"/>
                    </svg>
                    Generar Reporte
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Método de Pago</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">{sale.invoice_number}</TableCell>
                          <TableCell>
                            {sale.owners ? `${sale.owners.first_name} ${sale.owners.last_name}` : "Cliente eliminado"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {sale.created_at ? formatSaleDate(sale.created_at, true) : formatSaleDate(sale.invoice_date, true)}
                          </TableCell>
                          <TableCell>S/.{sale.total_amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(sale.payment_status)}>
                              {getStatusText(sale.payment_status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{sale.payment_method || "No especificado"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleViewDetails(sale)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleEditSale(sale)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="estadisticas" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">S/.{stats.salesToday.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">+12% desde ayer</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas Este Mes</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">S/.{stats.salesMonth.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">+8% desde el mes pasado</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Productos Vendidos</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.productsSoldToday}</div>
                    <p className="text-xs text-muted-foreground">+23% desde ayer</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Clientes Atendidos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.clientsToday}</div>
                    <p className="text-xs text-muted-foreground">+5% desde ayer</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>

            {/* Detalles de la venta */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Detalles de la Venta</DialogTitle>
                  <DialogDescription>
                    Información completa de la venta seleccionada
                  </DialogDescription>
                </DialogHeader>

                {selectedSale && (
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium">Factura #{selectedSale.invoice_number}</p>
                      <p className="text-sm text-gray-600">
                        {selectedSale.created_at 
                          ? formatSaleDate(selectedSale.created_at, true) 
                          : formatSaleDate(selectedSale.invoice_date, true)}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold mb-2">Cliente</h3>
                        {selectedSale.owners ? (
                          <>
                            <p>{selectedSale.owners.first_name} {selectedSale.owners.last_name}</p>
                            {selectedSale.owners.email && <p className="text-sm text-gray-600">{selectedSale.owners.email}</p>}
                            {selectedSale.owners.phone && <p className="text-sm text-gray-600">{selectedSale.owners.phone}</p>}
                          </>
                        ) : (
                          <p className="italic">Cliente eliminado</p>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Pago</h3>
                        <p>Método: {selectedSale.payment_method || "No especificado"}</p>
                        <p>Estado: {getStatusText(selectedSale.payment_status)}</p>
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
                          {saleItems.map((item) => (
                            <TableRow key={item.id as any}>
                              <TableCell>{(item as any).products?.name}</TableCell>
                              <TableCell>{(item as any).products?.category}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>S/{(item.unit_price ?? item.products?.price ?? 0).toFixed(2)}</TableCell>
                              <TableCell>S/{(item.total_price ?? ((item.products?.price ?? 0) * item.quantity)).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="text-right space-y-1">
                      <p>Subtotal: S/{selectedSale.subtotal.toFixed(2)}</p>
                      <p>Impuesto: S/{selectedSale.tax_amount.toFixed(2)}</p>
                      <p className="font-semibold">Total: S/{selectedSale.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
      </div>
    </div>
  )
}
