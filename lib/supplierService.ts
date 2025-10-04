import { supabase } from './db';
import { Supplier } from '@/types/supplier';

export const getSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching suppliers:', error);
    throw error;
  }

  return data || [];
};

export const createSupplier = async (supplierData: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier> => {
  try {
    console.log('Creating supplier with data:', JSON.stringify(supplierData, null, 2));

    // Asegurarse de que los campos opcionales sean null en lugar de undefined
    const dataToInsert = {
      name: supplierData.name,
      contact_person: supplierData.contact_person || null,
      email: supplierData.email || null,
      phone: supplierData.phone || null,
      address: supplierData.address || null,
      tax_id: supplierData.tax_id || null,
      notes: supplierData.notes || null,
      active: true
    };

    console.log('Data to insert:', JSON.stringify(dataToInsert, null, 2));

    const { data, error } = await supabase
      .from('suppliers')
      .insert([dataToInsert])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error
      });
      throw new Error(`Error al crear el proveedor: ${error.message}`);
    }

    if (!data) {
      throw new Error('No se recibieron datos al crear el proveedor');
    }

    console.log('Supplier created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in createSupplier:', error);
    throw error;
  }
};

export const updateSupplier = async (id: string, supplierData: Partial<Supplier>): Promise<Supplier> => {
  const { data, error } = await supabase
    .from('suppliers')
    .update(supplierData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating supplier:', error);
    throw error;
  }

  return data;
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting supplier:', error);
    throw error;
  }
};
