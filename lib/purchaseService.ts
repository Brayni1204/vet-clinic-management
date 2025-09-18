import { Purchase } from "@/types/purchase";
import { PurchaseItem } from "@/types/purchaseItem";
import { supabase } from './supabase';
import { toast } from 'sonner';

const PURCHASE_STORAGE_KEY = 'vetclinic_purchases';

// Obtener todas las compras
export const getPurchases = (): Purchase[] => {
  if (typeof window === 'undefined') return [];
  const purchases = localStorage.getItem(PURCHASE_STORAGE_KEY);
  return purchases ? JSON.parse(purchases) : [];
};

// Guardar una nueva compra
export const savePurchase = async (purchase: Omit<Purchase, 'id' | 'createdAt'>): Promise<Purchase> => {
  if (typeof window === 'undefined') {
    throw new Error('Cannot save purchase: window is not defined');
  }
  
  const purchases = getPurchases();
  
  // Verificar si ya existe una compra idéntica (mismo proveedor, fecha y productos)
  const duplicate = purchases.some((p: Omit<Purchase, 'id' | 'createdAt'>): boolean => {
    // Verificar si los items son arrays antes de usar every
    const pItems: PurchaseItem[] = Array.isArray(p.items) ? p.items : [];
    const purchaseItems: PurchaseItem[] = Array.isArray(purchase.items) ? purchase.items : [];
    
    // Validar que los campos requeridos existan
    if (!p.supplier || !p.invoiceNumber || !p.purchaseDate || 
        !purchase.supplier || !purchase.invoiceNumber || !purchase.purchaseDate) {
      return false;
    }
    
    const sameSupplier = p.supplier === purchase.supplier;
    const sameInvoice = p.invoiceNumber === purchase.invoiceNumber;
    const sameDate = p.purchaseDate === purchase.purchaseDate;
    const sameLength = pItems.length === purchaseItems.length;
    
    if (!sameSupplier || !sameInvoice || !sameDate || !sameLength) {
      return false;
    }
    
    return pItems.every((item: PurchaseItem, index: number): boolean => {
      const purchaseItem = purchaseItems[index];
      if (!purchaseItem) return false;
      
      const sameProduct = item.productId === purchaseItem.productId;
      const sameQuantity = item.quantity === purchaseItem.quantity;
      
      return sameProduct && sameQuantity;
    });
  });
  
  if (duplicate) {
    console.warn('Duplicate purchase detected, not saving again');
    return purchases.find((p: Purchase) => 
      p.supplier === purchase.supplier &&
      p.invoiceNumber === purchase.invoiceNumber
    ) as Purchase;
  }
  
  // Crear fecha actual ajustada a la zona horaria local
  const now = new Date();
  const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  
  // Usar la fecha y hora completas de la compra
  // Si purchaseDate ya tiene hora, mantenerla; de lo contrario, usar la hora actual
  const purchaseDateWithTime = purchase.purchaseDate.includes('T') 
    ? purchase.purchaseDate 
    : `${purchase.purchaseDate}T${localDate.toTimeString().split(' ')[0]}`;
  
  const newPurchase: Purchase = {
    ...purchase,
    id: Date.now().toString(),
    purchaseDate: purchaseDateWithTime, // Mantener fecha y hora completas
    createdAt: localDate.toISOString()
  };
  
  // Primero guardamos en localStorage para mantener la consistencia
  const updatedPurchases = [...purchases, newPurchase];
  localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(updatedPurchases));
  
  // Luego intentamos guardar en Supabase si estamos en el navegador
  if (typeof window !== 'undefined') {
    try {
      console.log('Intentando guardar en Supabase...');
      console.log('URL de Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      
      // Verificar si tenemos credenciales de Supabase
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Credenciales de Supabase no configuradas. Omitiendo guardado en la base de datos.');
        return newPurchase;
      }
      
      // Insertar la factura
      console.log('Insertando factura en Supabase:', {
        invoice_number: newPurchase.invoiceNumber,
        supplier: newPurchase.supplier,
        invoice_date: newPurchase.purchaseDate,
        total_amount: newPurchase.total,
        created_at: newPurchase.createdAt
      });
      
      // Calculate subtotal from items if available, otherwise use total
      const subtotal = Array.isArray(newPurchase.items) 
        ? newPurchase.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
        : newPurchase.total;
      
      const taxAmount = newPurchase.total - subtotal;
      
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: newPurchase.invoiceNumber,
          supplier: newPurchase.supplier,
          invoice_date: newPurchase.purchaseDate,
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: newPurchase.total,
          payment_status: 'paid', // Assuming purchases are immediately paid
          owner_id: '00000000-0000-0000-0000-000000000000', // Default system user
          created_at: newPurchase.createdAt,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (invoiceError) {
        console.error('Error al insertar factura en Supabase:', invoiceError);
        throw invoiceError;
      }
      
      console.log('✅ Factura guardada en Supabase:', invoice);
      
      // Insertar los items de la factura
      const items = Array.isArray(newPurchase.items) ? newPurchase.items : [];
      if (items.length > 0) {
        const invoiceItems = items.map((item: PurchaseItem) => ({
          invoice_id: invoice.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice,
          created_at: newPurchase.createdAt
        }));
        
        console.log('Insertando items de factura en Supabase:', invoiceItems);
        
        const { data: insertedItems, error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems)
          .select();
          
        if (itemsError) {
          console.error('Error al insertar items en Supabase:', itemsError);
          throw itemsError;
        }
        
        console.log('✅ Items de factura guardados en Supabase:', insertedItems);
      }
    } catch (error) {
      console.error('❌ Error al guardar en Supabase:', {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        error: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
          // Mostrar error al usuario en producción
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
        try {
          toast.error('No se pudo guardar en la base de datos', {
            description: 'Los datos se guardaron localmente pero hubo un error al sincronizar con el servidor.'
          });
        } catch (toastError) {
          console.error('Error al mostrar notificación:', toastError);
        }
      }
    }
  }
  
  console.log('Purchase saved:', newPurchase);
  return newPurchase;
};

