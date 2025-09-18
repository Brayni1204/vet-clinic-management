"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PawPrint, Stethoscope, ShoppingCart, Mail, Lock, UserPlus } from "lucide-react" // Removed Link from here
import { signIn as signInStaff } from "@/lib/auth" // For staff login (existing)
import { supabase } from "@/lib/supabase" // Your Supabase instance
import { toast } from "sonner" // Assuming you have sonner installed
import Link from "next/link" // Correct Link import for navigation

export default function LoginPage() {
  // Staff login state
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPassword, setStaffPassword] = useState("")
  const [staffError, setStaffError] = useState("")
  const [staffLoading, setStaffLoading] = useState(false)

  // Client login/registration state
  const [clientEmail, setClientEmail] = useState("")
  const [clientPassword, setClientPassword] = useState("")
  const [clientFirstName, setClientFirstName] = useState("")
  const [clientLastName, setClientLastName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [clientError, setClientError] = useState("")
  const [clientLoading, setClientLoading] = useState(false)
  const [clientTab, setClientTab] = useState("login") // To manage client tab (login/register)

  const router = useRouter()

  // Handler for staff login (same as before)
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setStaffLoading(true)
    setStaffError("")

    const result = await signInStaff(staffEmail, staffPassword)

    if (result.error) {
      setStaffError(result.error)
    } else {
      toast.success("¡Inicio de sesión de personal exitoso!");
      router.push("/dashboard") // Redirect to staff dashboard
    }
    setStaffLoading(false)
  }

  // Handler for client login (direct with Supabase)
  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setClientLoading(true)
    setClientError("")

    try {
      // Look for the client by email and password directly
      const { data: owners, error } = await supabase
        .from('owners')
        .select('id, first_name, last_name, email, phone') // Don't select 'password' here for security, even if plaintext
        .eq('email', clientEmail)
        .eq('password', clientPassword) // Direct comparison of the password (plaintext)
        .limit(1);

      if (error) {
        console.error("Error al buscar cliente en Supabase:", error);
        setClientError("Error interno del servidor al iniciar sesión.");
        setClientLoading(false);
        return;
      }

      const owner = owners?.[0];

      if (!owner) {
        setClientError("Credenciales inválidas. Verifica tu email y contraseña.");
      } else {
        toast.success("¡Inicio de sesión de cliente exitoso!");
        // Store the client's ID in local storage
        localStorage.setItem('client_user_id', owner.id);
        console.log('Client ID stored in local storage:', owner.id); // For debugging
        router.push("/cliente"); // Redirect to client dashboard
      }
    } catch (err: any) {
      console.error("Error inesperado en el login de cliente:", err);
      setClientError("Hubo un error inesperado al iniciar sesión. Intenta de nuevo.");
    } finally {
      setClientLoading(false);
    }
  }

  // Handler for client registration (direct with Supabase)
  const handleClientRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setClientLoading(true)
    setClientError("")

    try {
      // First, check if the email already exists to avoid unique key errors
      const { data: existingOwners, error: checkError } = await supabase
        .from('owners')
        .select('id')
        .eq('email', clientEmail)
        .limit(1);

      if (checkError) {
        console.error("Error al verificar email existente:", checkError);
        setClientError("Error al verificar disponibilidad del email.");
        setClientLoading(false);
        return;
      }

      if (existingOwners && existingOwners.length > 0) {
        setClientError("Este correo electrónico ya está registrado. Por favor, inicia sesión o usa otro correo.");
        setClientLoading(false);
        return;
      }

      // If the email doesn't exist, proceed with registration
      const { data, error: insertError } = await supabase
        .from('owners')
        .insert([
          {
            first_name: clientFirstName,
            last_name: clientLastName,
            email: clientEmail,
            phone: clientPhone,
            password: clientPassword, // Storing plaintext password
            registration_date: new Date().toISOString(),
          },
        ])
        .select('id, first_name, last_name, email, phone') // Select the data you want to return
        .single(); // Use .single() if you expect a single record back

      if (insertError) {
        console.error("Error al registrar cliente en Supabase:", insertError);
        setClientError("Error al registrar tus datos. Por favor, intenta de nuevo.");
      } else {
        toast.success("¡Registro de cliente exitoso! Ahora puedes iniciar sesión.");
        // After registration, switch to the login tab and pre-fill the email
        setClientTab("login");
        setClientEmail(clientEmail);
        setClientPassword(""); // Clear the password for user to enter on login
        setClientFirstName(""); // Clear other registration form fields
        setClientLastName("");
        setClientPhone("");
      }
    } catch (err: any) {
      console.error("Error inesperado en el registro de cliente:", err);
      setClientError("Hubo un error inesperado al registrarse. Intenta de nuevo.");
    } finally {
      setClientLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <PawPrint className="h-10 w-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">VetClinic Pro</h1>
          </div>
          <p className="text-gray-600">Sistema Integral de Gestión Veterinaria</p>
        </div>

        <Tabs defaultValue="staff" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="client" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Cliente
            </TabsTrigger>
          </TabsList>

          {/* Content for Staff Access */}
          <TabsContent value="staff">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Acceso del Personal</CardTitle>
                <CardDescription>Ingresa con tu cuenta de empleado</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleStaffLogin} className="space-y-4">
                  {staffError && (
                    <Alert variant="destructive">
                      <AlertDescription>{staffError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="staff-email">Correo Electrónico</Label>
                    <Input
                      id="staff-email"
                      type="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      required
                      placeholder="tu@veterinaria.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="staff-password">Contraseña</Label>
                    <Input
                      id="staff-password"
                      type="password"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      required
                      placeholder="Ingresa tu contraseña"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={staffLoading}>
                    {staffLoading ? "Iniciando sesión..." : "Iniciar Sesión Personal"}
                  </Button>
                </form>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Cuentas de Demostración:</p>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>
                      **Administrador:** admin@veterinaria.com / password
                    </p>
                    <p>
                      **Veterinario:** vet1@veterinaria.com / password
                    </p>
                    <p>
                      **Recepcionista:** recepcion@veterinaria.com / password
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content for Client Portal */}
          <TabsContent value="client">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Portal del Cliente</CardTitle>
                <CardDescription>Accede o regístrate para gestionar tus mascotas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={clientTab} onValueChange={setClientTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Iniciar Sesión
                    </TabsTrigger>
                    <TabsTrigger value="register" className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Registrarse
                    </TabsTrigger>
                  </TabsList>

                  {/* Client Login Form */}
                  <TabsContent value="login" className="mt-4">
                    <form onSubmit={handleClientLogin} className="space-y-4">
                      {clientError && (
                        <Alert variant="destructive">
                          <AlertDescription>{clientError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="client-email-login">Correo Electrónico</Label>
                        <Input
                          id="client-email-login"
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          required
                          placeholder="tu@ejemplo.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-password-login">Contraseña</Label>
                        <Input
                          id="client-password-login"
                          type="password"
                          value={clientPassword}
                          onChange={(e) => setClientPassword(e.target.value)}
                          required
                          placeholder="Ingresa tu contraseña"
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={clientLoading}>
                        {clientLoading ? "Iniciando sesión..." : "Iniciar Sesión Cliente"}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* Client Registration Form */}
                  <TabsContent value="register" className="mt-4">
                    <form onSubmit={handleClientRegister} className="space-y-4">
                      {clientError && (
                        <Alert variant="destructive">
                          <AlertDescription>{clientError}</AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="first-name">Nombre</Label>
                        <Input
                          id="first-name"
                          type="text"
                          value={clientFirstName}
                          onChange={(e) => setClientFirstName(e.target.value)}
                          required
                          placeholder="Tu nombre"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="last-name">Apellido</Label>
                        <Input
                          id="last-name"
                          type="text"
                          value={clientLastName}
                          onChange={(e) => setClientLastName(e.target.value)}
                          required
                          placeholder="Tu apellido"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="client-email-register">Correo Electrónico</Label>
                        <Input
                          id="client-email-register"
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          required
                          placeholder="tu@ejemplo.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="client-phone-register">Teléfono</Label>
                        <Input
                          id="client-phone-register"
                          type="tel"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          required
                          placeholder="+51 987 654 321" // Example for Peru
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="client-password-register">Contraseña</Label>
                        <Input
                          id="client-password-register"
                          type="password"
                          value={clientPassword}
                          onChange={(e) => setClientPassword(e.target.value)}
                          required
                          placeholder="Crea una contraseña"
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={clientLoading}>
                        {clientLoading ? "Registrando..." : "Registrarse"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
                <div className="w-full flex justify-center h-12">
                  {/* Changed from <Link> component to Button with router.push */}
                  <Button className="w-full" size="lg" onClick={() => router.push('/cliente')}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Acceder al Portal Público
                  </Button>
                </div>
                <div className="text-center text-sm text-gray-600">
                  <p>• Agendar citas en línea</p>
                  <p>• Comprar productos</p>
                  <p>• Ver historial de tu mascota</p>
                  <p>• Consultar facturas</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}