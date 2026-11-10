import { Pipe, PipeTransform } from '@angular/core';

/**
 * Los códigos que guarda la base (ACTIVO, MOROSO, TRANSFERENCIA…) dichos como se leen en la
 * pantalla: primera palabra en mayúscula y con tildes. Lo que no esté aquí se muestra tal cual.
 */
const ETIQUETAS: Record<string, string> = {
  // Miembro
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  MOROSO: 'En mora',
  INACTIVO: 'Inactivo',
  // Membresía
  ACTIVA: 'Activa',
  PAUSADA: 'Pausada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
  // Pagos y ventas
  PAGADO: 'Pagado',
  PAGADA: 'Pagada',
  ANULADO: 'Anulado',
  ANULADA: 'Anulada',
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otro',
  // Ingreso
  MANUAL: 'Manual',
  QR: 'QR',
  CEDULA: 'Cédula',
  HUELLA: 'Huella',
  FACIAL: 'Rostro',
};

export function etiqueta(codigo: string | null | undefined): string {
  if (!codigo) return '—';
  return ETIQUETAS[codigo] ?? codigo;
}

@Pipe({ name: 'etiqueta', standalone: true })
export class EtiquetaPipe implements PipeTransform {
  transform(codigo: string | null | undefined): string {
    return etiqueta(codigo);
  }
}