// Eliminar una compra por su ID
export const deletePurchase = async (purchaseId: string): Promise<boolean> => {
  if (typeof window === 'undefined') {
    throw new Error('Cannot delete purchase: window is not defined');
  }
  
  try {
    const purchases = getPurchases();
    const purchaseToDelete = purchases.find(p => p.id === purchaseId);
    
    if (!purchaseToDelete) {
      console.warn('No se encontró la compra a eliminar');
      return false;
    }
    
    // Revertir el inventario antes de eliminar la compra
    await revertInventoryFromPurchase(purchaseToDelete);
    
    const updatedPurchases = purchases.filter(purchase => purchase.id !== purchaseId);
    
    localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(updatedPurchases));
    console.log(`Purchase ${purchaseId} deleted`);
    return true;
  } catch (error) {
    console.error('Error deleting purchase:', error);
    return false;
  }
};

// Definir el tipo para el producto en la base de datos
interface ProductDB {
  id: string;
  stock: number;
  [key: string]: any; // Para otras propiedades que pueda tener el producto
}

// Actualizar el inventario cuando se realiza una compra
export const updateInventoryFromPurchase = async (purchase: Purchase): Promise<void> => {
  try {
    // Asegurarse de que purchase.items existe y es un array
    const purchaseItems = Array.isArray(purchase?.items) ? purchase.items : [];
    
    if (purchaseItems.length === 0) {
      console.warn('No hay items en la compra para actualizar el inventario');
      return;
    }
    
    const productIds = purchaseItems.map(item => item.productId).filter(Boolean);
    
    if (productIds.length === 0) {
      console.warn('No hay IDs de producto válidos en la compra');
      return;
    }
    
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (error) {
      console.error('Error al obtener productos de Supabase:', error);
      throw error;
    }
    
    const updates = (products as ProductDB[]).map((product) => {
      const purchasedItem = purchaseItems.find((item: PurchaseItem) => item.productId === product.id);
      if (!purchasedItem) return null;
      
      // Solo actualizamos el costo y el stock, no el precio de venta
      return supabase
        .from('products')
        .update({
          stock_quantity: (product.stock_quantity || 0) + (purchasedItem.quantity || 0),
          cost: purchasedItem.unitPrice, // Actualizar el costo de compra
          // No actualizamos el precio de venta (price) para mantener el valor existente
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);
    }).filter(Boolean);

    await Promise.all(updates);
    
  } catch (error) {
    console.error('Error updating inventory from purchase:', error);
    throw error;
  }
};

// Revertir los cambios en el inventario cuando se elimina una compra
export const revertInventoryFromPurchase = async (purchase: Purchase): Promise<void> => {
  try {
    const itemIds = (purchase.items as Array<{ productId: string }>).map((item: { productId: string }) => item.productId);
    if (itemIds.length === 0) return;
    
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .in('id', itemIds);

    if (error) throw error;

    const updates = products.map((product: any) => {
      const purchasedItem = (purchase.items as any[]).find((item: any) => item.productId === product.id);
      if (!purchasedItem) return null;
      
      // Restar la cantidad comprada del inventario
      const newQuantity = Math.max(0, (product.stock_quantity || 0) - (purchasedItem.quantity || 0));
      
      return supabase
        .from('products')
        .update({
          stock_quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);
    }).filter(Boolean);

    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
  } catch (error) {
    console.error('Error reverting inventory from purchase:', error);
    throw error;
  }
};
