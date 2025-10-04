"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Clock, Save, Bell, Palette } from "lucide-react"
import { supabase } from "@/lib/db"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { useToast } from "@/hooks/use-toast"
import { useAppConfig } from "@/context/AppConfigContext"

interface ClinicConfig {
  id?: string
  clinic_name: string
  address: string
  phone: string
  email: string
  website?: string
  opening_hours: string
  emergency_phone?: string
  tax_id?: string
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  enable_notifications: boolean
  enable_online_booking: boolean
  enable_sms_reminders: boolean
  default_appointment_duration: number
  max_appointments_per_day: number
  booking_advance_days: number
  cancellation_hours: number
  created_at?: string
  updated_at?: string
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<ClinicConfig>({
    clinic_name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    opening_hours: "",
    emergency_phone: "",
    tax_id: "",
    logo_url: "",
    primary_color: "#3B82F6",
    secondary_color: "#10B981",
    enable_notifications: true,
    enable_online_booking: true,
    enable_sms_reminders: false,
    default_appointment_duration: 30,
    max_appointments_per_day: 20,
    booking_advance_days: 30,
    cancellation_hours: 24,
  })

  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const { setClinicName } = useAppConfig()

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      const { data, error } = await supabase.from("clinic_configuration").select("*").single()

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" error
        console.error("Error loading configuration:", error)
      } else if (data) {
        setConfig(data)
      }
    } catch (error) {
      console.error("Error loading configuration:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfiguration = async () => {
    try {
      setIsSaving(true)
      const { data, error } = await supabase
        .from('clinic_configuration')
        .upsert([config], { onConflict: 'id' })
        .select()

      if (error) throw error

      // Actualizar el nombre de la clínica en el contexto
      if (config.clinic_name) {
        setClinicName(config.clinic_name)
      }

      toast({
        title: "¡Configuración guardada!",
        description: "Los cambios se han guardado correctamente.",
      })
    } catch (error) {
      console.error("Error saving configuration:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración. Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: keyof ClinicConfig, value: string | number | boolean) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard requiredPermission="configuration">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />

        <div className="flex-1 md:ml-64">
          <header className="bg-white shadow-sm border-b">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="ml-12 md:ml-0">
                  <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
                  <p className="text-sm text-gray-600">Configura los parámetros de tu clínica veterinaria</p>
                </div>
                <Button onClick={saveConfiguration} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6">
            <Tabs defaultValue="general" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                {/*<TabsTrigger value="appointments">Citas</TabsTrigger>
                {/*<TabsTrigger value="notifications">Notificaciones</TabsTrigger>*/}
                {/*<TabsTrigger value="appearance">Apariencia</TabsTrigger>*/}
              </TabsList>

              <TabsContent value="general" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Información de la Clínica
                    </CardTitle>
                    <CardDescription>Datos básicos de tu clínica veterinaria</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="clinic_name">Nombre de la Clínica</Label>
                        <Input
                          id="clinic_name"
                          value={config.clinic_name}
                          onChange={(e) => handleInputChange("clinic_name", e.target.value)}
                          placeholder="Veterinaria"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tax_id">RUC</Label>
                        <Input
                          id="tax_id"
                          value={config.tax_id || ""}
                          onChange={(e) => handleInputChange("tax_id", e.target.value)}
                          placeholder="ABC123456789"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Textarea
                        id="address"
                        value={config.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        placeholder="Calle Principal #123, Colonia Centro, Ciudad, Estado, CP 12345"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono Principal</Label>
                        <Input
                          id="phone"
                          value={config.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergency_phone">Teléfono de Emergencia</Label>
                        <Input
                          id="emergency_phone"
                          value={config.emergency_phone || ""}
                          onChange={(e) => handleInputChange("emergency_phone", e.target.value)}
                          placeholder="+1 (555) 987-6543"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={config.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          placeholder="info@vetclinicpro.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Sitio Web</Label>
                        <Input
                          id="website"
                          value={config.website || ""}
                          onChange={(e) => handleInputChange("website", e.target.value)}
                          placeholder="https://www.vetclinicpro.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="opening_hours">Horarios de Atención</Label>
                      <Textarea
                        id="opening_hours"
                        value={config.opening_hours}
                        onChange={(e) => handleInputChange("opening_hours", e.target.value)}
                        placeholder="Lunes a Viernes: 8:00 AM - 6:00 PM&#10;Sábados: 9:00 AM - 4:00 PM&#10;Domingos: Emergencias únicamente"
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/*<TabsContent value="appointments" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Configuración de Citas
                    </CardTitle>
                    <CardDescription>Parámetros para el sistema de citas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="default_appointment_duration">Duración por Defecto (minutos)</Label>
                        <Select
                          value={config.default_appointment_duration.toString()}
                          onValueChange={(value) =>
                            handleInputChange("default_appointment_duration", Number.parseInt(value))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 minutos</SelectItem>
                            <SelectItem value="30">30 minutos</SelectItem>
                            <SelectItem value="45">45 minutos</SelectItem>
                            <SelectItem value="60">60 minutos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_appointments_per_day">Máximo de Citas por Día</Label>
                        <Input
                          id="max_appointments_per_day"
                          type="number"
                          min="1"
                          max="50"
                          value={config.max_appointments_per_day}
                          onChange={(e) =>
                            handleInputChange("max_appointments_per_day", Number.parseInt(e.target.value))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="booking_advance_days">Días de Anticipación para Reservas</Label>
                        <Input
                          id="booking_advance_days"
                          type="number"
                          min="1"
                          max="365"
                          value={config.booking_advance_days}
                          onChange={(e) => handleInputChange("booking_advance_days", Number.parseInt(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cancellation_hours">Horas Mínimas para Cancelación</Label>
                        <Input
                          id="cancellation_hours"
                          type="number"
                          min="1"
                          max="168"
                          value={config.cancellation_hours}
                          onChange={(e) => handleInputChange("cancellation_hours", Number.parseInt(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="enable_online_booking"
                        checked={config.enable_online_booking}
                        onCheckedChange={(checked) => handleInputChange("enable_online_booking", checked)}
                      />
                      <Label htmlFor="enable_online_booking">Permitir reservas online</Label>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>*/}

              {/*<TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notificaciones
                    </CardTitle>
                    <CardDescription>Configuración de alertas y recordatorios</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Notificaciones del Sistema</Label>
                          <p className="text-sm text-gray-600">Recibir alertas sobre el funcionamiento del sistema</p>
                        </div>
                        <Switch
                          checked={config.enable_notifications}
                          onCheckedChange={(checked) => handleInputChange("enable_notifications", checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Recordatorios por SMS</Label>
                          <p className="text-sm text-gray-600">Enviar recordatorios de citas por mensaje de texto</p>
                        </div>
                        <Switch
                          checked={config.enable_sms_reminders}
                          onCheckedChange={(checked) => handleInputChange("enable_sms_reminders", checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>*/}

              {/*<TabsContent value="appearance" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Apariencia
                    </CardTitle>
                    <CardDescription>Personaliza la apariencia de tu clínica</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="logo_url">URL del Logo</Label>
                      <Input
                        id="logo_url"
                        value={config.logo_url || ""}
                        onChange={(e) => handleInputChange("logo_url", e.target.value)}
                        placeholder="https://ejemplo.com/logo.png"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="primary_color">Color Primario</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primary_color"
                            type="color"
                            value={config.primary_color || "#3B82F6"}
                            onChange={(e) => handleInputChange("primary_color", e.target.value)}
                            className="w-16 h-10"
                          />
                          <Input
                            value={config.primary_color || "#3B82F6"}
                            onChange={(e) => handleInputChange("primary_color", e.target.value)}
                            placeholder="#3B82F6"
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondary_color">Color Secundario</Label>
                        <div className="flex gap-2">
                          <Input
                            id="secondary_color"
                            type="color"
                            value={config.secondary_color || "#10B981"}
                            onChange={(e) => handleInputChange("secondary_color", e.target.value)}
                            className="w-16 h-10"
                          />
                          <Input
                            value={config.secondary_color || "#10B981"}
                            onChange={(e) => handleInputChange("secondary_color", e.target.value)}
                            placeholder="#10B981"
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg bg-gray-50">
                      <h4 className="font-medium mb-2">Vista Previa</h4>
                      <div className="flex gap-2">
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: config.primary_color || "#3B82F6" }}
                        />
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: config.secondary_color || "#10B981" }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>*/}
            </Tabs>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
