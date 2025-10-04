// context/AppConfigContext.tsx
'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AppConfig {
  clinicName: string
}

const AppConfigContext = createContext<AppConfig | undefined>(undefined)

export const AppConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<AppConfig>({ clinicName: 'VetClinic' })

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error('Failed to fetch config');
        }
        const data = await response.json();
        setConfig({ clinicName: data.clinic_name || 'VetClinic' });
      } catch (error) {
        console.error('Error cargando configuración de la clínica:', error);
        setConfig({ clinicName: 'VetClinic (Error)' });
      }
    };

    fetchConfig();
  }, []);

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