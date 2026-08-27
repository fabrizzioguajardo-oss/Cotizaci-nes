// Glosario compartido de términos técnicos del cotizador.
// UNA sola fuente para todos los tooltips: si Diego corrige una definición,
// se corrige aquí y cambia en toda la app.

export const GLOSARIO = {
  pn: 'Peso neto: solo la película, sin el cono de cartón. El costo y la factura se calculan por PN.',
  pb: 'Peso bruto: película + cono. Es lo que el cliente pesa al recibir el rollo.',
  utilidad: 'Ganancia sobre el COSTO: costo $100 + 12% = precio $112. No es porcentaje sobre la venta.',
  price_lb: 'Precio por libra entregada — la métrica del mercado en EUA. Se valida contra el rango típico.',
  reduccion: 'Cuánto material menos se fabrica vs lo declarado al cliente. Hasta 5% es saludable; más de 5% lo aprueba JN.',
  calibre: 'Espesor de la película (gauge). No cambia el precio por kg — solo el peso del rollo.',
  cono: 'Tubo de cartón del centro del rollo (kg). Sube el peso bruto, no el neto.',
  tc: 'Tipo de cambio MXN/USD. Convierte el costo (en pesos) a dólares — obligatorio en cotizaciones de EUA.',
  revenue: 'Lo que pagará el cliente: precio × unidades de todas las líneas.',
  costo: 'Lo que cuesta fabricar el pedido: (costo por kg + flete por kg) × peso neto, sumado por línea.',
  kg_neto: 'Kilos netos de película del pedido. En EUA se compara contra el límite del camión (19,200 kg).',
  base_edsa: 'Costo por kilo de la lista vigente de la planta (EDSA), según cono y peso del rollo.',
  intenso: 'Recargo por color intenso: +1.25 MXN/kg (política validada con Diego).',
  rollo_chico: 'Rollos con peso neto menor a 1.3 kg llevan +2.5 MXN/kg (aumento anunciado por EDSA).',
} as const;

export type TerminoGlosario = keyof typeof GLOSARIO;
