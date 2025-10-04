'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Printer, Search, Trash2, UserPlus, Package, FileDown } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Función auxiliar para formatear fechas de manera segura
const safeFormatDate = (dateString: string | Date, formatStr: string): string => {
  try {
    if (!dateString) return 'Fecha no disponible';

    let date: Date;

    if (dateString instanceof Date) {
      date = dateString;
    } else if (typeof dateString === 'string') {
      // Asegurarse de que la fecha se interprete correctamente en la zona horaria local
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        // Para fechas sin hora, usar mediodía en la zona horaria local
        date = new Date(dateString + 'T12:00:00');
      } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateString)) {
        // Para fechas con hora, asegurar que se interprete como UTC y luego ajustar a la zona horaria local
        const [datePart, timePart] = dateString.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);

        // Crear la fecha en la zona horaria local
        date = new Date(year, month - 1, day, hours, minutes);
      } else {
        // Para otros formatos, usar el constructor de Date normalmente
        date = new Date(dateString);
      }
    } else {
      return 'Formato de fecha no válido';
    }

    // Verificar si la fecha es válida
    if (!isValid(date)) {
      console.error('Fecha inválida:', dateString);
      return 'Fecha no válida';
    }

    // Usar el método toLocaleString para manejar correctamente la zona horaria
    if (formatStr === 'PPP') {
      return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
    } else if (formatStr === 'PPPp') {
      return format(date, "d 'de' MMMM 'de' yyyy 'a las' hh:mm a", { locale: es });
    } else if (formatStr === 'p') {
      return format(date, 'hh:mm a', { locale: es });
    }

    return format(date, formatStr, { locale: es });
  } catch (error) {
    console.error('Error al formatear fecha:', error, 'Valor original:', dateString);
    return 'Error en fecha';
  }
};

// @ts-ignore - jsPDF types are not available
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Sidebar } from '@/components/sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { supabase } from '@/lib/db';
import { Purchase, PurchaseItem } from '../../types/purchase';
import { savePurchase, getPurchases, updateInventoryFromPurchase, deletePurchase } from '@/lib/purchaseService';
import { Product } from '../../types/product';

// Extend the Purchase type to include items
interface ExtendedPurchase extends Purchase {
  items: (PurchaseItem & { name?: string })[];
  subtotal?: number;
  tax?: number;
  total?: number;
}

