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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { UserCheck, Plus, Search, Edit, Trash2, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/db"
import { Sidebar } from "@/components/sidebar"

interface Usuario {
  id: string
  email: string
  full_name: string
  role: string
  phone?: string
  created_at: string
}

export default function PersonalPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<{ id: string, role: string } | null>(null)
  const [alertInfo, setAlertInfo] = useState<{ title: string, message: string, isOpen: boolean }>({
    title: '',
    message: '',
    isOpen: false
  })

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    nombre_completo: "",
    rol: "",
    telefono: "",
    password: "",
  })

  useEffect(() => {
    fetchUsuarios()
  }, [])

  useEffect(() => {
    if (editingUser) {
      setFormData({
        email: editingUser.email,
        nombre_completo: editingUser.full_name,
        rol: editingUser.role,
        telefono: editingUser.phone || "",
        password: "",
      })
    } else {
      setFormData({
        email: "",
        nombre_completo: "",
        rol: "",
        telefono: "",
        password: "",
      })
    }
  }, [editingUser])

  const fetchUsuarios = async () => {
    const { data, error } = await supabase.from("users").select("*").order("full_name", { ascending: true })

    if (!error && data) {
      setUsuarios(data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const submitData = {
      email: formData.email,
      full_name: formData.nombre_completo,
      role: formData.rol,
      phone: formData.telefono || null,
      ...(formData.password && { password_hash: `$2b$10$${formData.password}_hash` }),
    }

    let error
    if (editingUser) {
      const { error: updateError } = await supabase.from("users").update(submitData).eq("id", editingUser.id)
      error = updateError
    } else {
      const { error: insertError } = await supabase.from("users").insert([
        {
          ...submitData,
          password_hash: `$2b$10$${formData.password}_hash`,
        },
      ])
      error = insertError
    }

    if (!error) {
      setIsDialogOpen(false)
      setEditingUser(null)
      setFormData({
        email: "",
        nombre_completo: "",
        rol: "",
        telefono: "",
        password: "",
      })
      fetchUsuarios()
    }
  }

  const checkRelatedRecords = async (userId: string) => {
    const relatedTables = [
      { table: 'appointments', column: 'veterinarian_id', message: 'citas programadas' },
      { table: 'appointments', column: 'created_by', message: 'citas creadas' },
      { table: 'medical_records', column: 'veterinarian_id', message: 'historiales médicos' },
      { table: 'invoices', column: 'created_by', message: 'facturas' },
      // Agrega más tablas relacionadas según sea necesario
    ];

    const relatedRecords = [];

    for (const { table, column, message } of relatedTables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(column, userId);

      if (error) {
        console.error(`Error al verificar la tabla ${table}:`, error);
        continue;
      }

      if (count && count > 0) {
        relatedRecords.push(`${count} ${message}`);
      }
    }

    return relatedRecords;
  };

  const handleDeleteClick = (id: string, role: string) => {
    setUserToDelete({ id, role });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      // Verificar registros relacionados
      const relatedRecords = await checkRelatedRecords(userToDelete.id);

      if (relatedRecords.length > 0) {
        const message = `No se puede eliminar este usuario porque tiene los siguientes registros asociados:\n\n` +
          relatedRecords.join('\n') +
          '\n\nPor favor, reasigna o elimina estos registros antes de eliminar el usuario.';

        setAlertInfo({
          title: 'No se puede eliminar',
          message: message.replace(/\\n/g, '\n'),
          isOpen: true
        });
        return;
      }

      // Si no hay registros relacionados, proceder con la eliminación
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userToDelete.id);

      if (error) {
        throw error;
      }

      // Actualizar la lista de usuarios
      setUsuarios(usuarios.filter(usuario => usuario.id !== userToDelete.id));

      setAlertInfo({
        title: 'Éxito',
        message: 'Usuario eliminado correctamente',
        isOpen: true
      });

    } catch (error: any) {
      console.error('Error al eliminar el usuario:', error);

      setAlertInfo({
        title: 'Error',
        message: error.code === '23503'
          ? 'No se puede eliminar el usuario porque tiene registros asociados en el sistema. Por favor, verifica y elimina o reasigna los registros relacionados primero.'
          : `Error al eliminar el usuario: ${error.message}`,
        isOpen: true
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const filteredUsuarios = usuarios.filter((usuario) => {
    const matchesSearch =
      usuario.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (usuario.phone && usuario.phone.includes(searchTerm))

    const matchesRole = roleFilter === "all" || usuario.role === roleFilter

    return matchesSearch && matchesRole
  })

  const getRoleColor = (rol: string) => {
    switch (rol) {
      case "admin":
        return "bg-red-100 text-red-800"
      case "veterinario":
        return "bg-blue-100 text-blue-800"
      case "recepcionista":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRoleText = (rol: string) => {
    switch (rol) {
      case "admin":
        return "Administrador"
      case "veterinario":
        return "Veterinario"
      case "recepcionista":
        return "Recepcionista"
      default:
        return rol
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
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Personal</h1>
                <p className="text-sm text-gray-600">Administra usuarios y permisos del sistema</p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingUser(null);
                }
              }}>
                <DialogTrigger asChild onClick={() => setEditingUser(null)}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingUser ? "Editar Usuario" : "Agregar Nuevo Usuario"}</DialogTitle>
                    <DialogDescription>
                      {editingUser
                        ? "Modifica la información del usuario"
                        : "Crea una nueva cuenta de usuario en el sistema"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre_completo">Nombre Completo</Label>
                      <Input
                        id="nombre_completo"
                        value={formData.nombre_completo}
                        onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Correo Electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rol">Rol</Label>
                      <Select value={formData.rol} onValueChange={(value) => setFormData({ ...formData, rol: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="veterinarian">Veterinario</SelectItem>
                          <SelectItem value="receptionist">Recepcionista</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telefono">Teléfono</Label>
                      <Input
                        id="telefono"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        placeholder="Número de teléfono (opcional)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">{editingUser ? "Nueva Contraseña (opcional)" : "Contraseña"}</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={!editingUser}
                        placeholder={editingUser ? "Dejar vacío para mantener actual" : "Contraseña"}
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      {editingUser ? "Actualizar Usuario" : "Crear Usuario"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="veterinarian">Veterinario</SelectItem>
                <SelectItem value="receptionist">Recepcionista</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredUsuarios.map((usuario) => (
              <Card key={usuario.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{usuario.full_name}</h3>
                        <Badge className={getRoleColor(usuario.role)}>{getRoleText(usuario.role)}</Badge>
                      </div>
                      <p className="text-gray-600 mb-1">Email: {usuario.email}</p>
                      {usuario.phone && <p className="text-gray-600 mb-1">Teléfono: {usuario.phone}</p>}
                      <p className="text-gray-500 text-sm">
                        Registrado: {new Date(usuario.created_at).toLocaleDateString("es-ES")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingUser(usuario)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick(usuario.id, usuario.role)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                      <UserCheck className="h-8 w-8 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredUsuarios.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron usuarios</h3>
                <p className="text-gray-600">Intenta ajustar la búsqueda o agregar un nuevo usuario.</p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[425px] rounded-lg border-0 shadow-xl">
          <AlertDialogHeader className="space-y-4">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-center">
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                ¿Eliminar usuario?
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-gray-600">
                Esta acción no se puede deshacer. El usuario será eliminado permanentemente.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <div className="flex flex-col sm:flex-row justify-center gap-3 w-full">
              <div className="w-full sm:w-32">
                <AlertDialogCancel className="w-full border-gray-300 hover:bg-gray-50 text-gray-700">
                  Cancelar
                </AlertDialogCancel>
              </div>
              <div className="w-full sm:w-32">
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="w-full bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </AlertDialogAction>
              </div>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de alerta */}
      <AlertDialog open={alertInfo.isOpen} onOpenChange={(open) => setAlertInfo(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent className="sm:max-w-[425px] rounded-lg border-0 shadow-xl">
          <AlertDialogHeader className="space-y-4">
            <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${alertInfo.title === 'Error' ? 'bg-red-100' : 'bg-green-100'
              }`}>
              {alertInfo.title === 'Error' ? (
                <AlertCircle className="h-6 w-6 text-red-600" />
              ) : (
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="text-center">
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                {alertInfo.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-gray-600 whitespace-pre-line">
                {alertInfo.message}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex justify-center">
            <div className="w-full max-w-[200px]">
              <AlertDialogAction className="w-full bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-600">
                Aceptar
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
