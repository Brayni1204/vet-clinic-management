'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface PurchaseRecord {
  id: string;
  productId: string;
  unitPrice: number;
  quantity: number;
  purchaseDate: string;
  invoiceNumber: string | null;
  supplier: string | null;
  createdAt: string;
}

interface PriceHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}

export function PriceHistoryDialog({ isOpen, onClose, productId, productName }: PriceHistoryDialogProps) {
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && productId) {
      setPurchaseRecords([]);
      setError(null);
      loadPriceHistory();
    } else {
      setPurchaseRecords([]);
      setError(null);
    }
  }, [isOpen, productId]);

  const loadPriceHistory = () => {
    if (typeof window === 'undefined') return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const purchasesJson = localStorage.getItem('vetclinic_purchases');
      if (!purchasesJson) {
        setPurchaseRecords([]);
        return;
      }
      
      const allPurchases = JSON.parse(purchasesJson);
      
      const productPurchases = allPurchases.flatMap((purchase: any) => {
        const purchaseItems = purchase.items || [];
        return purchaseItems
          .filter((item: any) => item.productId === productId)
          .map((item: any) => ({
            id: purchase.id,
            productId: item.productId,
            unitPrice: Number(item.unitPrice),
            quantity: Number(item.quantity),
            purchaseDate: purchase.purchaseDate,
            invoiceNumber: purchase.invoiceNumber || 'N/A',
            supplier: purchase.supplier || 'Sin proveedor',
            total: Number(item.unitPrice) * Number(item.quantity),
            rawData: { ...purchase, item }
          }));
      });
      
      const sortedPurchases = productPurchases.sort((a: PurchaseRecord, b: PurchaseRecord) => 
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      );
      
      setPurchaseRecords(sortedPurchases);
      
    } catch (error) {
      console.error('Error al cargar el historial de compras:', error);
      setError('Error al cargar el historial de compras. Por favor, inténtalo de nuevo.');
      toast.error('Error al cargar el historial de compras', {
        description: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible';
    
    try {
      let date: Date;
      
      // Si es un string de fecha ISO
      if (typeof dateString === 'string') {
        // Si es solo fecha (YYYY-MM-DD), añadir hora actual
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          date = new Date(dateString + 'T12:00:00'); // Usar mediodía por defecto
        } 
        // Si ya tiene hora pero no segundos
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateString)) {
          date = new Date(dateString + ':00');
        }
        // Si ya tiene formato completo
        else {
          date = new Date(dateString);
        }
      } else {
        return 'Formato de fecha no válido';
      }
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        console.error('Fecha inválida:', dateString);
        return 'Fecha no válida';
      }
      
      // Formatear la fecha en español con hora en formato 12h
      const formattedDate = format(date, "PPP 'a las' hh:mm a", { locale: es });
      
      // Para fechas sin hora, mostrar solo la fecha
      if (dateString.length <= 10) {
        return format(date, "PPP", { locale: es });
      }
      
      // Para fechas con hora, mostrar fecha y hora
      return formattedDate;
    } catch (error) {
      console.error('Error al formatear fecha:', error, 'Valor original:', dateString);
      return dateString || 'Fecha no disponible';
    }
  };

  const generatePdfReport = () => {
    try {
      if (!productName || !productId) {
        toast.error('No se pudo generar el reporte: información del producto incompleta');
        return;
      }

      const doc = new jsPDF();
      const title = `Reporte de Costos - ${productName}`;
      const currentDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      
      // Add title and date
      doc.setFontSize(18);
      doc.text(title, 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generado el: ${currentDate}`, 14, 30);
      
      // Add product info
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Producto: ${productName}`, 14, 40);
      doc.text(`ID: ${productId}`, 14, 46);
      
      if (purchaseRecords.length === 0) {
        doc.setFontSize(14);
        doc.text('No hay registros de compras para este producto.', 14, 70);
      } else {
        // Sort records by date (newest first)
        const sortedRecords = [...purchaseRecords].sort((a, b) => 
          new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
        );

        // Prepare table data with price change information
        const tableData = sortedRecords.map((record, index) => {
          const currentPrice = record.unitPrice || 0;
          const previousPrice = index < sortedRecords.length - 1 ? 
            (sortedRecords[index + 1]?.unitPrice || 0) : null;
          
          let priceChange = null;
          if (previousPrice !== null && previousPrice > 0) {
            const change = ((currentPrice - previousPrice) / previousPrice) * 100;
            priceChange = {
              value: Math.abs(change).toFixed(2) + '%',
              type: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'equal'
            };
          }

          return {
            fecha: record.purchaseDate ? format(parseISO(record.purchaseDate), 'dd/MM/yyyy', { locale: es }) : 'N/A',
            factura: record.invoiceNumber || 'N/A',
            proveedor: record.supplier || 'N/A',
            cantidad: record.quantity.toString(),
            'costo unitario': `S/ ${currentPrice.toFixed(2)}`,
            'costo total': `S/ ${(currentPrice * (record.quantity || 0)).toFixed(2)}`,
            'variación': priceChange ? 
              (priceChange.type === 'increase' ? '▲ ' : priceChange.type === 'decrease' ? '▼ ' : '') + 
              priceChange.value : 'N/A',
            'tendencia': priceChange?.type || 'equal'
          };
        });
        
        // Agregar tabla con información de cambios de precio
        (doc as any).autoTable({
          head: [
            ['Fecha', 'Factura', 'Proveedor', 'Cantidad', 'Precio Unitario', 'Variación', 'Total']
          ],
          body: tableData.map(item => {
            // Define cell styles based on price change
            const variationStyle = item.tendencia === 'increase' ? { textColor: [220, 38, 38] } : 
                                item.tendencia === 'decrease' ? { textColor: [22, 163, 74] } : {};
            
            return [
              { content: item.fecha, styles: { fontSize: 9 } },
              { content: item.factura, styles: { fontSize: 9 } },
              { content: item.proveedor, styles: { fontSize: 9 } },
              { content: item.cantidad, styles: { halign: 'right', fontSize: 9 } },
              { content: item['costo unitario'], styles: { halign: 'right', fontStyle: 'bold', fontSize: 9 } },
              { 
                content: item['variación'], 
                styles: { 
                  ...variationStyle, 
                  halign: 'right', 
                  fontStyle: 'bold',
                  fontSize: 9 
                } 
              },
              { 
                content: item['costo total'], 
                styles: { 
                  halign: 'right', 
                  fontStyle: 'bold',
                  fontSize: 9 
                } 
              }
            ];
          }),
          startY: 60,
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          margin: { top: 10 }
        });

        // Sección de análisis de precios
        const finalY = (doc as any).lastAutoTable?.finalY || 100;
        
        // Calcular estadísticas de precios
        const precios = sortedRecords.map(r => r.unitPrice || 0);
        const cambiosPrecio = [];
        
        for (let i = 0; i < precios.length - 1; i++) {
          if (precios[i + 1] > 0) {
            const cambio = ((precios[i] - precios[i + 1]) / precios[i + 1]) * 100;
            cambiosPrecio.push(cambio);
          }
        }
        
        const cambioPromedio = cambiosPrecio.length > 0 ? 
          (cambiosPrecio.reduce((a, b) => a + b, 0) / cambiosPrecio.length) : 0;
          
        const maxAumento = Math.max(...cambiosPrecio, 0);
        const maxReduccion = Math.min(...cambiosPrecio, 0);
        
        // Add summary section
        const totalPurchases = sortedRecords.length;
        const totalQuantity = sortedRecords.reduce((sum, record) => sum + (record.quantity || 0), 0);
        const totalCost = sortedRecords.reduce(
          (sum, record) => sum + ((record.unitPrice || 0) * (record.quantity || 0)), 
          0
        );
        
        // Agregar análisis de precios
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Análisis de Precios:', 14, finalY + 15);
        
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`Cambio promedio: ${cambioPromedio.toFixed(2)}%`, 20, finalY + 25);
        doc.setTextColor(220, 38, 38); // Rojo para aumentos
        doc.text(`Mayor aumento: ${maxAumento > 0 ? `+${maxAumento.toFixed(2)}%` : 'N/A'}`, 20, finalY + 33);
        doc.setTextColor(22, 163, 74); // Verde para disminuciones
        doc.text(`Mayor reducción: ${maxReduccion < 0 ? `${maxReduccion.toFixed(2)}%` : 'N/A'}`, 20, finalY + 41);
        
        // Restaurar color para el resumen
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text('Resumen de Compras:', 14, finalY + 55);
        
        doc.setFont(undefined, 'normal');
        doc.text(`Total de compras: ${totalPurchases}`, 20, finalY + 65);
        doc.text(`Cantidad total: ${totalQuantity} unidades`, 20, finalY + 72);
        doc.text(`Costo total: S/ ${totalCost.toFixed(2)}`, 20, finalY + 79);
        
        // Agregar leyenda
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Leyenda: ▲ Aumento de precio ▼ Reducción de precio', 14, finalY + 95);
      }
      
      // Save the PDF
      const fileName = `reporte_costos_${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);
      
      toast.success('Reporte generado exitosamente');
    } catch (error) {
      console.error('Error al generar el reporte PDF:', error);
      toast.error('Error al generar el reporte');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                <span className="text-primary">Historial de Costos</span>: {productName}
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Registro detallado de todas las compras realizadas para este producto.
              </DialogDescription>
            </div>
            <Button 
              onClick={generatePdfReport} 
              variant="outline" 
              size="sm"
              disabled={purchaseRecords.length === 0 || isLoading}
              className="flex items-center gap-2 mt-1"
            >
              <Download className="h-4 w-4" />
              <span>Generar Reporte</span>
            </Button>
          </div>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mt-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">Información importante</h4>
                <ul className="mt-1 text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Este registro muestra todas las compras del producto</li>
                  <li>Incluye detalles como cantidad, costo unitario y total por compra</li>
                  <li>Las ediciones manuales en el inventario no se registran aquí</li>
                  <li>Última actualización: {formatDate(new Date().toISOString())}</li>
                </ul>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        {error ? (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-md">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-medium">Error al cargar el historial</h3>
            </div>
            <p className="mt-2 text-sm">{error}</p>
            <button 
              onClick={loadPriceHistory}
              className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reintentar
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            <div className="text-center space-y-1">
              <p className="font-medium text-gray-700">Cargando historial de compras</p>
              <p className="text-sm text-gray-500">Esto puede tomar unos segundos...</p>
            </div>
          </div>
        ) : purchaseRecords.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">Sin registros de compras</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              No se encontraron registros de compras para este producto. 
              Las compras realizadas aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-1/4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha y Factura
                      </div>
                    </TableHead>
                    <TableHead className="text-right w-1/4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Detalles de Compra
                      </div>
                    </TableHead>
                    <TableHead className="text-right w-1/4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Costos
                      </div>
                    </TableHead>
                    <TableHead className="w-1/4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200">
                  {purchaseRecords.map((record, index) => (
                    <TableRow 
                      key={`${record.id}-${index}`} 
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-50`}
                    >
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(record.purchaseDate)}
                          </span>
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <svg className="mr-1.5 h-2 w-2 text-blue-400" fill="currentColor" viewBox="0 0 8 8">
                                <circle cx={4} cy={4} r={3} />
                              </svg>
                              Compra #{index + 1}
                            </span>
                          </div>
                          <div className="mt-2">
                            <div className="text-xs text-gray-500">
                              <span className="font-medium">Factura:</span> {record.invoiceNumber || 'N/A'}
                            </div>
                            {record.supplier && record.supplier !== 'Sin proveedor' && (
                              <div className="text-xs text-gray-500">
                                <span className="font-medium">Proveedor:</span> {record.supplier}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm text-gray-900">
                          <span className="font-medium">Cantidad:</span> {record.quantity.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">ID:</span> {record.id.split('-')[0]}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-gray-500">Unitario:</span>{' '}
                            <span className="font-medium">S/. {record.unitPrice.toFixed(2)}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500">Total:</span>{' '}
                            <span className="font-semibold text-gray-900">
                              S/. {(record.unitPrice * record.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end">
                          {index === 0 ? (
                            <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Última compra
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-medium text-gray-500">
                              Compra anterior
                            </span>
                          )}
                          {index < purchaseRecords.length - 1 && (
                            <div className="mt-2 text-xs text-gray-500 text-right">
                              <div>Precio anterior:</div>
                              <div className="font-medium">S/. {purchaseRecords[index + 1]?.unitPrice?.toFixed(2) || 'N/A'}</div>
                              <div className="mt-1 text-xs">
                                {record.unitPrice > (purchaseRecords[index + 1]?.unitPrice || 0) ? (
                                  <span className="text-red-600">
                                    <svg className="inline-block h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Aumentó
                                  </span>
                                ) : record.unitPrice < (purchaseRecords[index + 1]?.unitPrice || 0) ? (
                                  <span className="text-green-600">
                                    <svg className="inline-block h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Disminuyó
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    <svg className="inline-block h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                                    </svg>
                                    Sin cambio
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
