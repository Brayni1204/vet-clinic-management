'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AppConfigContextType {
  clinicName: string;
  setClinicName: (name: string) => void;
  loading: boolean;
}

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [clinicName, setClinicName] = useState('Veterinaria');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClinicConfig() {
      try {
        const { data, error } = await supabase
          .from('clinic_configuration')
          .select('clinic_name')
          .single();

        if (error) throw error;
        if (data?.clinic_name) {
          setClinicName(data.clinic_name);
        }
      } catch (error) {
        console.error('Error cargando configuración de la clínica:', error);
      } finally {
        setLoading(false);
      }
    }

    loadClinicConfig();
  }, []);

  return (
    <AppConfigContext.Provider value={{ clinicName, setClinicName, loading }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const context = useContext(AppConfigContext);
  if (context === undefined) {
    throw new Error('useAppConfig debe usarse dentro de un AppConfigProvider');
  }
  return context;
}
