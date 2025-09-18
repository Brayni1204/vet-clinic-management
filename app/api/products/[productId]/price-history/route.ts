import { createClient } from '../../../../../lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Esquema de validación para el ID del producto
const productIdSchema = z.string().uuid('ID de producto no válido');

// Interfaz para los items de factura
interface InvoiceItem {
  id: string;
  product_id: string;
  invoice_id: string;
  unit_price: number | string;
  quantity: number;
  created_at: string;
  description?: string;
}

// Interfaz para las facturas
interface Invoice {
  id: string;
  invoice_date: string;
  invoice_number: string;
  supplier: string | null;
  created_at: string;
  updated_at: string;
}

// Interfaz para los datos de historial de precios
interface PriceHistoryItem {
  id: string;
  productId: string;
  unitPrice: number;
  quantity: number;
  purchaseDate: string;
  invoiceNumber: string | null;
  supplier: string | null;
  createdAt: string;
}

export async function GET(
  request: Request,
  { params }: { params: { productId: string } }
) {
  console.log('=== Iniciando solicitud de historial de precios ===');
  
  try {
    const { productId } = params;
    console.log('Product ID recibido:', productId);
    
    if (!productId) {
      console.error('Error: No se proporcionó un ID de producto');
      return NextResponse.json(
        { error: 'Se requiere un ID de producto' },
        { status: 400 }
      );
    }
    
    // Validar el ID del producto
    const validation = productIdSchema.safeParse(productId);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'ID de producto no válido',
          details: validation.error.format()
        },
        { status: 400 }
      );
    }

    const supabase = createClient();
    console.log('Cliente Supabase creado');
    
    console.log(`Consultando historial de precios para el producto: ${productId}`);
    
    // 1. Primero obtenemos los invoice_items para el producto
    console.log('Obteniendo items de factura para el producto ID:', productId);
    
    // Consulta con más detalles de depuración
    const { data: invoiceItems, error: itemsError, count } = await supabase
      .from('invoice_items')
      .select('*', { count: 'exact' })
      .eq('product_id', productId);
    
    if (itemsError) {
      console.error('Error al obtener items de factura:', itemsError);
      throw new Error('Error al obtener los items de factura');
    }
    
    console.log(`Se encontraron ${invoiceItems?.length || 0} items de factura para el producto ${productId}`);
    
    // Depuración: Mostrar los IDs de los items encontrados
    if (invoiceItems && invoiceItems.length > 0) {
      console.log('IDs de items de factura encontrados:', invoiceItems.map(item => item.id));
    }
    
    if (!invoiceItems || invoiceItems.length === 0) {
      console.log(`No hay items de factura para el producto ${productId}`);
      // Verificar si hay items en la tabla invoice_items para otros productos
      const { data: allItems, error: allItemsError } = await supabase
        .from('invoice_items')
        .select('id, product_id')
        .limit(5);
      
      if (!allItemsError && allItems && allItems.length > 0) {
        console.log('Algunos items de factura en la base de datos (primeros 5):', allItems);
      } else if (allItemsError) {
        console.error('Error al verificar items de factura:', allItemsError);
      } else {
        console.log('No hay ningún item de factura en la base de datos');
      }
      
      return new NextResponse(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=300, stale-while-revalidate=60'
        }
      });
    }
    
    // 2. Obtenemos los IDs de factura únicos
    const invoiceIds = [...new Set(invoiceItems.map(item => item.invoice_id))];
    console.log('IDs de facturas a buscar:', invoiceIds);
    
    // 3. Obtenemos las facturas relacionadas
    console.log('Obteniendo datos de facturas...');
    console.log('Buscando facturas con IDs:', invoiceIds);
    
    if (invoiceIds.length === 0) {
      console.log('No hay IDs de factura para buscar');
      return new NextResponse(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=300, stale-while-revalidate=60'
        }
      });
    }
    
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .in('id', invoiceIds);
    
    if (invoicesError) {
      console.error('Error al obtener facturas:', invoicesError);
      throw new Error('Error al obtener las facturas relacionadas');
    }
    
    console.log(`Se encontraron ${invoices?.length || 0} facturas de ${invoiceIds.length} solicitadas`);
    
    // Depuración: Mostrar los IDs de facturas encontrados
    if (invoices && invoices.length > 0) {
      console.log('IDs de facturas encontradas:', invoices.map(inv => inv.id));
      
      // Mostrar detalles de las facturas para depuración
      console.log('Detalles de facturas encontradas:', invoices.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        supplier: inv.supplier,
        invoice_date: inv.invoice_date
      })));
    }
    
    console.log(`Se encontraron ${invoices?.length || 0} facturas`);
    
    // Creamos un mapa para búsqueda rápida de facturas
    const invoiceMap = new Map(invoices.map(invoice => [invoice.id, invoice]));
    
    console.log('Mapa de facturas creado con IDs:', Array.from(invoiceMap.keys()));
    
    // Procesamos los datos
    const data = invoiceItems.map(item => {
      const invoice = invoiceMap.get(item.invoice_id) || null;
      
      console.log(`Procesando item ${item.id} con factura_id ${item.invoice_id}:`, {
        item_id: item.id,
        product_id: item.product_id,
        invoice_id: item.invoice_id,
        invoice_encontrada: !!invoice,
        invoice_number: invoice?.invoice_number || 'N/A'
      });
      
      return {
        ...item,
        invoice: invoice
      };
    });
    
    console.log(`Datos procesados: ${data.length} items`);
    
    // Si no hay datos, devolver array vacío
    if (!data || data.length === 0) {
      console.log(`No se encontraron registros para el producto ${productId}`);
      return new NextResponse(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=300, stale-while-revalidate=60'
        }
      });
    }
  
    console.log(`Se encontraron ${data.length} registros para el producto ${productId}`);
    
    // Filtramos y formateamos los datos
    const formattedData: PriceHistoryItem[] = [];
    
    console.log('Iniciando filtrado y formateo de datos...');
    
    for (const item of data) {
      try {
        console.log(`Procesando item ${item.id} para formateo:`, {
          item_product_id: item.product_id,
          target_product_id: productId,
          has_invoice: !!item.invoice,
          invoice_id: item.invoice?.id || 'N/A'
        });
        
        // Verificar que el producto coincida (doble verificación)
        if (item.product_id !== productId) {
          console.warn(`Inconsistencia en los datos: El item ${item.id} pertenece al producto ${item.product_id}, no a ${productId}`);
          continue;
        }
        
        // Verificar que existe la factura
        if (!item.invoice) {
          console.warn(`No se encontró la factura para el item ${item.id}`);
          continue;
        }
        
        const invoice = item.invoice;
        const formattedItem = {
          id: item.id,
          productId: item.product_id,
          unitPrice: Number(item.unit_price),
          quantity: Number(item.quantity),
          purchaseDate: invoice.invoice_date || new Date().toISOString(),
          invoiceNumber: invoice.invoice_number || null,
          supplier: invoice.supplier || null,
          createdAt: item.created_at
        };
        
        console.log('Item formateado:', formattedItem);
        formattedData.push(formattedItem);
      } catch (error) {
        console.error(`Error al procesar el item ${item.id}:`, error);
      }
    }
    
    console.log(`Se formatearon correctamente ${formattedData.length} de ${data.length} items`);
  
    // Ordenamos por fecha de compra (más reciente primero)
    formattedData.sort((a, b) => 
      new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
    );
    
    console.log(`Devolviendo ${formattedData.length} registros de historial de precios`);
    
    return new NextResponse(JSON.stringify(formattedData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60'
      }
    });
    
  } catch (error) {
    const errorId = `err_${Date.now()}`;
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    console.error('Error inesperado al obtener el historial de precios:', {
      errorId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        errorId,
        message: 'Por favor, inténtalo de nuevo más tarde.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
}
