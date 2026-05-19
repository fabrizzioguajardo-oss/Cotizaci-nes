// Tipos compartidos del cotizador SICE - BioNovaPack

export type Unit = 'Cases' | 'Rolls' | 'Pallets';
export type ResinType = 'virgen' | 'reciclado' | 'color';
export type ColorType = 'clear' | 'orange' | 'black' | 'blue' | 'red' | 'green' | 'yellow' | 'custom';
export type CotizacionStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
export type DocType = 'quote' | 'po';

export interface LineItem {
  id: number;
  desc: string;
  unit: Unit;
  qty: number;

  // Spec del cliente (lo que el cliente cree que recibe)
  aCliente: number;
  calCliente: number;
  lCliente: number;

  // Spec real (lo que Extruidos realmente fabrica)
  aReal: number;
  calReal: number;
  lReal: number;
  cono: number;

  // Configuración logística
  rollosPallet: number;
  palletTrailer: number;

  // Build-up de costo (MXN/kg) - todos los adders
  costoBase: number;
  master: number;
  intenso: number;
  aditivo: number;
  aumento1: number;
  aumento2: number;
  refilado: number;
  cajaMXN: number;
  rollosCaja: number;

  // Resina y color
  tipoResina: ResinType;
  tipoColor: ColorType;

  // Precio del cliente (USD por unidad de venta - rollo o caso)
  precioCliente: number;
}

export interface CalcResult {
  pnReal: number;                  // peso neto real (kg)
  pbReal: number;                  // peso bruto real (kg)
  pnTeoricoClienteKg: number;      // peso neto que cree el cliente (kg)
  pnTeoricoClienteLbs: number;     // peso neto que cree el cliente (lbs)
  kgNetoItem: number;              // kg total para todos los rollos del item
  cajaBlancoKg: number;            // costo caja distribuido por kg
  costoTotalKgMXN: number;         // costo base + adders por kg
  transpKgMXN: number;             // costo flete por kg
  costoRolloMXN: number;           // costo total por rollo MXN
  costoRolloUSD: number;           // costo total por rollo USD
  utilidad: number | null;         // markup sobre costo (decimal)
  pricePerLb: number;              // precio por libra entregado al cliente
  materialReduction: number;       // % de reducción de material
}

export interface SuggestionResult {
  lReal: number;                   // largo real sugerido (ft)
  pnReal: number;                  // peso neto real (kg) con el lReal sugerido
  pbReal: number;                  // peso bruto real con cono actual (kg)
  reduction: number;               // reducción vs spec declarado
  pricePerLb: number;              // price/lb resultante
  isValid: boolean;
  warnings: string[];

  // Compensación de cono (estrategia: subir cono para que PB_real ≈ PB_cliente)
  conoSugerido: number;            // cono estándar más cercano al ideal sin exceder
  conoIdeal: number;               // cono ideal exacto (puede no ser estándar)
  pbCliente: number;               // PB que el cliente espera (PN_cliente + cono actual)
  pbConCompensacion: number;       // PB resultante usando conoSugerido
  pbDiffCompensado: number;        // pbConCompensacion - pbCliente (signed)
  conosAlternativos: number[];     // opciones estándar alrededor del ideal
}

export interface MarginStatus {
  label: string;
  color: string;
  level: 'none' | 'loss' | 'low' | 'ok';
}

export interface PrecioBase {
  id?: string;
  tipo_resina: ResinType;
  tipo_color: ColorType | null;
  ancho_in: number | null;
  calibre_ga: number | null;
  peso_neto_kg: number | null;
  cono_kg: number | null;
  precio_mxn_kg: number;
  fecha_vigencia: string;
  subido_por: string | null;
  created_at?: string;
}

// Categorias del catalogo de costos centralizado
export type CostCategory =
  | 'master'      // masterbatch de color
  | 'intenso'     // pigmento intenso/concentrado
  | 'aditivo'     // UV, VCI, antibloqueo, etc.
  | 'caja'        // caja blanca (cardboard packaging)
  | 'banding'     // marca de plastico al final del cono
  | 'refilado'    // slitting / rewinding
  | 'aumento';    // escalon de planta (aumento 1ero, 2do, 3ro)

export type CostSource = 'whatsapp' | 'email' | 'excel' | 'manual';

// Entrada del catalogo unificado.
// El precio_mxn_kg es el valor APLICABLE al producto. Para cajas, este valor
// puede recalcularse on-the-fly segun el rollo (PN x rollosCaja), pero se
// guarda un valor base de referencia.
export interface CostCatalogEntry {
  id?: string;
  category: CostCategory;
  name: string;
  precio_mxn_kg: number;
  inputs: Record<string, number | string | null> | null;
  source: CostSource | null;
  source_note: string | null;
  vigente: boolean;
  fecha_vigencia: string;
  subido_por: string | null;
  created_at?: string;
}

// Inputs especificos de caja blanca (calculo on-the-fly)
export interface CajaBlancaInputs {
  caja_mxn: number;          // costo de la caja (MXN por caja)
  kg_caja: number;           // peso del carton de la caja (kg)
  rollos_caja: number;       // rollos por caja
}

export interface CotizacionSaved {
  id?: string;
  cliente: string;
  vendedor: string;
  fecha: string;
  tc: number;
  transport_usd: number;
  total_revenue_usd: number;
  total_cost_usd: number;
  utilidad_global: number;
  status: CotizacionStatus;
  items: LineItem[];
  created_at?: string;
}
