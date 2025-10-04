"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  Save,
} from "lucide-react"
import { supabase } from "@/lib/db"
import { Sidebar } from "@/components/sidebar"
import { toast } from "sonner"

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
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_status: string
  payment_method?: string
  payment_details?: {
    numero_telefono?: string
    nombre_titular?: string
    comprobante_url?: string
  }
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
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [saleItems, setSaleItems] = useState<InvoiceItem[]>([])
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Formulario de nueva venta
  interface SaleFormData {
    metodoPago: string;
    notas: string;
    pagoConfirmado: boolean;
    datosPago: {
      numeroTelefono: string;
      nombreTitular: string;
      comprobante: File | null;
    };
  }

  const [saleForm, setSaleForm] = useState<SaleFormData>({
    metodoPago: "efectivo",
    notas: "",
    pagoConfirmado: false,
    datosPago: {
      numeroTelefono: "",
      nombreTitular: "",
      comprobante: null
    }
  })

  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [newInvoiceId, setNewInvoiceId] = useState<string | null>(null)

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

      // Obtener ventas recientes
      const { data: salesData } = await supabase
        .from("invoices")
        .select(`
        *,
        owners (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
        .order("invoice_date", { ascending: false })
        .limit(50)

      setProducts(productsData || [])
      setClients(clientsData || [])
      setSales(salesData || [])
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
      const today = new Date()
      const todayStr = today.toISOString().split("T")[0]
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthStartStr = firstDay.toISOString().split("T")[0]

      // Ventas de hoy y clientes atendidos hoy
      const { data: todayInvoices } = await supabase
        .from("invoices")
        .select("id, total_amount, owner_id")
        .eq("invoice_date", todayStr)

      const salesToday = (todayInvoices || []).reduce((acc, inv) => acc + (inv.total_amount || 0), 0)
      const clientIds = new Set((todayInvoices || []).map((inv) => inv.owner_id))
      const clientsToday = clientIds.size

      // Ventas del mes
      const { data: monthInvoices } = await supabase
        .from("invoices")
        .select("total_amount")
        .gte("invoice_date", monthStartStr)
        .lte("invoice_date", todayStr)
      const salesMonth = (monthInvoices || []).reduce((acc, inv) => acc + (inv.total_amount || 0), 0)

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
    if (cart.length === 0) {
      toast.error("El carrito está vacío")
      return
    }

    if (!selectedClient) {
      toast.error("Seleccione un cliente")
      return
    }

    // Validar datos de pago para Yape/Plin
    if (['yape', 'plin'].includes(saleForm.metodoPago)) {
      if (!saleForm.datosPago.numeroTelefono || !saleForm.datosPago.nombreTitular) {
        toast.error("Por favor complete todos los datos de pago");
        return;
      }
      if (!saleForm.pagoConfirmado) {
        toast.error("Debe confirmar que ha realizado el pago");
        return;
      }
    }

    try {
      // Calcular totales
      const subtotal = getCartTotal()
      const tax = subtotal * 0.16
      const total = subtotal + tax

      let invoiceId: string

      if (editingSale) {
        // Actualizar factura existente
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            owner_id: selectedClient.id,
            subtotal,
            tax_amount: tax,
            total_amount: total,
            payment_method: saleForm.metodoPago,
            payment_details: ['yape', 'plin'].includes(saleForm.metodoPago) ? {
              numero_telefono: saleForm.datosPago.numeroTelefono,
              nombre_titular: saleForm.datosPago.nombreTitular,
              // Aquí iría la lógica para subir el comprobante a Supabase Storage
              // comprobante_url: uploadedFileUrl
            } : null,
            notes: saleForm.notas,
          })
          .eq("id", editingSale.id)
          .select()

        if (invoiceError) throw invoiceError
        invoiceId = editingSale.id

        // Eliminar los items antiguos
        const { error: deleteItemsError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", editingSale.id)

        if (deleteItemsError) throw deleteItemsError
      } else {
        // Crear nueva factura
        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert([
            {
              owner_id: selectedClient.id,
              invoice_date: new Date().toISOString(),
              subtotal,
              tax_amount: tax,
              total_amount: total,
              payment_status: "completed",
              payment_method: saleForm.metodoPago,
              notes: saleForm.notas,
            },
          ])
          .select()
          .single()

        if (invoiceError) throw invoiceError
        invoiceId = newInvoice.id
      }

      // Crear los items de la factura
      const invoiceItems = cart.map((item) => ({
        invoice_id: invoiceId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }))

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems)

      if (itemsError) throw itemsError

      // Actualizar el stock de productos
      for (const item of cart) {
        const { error: updateError } = await supabase
          .from("products")
          .update({ stock_quantity: item.product.stock_quantity - item.quantity })
          .eq("id", item.product.id)

        if (updateError) throw updateError
      }

      // Limpiar el carrito y el formulario
      setCart([])
      setSelectedClient(null)
      setSaleForm({
        metodoPago: "efectivo",
        notas: "",
        pagoConfirmado: false,
        datosPago: {
          numeroTelefono: "",
          nombreTitular: "",
          comprobante: null
        }
      })
      setEditingSale(null)
      setIsNewSaleDialogOpen(false)

      // Actualizar la lista de ventas
      fetchData()
      fetchStats()

      toast.success(editingSale ? "Venta actualizada exitosamente" : "Venta registrada exitosamente")
    } catch (error) {
      console.error("Error al procesar la venta:", error)
      toast.error(`Error al ${editingSale ? 'actualizar' : 'registrar'} la venta`)
    }
  }

  const handleNewSaleClick = () => {
    setEditingSale(null)
    setCart([])
    setSelectedClient(null)
    setSaleForm({
      metodoPago: "efectivo",
      notas: "",
      pagoConfirmado: false,
      datosPago: {
        numeroTelefono: "",
        nombreTitular: "",
        comprobante: null
      }
    })
    setIsNewSaleDialogOpen(true)
  }

  const filteredProducts = products.filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case "pagada":
        return "bg-green-100 text-green-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "cancelada":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (estado: string) => {
    switch (estado) {
      case "pagada":
        return "Pagada"
      case "pendiente":
        return "Pendiente"
      case "cancelada":
        return "Cancelada"
      default:
        return estado
    }
  }

  const handleEditSale = (sale: Sale) => {
    // Cargar los datos de la venta en el formulario
    setEditingSale(sale)

    // Cargar el cliente
    if (sale.owners) {
      setSelectedClient(sale.owners)
    }

    // Cargar los items en el carrito
    if (sale.items) {
      const cartItems = sale.items.map(item => ({
        product: {
          id: item.product_id || '',
          name: item.products?.name || 'Producto no encontrado',
          price: item.unit_price || 0,
          stock_quantity: 0, // No es relevante para la edición
          category: item.products?.category || ''
        },
        quantity: item.quantity,
        price: item.unit_price || 0
      }))

      setCart(cartItems)
    }

    // Cargar los datos del formulario
    setSaleForm({
      metodoPago: sale.payment_method || "efectivo",
      notas: sale.notes || "",
      pagoConfirmado: false,
      datosPago: {
        numeroTelefono: "",
        nombreTitular: "",
        comprobante: null
      }
    })

    setIsNewSaleDialogOpen(true)
  }

  const handleViewDetails = (sale: Sale) => {
    // Implementar vista de detalles
    console.log("Ver detalles de la venta:", sale)
  }

  const resetForm = () => {
    setSaleForm({
      metodoPago: "efectivo",
      notas: "",
      pagoConfirmado: false,
      datosPago: {
        numeroTelefono: "",
        nombreTitular: "",
        comprobante: null
      }
    })
    setCart([])
    setSelectedClient(null)
    setEditingSale(null)
  }

  const handleOwnerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaleForm({
      ...saleForm,
      datosPago: {
        ...saleForm.datosPago,
        nombreTitular: e.target.value
      }
    })
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaleForm({
      ...saleForm,
      notas: e.target.value
    })
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaleForm({
      ...saleForm,
      datosPago: {
        ...saleForm.datosPago,
        numeroTelefono: e.target.value.replace(/\D/g, '').slice(0, 9)
      }
    })
  }

  const handlePaymentConfirmation = () => {
    setSaleForm({
      ...saleForm,
      pagoConfirmado: !saleForm.pagoConfirmado
    })
  }

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSaleForm({
      ...saleForm,
      datosPago: {
        ...saleForm.datosPago,
        comprobante: file
      }
    })
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
              <Dialog open={isNewSaleDialogOpen} onOpenChange={setIsNewSaleDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleNewSaleClick}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Venta
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>{editingSale ? 'Editar Venta' : 'Nueva Venta'}</DialogTitle>
                    <DialogDescription>Selecciona cliente y productos para crear una nueva venta</DialogDescription>
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
                              <span>IVA (16%):</span>
                              <span>S/.{(getCartTotal() * 0.16).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg">
                              <span>Total:</span>
                              <span>S/.{(getCartTotal() * 1.16).toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-4">
                              <div>
                                <Label>Método de Pago</Label>
                                <Select
                                  value={saleForm.metodoPago}
                                  onValueChange={handlePaymentMethodChange}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar método" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="efectivo">Efectivo</SelectItem>
                                    <SelectItem value="yape">Yape</SelectItem>
                                    <SelectItem value="plin">Plin</SelectItem>
                                    <SelectItem value="tarjeta_credito">Tarjeta de Crédito</SelectItem>
                                    <SelectItem value="tarjeta_debito">Tarjeta de Débito</SelectItem>
                                    <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {(saleForm.metodoPago === 'yape' || saleForm.metodoPago === 'plin') && (
                              <div className="space-y-5 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center space-x-3">
                                  <div className={`p-2 rounded-lg ${saleForm.metodoPago === 'yape' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                    {saleForm.metodoPago === 'yape' ? (
                                      <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22c-5.514 0-10-4.486-10-10S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
                                        <path d="M12 6c-3.309 0-6 2.691-6 6s2.691 6 6 6 6-2.691 6-6-2.691-6-6-6zm0 10c-2.206 0-4-1.794-4-4s1.794-4 4-4 4 1.794 4 4-1.794 4-4 4z"/>
                                      </svg>
                                    ) : (
                                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22c-5.514 0-10-4.486-10-10S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
                                        <path d="M12 6c-3.309 0-6 2.691-6 6s2.691 6 6 6 6-2.691 6-6-2.691-6-6-6zm0 10c-2.206 0-4-1.794-4-4s1.794-4 4-4 4 1.794 4 4-1.794 4-4 4z"/>
                                      </svg>
                                    )}
                                  </div>
                                  <h3 className="text-lg font-semibold text-gray-800">
                                    Pago con {saleForm.metodoPago === 'yape' ? 'Yape' : 'Plin'}
                                  </h3>
                                </div>
                                
                                <div className="space-y-4">
                                  <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-sm font-medium text-gray-500">Número de teléfono</span>
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {saleForm.metodoPago === 'yape' ? 'Yape' : 'Plin'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-lg font-semibold">+51 987 654 321</span>
                                      <button 
                                        onClick={() => {
                                          navigator.clipboard.writeText('+51987654321');
                                          toast.success('Número copiado al portapapeles');
                                        }}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                                      >
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copiar
                                      </button>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-500">
                                      A nombre de: <span className="font-medium">CLINICA VETERINARIA MASCOTAS FELICES</span>
                                    </div>
                                  </div>

                                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r">
                                    <div className="flex">
                                      <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h2a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                      <div className="ml-3">
                                        <p className="text-sm text-blue-700">
                                          Por favor, envía el monto exacto de la compra. Una vez realizado el pago, sube el comprobante y completa los datos solicitados.
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm font-medium text-gray-700">Tu número de teléfono</Label>
                                      <span className="text-xs text-gray-500">Obligatorio</span>
                                    </div>
                                    <div className="relative">
                                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-sm">+51</span>
                                      </div>
                                      <Input 
                                        type="tel" 
                                        placeholder="987654321"
                                        value={saleForm.datosPago.numeroTelefono}
                                        onChange={handlePhoneChange}
                                        className="pl-12"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm font-medium text-gray-700">Nombre del titular de la cuenta</Label>
                                      <span className="text-xs text-gray-500">Obligatorio</span>
                                    </div>
                                    <Input 
                                      placeholder="Ingresa tu nombre completo"
                                      value={saleForm.datosPago.nombreTitular}
                                      onChange={handleOwnerNameChange}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm font-medium text-gray-700">
                                        Comprobante de pago
                                      </Label>
                                      <span className="text-xs text-gray-500">Opcional</span>
                                    </div>
                                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                      <div className="space-y-1 text-center">
                                        <svg
                                          className="mx-auto h-12 w-12 text-gray-400"
                                          stroke="currentColor"
                                          fill="none"
                                          viewBox="0 0 48 48"
                                          aria-hidden="true"
                                        >
                                          <path
                                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                        <div className="flex text-sm text-gray-600">
                                          <label
                                            htmlFor="file-upload"
                                            className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                                          >
                                            <span>Sube un archivo</span>
                                            <input 
                                              id="file-upload" 
                                              name="file-upload" 
                                              type="file" 
                                              className="sr-only"
                                              accept="image/*,.pdf"
                                              onChange={handleReceiptUpload}
                                            />
                                          </label>
                                          <p className="pl-1">o arrastra y suelta</p>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                          PNG, JPG, PDF hasta 5MB
                                        </p>
                                      </div>
                                    </div>
                                    {saleForm.datosPago.comprobante && (
                                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-md">
                                        <div className="flex items-center">
                                          <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span className="text-sm font-medium text-green-800">
                                            {saleForm.datosPago.comprobante.name}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setSaleForm({
                                            ...saleForm,
                                            datosPago: {
                                              ...saleForm.datosPago,
                                              comprobante: null
                                            }
                                          })}
                                          className="text-red-600 hover:text-red-800"
                                        >
                                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-start space-x-3 pt-2">
                                  <div className="flex items-center h-5">
                                    <input
                                      id="pagoConfirmado"
                                      type="checkbox"
                                      checked={saleForm.pagoConfirmado}
                                      onChange={handlePaymentConfirmation}
                                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="text-sm">
                                    <label htmlFor="pagoConfirmado" className="font-medium text-gray-700">
                                      Confirmo que he realizado el pago
                                    </label>
                                    <p className="text-gray-500">
                                      Asegúrate de haber enviado el monto exacto de <span className="font-semibold">S/ {(getCartTotal() * 1.16).toFixed(2)}</span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                            <div>
                              <Input
                                placeholder="Notas adicionales"
                                value={saleForm.notas}
                                onChange={handleNotesChange}
                              />
                            </div>

                            <div className="pt-2">
                              <Button 
                                className={`w-full py-6 text-base ${saleForm.metodoPago === 'yape' ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800' : 
                                  saleForm.metodoPago === 'plin' ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' :
                                  'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800'}`}
                                onClick={handleCreateSale}
                                disabled={['yape', 'plin'].includes(saleForm.metodoPago) && !saleForm.pagoConfirmado}
                              >
                                {editingSale ? (
                                  <>
                                    <Save className="h-5 w-5 mr-2" />
                                    Actualizar Venta
                                  </>
                                ) : (
                                  <>
                                    <Receipt className="h-5 w-5 mr-2" />
                                    Confirmar Venta
                                  </>
                                )}
                              </Button>
                              
                              {['yape', 'plin'].includes(saleForm.metodoPago) && !saleForm.pagoConfirmado && (
                                <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r">
                                  <div className="flex">
                                    <div className="flex-shrink-0">
                                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <div className="ml-3">
                                      <p className="text-sm text-yellow-700">
                                        Por favor, confirma que has realizado el pago para continuar con la venta.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
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
                <CardHeader>
                  <CardTitle>Ventas Recientes</CardTitle>
                  <CardDescription>Historial de ventas</CardDescription>
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
                          <TableCell>{new Date(sale.invoice_date).toLocaleDateString()}</TableCell>
                          <TableCell>S/.{sale.total_amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(sale.payment_status)}>
                              {getStatusText(sale.payment_status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {sale.payment_method === 'yape' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Yape
                                </span>
                              )}
                              {sale.payment_method === 'plin' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Plin
                                </span>
                              )}
                              {sale.payment_method === 'efectivo' && 'Efectivo'}
                              {sale.payment_method === 'tarjeta_credito' && 'Tarjeta Crédito'}
                              {sale.payment_method === 'tarjeta_debito' && 'Tarjeta Débito'}
                              {sale.payment_method === 'transferencia' && 'Transferencia'}
                              {!sale.payment_method && 'No especificado'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(sale);
                                }}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditSale(sale);
                                }}
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

          {/* Diálogo de Detalles de la Venta */}
          <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalles de la Venta</DialogTitle>
                <DialogDescription>Información completa de la venta seleccionada</DialogDescription>
              </DialogHeader>

              {selectedSale && (
                <div className="space-y-4">
                  <div>
                    <p className="font-medium">Factura #{selectedSale.invoice_number}</p>
                    <p className="text-sm text-gray-600">{new Date(selectedSale.invoice_date).toLocaleDateString("es-ES")}</p>
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
                            <TableCell>${(item.unit_price ?? item.products?.price ?? 0).toFixed(2)}</TableCell>
                            <TableCell>${(item.total_price ?? ((item.products?.price ?? 0) * item.quantity)).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="text-right space-y-1">
                    <p>Subtotal: ${selectedSale.subtotal.toFixed(2)}</p>
                    <p>Impuesto: ${selectedSale.tax_amount.toFixed(2)}</p>
                    <p className="font-semibold">Total: ${selectedSale.total_amount.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
