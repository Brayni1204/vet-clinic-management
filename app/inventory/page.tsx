"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Package, Plus, Search, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Product {
  id: string
  name: string
  category: string
  description?: string
  price: number
  cost?: number
  stock_quantity: number
  low_stock_threshold: number
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    price: "",
    cost: "",
    stock_quantity: "",
    low_stock_threshold: "10",
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true })

    if (!error && data) {
      setProducts(data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const submitData = {
      ...formData,
      price: Number.parseFloat(formData.price),
      cost: formData.cost ? Number.parseFloat(formData.cost) : null,
      stock_quantity: Number.parseInt(formData.stock_quantity),
      low_stock_threshold: Number.parseInt(formData.low_stock_threshold),
    }

    const { error } = await supabase.from("products").insert([submitData])

    if (!error) {
      setIsDialogOpen(false)
      setFormData({
        name: "",
        category: "",
        description: "",
        price: "",
        cost: "",
        stock_quantity: "",
        low_stock_threshold: "10",
      })
      fetchProducts()
    }
  }

  const updateStock = async (id: string, newQuantity: number) => {
    const { error } = await supabase.from("products").update({ stock_quantity: newQuantity }).eq("id", id)

    if (!error) {
      fetchProducts()
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  const lowStockProducts = products.filter((product) => product.stock_quantity <= product.low_stock_threshold)
  const categories = [...new Set(products.map((product) => product.category))]

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "medication":
        return "bg-blue-100 text-blue-800"
      case "services":
        return "bg-green-100 text-green-800"
      case "food":
        return "bg-orange-100 text-orange-800"
      case "supplies":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                  <DialogDescription>Add a new product or service to inventory</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medication">Medication</SelectItem>
                        <SelectItem value="services">Services</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="supplies">Supplies</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Product description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price (S/.)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost">Cost (S/.)</Label>
                      <Input
                        id="cost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock Quantity</Label>
                      <Input
                        id="stock"
                        type="number"
                        min="0"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="threshold">Low Stock Alert</Label>
                      <Input
                        id="threshold"
                        type="number"
                        min="0"
                        value={formData.low_stock_threshold}
                        onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Add Product
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {lowStockProducts.length > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="h-5 w-5" />
                Low Stock Alert
              </CardTitle>
              <CardDescription className="text-orange-700">
                {lowStockProducts.length} product(s) are running low on stock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex justify-between items-center">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="outline" className="text-orange-800 border-orange-300">
                      {product.stock_quantity} remaining
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
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      <Badge className={getCategoryColor(product.category)}>{product.category}</Badge>
                      {product.stock_quantity <= product.low_stock_threshold && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Low Stock
                        </Badge>
                      )}
                    </div>
                    {product.description && <p className="text-gray-600 mb-2">{product.description}</p>}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Price:</span>
                        <p className="font-medium">S/.{product.price.toFixed(2)}</p>
                      </div>
                      {product.cost && (
                        <div>
                          <span className="text-gray-500">Cost:</span>
                          <p className="font-medium">S/.{product.cost.toFixed(2)}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Stock:</span>
                        <p className="font-medium">{product.stock_quantity}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Alert Level:</span>
                        <p className="font-medium">{product.low_stock_threshold}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      defaultValue={product.stock_quantity}
                      className="w-20"
                      onBlur={(e) => {
                        const newQuantity = Number.parseInt(e.target.value)
                        if (newQuantity !== product.stock_quantity) {
                          updateStock(product.id, newQuantity)
                        }
                      }}
                    />
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600">Try adjusting your search or add a new product.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
