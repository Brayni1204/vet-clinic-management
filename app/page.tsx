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
  created_at?: string
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_status: string
  payment_method?: string
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
  const [saleForm, setSaleForm] = useState({
    metodoPago: "",
    notas: "",
  })

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
        created_at,
        owners (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
        .order("created_at", { ascending: false })
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
        .select("id, total_amount, owner_id, invoice_date")
        .gte("invoice_date", todayStr + "T00:00:00")
        .lte("invoice_date", todayStr + "T23:59:59.999")

      const salesToday = (todayInvoices || []).reduce((acc, inv) => acc + (inv.total_amount || 0), 0)
      const clientIds = new Set((todayInvoices || []).map((inv) => inv.owner_id))
      const clientsToday = clientIds.size

      // Ventas del mes
      const { data: monthInvoices } = await supabase
        .from("invoices")
        .select("total_amount")
        .gte("invoice_date", monthStartStr + "T00:00:00")
        .lte("invoice_date", todayStr + "T23:59:59.999")
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
    if (!selectedClient || cart.length === 0) {
      alert("Selecciona un cliente y agrega productos al carrito")
      return
    }

    const subtotal = getCartTotal()
    const impuestos = subtotal * 0.16
    const total = subtotal + impuestos
    const numeroFactura = `FAC-${Date.now()}`

    try {
      // Crear factura
      const { data: factura, error: facturaError } = await supabase
        .from("invoices")
        .insert([
          {
            owner_id: selectedClient.id,
            invoice_number: numeroFactura,
            invoice_date: new Date().toISOString(), // Guardamos la fecha y hora completas
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

      const { error: itemsError } = await supabase.from("invoice_items").insert(facturaItems)

      if (itemsError) throw itemsError

      // Actualizar stock de productos
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from("products")
          .update({ stock_quantity: item.product.stock_quantity - item.quantity })
          .eq("id", item.product.id)

        if (stockError) console.error("Error actualizando stock:", stockError)
      }

      // Limpiar formulario
      setCart([])
      setSelectedClient(null)
      setSaleForm({ metodoPago: "", notas: "" })
      setIsNewSaleDialogOpen(false)

      // Refrescar datos
      fetchData()

      toast("Venta creada exitosamente")
    } catch (error) {
      console.error("Error creando venta:", error)
      toast("Error al crear la venta")
    }
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
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Venta
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Crear Nueva Venta</DialogTitle>
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

                            <Button className="w-full" onClick={handleCreateSale}>
                              <Receipt className="h-4 w-4 mr-2" />
                              Crear Venta
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
                          <TableCell>
                            <div className="font-medium">
                              {new Date(sale.created_at || sale.invoice_date).toLocaleTimeString('es-PE', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(sale.created_at || sale.invoice_date).toLocaleDateString("es-ES")}
                            </div>
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
                              <Button size="sm" variant="ghost">
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
      </div>
    </div>
  )
}
