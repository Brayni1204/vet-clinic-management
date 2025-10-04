'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/db' // Asegúrate que la importación apunte a lib/db

interface AppConfig {
  clinicName: string
}
// ... (el resto del archivo sigue igual que la última vez)
const AppConfigContext = createContext<AppConfig | undefined>(undefined)

export const AppConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<AppConfig>({ clinicName: 'VetClinic' })

  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from('clinic_configuration')
        .select('clinic_name')

      if (error || !data || data.length === 0) {
        console.error('Error cargando configuración de la clínica:', error)
        setConfig({ clinicName: 'VetClinic (Error)' })
      } else {
        setConfig({ clinicName: data[0].clinic_name })
      }
    }

    fetchConfig()
  }, [])

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  )
}

export const useAppConfig = () => {
  const context = useContext(AppConfigContext)
  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppConfigProvider')
  }
  return context
}