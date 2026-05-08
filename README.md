# SICE Cotizador — BioNovaPack

Cotizador inteligente con sugerencia inversa de spec real para planta.

## Correr en local

```bash
npm install
cp .env.example .env.local   # opcional, sin esto la app corre sin persistencia
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) → redirige a `/cotizador`.

## Estructura

- `app/cotizador/` — UI principal con dos tabs
- `app/cotizador/precios/` — carga del Excel de precios de Diego
- `lib/pricingEngine.ts` — toda la lógica de negocio (sin UI)
- `lib/pdfGenerator.ts` — generación de Cotización y PO
- `lib/excelParser.ts` — parser de los Excel de EDSA/Color
- `supabase/schema.sql` — schema de la BD (ejecutar en Supabase SQL editor)

## Algoritmo clave (Tab 2)

El motor invierte la ecuación de costo: dado el precio del cliente y un margen
objetivo, despeja el largo real necesario (`lReal`) que la planta debe fabricar:

```
costoRolloMXN_max = precio_USD × TC / (1 + margen_objetivo)
pbReal_needed     = costoRolloMXN_max / (costoBase + flete)
pnReal_needed     = pbReal_needed − cono
lReal             = pnReal_needed / (ancho_real × calibre_real × 1.8148e-6)
```

## Deploy

```bash
vercel deploy
```

Configurar variables de entorno en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
