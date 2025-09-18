"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Stethoscope, Plus, Search, Calendar, FileText, Download, Printer } from "lucide-react"
import { useRef } from "react";

// Función para formatear la fecha
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
import { supabase } from "@/lib/supabase"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"

interface MedicalRecord {
  id: string
  visit_date: string
  diagnosis: string
  treatment: string
  notes?: string
  weight?: number
  temperature?: number
  heart_rate?: number
  respiratory_rate?: number
  pets: {
    id: string
    name: string
    species: string
    owners: {
      first_name: string
      last_name: string
    }
  }
  users: {
    id: string
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

export default function HistorialesPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [veterinarians, setVeterinarians] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    pet_id: "",
    veterinarian_id: "",
    visit_date: "",
    diagnosis: "",
    treatment: "",
    notes: "",
    weight: "",
    temperature: "",
    heart_rate: "",
    respiratory_rate: "",
  })

  useEffect(() => {
    fetchRecords()
    fetchPets()
    fetchVeterinarians()
  }, [])

  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from("medical_records")
      .select(`
        *,
        pets (
          name,
          species,
          owners (
            first_name,
            last_name
          )
        ),
        users (
          full_name
        )
      `)
      .order("visit_date", { ascending: false })

    if (!error && data) {
      const recordsData: MedicalRecord[] = data.map((record: any) => ({
        ...record,
        pets: {
          ...record.pets,
          owners:
            Array.isArray(record.pets?.owners)
              ? record.pets.owners[0] ?? { first_name: "", last_name: "" }
              : record.pets?.first_name
              ? (record.pets.owners as { first_name: string; last_name: string })
              : { first_name: "", last_name: "" },
        },
      }))
      setRecords(recordsData)
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
      const petsData: Pet[] = data.map((pet: any) => ({
        ...pet,
        owners: Array.isArray(pet.owners) ? pet.owners[0] ?? { first_name: "", last_name: "" } : pet.owners ?? { first_name: "", last_name: "" },
      }))
      setPets(petsData)
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

    const submitData = {
      pet_id: formData.pet_id || null,
      veterinarian_id: formData.veterinarian_id || null,
      visit_date: formData.visit_date,
      reason_for_visit: formData.diagnosis,
      symptoms: null,
      diagnosis: formData.diagnosis,
      treatment: formData.treatment,
      follow_up_notes: formData.notes || null,
      weight: formData.weight ? Number.parseFloat(formData.weight) : null,
      temperature: formData.temperature ? Number.parseFloat(formData.temperature) : null,
    }

    try {
      if (editingRecord) {
        // Actualizar registro existente
        const { error } = await supabase
          .from("medical_records")
          .update(submitData)
          .eq("id", editingRecord.id)
        
        if (error) throw error
      } else {
        // Crear nuevo registro
        const { error } = await supabase.from("medical_records").insert([submitData])
        if (error) throw error
      }

      // Limpiar el formulario y actualizar la lista
      setIsDialogOpen(false)
      setFormData({
        pet_id: "",
        veterinarian_id: "",
        visit_date: "",
        diagnosis: "",
        treatment: "",
        notes: "",
        weight: "",
        temperature: "",
        heart_rate: "",
        respiratory_rate: "",
      })
      setEditingRecord(null)
      fetchRecords()
    } catch (error) {
      console.error("Error al guardar el registro:", error)
    }
  }

  const handleCreateNew = () => {
    setEditingRecord(null)
    setFormData({
      pet_id: "",
      veterinarian_id: "",
      visit_date: "",
      diagnosis: "",
      treatment: "",
      notes: "",
      weight: "",
      temperature: "",
      heart_rate: "",
      respiratory_rate: "",
    })
    setIsDialogOpen(true)
  }

  const handleEdit = (record: MedicalRecord) => {
    setEditingRecord(record)
    setFormData({
      pet_id: record.pets?.id || "",
      veterinarian_id: record.users?.id || "",
      visit_date: record.visit_date.split('T')[0], // Formato YYYY-MM-DD para input date
      diagnosis: record.diagnosis || "",
      treatment: record.treatment || "",
      notes: record.notes || "",
      weight: record.weight?.toString() || "",
      temperature: record.temperature?.toString() || "",
      heart_rate: record.heart_rate?.toString() || "",
      respiratory_rate: record.respiratory_rate?.toString() || "",
    })
    setIsDialogOpen(true)
  }

  const filteredRecords = records.filter(
    (record) =>
      record.pets.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${record.pets.owners.first_name} ${record.pets.owners.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      record.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.treatment.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Cargando...</div>
  }

  return (
    <AuthGuard requiredPermission="medical_records">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />

        <div className="flex-1 md:ml-64">
          <header className="bg-white shadow-sm border-b">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="ml-12 md:ml-0">
                  <h1 className="text-2xl font-bold text-gray-900">Historiales Médicos</h1>
                  <p className="text-sm text-gray-600">Gestiona los registros médicos de las mascotas</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleCreateNew}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Registro
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingRecord ? 'Editar Historial Médico' : 'Nuevo Historial Médico'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingRecord 
                          ? 'Modifique los datos del historial médico.'
                          : 'Complete los datos del nuevo historial médico.'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
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
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visit_date">Fecha de Visita</Label>
                        <Input
                          id="visit_date"
                          type="date"
                          value={formData.visit_date}
                          onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="diagnosis">Diagnóstico</Label>
                        <Textarea
                          id="diagnosis"
                          value={formData.diagnosis}
                          onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="treatment">Tratamiento</Label>
                        <Textarea
                          id="treatment"
                          value={formData.treatment}
                          onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="weight">Peso (kg)</Label>
                          <Input
                            id="weight"
                            type="number"
                            step="0.1"
                            value={formData.weight}
                            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="temperature">Temperatura (°C)</Label>
                          <Input
                            id="temperature"
                            type="number"
                            step="0.1"
                            value={formData.temperature}
                            onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="heart_rate">Frecuencia Cardíaca</Label>
                          <Input
                            id="heart_rate"
                            type="number"
                            value={formData.heart_rate}
                            onChange={(e) => setFormData({ ...formData, heart_rate: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="respiratory_rate">Frecuencia Respiratoria</Label>
                          <Input
                            id="respiratory_rate"
                            type="number"
                            value={formData.respiratory_rate}
                            onChange={(e) => setFormData({ ...formData, respiratory_rate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notas Adicionales</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Observaciones adicionales..."
                        />
                      </div>

                      <Button type="submit">
                        {editingRecord ? 'Actualizar' : 'Guardar'}
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
                  placeholder="Buscar registros médicos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Lista de registros */}
            <div className="grid gap-4">
              {filteredRecords.map((record) => (
                <Card key={record.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{record.pets.name}</h3>
                          <Badge variant="secondary">{record.pets.species}</Badge>
                        </div>
                        <p className="text-gray-600 mb-1">
                          Dueño: {record.pets.owners.first_name} {record.pets.owners.last_name}
                        </p>
                        <p className="text-gray-600 mb-1">Veterinario: {record.users.full_name}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(record.visit_date).toLocaleDateString("es-ES")}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <h4 className="font-medium text-gray-900">Diagnóstico:</h4>
                            <p className="text-gray-700">{record.diagnosis}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">Tratamiento:</h4>
                            <p className="text-gray-700">{record.treatment}</p>
                          </div>

                          {/* Signos vitales */}
                          {(record.weight || record.temperature || record.heart_rate || record.respiratory_rate) && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-1">Signos Vitales:</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                {record.weight && (
                                  <div className="bg-gray-50 p-2 rounded">
                                    <span className="font-medium">Peso:</span> {record.weight} kg
                                  </div>
                                )}
                                {record.temperature && (
                                  <div className="bg-gray-50 p-2 rounded">
                                    <span className="font-medium">Temperatura:</span> {record.temperature}°C
                                  </div>
                                )}
                                {record.heart_rate && (
                                  <div className="bg-gray-50 p-2 rounded">
                                    <span className="font-medium">FC:</span> {record.heart_rate} bpm
                                  </div>
                                )}
                                {record.respiratory_rate && (
                                  <div className="bg-gray-50 p-2 rounded">
                                    <span className="font-medium">FR:</span> {record.respiratory_rate} rpm
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {record.notes && (
                            <div>
                              <h4 className="font-medium text-gray-900">Notas:</h4>
                              <p className="text-gray-700">{record.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-center space-y-2">
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(record);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </div>
                        <Stethoscope className="h-8 w-8 text-gray-400" />
                        <button 
                          onClick={() => {
                            const printWindow = window.open('', '', 'width=900,height=600');
                            if (printWindow) {
                              printWindow.document.write(`
                                <!DOCTYPE html>
                                <html>
                                <head>
                                  <title>Historial Médico - ${record.pets.name}</title>
                                  <style>
                                    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
                                    .header { text-align: center; margin-bottom: 20px; }
                                    .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                                    .subtitle { color: #666; margin-bottom: 20px; }
                                    .section { margin-bottom: 20px; }
                                    .section-title { font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
                                    .row { display: flex; margin-bottom: 5px; }
                                    .label { font-weight: bold; width: 200px; }
                                    .vital-signs { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; }
                                    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
                                    @media print { 
                                      button { display: none; } 
                                      body { -webkit-print-color-adjust: exact; }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <div class="title">Historial Médico</div>
                                    <div class="subtitle">Clínica Veterinaria Mascota Feliz</div>
                                  </div>

                                  <div class="section">
                                    <div class="section-title">Información de la Mascota</div>
                                    <div class="row">
                                      <div style="width: 50%;">
                                        <div><span class="label">Nombre:</span> ${record.pets.name}</div>
                                        <div><span class="label">Especie:</span> ${record.pets.species}</div>
                                      </div>
                                      <div style="width: 50%;">
                                        <div><span class="label">Dueño:</span> ${record.pets.owners.first_name} ${record.pets.owners.last_name}</div>
                                        <div><span class="label">Fecha de la consulta:</span> ${formatDate(record.visit_date)}</div>
                                      </div>
                                    </div>
                                  </div>

                                  <div class="section">
                                    <div class="section-title">Información de la Consulta</div>
                                    <div><span class="label">Veterinario:</span> ${record.users.full_name}</div>
                                  </div>

                                  ${(record.weight || record.temperature || record.heart_rate || record.respiratory_rate) ? `
                                    <div class="section vital-signs">
                                      <div class="section-title">Signos Vitales</div>
                                      <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                        ${record.weight ? `<div><span class="label">Peso:</span> ${record.weight} kg</div>` : ''}
                                        ${record.temperature ? `<div><span class="label">Temperatura:</span> ${record.temperature}°C</div>` : ''}
                                        ${record.heart_rate ? `<div><span class="label">Frecuencia Cardíaca:</span> ${record.heart_rate} bpm</div>` : ''}
                                        ${record.respiratory_rate ? `<div><span class="label">Frecuencia Respiratoria:</span> ${record.respiratory_rate} rpm</div>` : ''}
                                      </div>
                                    </div>
                                  ` : ''}

                                  <div class="section">
                                    <div class="section-title">Diagnóstico</div>
                                    <div>${record.diagnosis}</div>
                                  </div>

                                  <div class="section">
                                    <div class="section-title">Tratamiento</div>
                                    <div>${record.treatment}</div>
                                  </div>

                                  ${record.notes ? `
                                    <div class="section">
                                      <div class="section-title">Notas Adicionales</div>
                                      <div>${record.notes}</div>
                                    </div>
                                  ` : ''}

                                  <div class="footer">
                                    <div>Documento generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                    <div>Clínica Veterinaria Mascota Feliz - Todos los derechos reservados</div>
                                  </div>

                                  <div style="text-align: center; margin-top: 20px;">
                                    <button onclick="window.print()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                                      Imprimir
                                    </button>
                                    <button onclick="window.close()" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                      Cerrar
                                    </button>
                                  </div>
                                </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }
                          }}
                          className="flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                        >
                          <Printer className="h-4 w-4 mr-1.5" />
                          Imprimir
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredRecords.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron registros médicos</h3>
                  <p className="text-gray-600">Intenta ajustar los términos de búsqueda o crear un nuevo registro.</p>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
