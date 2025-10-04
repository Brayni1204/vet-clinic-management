"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Toaster, toast } from "sonner"
import { Trash2, Package, Plus, Search, AlertTriangle, Edit, History } from "lucide-react"
import { supabase } from "@/lib/db"
import { Sidebar } from "@/components/sidebar"
import { PriceHistoryDialog } from "@/components/PriceHistoryDialog"
// Importaciones de navegación y UI

interface Producto {
  id: string
  name: string
  category: string
  description?: string
  price: number
  cost?: number
  stock_quantity: number
  low_stock_threshold: number
  barcode?: string
  supplier?: string
  image_url?: string
}

export default function InventarioPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null)
  const [proveedores, setProveedores] = useState<string[]>([])
  const [isLoadingProveedores, setIsLoadingProveedores] = useState(true)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [mostrarInputCategoria, setMostrarInputCategoria] = useState(false)
  const [priceHistoryDialogOpen, setPriceHistoryDialogOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedProductName, setSelectedProductName] = useState<string>('')

  // Estado del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    precio: '',
    costo: '',
    cantidad_stock: '',
    stock_minimo: '10',
    codigo_barras: '',
    proveedor: 'sin-proveedor',
    imagen_url: "",
  })

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        await Promise.all([
          fetchProductos(),
          fetchProveedores(),
          fetchCategorias()
        ])
      } catch (error) {
        console.error('Error al cargar datos iniciales:', error)
        toast.error('Error al cargar los datos iniciales')
      }
    }

    cargarDatosIniciales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        nombre: editingProduct.name,
        categoria: editingProduct.category,
        descripcion: editingProduct.description || "",
        precio: editingProduct.price.toString(),
        costo: editingProduct.cost?.toString() || "",
        cantidad_stock: editingProduct.stock_quantity.toString(),
        stock_minimo: editingProduct.low_stock_threshold.toString(),
        codigo_barras: editingProduct.barcode || "",
        proveedor: editingProduct.supplier || "",
        imagen_url: editingProduct.image_url || "",
      })
    } else {
      setFormData({
        nombre: "",
        categoria: "",
        descripcion: "",
        precio: "",
        costo: "",
        cantidad_stock: "",
        stock_minimo: "10",
        codigo_barras: "",
        proveedor: "",
        imagen_url: "",
      })
    }
  }, [editingProduct])

  const fetchProveedores = async () => {
    try {
      console.log('Buscando proveedores en la tabla de productos...');

      // Obtener proveedores únicos de la tabla de productos
      const { data, error } = await supabase
        .from('products')
        .select('supplier')
        .not('supplier', 'is', null)
        .not('supplier', 'eq', '')
        .order('supplier', { ascending: true });

      if (error) {
        console.error('Error al cargar proveedores:', error);
        return;
      }

      // Extraer proveedores únicos
      const proveedoresUnicos = Array.from(
        new Set(
          data
            .map((item: { supplier: string }) => item.supplier)
            .filter((supplier): supplier is string => !!supplier)
        )
      );

      console.log('Proveedores encontrados en la tabla de productos:', proveedoresUnicos);
      setProveedores(proveedoresUnicos);

    } catch (error) {
      console.error('Error al cargar proveedores:', error);
    } finally {
      setIsLoadingProveedores(false);
    }
  }

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        nombre: editingProduct.name,
        categoria: editingProduct.category,
        descripcion: editingProduct.description || "",
        precio: editingProduct.price.toString(),
        costo: editingProduct.cost?.toString() || "",
        cantidad_stock: editingProduct.stock_quantity.toString(),
        stock_minimo: editingProduct.low_stock_threshold.toString(),
        codigo_barras: editingProduct.barcode || "",
        proveedor: editingProduct.supplier || "",
        imagen_url: editingProduct.image_url || "",
      })
    } else {
      setFormData({
        nombre: "",
        categoria: "",
        descripcion: "",
        precio: "",
        costo: "",
        cantidad_stock: "",
        stock_minimo: "10",
        codigo_barras: "",
        proveedor: "",
        imagen_url: "",
      })
    }
  }, [editingProduct])

  const fetchProductos = async () => {
    const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true })

    if (!error && data) {
      setProductos(data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)

      // Validar que el stock mínimo no sea mayor al stock actual
      if (parseInt(formData.cantidad_stock) < parseInt(formData.stock_minimo)) {
        throw new Error('El stock mínimo no puede ser mayor que la cantidad en stock')
      }

      // Si es una categoría nueva, la añadimos a la lista de categorías
      if (formData.categoria && !categorias.includes(formData.categoria)) {
        setCategorias(prev => [...prev, formData.categoria].sort())
      }

      const productoData = {
        name: formData.nombre,
        category: formData.categoria,
        description: formData.descripcion || null,
        price: parseFloat(formData.precio),
        cost: formData.costo ? parseFloat(formData.costo) : null,
        stock_quantity: parseInt(formData.cantidad_stock),
        low_stock_threshold: parseInt(formData.stock_minimo),
        barcode: formData.codigo_barras || null,
        supplier: formData.proveedor === 'sin-proveedor' ? null : formData.proveedor,
        image_url: formData.imagen_url || null
      }

      if (editingProduct) {
        // Actualizar producto existente
        const { error } = await supabase
          .from('products')
          .update(productoData)
          .eq('id', editingProduct.id)

        if (error) throw error

        toast.success('Producto actualizado correctamente')
      } else {
        // Crear nuevo producto
        const { error } = await supabase
          .from('products')
          .insert([productoData])

        if (error) throw error

        toast.success('Producto creado correctamente')
      }

      // Recargar la lista de productos
      await fetchProductos()

      // Cerrar el diálogo y limpiar el formulario
      setIsDialogOpen(false)
      setEditingProduct(null)
      setFormData({
        nombre: "",
        categoria: "",
        descripcion: "",
        precio: "",
        costo: "",
        cantidad_stock: "",
        stock_minimo: "10",
        codigo_barras: "",
        proveedor: "",
        imagen_url: "",
      })

    } catch (error) {
      console.error('Error al guardar el producto:', error)
      toast.error(error instanceof Error ? error.message : 'Error al guardar el producto')
    } finally {
      setLoading(false)
    }
  }

  const updateStock = async (id: string, newQuantity: number) => {
    const { error } = await supabase.from("products").update({ stock_quantity: newQuantity }).eq("id", id)

    if (!error) {
      fetchProductos()
    }
  }

  const filteredProductos = productos.filter((producto) => {
    const matchesSearch =
      producto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (producto.description && producto.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (producto.supplier && producto.supplier.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = categoryFilter === "all" || producto.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  const productosStockBajo = productos.filter((producto) => producto.stock_quantity <= producto.low_stock_threshold)

  // Categorías predeterminadas
  const categoriasPredeterminadas = ['medicamento', 'servicios', 'alimento', 'suministros']

  // Estado para manejar las categorías
  const [categorias, setCategorias] = useState<string[]>(categoriasPredeterminadas)
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Función para cargar todas las categorías ónicas de la base de datos
  const fetchCategorias = async () => {
    try {
      // Primero obtenemos todas las categorías de la base de datos
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null)
        .not('category', 'eq', '')

      if (error) throw error

      // Extraer categorías ónicas de la base de datos
      const categoriasBD = [...new Set(data.map((item: any) => item.category))] as string[]

      // Combinar con categorías predeterminadas, asegurándonos de que no haya duplicados
      const categoriasCombinadas = [...new Set([...categoriasPredeterminadas, ...categoriasBD])]
        .filter(Boolean) // Eliminar valores nulos o vacíos
        .sort() // Ordenar alfabéticamente

      console.log('Categorías cargadas de la base de datos:', categoriasCombinadas)

      // Actualizar el estado solo si hay cambios
      setCategorias(prevCategorias => {
        const nuevasCategorias = [...new Set([...categoriasCombinadas, ...prevCategorias])]
          .sort()
          .filter(Boolean)

        // Si no hay cambios, devolver el estado anterior para evitar re-renderizados innecesarios
        if (JSON.stringify(nuevasCategorias) === JSON.stringify(prevCategorias)) {
          return prevCategorias
        }

        return nuevasCategorias
      })

    } catch (error) {
      console.error('Error al cargar las categorías:', error)
      toast.error('Error al cargar las categorías')
      // En caso de error, mantener las categorías existentes
    }
  }

  // Cargar categorías al montar el componente y cuando cambien los productos
  useEffect(() => {
    fetchCategorias()
  }, [productos])

  const handleDeleteCategory = (categoria: string) => {
    setCategoriaAEliminar(categoria)
    setShowDeleteDialog(true)
  }

  const confirmDeleteCategory = async () => {
    if (!categoriaAEliminar) return

    try {
      // Verificar si hay productos usando esta categoría
      const { data: productosConEstaCategoria, error } = await supabase
        .from('products')
        .select('id')
        .eq('category', categoriaAEliminar)

      if (error) throw error

      if (productosConEstaCategoria && productosConEstaCategoria.length > 0) {
        // No permitir eliminar si hay productos con esta categoría
        toast.error(`No se puede eliminar la categoría "${categoriaAEliminar}" porque está en uso por ${productosConEstaCategoria.length} producto(s).`)
      } else {
        // Actualizar la lista de categorías en el estado local
        const nuevasCategorias = categorias.filter(cat => cat !== categoriaAEliminar)
        setCategorias(nuevasCategorias)

        // Actualizar la categoría en la base de datos para los productos que la usan
        // (esto no debería ser necesario si la validación anterior es correcta)
        await supabase
          .from('products')
          .update({ category: null })
          .eq('category', categoriaAEliminar)

        toast.success(`Categoría "${categoriaAEliminar}" eliminada correctamente`)
      }
    } catch (error) {
      console.error('Error al eliminar la categoría:', error)
      toast.error('Error al eliminar la categoría. Por favor, inténtalo de nuevo.')
    } finally {
      setShowDeleteDialog(false)
      setCategoriaAEliminar(null)
    }
  }

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case "medicamento":
        return "bg-blue-100 text-blue-800"
      case "servicios":
        return "bg-green-100 text-green-800"
      case "alimento":
        return "bg-orange-100 text-orange-800"
      case "suministros":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCategoryText = (categoria: string) => {
    switch (categoria) {
      case "medicamento":
        return "Medicamento"
      case "servicios":
        return "Servicios"
      case "alimento":
        return "Alimento"
      case "suministros":
        return "Suministros"
      default:
        return categoria
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Cargando...</div>
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 md:ml-64">
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="ml-12 md:ml-0">
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Inventario</h1>
                <p className="text-sm text-gray-600">Administra productos y stock</p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingProduct(null);
                }
              }}>
                <DialogTrigger asChild onClick={() => setEditingProduct(null)}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Producto
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Editar Producto" : "Agregar Nuevo Producto"}</DialogTitle>
                    <DialogDescription>
                      {editingProduct
                        ? "Modifica la información del producto"
                        : "Agrega un nuevo producto o servicio al inventario"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-6 py-2">
                    <div className="space-y-2.5">
                      <Label htmlFor="nombre">Nombre del Producto</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="categoria">Categoría</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => setMostrarInputCategoria(true)}
                        >
                          + Nueva categoría
                        </Button>
                      </div>

                      {mostrarInputCategoria ? (
                        <div className="flex gap-2">
                          <Input
                            id="nueva-categoria"
                            value={nuevaCategoria}
                            onChange={(e) => setNuevaCategoria(e.target.value)}
                            placeholder="Nombre de la nueva categoría"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (nuevaCategoria.trim()) {
                                const categoriaNormalizada = nuevaCategoria.trim().toLowerCase();
                                if (!categorias.includes(categoriaNormalizada)) {
                                  setCategorias([...categorias, categoriaNormalizada]);
                                }
                                setFormData({ ...formData, categoria: categoriaNormalizada });
                                setNuevaCategoria('');
                                setMostrarInputCategoria(false);
                              }
                            }}
                          >
                            Agregar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMostrarInputCategoria(false);
                              setNuevaCategoria('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={formData.categoria}
                          onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {categorias.map((categoria) => (
                              <SelectItem key={categoria} value={categoria} className="relative group">
                                <div className="flex justify-between items-center w-full">
                                  <span>{categoria.charAt(0).toUpperCase() + categoria.slice(1)}</span>
                                  {!categoriasPredeterminadas.includes(categoria) && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteCategory(categoria)
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                      <span className="sr-only">Eliminar categoría</span>
                                    </Button>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Input
                        id="descripcion"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        placeholder="Descripción del producto"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="space-y-2.5">
                        <Label htmlFor="precio">Precio (S/.)</Label>
                        <Input
                          id="precio"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.precio}
                          onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2.5">
                        <Label htmlFor="costo">Costo (S/.)</Label>
                        <Input
                          id="costo"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.costo}
                          onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="space-y-2.5">
                        <Label htmlFor="stock">Cantidad en Stock</Label>
                        <Input
                          id="stock"
                          type="number"
                          min="0"
                          value={formData.cantidad_stock}
                          onChange={(e) => setFormData({ ...formData, cantidad_stock: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2.5">
                        <Label htmlFor="stock_minimo">Stock Mínimo</Label>
                        <Input
                          id="stock_minimo"
                          type="number"
                          min="0"
                          value={formData.stock_minimo}
                          onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="imagen_url">URL de la Imagen</Label>
                      <Input
                        id="imagen_url"
                        value={formData.imagen_url}
                        onChange={(e) => setFormData({ ...formData, imagen_url: e.target.value })}
                        placeholder="https://...jpg"
                      />
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="codigo_barras">Código de Barras</Label>
                      <Input
                        id="codigo_barras"
                        value={formData.codigo_barras}
                        onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                        placeholder="Código de barras (opcional)"
                      />
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="proveedor">Proveedor</Label>
                      <Select
                        value={formData.proveedor}
                        onValueChange={(value) => setFormData({ ...formData, proveedor: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar proveedor (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingProveedores ? (
                            <SelectItem value="" disabled>
                              Cargando proveedores...
                            </SelectItem>
                          ) : (
                            <>
                              <SelectItem value="sin-proveedor">
                                Sin proveedor
                              </SelectItem>
                              {proveedores.map((proveedor) => (
                                <SelectItem key={proveedor} value={proveedor}>
                                  {proveedor}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {!isLoadingProveedores && proveedores.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No hay proveedores registrados. Agrega uno en la sección de Compras.
                        </p>
                      )}
                    </div>

                    <div className="pt-2">
                      <Button type="submit" className="w-full">
                        {editingProduct ? "Actualizar Producto" : "Agregar Producto"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <main className="p-6">
          {productosStockBajo.length > 0 && (
            <Card className="mb-6 border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-5 w-5" />
                  Alerta de Stock Bajo
                </CardTitle>
                <CardDescription className="text-orange-700">
                  {productosStockBajo.length} producto(s) tienen stock bajo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {productosStockBajo.map((producto) => (
                    <div key={producto.id} className="flex justify-between items-center">
                      <span className="font-medium">{producto.name}</span>
                      <Badge variant="outline" className="text-orange-800 border-orange-300">
                        {producto.stock_quantity} restantes
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias.map((categoria) => (
                  <SelectItem key={categoria} value={categoria}>
                    {getCategoryText(categoria)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredProductos.map((producto) => (
              <Card key={producto.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{producto.name}</h3>
                        <Badge className={getCategoryColor(producto.category)}>
                          {getCategoryText(producto.category)}
                        </Badge>
                        {producto.stock_quantity <= producto.low_stock_threshold && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Stock Bajo
                          </Badge>
                        )}
                      </div>
                      {producto.description && <p className="text-gray-600 mb-2">{producto.description}</p>}
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Precio:</span>
                          <p className="font-medium">S/.{producto.price.toFixed(2)}</p>
                        </div>
                        {producto.cost && (
                          <div>
                            <span className="text-gray-500">Costo:</span>
                            <p className="font-medium">S/.{producto.cost.toFixed(2)}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Stock:</span>
                          <p className="font-medium">{producto.stock_quantity}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Stock Mínimo:</span>
                          <p className="font-medium">{producto.low_stock_threshold}</p>
                        </div>
                        {producto.supplier && (
                          <div>
                            <span className="text-gray-500">Proveedor:</span>
                            <p className="font-medium">{producto.supplier}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        defaultValue={producto.stock_quantity}
                        className="w-20"
                        onBlur={(e) => {
                          const newQuantity = Number.parseInt(e.target.value)
                          if (newQuantity !== producto.stock_quantity) {
                            updateStock(producto.id, newQuantity)
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingProduct(producto)
                          setIsDialogOpen(true)
                        }}
                        title="Editar producto"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedProductId(producto.id)
                          setSelectedProductName(producto.name)
                          setPriceHistoryDialogOpen(true)
                        }}
                        title="Ver historial de precios"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProductos.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron productos</h3>
                <p className="text-gray-600">Intenta ajustar la búsqueda o agregar un nuevo producto.</p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* Diálogo de historial de precios */}
      <PriceHistoryDialog
        isOpen={priceHistoryDialogOpen}
        onClose={() => setPriceHistoryDialogOpen(false)}
        productId={selectedProductId}
        productName={selectedProductName}
      />
    </div>
  )
}
