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
import { Calendar, Clock, Plus, Search } from "lucide-react"
import { supabase } from "@/lib/db"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"

interface Appointment {
  id: string
  appointment_date: string
  appointment_time: string
  reason: string
  status: string
  notes?: string
  pets: {
    name: string
    species: string
    owners: {
      first_name: string
      last_name: string
      phone: string
    }
  }
  users: {
    full_name: string
  }
}

interface Pet {
  id: string
  name: string
  species: string
  owners: {
    first_name: string
    last_name: string
  }
}

interface User {
  id: string
  full_name: string
  role: string
}

export default function CitasPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [veterinarians, setVeterinarians] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    pet_id: "",
    veterinarian_id: "",
    appointment_date: "",
    appointment_time: "",
    reason: "",
    notes: "",
  })

  useEffect(() => {
    fetchAppointments()
    fetchPets()
    fetchVeterinarians()
  }, [])

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        pets (
          name,
          species,
          owners (
            first_name,
            last_name,
            phone
          )
        ),
        users (
          full_name
        )
      `)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })

    if (!error && data) {
      setAppointments(data)
    }
    setLoading(false)
  }

  const fetchPets = async () => {
    const { data, error } = await supabase.from("pets").select(`
        id,
        name,
        species,
        owners (
          first_name,
          last_name
        )
      `)

    if (!error && data) {
      setPets(data)
    }
  }

  const fetchVeterinarians = async () => {
    const { data, error } = await supabase.from("users").select("id, full_name, role").eq("role", "veterinarian")

    if (!error && data) {
      setVeterinarians(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.from("appointments").insert([formData])

    if (!error) {
      setIsDialogOpen(false)
      setFormData({
        pet_id: "",
        veterinarian_id: "",
        appointment_date: "",
        appointment_time: "",
        reason: "",
        notes: "",
      })
      fetchAppointments()
    }
  }

  const updateAppointmentStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id)

    if (!error) {
      fetchAppointments()
    }
  }

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesSearch =
      appointment.pets.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${appointment.pets.owners.first_name} ${appointment.pets.owners.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      appointment.reason.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter

    let matchesDate = true
    if (dateFilter === "today") {
      matchesDate = appointment.appointment_date === new Date().toISOString().split("T")[0]
    } else if (dateFilter === "week") {
      const today = new Date()
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const appointmentDate = new Date(appointment.appointment_date)
      matchesDate = appointmentDate >= today && appointmentDate <= weekFromNow
    }

    return matchesSearch && matchesStatus && matchesDate
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "no-show":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "scheduled":
        return "Programada"
      case "completed":
        return "Completada"
      case "cancelled":
        return "Cancelada"
      case "no-show":
        return "No asistió"
      default:
        return status
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Cargando...</div>
  }

  return (
    <AuthGuard requiredPermission="appointments">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />

        <div className="flex-1 md:ml-64">
          <header className="bg-white shadow-sm border-b">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="ml-12 md:ml-0">
                  <h1 className="text-2xl font-bold text-gray-900">Gestión de Citas</h1>
                  <p className="text-sm text-gray-600">Administra las citas médicas</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nueva Cita
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Programar Nueva Cita</DialogTitle>
                      <DialogDescription>Crear una nueva cita médica para una mascota</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pet">Mascota</Label>
                        <Select
                          value={formData.pet_id}
                          onValueChange={(value) => setFormData({ ...formData, pet_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar mascota" />
                          </SelectTrigger>
                          <SelectContent>
                            {pets.map((pet) => (
                              <SelectItem key={pet.id} value={pet.id}>
                                {pet.name} ({pet.species}) - {pet.owners.first_name} {pet.owners.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="veterinarian">Veterinario</Label>
                        <Select
                          value={formData.veterinarian_id}
                          onValueChange={(value) => setFormData({ ...formData, veterinarian_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar veterinario" />
                          </SelectTrigger>
                          <SelectContent>
                            {veterinarians.map((vet) => (
                              <SelectItem key={vet.id} value={vet.id}>
                                {vet.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="date">Fecha</Label>
                          <Input
                            id="date"
                            type="date"
                            value={formData.appointment_date}
                            onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="time">Hora</Label>
                          <Input
                            id="time"
                            type="time"
                            value={formData.appointment_time}
                            onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reason">Motivo</Label>
                        <Select
                          value={formData.reason}
                          onValueChange={(value) => setFormData({ ...formData, reason: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar motivo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Consulta general">Consulta general</SelectItem>
                            <SelectItem value="Vacunación">Vacunación</SelectItem>
                            <SelectItem value="Cirugía">Cirugía</SelectItem>
                            <SelectItem value="Emergencia">Emergencia</SelectItem>
                            <SelectItem value="Control">Control</SelectItem>
                            <SelectItem value="Limpieza dental">Limpieza dental</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notas (Opcional)</Label>
                        <Input
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Notas adicionales"
                        />
                      </div>

                      <Button type="submit" className="w-full">
                        Programar Cita
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </header>

          <main className="p-6">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar citas..."
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
                  <SelectItem value="scheduled">Programadas</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                  <SelectItem value="no-show">No asistió</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fechas</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de citas */}
            <div className="grid gap-4">
              {filteredAppointments.map((appointment) => (
                <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{appointment.pets.name}</h3>
                          <Badge variant="secondary">{appointment.pets.species}</Badge>
                          <Badge className={getStatusColor(appointment.status)}>
                            {getStatusText(appointment.status)}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-1">
                          Dueño: {appointment.pets.owners.first_name} {appointment.pets.owners.last_name}
                        </p>
                        <p className="text-gray-600 mb-1">Teléfono: {appointment.pets.owners.phone}</p>
                        <p className="text-gray-600 mb-1">Veterinario: {appointment.users.full_name}</p>
                        <p className="text-gray-600 mb-2">Motivo: {appointment.reason}</p>
                        {appointment.notes && <p className="text-gray-600 mb-2">Notas: {appointment.notes}</p>}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(appointment.appointment_date).toLocaleDateString("es-ES")}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {appointment.appointment_time}
                          </div>
                        </div>
                      </div>

                      {appointment.status === "scheduled" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateAppointmentStatus(appointment.id, "completed")}>
                            Marcar Completada
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAppointmentStatus(appointment.id, "cancelled")}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAppointmentStatus(appointment.id, "no-show")}
                          >
                            No Asistió
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredAppointments.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron citas</h3>
                  <p className="text-gray-600">Intenta ajustar los filtros o crear una nueva cita.</p>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
