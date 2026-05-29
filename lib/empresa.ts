// Metadata por empresa/mercado. Un solo lugar para los datos de marca,
// moneda y comportamiento de cada entidad para la que se cotiza.

import type { Empresa, Moneda } from '@/types';

export interface EmpresaInfo {
  id: Empresa;
  nombre: string;     // razón social (para PDFs)
  corto: string;      // nombre corto (UI)
  mercado: string;    // país/mercado
  moneda: Moneda;
  usaTC: boolean;     // ¿requiere tipo de cambio? (USA sí, México no)
  // ¿usa el modelo multi-trailer con capacidad? USA sí; México es un solo
  // flete (pickup / Castores), modelado internamente como un trailer único.
  multiTrailer: boolean;
  accent: string;     // color de marca principal (hex), para acentos de UI
  accent2?: string;   // color secundario de marca
  domicilio?: string; // dirección fiscal (para PDF)
}

export const EMPRESAS: Record<Empresa, EmpresaInfo> = {
  bionovapack: {
    id: 'bionovapack',
    nombre: 'NOVAPACK LLC',
    corto: 'BioNovaPack',
    mercado: 'Estados Unidos',
    moneda: 'USD',
    usaTC: true,
    multiTrailer: true,
    accent: '#5BAA47', // verde BNP
  },
  extruidos: {
    id: 'extruidos',
    nombre: 'EXTRUIDOS BOLSA POLIETILENO, S.A. DE C.V.',
    corto: 'Extruidos',
    mercado: 'México',
    moneda: 'MXN',
    usaTC: false,
    multiTrailer: false,
    accent: '#1F2A4D',  // navy Extruidos
    accent2: '#3E8EDE', // azul Extruidos
    domicilio:
      'Autopista Méx - Querétaro KM. 37.5 #5010 Bodega 46, Complejo Industrial, Cuautitlán Izcalli, Edo. de México C.P. 54730',
  },
};

export function empresaInfo(e: Empresa): EmpresaInfo {
  return EMPRESAS[e] ?? EMPRESAS.bionovapack;
}

export function monedaDe(e: Empresa): Moneda {
  return empresaInfo(e).moneda;
}

// Tipo de cambio EFECTIVO para los cálculos: en México el costo ya está en
// MXN y el precio se captura en MXN, así que NO se convierte (divisor = 1).
// En EUA se usa el TC real para pasar de MXN a USD.
export function tcEfectivo(e: Empresa, tcReal: number): number {
  return empresaInfo(e).usaTC ? tcReal : 1;
}
