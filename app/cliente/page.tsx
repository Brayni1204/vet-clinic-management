"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppConfig } from "@/context/AppConfigContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Calendar,
  ShoppingCart,
  PawPrint,
  Clock,
  Package,
  Plus,
  Search,
  Star,
  Heart,
  Phone,
  Mail,
  MapPin,
  Minus,
  Trash2,
  CreditCard,
  CheckCircle,
  LogOut,
  User,
} from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/db"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  category: string
  description?: string
  price: number
  stock_quantity: number
  image_url?: string
}

interface CartItem extends Product {
  quantity: number
}

interface ClientUser {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
}

export default function ClientPortalPage() {
  const { clinicName } = useAppConfig()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false)
  const [isCartDialogOpen, setIsCartDialogOpen] = useState(false)
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [showYapeModal, setShowYapeModal] = useState(false)
  const [showPlinModal, setShowPlinModal] = useState(false)
  const [showCardModal, setShowCardModal] = useState(false)
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const [clientUser, setClientUser] = useState<ClientUser | null>(null)

  const router = useRouter()

  const saveReceiptToLocalStorage = async (file: File, orderId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64String = reader.result as string;
          const receiptData = {
            fileName: file.name,
            fileType: file.type,
            data: base64String,
            timestamp: new Date().toISOString(),
            orderId: orderId
          };
          const receiptKey = `receipt_${Date.now()}_${orderId}`;
          localStorage.setItem(receiptKey, JSON.stringify(receiptData));
          console.log('Comprobante guardado en localStorage con key:', receiptKey);
          resolve(receiptKey);
        } catch (error) {
          console.error('Error al guardar el comprobante:', error);
          reject(error);
        }
      };
      reader.onerror = (error) => {
        console.error('Error al leer el archivo:', error);
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  };
  const [isUploading, setIsUploading] = useState(false)
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: ''
  })
  const [cardErrors, setCardErrors] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: ''
  })

  const validateCardNumber = (number: string) => {
    const cleaned = number.replace(/\s+/g, '');
    if (!/^\d+$/.test(cleaned)) return 'Solo se permiten números';
    if (cleaned.length !== 16) return 'Deben ser 16 dígitos';
    return '';
  }

  const handleCardNumberChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const formatted = numericValue.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    setCardForm({ ...cardForm, cardNumber: formatted });
    setCardErrors({ ...cardErrors, cardNumber: '' });
  }

  const validateExpiryDate = (date: string) => {
    if (!/^\d{2}\/\d{2}$/.test(date)) return 'Formato válido: MM/AA';
    const [month, year] = date.split('/').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;

    if (month < 1 || month > 12) return 'Mes inválido';
    if (year < currentYear || (year === currentYear && month < currentMonth)) return 'Tarjeta vencida';
    return '';
  }

  const validateCVV = (cvv: string) => {
    if (!/^\d{3}$/.test(cvv)) return 'CVV debe tener 3 dígitos';
    return '';
  }

  const handleCVVChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 3);
    setCardForm({ ...cardForm, cvv: numericValue });
    setCardErrors({ ...cardErrors, cvv: '' });
  }

  const validateCardName = (name: string) => {
    if (name.trim().length < 3) return 'Nombre muy corto';
    if (!/^[a-zA-ZÀ-ſ ]+$/.test(name)) return 'Solo letras y espacios';
    return '';
  }

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (v.length >= 3) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  }
  const [config, setConfig] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("productos")

  const [appointmentForm, setAppointmentForm] = useState({
    petName: "",
    petSpecies: "",
    appointmentDate: "",
    appointmentTime: "",
    reason: "",
    notes: "",
  })

  const [checkoutForm, setCheckoutForm] = useState({
    direccion: "",
    metodoPago: "",
    notas: "",
  })

  useEffect(() => {
    fetchProducts()
    loadCartFromStorage()
    fetchConfig()
  }, [])

  useEffect(() => {
    saveCartToStorage()
  }, [cart])

  useEffect(() => {
    console.log('showYapeModal cambió a:', showYapeModal);
    console.log('showPlinModal cambió a:', showPlinModal);
    if (!showYapeModal && !showPlinModal) {
      setPaymentReceipt(null);
    }
  }, [showYapeModal, showPlinModal]);

  // New useEffect to check for logged-in client and fetch their data
  useEffect(() => {
    const loadClientData = async () => {
      if (typeof window !== "undefined") {
        const clientId = localStorage.getItem('client_user_id');
        if (clientId) {
          try {
            const { data, error } = await supabase
              .from('owners')
              .select('id, first_name, last_name, email, phone, address, city, state, zip_code')
              .eq('id', clientId)
              .single();

            if (error) {
              console.error("Error fetching client data:", error);
              localStorage.removeItem('client_user_id');
              setClientUser(null);
              toast.error("Error al cargar tus datos de sesión. Por favor, vuelve a iniciar sesión.");
            } else if (data) {
              setClientUser(data);
            }
          } catch (err) {
            console.error("Exception loading client data:", err);
            localStorage.removeItem('client_user_id');
            setClientUser(null);
            toast.error("Hubo un problema al cargar tu sesión. Vuelve a iniciar sesión.");
          }
        }
      }
    };
    loadClientData();
  }, []); // Run once on component mount

  const handleClientLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem('client_user_id');
      setClientUser(null);
      toast.info("Has cerrado sesión.");
      router.push('/cliente'); // Redirect to this same page to refresh state
    }
  };


  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .gt("stock_quantity", 0)
        .order("name", { ascending: true })

      if (error) {
        console.error("Error fetching products:", error)
      } else {
        setProducts(data || [])
      }
    } catch (err) {
      console.error("Exception fetching products:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("clinic_configuration")
        .select("phone,email,address,emergency_phone")
        .limit(1)
        .single()

      if (error) {
        console.error("Error fetching configuration:", error)
      } else {
        setConfig(data)
      }
    } catch (err) {
      console.error("Exception fetching configuration:", err)
    }
  }

  const loadCartFromStorage = () => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("vetclinic-cart")
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart))
        } catch (err) {
          console.error("Error loading cart from storage:", err)
        }
      }
    }
  }

  const saveCartToStorage = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("vetclinic-cart", JSON.stringify(cart))
    }
  }

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id)
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) } : item,
        )
      }
      return [...prevCart, { ...product, quantity: 1 }]
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(productId)
      return
    }

    const product = products.find((p) => p.id === productId)
    const maxQuantity = product?.stock_quantity || 1

    setCart((prevCart) =>
      prevCart.map((item) => (item.id === productId ? { ...item, quantity: Math.min(quantity, maxQuantity) } : item)),
    )
  }

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // En este punto, sabemos que clientUser NO es null debido a la comprobación del botón.
    const ownerId = clientUser!.id; // Accedemos directamente a la ID del usuario logeado

    try {
      // 1. Crear/insertar mascota (siempre necesario)
      const { data: pet, error: petError } = await supabase
        .from("pets")
        .insert([
          {
            owner_id: ownerId, // Usar la ID del cliente logeado
            name: appointmentForm.petName,
            species: appointmentForm.petSpecies,
          },
        ])
        .select()
        .single()

      if (petError) throw petError

      // 2. Crear cita
      const { error: apptError } = await supabase.from("appointments").insert([
        {
          pet_id: pet.id,
          owner_id: ownerId, // Usar la ID del cliente logeado
          appointment_date: appointmentForm.appointmentDate,
          appointment_time: appointmentForm.appointmentTime,
          reason: appointmentForm.reason,
          notes: appointmentForm.notes,
          status: "scheduled",
          created_at: new Date().toISOString(),
        },
      ])

      if (apptError) throw apptError

      // Éxito
      toast("¡Solicitud de cita enviada! Te contactaremos pronto para confirmar.")
      setIsAppointmentDialogOpen(false)

    } catch (err: any) {
      console.error("Error enviando cita:", err)
      toast("Hubo un problema al enviar la solicitud. Por favor, intenta de nuevo.")
    } finally {
      // Resetear solo los campos de la mascota y cita, no los del propietario
      setAppointmentForm((prev) => ({
        ...prev,
        petName: "",
        petSpecies: "",
        appointmentDate: "",
        appointmentTime: "",
        reason: "",
        notes: "",
      }))
    }
  }

  const processOrder = async () => {
    const subtotal = getTotalPrice()
    const impuestos = subtotal * 0.18 // 18% IGV (IVA)
    const total = subtotal + impuestos
    const numeroPedido = `PED-${Date.now()}`

    // En este punto, sabemos que clientUser NO es null debido a la comprobación del botón.
    const clientOrderName = `${clientUser!.first_name} ${clientUser!.last_name}`;
    const clientOrderEmail = clientUser!.email;
    const clientOrderPhone = clientUser!.phone;
    const clientOrderId = clientUser!.id; // Usar la ID del cliente logeado

    try {
      const orderData = {
        order_number: numeroPedido,
        client_name: clientOrderName,
        client_email: clientOrderEmail,
        client_phone: clientOrderPhone,
        delivery_address: checkoutForm.direccion,
        subtotal,
        tax_amount: impuestos,
        total_amount: total,
        status: "pending",
        payment_method: checkoutForm.metodoPago,
        notes: checkoutForm.notas,
        estimated_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        owner_id: clientOrderId, // Link the order to the logged-in owner ID
      };

      const { data: pedido, error: pedidoError } = await supabase
        .from("client_orders")
        .insert(orderData)
        .select('*')

      if (paymentReceipt && pedido && pedido[0]) {
        try {
          const orderId = pedido[0].id;
          await saveReceiptToLocalStorage(paymentReceipt, orderId);
        } catch (error) {
          console.error('Error saving receipt:', error);
        }
      }

      if (pedidoError) {
        console.error("Error creating order:", pedidoError)
        throw pedidoError
      }

      if (!pedido || pedido.length === 0) {
        throw new Error('Could not get order ID after insertion');
      }
      const pedidoId = pedido[0].id;

      const itemsPedido = cart.map((item) => ({
        order_id: pedidoId,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }))

      const { error: itemsError } = await supabase.from("order_items").insert(itemsPedido)

      if (itemsError) {
        console.error("Error creating order items:", itemsError)
        throw itemsError
      }

      for (const item of cart) {
        const { error: stockError } = await supabase
          .from("products")
          .update({ stock_quantity: item.stock_quantity - item.quantity })
          .eq("id", item.id)

        if (stockError) console.error("Error updating stock:", stockError)
      }

      setCart([])
      if (typeof window !== "undefined") {
        localStorage.removeItem("vetclinic-cart")
      }
      fetchProducts()
      return true
    } catch (error) {
      console.error("Error processing order:", error)
      throw error
    }
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()

    if (cart.length === 0) {
      alert("El carrito está vacío")
      return
    }

    if (!clientUser) {
      toast.warning("Debes iniciar sesión para finalizar tu compra.");
      router.push("/login"); // Redirect to login page
      return;
    }

    if (!checkoutForm.metodoPago) {
      alert("Por favor selecciona un método de pago");
      return;
    }

    if (checkoutForm.metodoPago === 'yape') {
      setShowYapeModal(true);
      return;
    }

    if (checkoutForm.metodoPago === 'plin') {
      setShowPlinModal(true);
      return;
    }

    if (checkoutForm.metodoPago === 'tarjeta_credito' || checkoutForm.metodoPago === 'tarjeta_debito') {
      setShowCardModal(true);
      return;
    }

    try {
      await processOrder();
      setOrderSuccess(true);
      setIsCheckoutDialogOpen(false);
    } catch (error) {
      console.error('Error en el proceso de pago:', error);
      alert("Error al procesar el pedido. Por favor intenta de nuevo.");
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = [...new Set(products.map((product) => product.category))]

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case "medicamento":
        return "bg-blue-100 text-blue-800"
      case "alimento":
        return "bg-green-100 text-green-800"
      case "suministro":
        return "bg-purple-100 text-purple-800"
      case "servicio":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case 'efectivo': return 'Efectivo (Contra entrega)';
      case 'yape_plin': return 'Yape o Plin';
      case 'tarjeta_credito': return 'Tarjeta de Crédito';
      case 'tarjeta_debito': return 'Tarjeta de Débito';
      default: return method;
    }
  }

  const getCategoryName = (categoria: string) => {
    switch (categoria) {
      case "medicamento":
        return "Medicamento"
      case "alimento":
        return "Alimento"
      case "suministro":
        return "Suministro"
      case "servicio":
        return "Servicio"
      default:
        return categoria
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando productos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <PawPrint className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{clinicName || 'Veterinaria'}</h1>
                <p className="text-sm text-gray-600">Portal del Cliente</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Dialog open={isCartDialogOpen} onOpenChange={setIsCartDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="relative bg-transparent">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Ver Carrito ({getTotalItems()})
                    {cart.length > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                        {getTotalItems()}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Carrito de Compras</DialogTitle>
                    <DialogDescription>Revisa tus productos antes de proceder al pago</DialogDescription>
                  </DialogHeader>

                  {cart.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Tu carrito está vacío</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cart.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <Badge className={getCategoryColor(item.category)}>
                                    {getCategoryName(item.category)}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>S/.{item.price.toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center">{item.quantity}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    disabled={item.quantity >= item.stock_quantity}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>S/.{(item.price * item.quantity).toFixed(2)}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" onClick={() => removeFromCart(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                          <span>Subtotal:</span>
                          <span>S/.{getTotalPrice().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span>IGV (18%):</span>
                          <span>S/.{(getTotalPrice() * 0.18).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Total:</span>
                          <span>S/.{(getTotalPrice() * 1.18).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => setIsCartDialogOpen(false)}
                        >
                          Seguir Comprando
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => {
                            // Check if client is logged in before proceeding to checkout
                            if (!clientUser) {
                              toast.warning("Debes iniciar sesión para finalizar tu compra.");
                              router.push("/login"); // Redirect to login page
                              return;
                            }
                            setIsCartDialogOpen(false)
                            setIsCheckoutDialogOpen(true)
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Proceder al Pago
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Login/Logout display */}
              {clientUser ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-700 flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <p>Hola, <strong>{clientUser.first_name}</strong></p>
                  </span>
                  <Button variant="ghost" onClick={handleClientLogout}>
                    <LogOut className="h-4 w-4 mr-1" />
                    Cerrar Sesión
                  </Button>
                </div>
              ) : (
                <Link href="/login">
                  <Button variant="ghost">Iniciar Sesión</Button>
                </Link>
              )}
              {/* Always show "Personal" button */}
              <Link href="/login">
                <Button variant="ghost">Personal</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white mb-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-4">Cuidamos a tu mascota como familia</h2>
            <p className="text-lg mb-6">
              Servicios veterinarios profesionales, productos de calidad y atención personalizada para el bienestar de
              tu compañero peludo.
            </p>
            <div className="flex gap-4">
              <Dialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="secondary" onClick={() => {
                    if (!clientUser) {
                      toast.warning("Debes iniciar sesión para agendar una cita.");
                      router.push("/login"); // Redirect to login page
                      return;
                    }
                    setIsAppointmentDialogOpen(true); // Open the dialog if logged in
                  }}>
                    <Calendar className="h-5 w-5 mr-2" />
                    Agendar Cita
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Solicitar Cita</DialogTitle>
                    <DialogDescription>
                      Completa el formulario y te contactaremos para confirmar tu cita
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAppointmentSubmit} className="space-y-4">
                    {/* Display client data if logged in, otherwise hide fields */}
                    {clientUser ? (
                      <></>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="ownerName">Tu Nombre</Label>
                            <Input
                              id="ownerName"
                              value={appointmentForm.petName} // Using petName as a placeholder for a non-logged-in scenario, but this form should only appear if logged in.
                              // This whole block should ideally not be rendered if clientUser exists.
                              // Removed ownerName, ownerPhone, ownerEmail from appointmentForm state for simplicity as they are now prefilled.
                              // If clientUser is null, this form won't be reachable.
                              // So, these fields are implicitly required via the clientUser check.
                              disabled // Disable if logged in, but the whole block should be conditional
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ownerPhone">Teléfono</Label>
                            <Input
                              id="ownerPhone"
                              value={appointmentForm.petSpecies} // Placeholder
                              disabled
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ownerEmail">Email</Label>
                          <Input
                            id="ownerEmail"
                            type="email"
                            value={appointmentForm.appointmentDate} // Placeholder
                            disabled
                          />
                        </div>
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="petName">Nombre de la Mascota</Label>
                        <Input
                          id="petName"
                          value={appointmentForm.petName}
                          onChange={(e) => setAppointmentForm({ ...appointmentForm, petName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="petSpecies">Especie</Label>
                        <Select
                          value={appointmentForm.petSpecies}
                          onValueChange={(value) => setAppointmentForm({ ...appointmentForm, petSpecies: value })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Perro">Perro</SelectItem>
                            <SelectItem value="Gato">Gato</SelectItem>
                            <SelectItem value="Ave">Ave</SelectItem>
                            <SelectItem value="Conejo">Conejo</SelectItem>
                            <SelectItem value="Otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="appointmentDate">Fecha Preferida</Label>
                        <Input
                          id="appointmentDate"
                          type="date"
                          value={appointmentForm.appointmentDate}
                          onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="appointmentTime">Hora Preferida</Label>
                        <Input
                          id="appointmentTime"
                          type="time"
                          value={appointmentForm.appointmentTime}
                          onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentTime: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason">Motivo de la Consulta</Label>
                      <Select
                        value={appointmentForm.reason}
                        onValueChange={(value) => setAppointmentForm({ ...appointmentForm, reason: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Consulta general">Consulta general</SelectItem>
                          <SelectItem value="Vacunación">Vacunación</SelectItem>
                          <SelectItem value="Emergencia">Emergencia</SelectItem>
                          <SelectItem value="Cirugía">Cirugía</SelectItem>
                          <SelectItem value="Limpieza dental">Limpieza dental</SelectItem>
                          <SelectItem value="Control">Control</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notas Adicionales</Label>
                      <Input
                        id="notes"
                        value={appointmentForm.notes}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                        placeholder="Describe los síntomas o información adicional"
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      Enviar Solicitud
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                size="lg"
                variant="outline"
                className="text-white border-white hover:bg-white hover:text-blue-600 bg-transparent"
                onClick={() => {
                  if (config?.phone) {
                    window.location.href = `tel:${config.phone}`
                  }
                }}
              >
                <Phone className="h-5 w-5 mr-2" />
                Llamar Ahora
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="productos">Productos</TabsTrigger>
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
            <TabsTrigger value="contacto">Contacto</TabsTrigger>
          </TabsList>

          <TabsContent value="productos" className="space-y-6">
            <div className="text-sm text-gray-500 mb-4">
              Productos encontrados: {products.length} | Productos filtrados: {filteredProducts.length}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {getCategoryName(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cart.length > 0 && (
              <Card className="sticky top-4 z-10 border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Carrito: {getTotalItems()} productos</p>
                      <p className="text-sm text-gray-600">Total: S/.{(getTotalPrice() * 1.16).toFixed(2)}</p>
                    </div>
                    <Button onClick={() => setIsCartDialogOpen(true)}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Ver Carrito
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron productos</h3>
                <p className="text-gray-600">
                  {products.length === 0
                    ? "No hay productos disponibles en este momento."
                    : "Intenta cambiar los filtros de búsqueda."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="aspect-square rounded-lg mb-4 overflow-hidden flex items-center justify-center bg-gray-100">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <Package className="h-12 w-12 text-gray-400" />
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={getCategoryColor(product.category)}>
                            {getCategoryName(product.category)}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm">4.5</span>
                          </div>
                        </div>

                        <h3 className="font-semibold">{product.name}</h3>
                        {product.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-green-600">
                            S/.{product.price.toFixed(2)}
                          </span>
                          <span className="text-sm text-gray-500">
                            Stock: {product.stock_quantity}
                          </span>
                        </div>

                        <Button
                          className="w-full"
                          onClick={() => addToCart(product)}
                          disabled={product.stock_quantity === 0}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar al Carrito
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="servicios" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    Consulta General
                  </CardTitle>
                  <CardDescription>Examen completo de salud para tu mascota</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-2xl font-bold text-green-600">S/.85.00</div>
                    <ul className="text-sm space-y-1">
                      <li>• Examen físico completo</li>
                      <li>• Evaluación de peso y condición</li>
                      <li>• Recomendaciones de cuidado</li>
                      <li>• Plan de vacunación</li>
                    </ul>
                    <Button className="w-full" onClick={() => {
                      if (!clientUser) {
                        toast.warning("Debes iniciar sesión para agendar una cita.");
                        router.push("/login"); // Redirect to login page
                        return;
                      }
                      setIsAppointmentDialogOpen(true); // Open the dialog if logged in
                    }}>Agendar Consulta</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    Vacunación
                  </CardTitle>
                  <CardDescription>Protege a tu mascota con nuestras vacunas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-2xl font-bold text-green-600">Desde S/.25.00</div>
                    <ul className="text-sm space-y-1">
                      <li>• Vacuna antirrábica</li>
                      <li>• DHPP (perros)</li>
                      <li>• Triple felina (gatos)</li>
                      <li>• Certificado de vacunación</li>
                    </ul>
                    <Button className="w-full" onClick={() => { setActiveTab("productos"); setCategoryFilter("vacunas") }}>Ver Opciones</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-500" />
                    Emergencias
                  </CardTitle>
                  <CardDescription>Atención de urgencia 24/7</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-2xl font-bold text-red-600">Urgente</div>
                    <ul className="text-sm space-y-1">
                      <li>• Atención inmediata</li>
                      <li>• Disponible 24 horas</li>
                      <li>• Equipo especializado</li>
                      <li>• Hospitalización si es necesario</li>
                    </ul>
                    <Button
                      className="w-full"
                      variant="destructive"
                      onClick={() => {
                        const num = (config?.emergency_phone || config?.phone || "").replace(/\D/g, "")
                        if (num) {
                          window.open(`https://wa.me/${num}`, "_blank")
                        }
                      }}
                    >
                      <Phone className="h-5 w-5 mr-2" />
                      Llamar Emergencia
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contacto" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Información de Contacto</CardTitle>
                  <CardDescription>Estamos aquí para ayudarte</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Teléfono</p>
                      <p className="text-gray-600">{config?.phone || "+51 000000000"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-gray-600">{config?.email || "no-disponible@correo.com"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Dirección</p>
                      <p className="text-gray-600">{config?.address || "Dirección no disponible"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Horarios</p>
                      <p className="text-gray-600">Lun-Vie: 8:00 AM - 6:00 PM</p>
                      <p className="text-gray-600">Sáb: 9:00 AM - 4:00 PM</p>
                      <p className="text-gray-600">Dom: Emergencias únicamente</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Envíanos un Mensaje</CardTitle>
                  <CardDescription>Te responderemos lo antes posible</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input id="name" placeholder="Tu nombre" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input id="phone" placeholder="Tu teléfono" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="tu@email.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Asunto</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un asunto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cita">Solicitar cita</SelectItem>
                          <SelectItem value="consulta">Consulta general</SelectItem>
                          <SelectItem value="emergencia">Emergencia</SelectItem>
                          <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Mensaje</Label>
                      <textarea
                        id="message"
                        className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Escribe tu mensaje aquí..."
                      />
                    </div>
                    <Button className="w-full" onClick={() => { if (config?.email) window.location.href = `mailto:${config.email}` }}>Enviar Mensaje</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Compra</DialogTitle>
            <DialogDescription>Completa tus datos para procesar el pedido</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckout} className="space-y-4">
            {/* Display client data if logged in, otherwise hide fields */}
            {clientUser ? (
              <></>
            ) : (
              // This block should ideally not be rendered if clientUser is null,
              // as the dialog won't open if clientUser is null due to the button check.
              // Keeping it here for clarity, but the UI flow ensures it's not seen.
              <>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre Completo</Label>
                  <Input
                    id="nombre"
                    value={checkoutForm.direccion} // Placeholder
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={checkoutForm.metodoPago} // Placeholder
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={checkoutForm.notas} // Placeholder
                    disabled
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección de Entrega</Label>
              <Input
                id="direccion"
                value={checkoutForm.direccion}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, direccion: e.target.value })}
                placeholder="Calle, número, colonia, ciudad"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de Pago</Label>
              <Select
                value={checkoutForm.metodoPago}
                onValueChange={(value) => {
                  setCheckoutForm({ ...checkoutForm, metodoPago: value });
                  if (value === 'yape') {
                    setShowYapeModal(true);
                  } else if (value === 'plin') {
                    setShowPlinModal(true);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo (Contra entrega)</SelectItem>
                  <SelectItem value="yape">Yape</SelectItem>
                  <SelectItem value="plin">Plin</SelectItem>
                  <SelectItem value="tarjeta_credito">Tarjeta de Crédito</SelectItem>
                  <SelectItem value="tarjeta_debito">Tarjeta de Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas Adicionales (Opcional)</Label>
              <Input
                id="notas"
                value={checkoutForm.notas}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, notas: e.target.value })}
                placeholder="Instrucciones especiales de entrega"
              />
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>S/.
                    {getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IGV (18%):</span>
                  <span>S/.
                    {(getTotalPrice() * 0.18).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>S/.
                    {(getTotalPrice() * 1.18).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full">
              <CreditCard className="h-4 w-4 mr-2" />
              Confirmar Pedido
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Modals (Yape, Plin, Card) - remain unchanged */}
      {/* ... (Your Yape, Plin, Card Modals are here, they remain the same) */}

      {/* Yape Modal */}
      <Dialog open={showYapeModal} onOpenChange={setShowYapeModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>Pago con Yape</DialogTitle>
            <DialogDescription>
              Realiza el pago al siguiente número y sube el comprobante
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 p-1">
            <div className="bg-white rounded-lg">
              <div className="flex flex-col items-center">
                <div className="mb-6">
                  <p className="text-2xl font-bold text-purple-700 text-center">Escanea para pagar</p>
                </div>

                <div className="mb-6 p-4 bg-white border-2 border-purple-100 rounded-lg">
                  <img
                    src="/yape-logo.jpg"
                    alt="Logo de Yape"
                    className="w-48 h-48 mx-auto"
                  />
                </div>

                <div className="w-full max-w-xs space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Paga al número</p>
                    <p className="text-2xl font-bold text-purple-700">987 654 321</p>
                    <p className="text-sm text-gray-500">Veterinaria Mascota Feliz</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codigoSeguridad" className="block text-sm font-medium text-gray-700 text-center">
                      Ingresa el código de seguridad de Yape
                    </Label>
                    <Input
                      id="codigoSeguridad"
                      type="text"
                      placeholder="Ej: 123"
                      className="text-center text-xl font-mono tracking-widest"
                      pattern="\d{3}"
                      inputMode="numeric"
                      maxLength={3}
                      minLength={3}
                      title="Por favor ingresa exactamente 3 dígitos numéricos"
                      required
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        e.target.value = value.slice(0, 3);
                      }}
                    />
                    <p className="text-xs text-gray-500 text-center">
                      Ingresa el código que aparece en tu comprobante de pago
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div>
            <div className="mt-8 space-y-4 bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 text-center">Subir comprobante de pago</h3>
              <div className="mt-2 flex justify-center px-6 pt-8 pb-10 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                <div className="space-y-3 text-center">
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
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-1 text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>Sube un archivo</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept="image/*,.pdf"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPaymentReceipt(file);
                            const previewUrl = URL.createObjectURL(file);
                            setReceiptPreview(previewUrl);
                          } else {
                            setPaymentReceipt(null);
                            setReceiptPreview(null);
                          }
                        }}
                      />
                    </label>
                    <p>o arrastra y suelta</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, PDF hasta 5MB
                  </p>
                </div>
              </div>
              {paymentReceipt && (
                <div className="mt-3 p-3 bg-white rounded-md border border-gray-200">
                  <p className="text-sm text-gray-700 truncate">
                    <span className="font-medium">Archivo:</span> {paymentReceipt.name}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowYapeModal(false)}
                disabled={isUploading}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!paymentReceipt) {
                    alert('Por favor, sube el comprobante de pago')
                    return
                  }

                  setIsUploading(true)
                  try {
                    await new Promise(resolve => setTimeout(resolve, 1500))

                    await processOrder();

                    setShowYapeModal(false);
                    setIsCheckoutDialogOpen(false);

                    setOrderSuccess(true);

                    setCheckoutForm({
                      ...checkoutForm,
                      metodoPago: ''
                    });

                  } catch (error) {
                    console.error('Error al procesar el pago:', error);
                    alert('Error al procesar el pago. Por favor, inténtalo de nuevo.');
                  } finally {
                    setIsUploading(false);
                  }
                }}
                disabled={!paymentReceipt || isUploading}
              >
                {isUploading ? 'Procesando...' : 'Confirmar Pago'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plin Modal */}
      <Dialog open={showPlinModal} onOpenChange={setShowPlinModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>Pago con Plin</DialogTitle>
            <DialogDescription>
              Realiza el pago al siguiente número y sube el comprobante
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 p-1">
            <div className="bg-white rounded-lg">
              <div className="flex flex-col items-center">
                <div className="mb-6">
                  <p className="text-2xl font-bold text-blue-700 text-center">Paga con Plin</p>
                </div>

                <div className="mb-6 p-4 bg-white border-2 border-blue-100 rounded-lg">
                  <img
                    src="/yape-logo.jpg"
                    alt="Logo de Plin"
                    className="w-48 h-48 mx-auto object-contain"
                  />
                </div>

                <div className="w-full max-w-xs space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Paga al número</p>
                    <p className="text-2xl font-bold text-blue-700">987 654 321</p>
                    <p className="text-sm text-gray-500">Veterinaria Mascota Feliz</p>
                  </div>

                  <div className="space-y-2 w-full">
                    <Label htmlFor="codigoOperacion" className="block text-sm font-medium text-gray-700 text-center">
                      Código de operación
                    </Label>
                    <Input
                      id="codigoOperacion"
                      type="text"
                      placeholder="Ej: 1234567"
                      className="text-center text-lg font-mono tracking-widest"
                      pattern="\d{7}"
                      inputMode="numeric"
                      maxLength={7}
                      minLength={7}
                      title="Por favor ingresa exactamente 7 dígitos numéricos"
                      required
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        e.target.value = value.slice(0, 7);
                      }}
                    />
                    <p className="text-xs text-gray-500 text-center">
                      Ingresa el código de operación de 7 dígitos
                    </p>
                  </div>

                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4 bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 text-center">Subir comprobante de pago</h3>
              <div className="mt-2 flex justify-center px-6 pt-8 pb-10 border-2 border-dashed border-blue-300 rounded-lg bg-white">
                <div className="space-y-3 text-center">
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
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-1 text-sm text-gray-600">
                    <label
                      htmlFor="file-upload-plin"
                      className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>Sube un archivo</span>
                      <input
                        id="file-upload-plin"
                        name="file-upload-plin"
                        type="file"
                        className="sr-only"
                        accept="image/*,.pdf"
                        onChange={(e) => setPaymentReceipt(e.target.files?.[0] || null)}
                      />
                    </label>
                    <p>o arrastra y suelta</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, PDF hasta 5MB
                  </p>
                </div>
              </div>
              {paymentReceipt && (
                <div className="mt-3 p-3 bg-white rounded-md border border-blue-200">
                  <p className="text-sm text-gray-700 truncate">
                    <span className="font-medium">Archivo:</span> {paymentReceipt.name}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPlinModal(false)}
                  disabled={isUploading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!paymentReceipt) {
                      alert('Por favor, sube el comprobante de pago')
                      return
                    }

                    setIsUploading(true)
                    try {
                      await new Promise(resolve => setTimeout(resolve, 1500))

                      await processOrder();

                      setShowPlinModal(false);
                      setIsCheckoutDialogOpen(false);

                      setOrderSuccess(true);

                      setCheckoutForm({
                        ...checkoutForm,
                        metodoPago: ''
                      });

                    } catch (error) {
                      console.error('Error al procesar el pago:', error);
                      alert('Error al procesar el pago. Por favor, inténtalo de nuevo.');
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  disabled={!paymentReceipt || isUploading}
                >
                  {isUploading ? 'Procesando...' : 'Confirmar Pago'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Payment Modal */}
      <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pago con Tarjeta</DialogTitle>
            <DialogDescription>
              Ingresa los datos de tu tarjeta para realizar el pago
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Número de tarjeta</Label>
              <Input
                id="cardNumber"
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardForm.cardNumber}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                onBlur={() => {
                  const error = validateCardNumber(cardForm.cardNumber);
                  setCardErrors({ ...cardErrors, cardNumber: error });
                }}
                maxLength={19}
                inputMode="numeric"
                pattern="[0-9\s]*"
                className={`w-full ${cardErrors.cardNumber ? 'border-red-500' : ''}`}
              />
              {cardErrors.cardNumber && (
                <p className="text-sm text-red-500">{cardErrors.cardNumber}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardName">Nombre en la tarjeta</Label>
              <Input
                id="cardName"
                type="text"
                placeholder="JUAN PEREZ"
                value={cardForm.cardName}
                onChange={(e) => {
                  setCardForm({ ...cardForm, cardName: e.target.value });
                  setCardErrors({ ...cardErrors, cardName: '' });
                }}
                onBlur={() => {
                  const error = validateCardName(cardForm.cardName);
                  setCardErrors({ ...cardErrors, cardName: error });
                }}
                className={`w-full ${cardErrors.cardName ? 'border-red-500' : ''}`}
              />
              {cardErrors.cardName && (
                <p className="text-sm text-red-500">{cardErrors.cardName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Vencimiento (MM/AA)</Label>
                <Input
                  id="expiryDate"
                  type="text"
                  placeholder="12/25"
                  value={cardForm.expiryDate}
                  onChange={(e) => {
                    const formatted = formatExpiryDate(e.target.value);
                    setCardForm({ ...cardForm, expiryDate: formatted });
                    setCardErrors({ ...cardErrors, expiryDate: '' });
                  }}
                  onBlur={() => {
                    const error = validateExpiryDate(cardForm.expiryDate);
                    setCardErrors({ ...cardErrors, expiryDate: error });
                  }}
                  maxLength={5}
                  className={cardErrors.expiryDate ? 'border-red-500' : ''}
                />
                {cardErrors.expiryDate && (
                  <p className="text-sm text-red-500">{cardErrors.expiryDate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="password"
                  placeholder="123"
                  value={cardForm.cvv}
                  onChange={(e) => handleCVVChange(e.target.value)}
                  onBlur={() => {
                    const error = validateCVV(cardForm.cvv);
                    setCardErrors({ ...cardErrors, cvv: error });
                  }}
                  maxLength={3}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cardErrors.cvv ? 'border-red-500' : ''}
                />
                {cardErrors.cvv && (
                  <p className="text-sm text-red-500">{cardErrors.cvv}</p>
                )}
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-600">
              <p>El pago se procesará de forma segura con nuestro proveedor de pagos.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCardModal(false)}
                disabled={isUploading}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  const errors = {
                    cardNumber: validateCardNumber(cardForm.cardNumber),
                    cardName: validateCardName(cardForm.cardName),
                    expiryDate: validateExpiryDate(cardForm.expiryDate),
                    cvv: validateCVV(cardForm.cvv)
                  };

                  setCardErrors(errors);

                  const hasErrors = Object.values(errors).some(error => error !== '');
                  if (hasErrors) {
                    const firstErrorField = Object.keys(errors).find(key => errors[key as keyof typeof errors] !== '');
                    if (firstErrorField) {
                      document.getElementById(firstErrorField)?.focus();
                    }
                    return;
                  }

                  setIsUploading(true);
                  try {
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    await processOrder();

                    setShowCardModal(false);
                    setIsCheckoutDialogOpen(false);

                    setOrderSuccess(true);

                    setCheckoutForm({
                      ...checkoutForm,
                      metodoPago: ''
                    });

                    setCardForm({
                      cardNumber: '',
                      cardName: '',
                      expiryDate: '',
                      cvv: ''
                    });

                    setCardErrors({
                      cardNumber: '',
                      cardName: '',
                      expiryDate: '',
                      cvv: ''
                    });

                  } catch (error) {
                    console.error('Error al procesar el pago:', error);
                    alert('Error al procesar el pago. Por favor, inténtalo de nuevo.');
                  } finally {
                    setIsUploading(false);
                  }
                }}
                disabled={isUploading}
              >
                {isUploading ? 'Procesando...' : `Pagar S/ ${(getTotalPrice() * 1.16).toFixed(2)}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={orderSuccess} onOpenChange={setOrderSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              ¡Pedido Confirmado!
            </DialogTitle>
            <DialogDescription>Tu pedido ha sido procesado exitosamente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">¡Gracias por tu compra!</h3>
              <p className="text-gray-600 mb-4">
                Hemos recibido tu pedido y te contactaremos pronto para coordinar la entrega.
              </p>
              <p className="text-sm text-gray-500">Recibirás un email de confirmación con los detalles de tu pedido.</p>
            </div>
            <Button className="w-full" onClick={() => setOrderSuccess(false)}>
              Continuar Comprando
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}