export default function ComprasPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<ExtendedPurchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false); // Estado para el diálogo de detalles
  const [generatingPdf, setGeneratingPdf] = useState(false); // Estado para el indicador de carga del PDF

  // Función para generar el reporte en PDF
  const generatePdfReport = async () => {
    try {
      setGeneratingPdf(true);

      // Crear un nuevo documento PDF
      const doc = new jsPDF();

      // Título del reporte
      const title = 'Reporte de Compras';
      const currentDate = new Date().toISOString();
      const formattedDate = safeFormatDate(currentDate, 'PPP');

      // Configuración del título
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(title, 14, 22);

      // Fecha del reporte
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text(`Generado el: ${formattedDate}`, 14, 30);

      // Tabla de compras
      const tableColumn = [
        'Nº Factura',
        'Proveedor',
        'Fecha',
        'Productos',
        'Subtotal',
        'IGV',
        'Total'
      ];

      const tableRows = purchases.map(purchase => {
        // Calcular subtotal, IGV y total basado en los ítems si no están definidos
        let subtotal = 0;
        let tax = 0;
        let total = 0;

        if (purchase.items && purchase.items.length > 0) {
          subtotal = purchase.items.reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0), 0);
          tax = subtotal * 0.18; // Asumiendo 18% de IGV
          total = subtotal + tax;
        }

        return [
          purchase.invoiceNumber || '-',
          purchase.supplier || 'No especificado',
          purchase.purchaseDate ? safeFormatDate(purchase.purchaseDate, 'dd/MM/yyyy') : '-',
          purchase.items?.length.toString() || '0',
          `S/. ${subtotal.toFixed(2)}`,
          `S/. ${tax.toFixed(2)}`,
          `S/. ${total.toFixed(2)}`
        ];
      });

      // Añadir la tabla al documento
      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        headStyles: {
          fillColor: [59, 130, 246], // azul-500
          textColor: 255,
          fontStyle: 'bold',
        },
        didDrawPage: function (data: any) {
          // Pie de página
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          doc.text('Página ' + data.pageCount, data.settings.margin.left, pageHeight - 10);
        }
      });

      // Resumen
      const finalY = (doc as any).lastAutoTable?.finalY || 50;

      // Totales
      const totalPurchases = purchases.length;
      const totalAmount = purchases.reduce((sum, purchase) => {
        if (purchase.items && purchase.items.length > 0) {
          const subtotal = purchase.items.reduce((s, item) => s + (item.unitPrice || 0) * (item.quantity || 0), 0);
          return sum + subtotal * 1.18; // Sumar IGV 18%
        }
        return sum;
      }, 0);

      const totalTax = totalAmount * 0.18; // 18% del total
      const subtotal = totalAmount - totalTax;

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Resumen de Compras', 14, finalY + 15);

      doc.setFont(undefined, 'normal');
      doc.text(`Total de compras: ${totalPurchases}`, 20, finalY + 25);
      doc.text(`Subtotal: S/. ${subtotal.toFixed(2)}`, 20, finalY + 33);
      doc.text(`Total IGV (18%): S/. ${totalTax.toFixed(2)}`, 20, finalY + 41);
      doc.text(`Monto total: S/. ${totalAmount.toFixed(2)}`, 20, finalY + 49);

      // Guardar el PDF
      doc.save(`reporte-compras-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast({
        title: '\u00c9xito',
        description: 'Reporte generado correctamente',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error al generar el reporte:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el reporte',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Form state
  // Estados para el formulario de compra
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<ExtendedPurchase | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          loadPurchases(),
          loadProducts(),
          loadSuppliers()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const loadSuppliers = async () => {
    try {
      // Obtener proveedores únicos de la tabla de productos
      const { data, error } = await supabase
        .from('products')
        .select('supplier')
        .not('supplier', 'is', null)
        .not('supplier', 'eq', '');

      if (error) throw error;

      // Extraer nombres únicos de proveedores
      const uniqueSuppliers = Array.from(new Set(
        data.map(item => item.supplier).filter(Boolean)
      ));

      setSuppliers(uniqueSuppliers);
    } catch (error) {
      console.error('Error cargando proveedores:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los proveedores',
        variant: 'destructive',
      });
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del proveedor es obligatorio',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Agregar el nuevo proveedor a la lista
      setSuppliers(prev => [...new Set([...prev, newSupplierName.trim()])]);

      // Seleccionar el nuevo proveedor
      setSelectedSupplier(newSupplierName.trim());

      // Limpiar el campo
      setNewSupplierName('');

      // Cerrar el diálogo
      setIsSupplierDialogOpen(false);

      // Mostrar mensaje de éxito
      toast({
        title: 'Éxito',
        description: 'Proveedor agregado correctamente',
      });
    } catch (error) {
      console.error('Error guardando proveedor:', error);

      // Mostrar mensaje de error
      toast({
        title: 'Error',
        description: 'No se pudo guardar el proveedor',
        variant: 'destructive',
      });
    }
  };

  const loadPurchases = async () => {
    try {
      const data = await getPurchases();

      // Asegurarse de que cada compra tenga un proveedor
      const purchasesWithSupplier = data.map(purchase => ({
        ...purchase,
        // Si no hay proveedor, usar 'Proveedor no especificado'
        supplier: purchase.supplier || 'Proveedor no especificado'
      }));

      setPurchases(purchasesWithSupplier);
      return purchasesWithSupplier;
    } catch (error) {
      console.error('Error loading purchases:', error);
      throw error;
    }
  };

  // Función para eliminar una compra
  const handleDeletePurchase = async (purchaseId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta compra? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const success = await deletePurchase(purchaseId);

      if (success) {
        // Actualizar la lista de compras
        await loadPurchases();

        toast({
          title: 'Éxito',
          description: 'Compra eliminada correctamente',
        });
      } else {
        throw new Error('No se pudo eliminar la compra');
      }
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la compra',
        variant: 'destructive',
      });
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los productos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePriceWithIgv = (price: number) => {
    const igvRate = 0.18; // 18% IGV
    return price / (1 + igvRate);
  };

  const handleAddItem = () => {
    if (!selectedProduct || !quantity || !unitPrice) {
      toast({
        title: 'Error',
        description: 'Por favor, complete todos los campos del producto',
        variant: 'destructive',
      });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    // Calcular el IGV (18% del subtotal)
    const igvRate = 0.18;
    const subtotal = unitPrice * quantity;
    const igv = subtotal * igvRate;
    const total = subtotal + igv;

    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      productId: selectedProduct,
      name: product.name,
      quantity: quantity,
      unitPrice: unitPrice, // Precio unitario ingresado por el usuario
      total: total, // Total incluye IGV
      igv: igv, // IGV calculado (18%)
      lotNumber: lotNumber || undefined,
      expirationDate: expirationDate || undefined,
    };

    setItems([...items, newItem]);
    setSelectedProduct('');
    setQuantity(1);
    setUnitPrice(0);
    setLotNumber('');
    setExpirationDate('');
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Función para verificar y crear un producto si no existe
  const checkAndCreateProduct = async (item: any) => {
    try {
      // Verificar si el producto ya existe
      const { data: existingProduct, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .single();

      // Si el producto no existe, crearlo
      if (fetchError || !existingProduct) {
        const newProduct = {
          id: item.productId,
          name: item.name,
          category: 'supplies', // Categoría por defecto
          description: `Producto agregado automáticamente el ${new Date().toLocaleDateString()}`,
          price: Math.ceil(item.unitPrice * 1.3), // Precio de venta con 30% de margen
          cost: item.unitPrice, // Costo es el precio de compra
          stock_quantity: item.quantity,
          supplier: selectedSupplier,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: createError } = await supabase
          .from('products')
          .insert([newProduct]);

        if (createError) throw createError;

        console.log('Nuevo producto creado:', newProduct);
        return newProduct;
      }

      return existingProduct;
    } catch (error) {
      console.error('Error al verificar/crear producto:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Evitar múltiples envíos
    if (isSubmitting) return;

    if (items.length === 0) {
      toast({
        title: 'Error',
        description: 'Debe agregar al menos un producto',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedSupplier || !purchaseDate) {
      toast({
        title: 'Error',
        description: 'Por favor, complete los campos de Proveedor y Fecha de Compra.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Verificar y crear productos que no existan
      for (const item of items) {
        await checkAndCreateProduct(item);
      }

      // Usar la fecha directamente del input (formato YYYY-MM-DD)
      const formattedDate = purchaseDate;

      // Calcular totales
      const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const igv = items.reduce((sum, item) => sum + (item.igv || 0), 0);
      const total = subtotal + igv; // El total ya incluye IGV

      const newPurchase = await savePurchase({
        supplier: selectedSupplier,
        invoiceNumber,
        purchaseDate: formattedDate, // Usar la fecha formateada
        items: items.map(item => ({
          ...item,
          // Aseguramos que el precio unitario no incluya IGV
          unitPrice: item.unitPrice,
          // El total es subtotal + IGV
          total: item.total
        })),
        subtotal,
        tax: igv,
        total,
        notes
      });

      console.log('Nueva compra creada:', newPurchase);

      // Actualizar el inventario con los precios sin IGV
      await updateInventoryFromPurchase(newPurchase);

      // Reset form
      setSelectedSupplier('');
      setInvoiceNumber('');
      setPurchaseDate(format(new Date(), 'yyyy-MM-dd'));
      setItems([]);
      setNotes('');

      // Cerrar el diálogo
      setIsDialogOpen(false);

      // Recargar compras y productos
      await Promise.all([
        loadPurchases(),
        loadProducts()
      ]);

      // Mostrar mensaje de éxito
      toast({
        title: 'Éxito',
        description: 'Compra registrada correctamente y productos actualizados en inventario',
      });

    } catch (error) {
      console.error('Error saving purchase:', error);
      toast({
        title: 'Error',
        description: 'No se pudo completar la operación',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPurchases = purchases.filter(purchase =>
    purchase.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.items?.some((item: PurchaseItem) =>
      item.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleOpenDetailsDialog = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsDetailsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Cargando...</div>;
  }

  // Función para formatear moneda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Diálogo de Detalles de Compra */}
      <Dialog open={!!selectedPurchase} onOpenChange={(open) => !open && setSelectedPurchase(null)}>
        <DialogContent className="sm:max-w-4xl">
          {selectedPurchase && (
            <>
              <DialogHeader>
                <DialogTitle>Detalles de la Compra</DialogTitle>
                <DialogDescription>
                  Compra del {safeFormatDate(selectedPurchase.purchaseDate, 'PPP')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Información de la compra */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">Proveedor</p>
                    <p className="font-medium text-gray-900">{selectedPurchase.supplier}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">N° Factura</p>
                    <p className="text-gray-900">
                      {selectedPurchase.invoiceNumber || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">Fecha de compra</p>
                    <p className="text-gray-900">
                      {safeFormatDate(selectedPurchase.purchaseDate, 'PPP')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">Registrado el</p>
                    <p className="text-gray-900">
                      {safeFormatDate(selectedPurchase.createdAt, 'PPPp')}
                    </p>
                  </div>
                </div>

                {/* Lista de productos */}
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h3 className="text-sm font-medium text-gray-600">Productos de la compra</h3>
                  </div>
                  <div className="divide-y">
                    {selectedPurchase.items.map((item: PurchaseItem) => (
                      <div key={item.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                            {item.lotNumber && (
                              <div className="text-xs text-gray-500 mt-1">
                                Lote: {item.lotNumber}
                                {item.expirationDate && ` | Vence: ${format(new Date(item.expirationDate), 'dd/MM/yyyy')}`}
                              </div>
                            )}
                          </div>

                          <div className="ml-4 text-right">
                            <div className="grid grid-cols-4 gap-4 text-sm">
                              <div className="w-16">
                                <div className="text-xs text-gray-500">Cantidad</div>
                                <div className="font-medium">{item.quantity.toLocaleString()}</div>
                              </div>
                              <div className="w-24">
                                <div className="text-xs text-gray-500">P. Unitario</div>
                                <div className="font-medium">{formatCurrency(item.unitPrice)}</div>
                              </div>
                              <div className="w-20">
                                <div className="text-xs text-gray-500">IGV</div>
                                <div className="font-medium">{formatCurrency(item.igv || 0)}</div>
                              </div>
                              <div className="w-24">
                                <div className="text-xs text-gray-500">Total</div>
                                <div className="font-semibold text-gray-900">
                                  {formatCurrency((item.unitPrice * item.quantity) + (item.igv || 0))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen de totales */}
                  <div className="border-t bg-gray-50 px-6 py-4">
                    <div className="flex justify-end">
                      <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(selectedPurchase.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Impuesto General a las Ventas (18%):</span>
                          <span className="font-medium">{formatCurrency(selectedPurchase.tax)}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                          <span className="text-gray-900 font-semibold">Total:</span>
                          <span className="text-gray-900 font-bold">
                            {formatCurrency(selectedPurchase.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedPurchase.notes && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">Notas adicionales</h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p className="whitespace-pre-line">{selectedPurchase.notes}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Generar PDF o algo similar
                    window.print();
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir
                </Button>
                <Button onClick={() => setSelectedPurchase(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Sidebar />
      <div className="flex-1 md:ml-64">
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="ml-12 md:ml-0">
                <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
                <p className="text-sm text-gray-600">Gestión de compras de inventario</p>
              </div>
              <Button
                variant="outline"
                onClick={generatePdfReport}
                disabled={generatingPdf || purchases.length === 0}
                className="flex items-center gap-2"
              >
                <FileDown className={`h-4 w-4 ${generatingPdf ? 'animate-spin' : ''}`} />
                {generatingPdf ? 'Generando...' : 'Generar Reporte'}
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Compra
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registrar Nueva Compra</DialogTitle>
                    <DialogDescription>
                      Ingresa los detalles de la compra y los productos adquiridos.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-6 py-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="supplier">Proveedor</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-blue-600 hover:text-blue-800"
                            onClick={() => setIsSupplierDialogOpen(true)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Nuevo Proveedor
                          </Button>
                        </div>
                        <Select
                          value={selectedSupplier}
                          onValueChange={setSelectedSupplier}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((supplier, index) => (
                              <SelectItem key={index} value={supplier}>
                                {supplier}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoiceNumber">N° Factura</Label>
                        <Input
                          id="invoiceNumber"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="purchaseDate">Fecha de Compra *</Label>
                        <Input
                          id="purchaseDate"
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-4">Productos de la Compra</h3>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end">
                        <div className="md:col-span-4 space-y-2">
                          <Label htmlFor="product">Producto *</Label>
                          <Select
                            value={selectedProduct}
                            onValueChange={setSelectedProduct}
                          >
                            <SelectTrigger id="product">
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="quantity">Cantidad *</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                            required
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="unitPrice">Precio Unit. (S/.) *</Label>
                          <Input
                            id="unitPrice"
                            type="number"
                            step="0.01"
                            min="0"
                            value={unitPrice}
                            onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="lotNumber">Lote</Label>
                          <Input
                            id="lotNumber"
                            value={lotNumber}
                            onChange={(e) => setLotNumber(e.target.value)}
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="expirationDate">Fecha Venc.</Label>
                          <Input
                            id="expirationDate"
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full mt-2"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Producto a la Lista
                      </Button>

                      {items.length > 0 && (
                        <div className="rounded-md border mt-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>Cantidad</TableHead>
                                <TableHead className="text-right">Precio Unit.</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Lote</TableHead>
                                <TableHead>Vencimiento</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{item.name}</TableCell>
                                  <TableCell>{item.quantity}</TableCell>
                                  <TableCell className="text-right">S/ {item.unitPrice.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">S/ {(item.total + (item.igv || 0)).toFixed(2)}</TableCell>
                                  <TableCell>{item.lotNumber || 'N/A'}</TableCell>
                                  <TableCell>
                                    {item.expirationDate ? format(new Date(item.expirationDate), 'dd/MM/yyyy') : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      type="button"
                                      onClick={() => handleRemoveItem(index)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={3} className="text-right font-semibold">Subtotal:</TableCell>
                                <TableCell className="text-right font-semibold">
                                  S/ {items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(2)}
                                </TableCell>
                                <TableCell colSpan={3}></TableCell>
                              </TableRow>
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={3} className="text-right font-semibold">Impuesto General a las Ventas (18%):</TableCell>
                                <TableCell className="text-right font-semibold">
                                  S/ {items.reduce((sum, item) => sum + (item.igv || 0), 0).toFixed(2)}
                                </TableCell>
                                <TableCell colSpan={3}></TableCell>
                              </TableRow>
                              <TableRow className="bg-muted/100 font-bold text-lg">
                                <TableCell colSpan={3} className="text-right">Total:</TableCell>
                                <TableCell className="text-right">
                                  S/ {items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                                </TableCell>
                                <TableCell colSpan={3}></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notas</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notas adicionales sobre la compra..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit">Guardar Compra</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Diálogo para agregar nuevo proveedor */}
              <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo Proveedor</DialogTitle>
                    <DialogDescription>
                      Ingrese el nombre del nuevo proveedor
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplier-name">Nombre del proveedor *</Label>
                      <Input
                        id="supplier-name"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        placeholder="Ej: Agrovet Market S.A."
                      />
                      <p className="text-sm text-gray-500">
                        Ingrese el nombre del proveedor. Este nombre se usará en las compras.
                      </p>
                    </div>
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700">
                            <strong>Nota:</strong> La gestión de proveedores es básica. Para una gestión más completa, se recomienda crear una tabla de proveedores en la base de datos.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSupplierDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAddSupplier}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Guardar Proveedor
                    </Button>
                  </DialogFooter>
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
                placeholder="Buscar compras por proveedor, factura o producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* No hay filtro por categoría para compras como en inventario, pero puedes añadir uno si es necesario */}
          </div>

          <div className="grid gap-4">
            {filteredPurchases.length > 0 ? (
              filteredPurchases.map((purchase) => (
                <Card key={purchase.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">
                            Compra del {purchase.purchaseDate.split('T')[0].split('-').reverse().join('/')}
                          </h3>
                          {purchase.invoiceNumber && (
                            <span className="text-sm text-gray-500">Factura: {purchase.invoiceNumber}</span>
                          )}
                        </div>
                        <p className="text-gray-600 mb-2">Proveedor: <span className="font-medium">{purchase.supplier}</span></p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Producto:</span>
                            <p className="font-medium">
                              {purchase.items[0]?.name || 'Ninguno'}
                              {purchase.items[0]?.quantity ? ` (${purchase.items[0].quantity} ${purchase.items[0].quantity === 1 ? 'unidad' : 'unidades'})` : ''}
                              {purchase.items.length > 1 ? ` +${purchase.items.length - 1} más` : ''}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Subtotal:</span>
                            <p className="font-medium">S/.{purchase.subtotal.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Impuesto General a las Ventas (18%):</span>
                            <p className="font-medium">S/.{purchase.tax.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Total:</span>
                            <p className="font-medium text-lg text-primary">S/.{purchase.total.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPurchase(purchase);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Ver Detalles
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePurchase(purchase.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Puedes añadir un botón para editar o descargar aquí si lo necesitas */}
                        {/* <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button> */}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron compras</h3>
                  <p className="text-gray-600">Comienza registrando tu primera compra.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}