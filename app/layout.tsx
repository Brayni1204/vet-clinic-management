import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { Toaster as RadixToaster } from "@/components/ui/toaster"
import { AppConfigProvider } from "@/context/AppConfigContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sistema Veterinario",
  description: "Sistema de gestión para clínicas veterinarias",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ErrorBoundary>
          <AppConfigProvider>
            {children}
            <SonnerToaster />
            <RadixToaster />
          </AppConfigProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
