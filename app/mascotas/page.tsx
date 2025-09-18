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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PawPrint, Plus, Search, Users, Phone, Mail } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"

interface Pet {
  id: string
  name: string
  species: string
  breed?: string
  color?: string
  gender?: string
  date_of_birth?: string
  weight?: number
  owners: {
    id: string
    first_name: string
    last_name: string
    phone: string
    email?: string
  }
}

interface Owner {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
}

export default function MascotasPage() {
  const [pets, setPets] = useState<Pet[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isPetDialogOpen, setIsPetDialogOpen] = useState(false)
  const [isOwnerDialogOpen, setIsOwnerDialogOpen] = useState(false)

  // Pet form state
  const [petFormData, setPetFormData] = useState({
    owner_id: "",
    name: "",
    species: "",
    breed: "",
    color: "",
    gender: "",
    date_of_birth: "",
    weight: "",
  })

  // Owner form state
  const [ownerFormData, setOwnerFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  })

  useEffect(() => {
    fetchPets()
    fetchOwners()
  }, [])

  const fetchPets = async () => {
    const { data, error } = await supabase
      .from("pets")
      .select(`
        *,
        owners (
          id,
          first_name,
          last_name,
          phone,
          email
        )
      `)
      .order("name", { ascending: true })

    if (!error && data) {
      setPets(data)
    }
    setLoading(false)
  }

  const fetchOwners = async () => {
    const { data, error } = await supabase.from("owners").select("*").order("last_name", { ascending: true })

    if (!error && data) {
      setOwners(data)
    }
  }

  const handlePetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const submitData = {
      ...petFormData,
      weight: petFormData.weight ? Number.parseFloat(petFormData.weight) : null,
    }

    const { error } = await supabase.from("pets").insert([submitData])

    if (!error) {
      setIsPetDialogOpen(false)
      setPetFormData({
        owner_id: "",
        name: "",
        species: "",
        breed: "",
        color: "",
        gender: "",
        date_of_birth: "",
        weight: "",
      })
      fetchPets()
    }
  }

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.from("owners").insert([ownerFormData])

    if (!error) {
      setIsOwnerDialogOpen(false)
      setOwnerFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
      })
      fetchOwners()
    }
  }

  const filteredPets = pets.filter(
    (pet) =>
      pet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pet.species.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${pet.owners.first_name} ${pet.owners.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredOwners = owners.filter(
    (owner) =>
      `${owner.first_name} ${owner.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      owner.phone.includes(searchTerm) ||
      (owner.email && owner.email.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Cargando...</div>
  }

  return (
    <AuthGuard requiredPermission="pets">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />

        <div className="flex-1 md:ml-64">
          <header className="bg-white shadow-sm border-b">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="ml-12 md:ml-0">
                  <h1 className="text-2xl font-bold text-gray-900">Mascotas y Dueños</h1>
                  <p className="text-sm text-gray-600">Gestiona la información de mascotas y clientes</p>
                </div>
              </div>
            </div>
          </header>

          <main className="p-6">
            <Tabs defaultValue="mascotas" className="space-y-6">
              <TabsList>
                <TabsTrigger value="mascotas">Mascotas</TabsTrigger>
                <TabsTrigger value="duenos">Dueños</TabsTrigger>
              </TabsList>

              <TabsContent value="mascotas" className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar mascotas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Dialog open={isPetDialogOpen} onOpenChange={setIsPetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Mascota
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Registrar Nueva Mascota</DialogTitle>
                        <DialogDescription>Registra una nueva mascota en el sistema</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handlePetSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="owner">Dueño</Label>
                          <Select
                            value={petFormData.owner_id}
                            onValueChange={(value) => setPetFormData({ ...petFormData, owner_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar dueño" />
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

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nombre de la Mascota</Label>
                            <Input
                              id="name"
                              value={petFormData.name}
                              onChange={(e) => setPetFormData({ ...petFormData, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="species">Especie</Label>
                            <Select
                              value={petFormData.species}
                              onValueChange={(value) => setPetFormData({ ...petFormData, species: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar especie" />
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
                            <Label htmlFor="breed">Raza</Label>
                            <Input
                              id="breed"
                              value={petFormData.breed}
                              onChange={(e) => setPetFormData({ ...petFormData, breed: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="color">Color</Label>
                            <Input
                              id="color"
                              value={petFormData.color}
                              onChange={(e) => setPetFormData({ ...petFormData, color: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="gender">Sexo</Label>
                            <Select
                              value={petFormData.gender}
                              onValueChange={(value) => setPetFormData({ ...petFormData, gender: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar sexo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Macho">Macho</SelectItem>
                                <SelectItem value="Hembra">Hembra</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="weight">Peso (kg)</Label>
                            <Input
                              id="weight"
                              type="number"
                              step="0.1"
                              value={petFormData.weight}
                              onChange={(e) => setPetFormData({ ...petFormData, weight: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dob">Fecha de Nacimiento</Label>
                          <Input
                            id="dob"
                            type="date"
                            value={petFormData.date_of_birth}
                            onChange={(e) => setPetFormData({ ...petFormData, date_of_birth: e.target.value })}
                          />
                        </div>

                        <Button type="submit" className="w-full">
                          Registrar Mascota
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid gap-4">
                  {filteredPets.map((pet) => (
                    <Card key={pet.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{pet.name}</h3>
                              <Badge variant="secondary">{pet.species}</Badge>
                              {pet.gender && <Badge variant="outline">{pet.gender}</Badge>}
                            </div>
                            <p className="text-gray-600 mb-1">
                              Dueño: {pet.owners.first_name} {pet.owners.last_name}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                              <div className="flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                {pet.owners.phone}
                              </div>
                              {pet.owners.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-4 w-4" />
                                  {pet.owners.email}
                                </div>
                              )}
                            </div>
                            {pet.breed && <p className="text-gray-600 mb-1">Raza: {pet.breed}</p>}
                            {pet.color && <p className="text-gray-600 mb-1">Color: {pet.color}</p>}
                            {pet.weight && <p className="text-gray-600 mb-1">Peso: {pet.weight} kg</p>}
                            {pet.date_of_birth && (
                              <p className="text-gray-600">
                                Edad:{" "}
                                {Math.floor(
                                  (new Date().getTime() - new Date(pet.date_of_birth).getTime()) /
                                    (1000 * 60 * 60 * 24 * 365),
                                )}{" "}
                                años
                              </p>
                            )}
                          </div>
                          <PawPrint className="h-8 w-8 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="duenos" className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar dueños..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Dialog open={isOwnerDialogOpen} onOpenChange={setIsOwnerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Dueño
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Registrar Nuevo Dueño</DialogTitle>
                        <DialogDescription>Registra un nuevo dueño de mascota en el sistema</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleOwnerSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">Nombre</Label>
                            <Input
                              id="firstName"
                              value={ownerFormData.first_name}
                              onChange={(e) => setOwnerFormData({ ...ownerFormData, first_name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Apellido</Label>
                            <Input
                              id="lastName"
                              value={ownerFormData.last_name}
                              onChange={(e) => setOwnerFormData({ ...ownerFormData, last_name: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Correo Electrónico</Label>
                          <Input
                            id="email"
                            type="email"
                            value={ownerFormData.email}
                            onChange={(e) => setOwnerFormData({ ...ownerFormData, email: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Teléfono</Label>
                          <Input
                            id="phone"
                            value={ownerFormData.phone}
                            onChange={(e) => setOwnerFormData({ ...ownerFormData, phone: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="address">Dirección</Label>
                          <Input
                            id="address"
                            value={ownerFormData.address}
                            onChange={(e) => setOwnerFormData({ ...ownerFormData, address: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="city">Ciudad</Label>
                            <Input
                              id="city"
                              value={ownerFormData.city}
                              onChange={(e) => setOwnerFormData({ ...ownerFormData, city: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="state">Estado</Label>
                            <Input
                              id="state"
                              value={ownerFormData.state}
                              onChange={(e) => setOwnerFormData({ ...ownerFormData, state: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="zip">Código Postal</Label>
                            <Input
                              id="zip"
                              value={ownerFormData.zip_code}
                              onChange={(e) => setOwnerFormData({ ...ownerFormData, zip_code: e.target.value })}
                            />
                          </div>
                        </div>

                        <Button type="submit" className="w-full">
                          Registrar Dueño
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid gap-4">
                  {filteredOwners.map((owner) => (
                    <Card key={owner.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">
                              {owner.first_name} {owner.last_name}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                              <div className="flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                {owner.phone}
                              </div>
                              {owner.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-4 w-4" />
                                  {owner.email}
                                </div>
                              )}
                            </div>
                            {owner.address && (
                              <p className="text-gray-600">
                                Dirección: {owner.address}
                                {owner.city && `, ${owner.city}`}
                                {owner.state && `, ${owner.state}`}
                                {owner.zip_code && ` ${owner.zip_code}`}
                              </p>
                            )}
                          </div>
                          <Users className="h-8 w-8 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {((searchTerm && filteredPets.length === 0) || (searchTerm && filteredOwners.length === 0)) && (
              <Card>
                <CardContent className="text-center py-8">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron resultados</h3>
                  <p className="text-gray-600">Intenta ajustar los términos de búsqueda.</p>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
