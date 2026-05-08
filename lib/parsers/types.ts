// Tipos compartidos por todos los parsers de Excel.
// Output unificado independiente del formato de origen.

export type ProductType =
  | 'manual'
  | 'semi'
  | 'auto'
  | 'auto_c50_semi_hp'
  | 'hp300'
  | 'hp350'
  | 'preesti'
  | 'special'; // termoencogible, antiestático, etc.

export type ResinClass = 'virgen' | 'reciclado' | 'color';

// Una fila normalizada de la lista de precios EDSA o Color.
// Después del parse, todas las hojas se reducen a este formato plano.
export interface ParsedPriceRow {
  source_file: 'edsa' | 'color';
  source_sheet: string;
  product_type: ProductType;
  resin_class: ResinClass;
  color: string | null;            // 'orange', 'black', etc. — solo si resin_class === 'color'
  ancho: number;
  calibres: number[];              // lista de calibres a los que aplica esta fila
  cono: number;                    // peso del cono en kg
  peso_neto: number;               // PN del rollo en kg
  peso_total: number;              // PB del rollo en kg
  precio_mxn_kg: number;           // costo MXN/kg base (sin adders)
  raw_description: string;         // texto original para debugging
  // adders embebidos en el archivo de Color (master, intenso) por SKU
  master_mxn_kg?: number;          // si la hoja Color especifica master en el header
  intenso_mxn_kg?: number;
}

// Catalogo de productos en "Cantidad Producto por Tarima.xlsx" - sheet "Flitros".
// Uno por SKU especifico, con cono y dimensiones reales.
export interface ParsedTarimaRow {
  codigo_edsa: string | null;
  codigo_alterno: string | null;
  ancho: number;
  calibre: number;
  peso_total: number;
  peso_cono: number;
  peso_neto: number;
  largo_real: number | null;
  largo_aprox: number | null;
  codigo_generado: string | null;
}

// Reglas de la sheet "General" del archivo de tarima.
// Dado (ancho, peso_total) → cuántos rollos caben por tarima.
export interface ParsedTarimaRange {
  ancho: number;
  peso_min: number;
  peso_max: number;
  pz_por_cama: number;
  camas_por_tarima: number;
  total_rollos: number;
}

export interface ParseReport {
  rows: ParsedPriceRow[];
  warnings: string[];
  sheetsProcessed: string[];
  sheetsSkipped: { name: string; reason: string }[];
}

export interface TarimaParseReport {
  catalogo: ParsedTarimaRow[];
  rangos: ParsedTarimaRange[];
  warnings: string[];
}
