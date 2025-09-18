"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DollarSign, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_status: string
  payment_method?: string
  owners: {
    first_name: string
    last_name: string
  }
  pets: {
    name: string
    species: string
  }
  invoice_items: {
    id: string
    description: string
    quantity: number
    unit_price: number
    total_price: number
  }[]
}

interface Owner {
  id: string
  first_name: string
  last_name: string
}

interface Pet {
  id: string
  name: string
  species: string
  owner_id: string
}

interface Product {
  id: string
  name: string
  price: number
}

interface InvoiceItem {
  product_id: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    owner_id: "",
    pet_id: "",
    payment_method: "",
    notes: "",
  })

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [currentItem, setCurrentItem] = useState({
    product_id: "",
    description: "",
    quantity: 1,
    unit_price: 0,
  })

  useEffect(() => {
    fetchInvoices()
    fetchOwners()
    fetchPets()
    fetchProducts()
  }, [])

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        owners (
          first_name,
          last_name
        ),
        pets (
          name,
          species
        ),
        invoice_items (
          id,
          description,
          quantity,
          unit_price,
          total_price
        )
      `)
      .order("invoice_date", { ascending: false })

    if (!error && data) {
      setInvoices(data)
    }
    setLoading(false)
  }

  const fetchOwners = async () => {
    const { data, error } = await supabase
      .from("owners")
      .select("id, first_name, last_name")
      .order("last_name", { ascending: true })

    if (!error && data) {
      setOwners(data)
    }
  }

  const fetchPets = async () => {
    const { data, error } = await supabase.from("pets").select("id, name, species, owner_id")

    if (!error && data) {
      setPets(data)
    }
  }

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("id, name, price").order("name", { ascending: true })

    if (!error && data) {
      setProducts(data)
    }
  }

  const addInvoiceItem = () => {
    if (currentItem.description && currentItem.quantity > 0 && currentItem.unit_price > 0) {
      const newItem: InvoiceItem = {
        ...currentItem,
        total_price: currentItem.quantity * currentItem.unit_price,
      }

      setInvoiceItems([...invoiceItems, newItem])
      setCurrentItem({
        product_id: "",
        description: "",
        quantity: 1,
        unit_price: 0,
      })
    }
  }

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total_price, 0)
    const taxAmount = subtotal * 0.08 // 8% tax
    const total = subtotal + taxAmount

    return { subtotal, taxAmount, total }
  }

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) {
      setCurrentItem({
        ...currentItem,
        product_id: productId,
        description: product.name,
        unit_price: product.price,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (invoiceItems.length === 0) {
      alert("Please add at least one item to the invoice")
      return
    }

    const { subtotal, taxAmount, total } = calculateTotals()
    const invoiceNumber = `INV-${Date.now()}`

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert([
        {
          ...formData,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split("T")[0],
          subtotal,
          tax_amount: taxAmount,
          total_amount: total,
          payment_status: "pending",
        },
      ])
      .select()
      .single()

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError)
      return
    }

    // Create invoice items
    const itemsWithInvoiceId = invoiceItems.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.product_id || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithInvoiceId)

    if (!itemsError) {
      setIsDialogOpen(false)
      setFormData({
        owner_id: "",
        pet_id: "",
        payment_method: "",
        notes: "",
      })
      setInvoiceItems([])
      fetchInvoices()
    }
  }

  const updatePaymentStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("invoices").update({ payment_status: status }).eq("id", id)

    if (!error) {
      fetchInvoices()
    }
  }

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${invoice.owners.first_name} ${invoice.owners.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.pets.name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || invoice.payment_status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const availablePets = pets.filter((pet) => pet.owner_id === formData.owner_id)

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
              <h1 className="text-2xl font-bold text-gray-900">Sales & Billing</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                  <DialogDescription>Generate a new invoice for services and products</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="owner">Owner</Label>
                      <Select
                        value={formData.owner_id}
                        onValueChange={(value) => setFormData({ ...formData, owner_id: value, pet_id: "" })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an owner" />
                        </SelectTrigger>
                        <SelectContent>
                          {owners.map((owner) => (
                            <SelectItem key={owner.id} value={owner.id}>
                              {owner.first_name} {owner.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pet">Pet</Label>
                      <Select
                        value={formData.pet_id}
                        onValueChange={(value) => setFormData({ ...formData, pet_id: value })}
                        disabled={!formData.owner_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a pet" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePets.map((pet) => (
                            <SelectItem key={pet.id} value={pet.id}>
                              {pet.name} ({pet.species})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Invoice Items</h3>

                    <div className="grid grid-cols-5 gap-2">
                      <div className="space-y-2">
                        <Label>Product/Service</Label>
                        <Select value={currentItem.product_id} onValueChange={handleProductSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - ${product.price}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={currentItem.description}
                          onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                          placeholder="Item description"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={currentItem.quantity}
                          onChange={(e) =>
                            setCurrentItem({ ...currentItem, quantity: Number.parseInt(e.target.value) || 1 })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Unit Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentItem.unit_price}
                          onChange={(e) =>
                            setCurrentItem({ ...currentItem, unit_price: Number.parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>&nbsp;</Label>
                        <Button type="button" onClick={addInvoiceItem} className="w-full">
                          Add Item
                        </Button>
                      </div>
                    </div>

                    {invoiceItems.length > 0 && (
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                                <TableCell>${item.total_price.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeInvoiceItem(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        <div className="p-4 border-t bg-gray-50">
                          <div className="flex justify-end space-y-1">
                            <div className="text-right">
                              <p>Subtotal: ${calculateTotals().subtotal.toFixed(2)}</p>
                              <p>Tax (8%): ${calculateTotals().taxAmount.toFixed(2)}</p>
                              <p className="font-bold text-lg">Total: ${calculateTotals().total.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="debit_card">Debit Card</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full" disabled={invoiceItems.length === 0}>
                    Create Invoice
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
              <SelectItem value="overdue">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{invoice.invoice_number}</h3>
                      <Badge className={getStatusColor(invoice.payment_status)}>{invoice.payment_status}</Badge>
                    </div>
                    <p className="text-gray-600 mb-1">
                      Client: {invoice.owners.first_name} {invoice.owners.last_name}
                    </p>
                    <p className="text-gray-600 mb-1">
                      Pet: {invoice.pets.name} ({invoice.pets.species})
                    </p>
                    <p className="text-gray-600 mb-2">Date: {new Date(invoice.invoice_date).toLocaleDateString()}</p>
                    <p className="text-lg font-semibold text-green-600">Total: ${invoice.total_amount.toFixed(2)}</p>

                    {invoice.invoice_items.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Items:</p>
                        <div className="text-sm text-gray-600">
                          {invoice.invoice_items.map((item, index) => (
                            <span key={item.id}>
                              {item.description} (×{item.quantity}){index < invoice.invoice_items.length - 1 && ", "}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {invoice.payment_status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updatePaymentStatus(invoice.id, "paid")}>
                        Mark Paid
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(invoice.id, "overdue")}>
                        Mark Overdue
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredInvoices.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-600">Try adjusting your search or create a new invoice.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
