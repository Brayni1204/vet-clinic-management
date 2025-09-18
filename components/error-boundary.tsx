"use client"

import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />
      }

      return <DefaultErrorFallback error={this.state.error!} resetError={this.resetError} />
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  const isSupabaseError = error.message.includes("Supabase") || error.message.includes("NEXT_PUBLIC_SUPABASE")

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <CardTitle>Error de Configuración</CardTitle>
          </div>
          <CardDescription>
            {isSupabaseError
              ? "Hay un problema con la configuración de la base de datos"
              : "Ha ocurrido un error inesperado"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSupabaseError && (
            <Alert>
              <AlertDescription>
                <strong>Variables de entorno faltantes:</strong>
                <br />• NEXT_PUBLIC_SUPABASE_URL
                <br />• NEXT_PUBLIC_SUPABASE_ANON_KEY
                <br />
                <br />
                Por favor, configura estas variables en tu archivo .env.local
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-gray-100 p-3 rounded text-sm font-mono text-gray-700">{error.message}</div>

          <div className="flex gap-2">
            <Button onClick={resetError} variant="outline" className="flex-1 bg-transparent">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
            <Button onClick={() => window.location.reload()} className="flex-1">
              Recargar Página
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
