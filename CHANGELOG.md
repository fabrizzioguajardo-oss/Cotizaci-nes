# Changelog — Cotizador SICE

Registro de cambios entre versiones. Las versiones más recientes aparecen primero.

---

## v1.10 — Mayo 2026 — Red de seguridad: paridad PDFs + invariantes ejecutables

**Foco**: invisibles al vendedor pero crítico. Convertir las invariantes que viven en comentarios del código (PB_real ≤ PB_cliente, margen ≥ 12%, capacidad trailer 19,200 kg) en **assertions ejecutables**, y garantizar que los DOS PDFs (cotización al cliente vs PO a Extruidos) salgan del mismo árbol de cálculo. Es el primer entregable del plan de 3 semanas que salió de la auditoría con la Mesa Redonda.

### Nuevo

- **`lib/computeQuote.ts`**: único entry point de cálculo para una cotización. Envuelve `calcAllTrailerTotals` + `calcLineItem` y produce un objeto `QuoteResult` con `perItem`, `perTrailer`, `totals` y `warnings`. Los dos PDFs deben consumir este resultado — su paridad subyacente es la razón de existir de SICE.
- **5 invariantes de negocio ejecutables** dentro de `computeQuote`:
  - `pb_excedido`: PB_real > PB_cliente (con tolerancia 0.5% por floating point). **error.** Cubre regresiones del bug v1.07-v1.08 donde el cono compensatorio inflaba el peso bruto arriba del esperado.
  - `margen_perdida`: utilidad < 0 (precio bajo costo). **error.**
  - `margen_bajo`: utilidad entre 0 y 12%. **warn.**
  - `capacidad_excedida`: trailer arriba de 19,200 kg netos. **error.**
  - `pn_cero`: línea con precio pero sin spec real. **error.**
  - `sin_precio`: línea con spec pero precio en cero. **warn.**
- **`scripts/verify-pdf-parity.ts`** + **`npm run verify`**: red de seguridad ejecutable. 6 casos de prueba (10mo camión real Level Packaging + regression del bug v1.07 + casos sintéticos de margen/capacidad/spec inválido) + test de paridad estructural (`computeQuote` es determinístico). Falla con exit 1 si cualquier invariante se viola. Patrón consistente con `verify-cono-compensation.ts` y `verify-truck-*.ts`.
- **Confirmación previa al descargar PDF**: en `page.tsx`, antes de generar la cotización al cliente o la PO a Extruidos, se muestra un `confirm()` con la lista completa de violaciones e inconsistencias detectadas. El vendedor decide si proceder o regresar a ajustar. Esto cierra la red de seguridad — los warnings ya no viven solo en tests offline, también el vendedor los ve antes de mandar el documento.

### Por qué importa

Tres bugs previos (v1.07 PB inflado, v1.08 cono acumulando, v1.06 utilidad falsa) tenían en común que las invariantes de negocio vivían como **comentarios y supuestos**, no como assertions. Cada regresión se detectaba en producción, no en desarrollo. Esta versión convierte esas reglas en código ejecutable:

- Si un futuro cambio rompe `PB_real ≤ PB_cliente`, `npm run verify` falla.
- Si la cotización va a salir con margen perdida, el vendedor ve la alerta antes de descargar el PDF.
- Si los dos PDFs llegaran a divergir por un cálculo desincronizado, el test de paridad estructural lo detecta.

### Tipos modificados

- `QuoteResult` y `QuoteWarning` en `lib/computeQuote.ts`.
- `package.json`: nuevo script `verify` y devDependency `tsx`.

### Notas para el roadmap

Este es el **Push #1 del plan de 3 semanas** post-auditoría. Próximos:

- **Push #2**: snapshot inmutable de cotizaciones emitidas (tabla nueva en Supabase + endpoint), para poder reconstruir cualquier cotización pasada aunque los precios EDSA cambien después.
- **Push #3**: bugs del Adversario (autosave race multi-tab, `costoTotalKg ≤ 1` silencioso, flete fantasma en trailer vacío) + vendedor dinámico en PDFs + defaults vacíos.
- **Push #4**: catálogo nombrado de aumentos (en vez de "Aumento 1/2") + ambigüedad Cases-vs-rollo en cálculo de margen + chips PB esperado visibles.

---

## v1.09 — Mayo 2026 — Bug fixes de sugerencia + tabla maestra EDSA

**Foco**: blindar el algoritmo de sugerencia contra entradas incompletas/edge cases que producían números absurdos (lReal de 182M pies, PB de 1kg cuando se esperaba 0.48kg), y agregar la tabla maestra de productos EDSA como fuente adicional para sugerir cono.

### Bugs arreglados (reportados por compañeros — Diego, Evers)

- **Cono sugerido podía inflar PB > PB_cliente.** Con 3″×70GA×1000′ cono 0.150kg PB esperado 0.48kg, el algoritmo (a margen bajo) sugería fabricar más material y terminaba dando PB ~1kg o, en casos extremos, lReal=182M pies. Causa: cuando el precio cubre el spec con margen sobrado, `lReal_raw > lCliente` → `pnReducido` negativo → `conoIdeal` negativo → `findClosestStandardConoDown` retornaba el cono más chico. PB explotaba porque pnReal_facturable ya estaba inflado por el exceso de largo.
  - Fix en `suggestRealSpec`: cap duro multi-capa. Si `lReal_raw >= lCliente`, NaN, Infinity, `lReal_raw <= 0`, o `costoTotalKg < 1 MXN/kg` (datos incompletos) → retorna no-op suggestion (fabricar tal cual lo pedido, sin compensar).
  - Red de seguridad final: `lReal = Math.min(lCliente, Math.ceil(lReal_raw))` — imposible exceder el largo del cliente.
  - Clamp en `conoIdeal = Math.max(cono, cono + pnReducido)` — el cono sugerido nunca queda por debajo del cono base.
  - **Garantía**: PB_real ≤ PB_cliente siempre. Verificado con `scripts/verify-cono-compensation.ts` contra el 10mo camión de Level Packaging — 4/4 líneas con PB diff entre −6% y 0%, jamás positivo.

- **Los botones de cono alternativo "sumaban" en cada click.** Cada click hacía `onChange({ cono })` → el algoritmo recomputaba `conoIdeal = cono + pnReducido` con el cono nuevo → el sugerido subía un escalón → el siguiente click subía otro escalón. El vendedor percibía que "el cono suma".
  - Fix: estado local `conoOverride` en `TabSugerencia`. El click solo previsualiza; el commit a `item.cono` ocurre cuando el vendedor pica "Aplicar sugerencia al spec real". El algoritmo siempre computa contra el cono original del cliente.
  - `SuggestionCard` recibe `conoEfectivo` y resalta el botón realmente seleccionado en vez del que computó el algoritmo.

- **Modal "Reportar bug" persistía el texto entre aperturas.** Al picar "Abrir Gmail web" o "Abrir mi app de correo" el modal no se cerraba (solo abría tab nuevo). El reset del textarea estaba en cleanup de `open=false` que nunca disparaba. Al volver a abrir, aparecía el reporte anterior.
  - Fix: reset al abrir Y al cerrar (defensa en profundidad). Los handlers de Gmail y mailto llaman `onClose()` después de disparar la acción.

- **Input "Transporte (USD)" del TopBar lucía editable pero no hacía nada.** En v1.08 multi-trailer el flete se edita por bloque de trailer, pero el TopBar todavía tenía un input con `onChange={() => {}}`. El vendedor escribía y el valor se descartaba silenciosamente.
  - Fix: `readOnly` con tooltip y subtítulo "Suma por trailer · editar en el sidebar". Comportamiento consistente con la arquitectura multi-trailer.

### Feature — Tabla maestra de productos EDSA como fuente de cono

- **Nuevo parser** `lib/parsers/productosEDSAParser.ts` para el archivo `prductosEDSA.xlsx` que manda Diego (tolera el typo "tablaMestra" en el nombre de hoja).
- **`lookupConoOptions` consulta en cascada**: catálogo de tarima (curado) → tabla maestra EDSA (nuevo, fallback) → universo de precios (último recurso). Esto cubre productos que EDSA fabrica pero que no están en el archivo de rollos por tarima (subset filtrado), y evita que el panel de cono salga vacío para esos specs.
- **`findCatalogMatches` también busca en productosEDSA** para conservar el `codigo_alterno` cuando el match viene de la tabla maestra.
- **Endpoint `/api/data/upload`** acepta `kind=productos_edsa`. Aplica el flujo RLS estándar (`getAuthedSupabase()`, marca versiones anteriores como obsoletas).
- **4ta `UploadZone` en `/cotizador/precios`** (color ámbar) para que el admin suba el archivo. Sin template descargable porque el formato viene del SAP de EDSA y es estable.
- **`build-static-data.ts` precompila el archivo opcional** si está en `~/Downloads/prductosEDSA.xlsx`. Build vigente: 1,329 SKUs parseados sin warnings.

### Tipos modificados

- `PriceData` (en `lib/dataStore.ts`) ahora tiene `productos_edsa?: ParsedTarimaRow[]`.
- `SuggestionCard` Props acepta `conoEfectivo?: number`.

### Convenciones reafirmadas

- PN facturable usa `Math.floor(raw * 100) / 100` (`calcPNFacturable`) — verificado: 3″×70GA×1000′ = 0.381 raw → 0.38 facturable. Consistente con `=REDONDEAR.MENOS` del Excel de Diego ("no regalar producto").

---

## v1.08 — Mayo 2026 — Multi-trailer con drag-and-drop estilo Scratch

**Foco**: una cotización ahora puede tener varios camiones, cada uno con su propio destino, costo de flete y capacidad. Las líneas se arrastran entre camiones como bloques de Scratch. El flete se distribuye SOLO entre las líneas del mismo trailer.

### Nuevo
- **`Trailer` como entidad de primera clase**: `{ id, destino, transport_usd, kg_max }`. Default: 1 trailer con capacidad 19,200 kg.
- **`trailerId` en `LineItem`**: cada línea pertenece a un trailer. Backward-compat: items sin `trailerId` se migran al trailer 1.
- **`calcAllTrailerTotals(items, trailers, tc)`**: nueva función en pricing engine. Calcula totales **por trailer** — kg neto, capacidad %, revenue, costo, utilidad. El flete de cada trailer se distribuye solo entre sus líneas.
- **`TrailerStack` + `TrailerBlock` + `DraggableLineItem`**: tres componentes nuevos. El sidebar izquierdo del cotizador ahora muestra los trailers como bloques apilados estilo Scratch.

### UI del sidebar
```
┌────────────────────────────────────────┐
│ [1] 🚛  Columbus OH         🗑          │
│ Flete USD: $6,900                       │
│ Capacidad: 12,400 / 19,200 kg (65%)    │
│ ▮▮▮▮▮▮▮▮░░░░░░░░░                       │
│ ┌──────────────────────────────────┐   │
│ │ ⋮⋮ 9.87×80 Orange  ●12.5%  📋🗑 │   │ ← draggable
│ │ ⋮⋮ 3×70 Bandling   ●5.0%        │   │
│ │ ⋮⋮ 5×70 Bandling   ●5.0%        │   │
│ └──────────────────────────────────┘   │
│ [+ Nueva línea en este trailer]        │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ [2] 🚛  Monterrey          🗑           │
│ Flete USD: $4,500                       │
│ Capacidad: 7,200 / 19,200 kg (37%)     │
│ ▮▮▮▮▮░░░░░░░░░░░░░░                     │
│ ┌──────────────────────────────────┐   │
│ │ ⋮⋮ 20×75 Ext Core  ●14.2%       │   │
│ └──────────────────────────────────┘   │
│ [+ Nueva línea en este trailer]        │
└────────────────────────────────────────┘
[+ Agregar trailer]
```

### Drag-and-drop
- Powered by `@dnd-kit/core`
- Cada línea tiene un handle (⋮⋮) que el vendedor arrastra
- El trailer destino se ilumina verde cuando recibe drop
- Visual "ghost" del item siendo arrastrado en DragOverlay
- 5px threshold antes de iniciar drag (evita drags accidentales al hacer click)

### Capacidad por trailer
- Barra de progreso verde → ámbar (>85%) → rojo (>100%)
- Warning visible cuando excede 19,200 kg: "Excede capacidad — separa en otro trailer"
- El vendedor decide manualmente (no auto-split) para mantener control

### Costos
- Cada trailer tiene su propio `transport_usd` editable inline en el header del bloque
- El flete por kg se calcula con el `kg_neto` del trailer (NO el global)
- Si un trailer tiene 12,000 kg y flete $6,000 → cada kg absorbe $0.50 de flete. Las líneas de OTRO trailer no comparten ese costo.
- TopBar global muestra la suma de `transport_usd` de todos los trailers (informativo)

### Backwards compat
- Drafts viejos sin `trailerId` en items → migrados a trailer 1 al cargar
- `transport_usd` viejo se asigna al trailer 1
- Función `calcTrailerTotals` (legacy) preservada para código que aún la usa

---

## v1.07 — Mayo 2026 — Compensación automática de cono (cuidar el peso bruto)

**Foco**: Tab 2 ahora también sugiere subir el cono para mantener el peso bruto del paquete cercano a lo que el cliente espera, mimicando la estrategia que Evers usa manualmente.

### Nuevo
- **Sugerencia de cono compensatorio**: cuando el algoritmo reduce el largo para subir margen, el cliente recibe menos PN (resina). Si el cono se queda igual, el paquete pesa visiblemente menos de lo declarado. Ahora el sistema sugiere subir el cono lo suficiente para que **PB_real ≈ PB_cliente**.
  - Algoritmo: `cono_ideal = cono_cliente + PN_reducido`. El sistema escoge el cono estándar más cercano sin exceder (conservador).
  - 20 tamaños estándar de cono (0.1 a 2.0 kg).
- **Card visual en Tab 2 con 3 paneles**:
  - "Cliente cree que recibe" — ancho × largo declarado + cono cliente + PB esperado
  - "Realmente fabricar" — largo sugerido + cono sugerido (+delta) + PB resultante
  - Card explicativa con el cálculo en lenguaje claro: *"Subiendo el cono de X a Y, el paquete final pesa Z kg (+0.05 kg vs lo esperado, 0.7%)"*
- **Botones de conos alternativos**: el vendedor puede elegir entre 3 conos estándar alrededor del ideal (más conservador, exacto, más agresivo). Click → aplica al instante.
- **`handleApply`** ahora actualiza tanto `lReal` como `cono`.

### Verificación contra el 10mo camión Level Packaging
- Línea 1 (9.87×80): Evers usó cono 0.9 (compensación parcial 36%), mi sugerencia es 1.2 (compensación 100%). Ambas válidas, el vendedor escoge.
- Línea 2 (3×70): Match exacto con Evers (cono 0.15).
- Línea 3 (5×70): Sugiero 0.2, Evers usó 0.25 (Evers sobre-compensó). Diferencia mínima.
- Línea 4 (20×75): Sugiero cono 0.7 (compensación total), Evers usó 0.25 (sin compensar). Mi sugerencia da PB casi exacto.

El vendedor mantiene control: la sugerencia es el "default óptimo matemáticamente" y puede ajustarla según criterio operativo (costo de cono, disponibilidad del proveedor, riesgo aceptable de detección).

### Tipos modificados
- `SuggestionResult` ahora incluye: `conoSugerido`, `conoIdeal`, `pbCliente`, `pbConCompensacion`, `pbDiffCompensado`, `conosAlternativos`.

---

## v1.06 — Mayo 2026 — Tolerance warning + confidencialidad de precios

**Foco**: nueva información de tolerancia de producción en Tab 2, y limpieza para que ningún precio real quede en el repositorio público.

### Nuevo
- **🟢 Aviso de tolerancia de producción** en Tab 2 (Sugerencia para planta):
  - Calcula el rango natural que la planta puede producir: `largo_cliente ± 0.5%`
  - Compara contra la sugerencia actual de `lReal`
  - Tres niveles de visualización:
    - ✓ Verde "DENTRO de tolerancia" — la sugerencia cae en el rango natural, no requiere disclosure al cliente
    - ⚠ Amber "FUERA de tolerancia natural" — reducción intencional para subir margen, verificar contrato
    - 🚫 Rojo "MUY POR DEBAJO" — reducción >10pp más allá de tolerancia, considerar validar con Jennifer
  - Constante `PLANT_TOLERANCE_PCT = 0.005` configurable en `lib/pricingEngine.ts`
  - Banda visual con marcadores de cliente vs sugerencia

### Cambio importante de seguridad
- **🔒 Precios reales removidos del repo de GitHub**. Los siguientes archivos NO se versionan más:
  - `public/data/precios.json` (664 KB de precios EDSA + Color)
  - `public/templates/template_precios_*.xlsx` (3 archivos con data real abril 2026)
  - `templates/template_precios_*.xlsx` (mismos)
- **`.gitignore` actualizado** para que cualquier futuro `*.xlsx` con prefijos de precios reales quede fuera del repo automáticamente.
- **Templates blank** (estructura + 2-3 filas ficticias) generados como reemplazo:
  - `template_blank_EDSA.xlsx`
  - `template_blank_color.xlsx`
  - `template_blank_tarima.xlsx`
- **Los botones de descarga** en `/cotizador/precios` apuntan a estos blanks. El admin los llena con datos reales y los sube via el cotizador → van a Supabase, NO al repo.
- **El cotizador en producción** lee precios desde Supabase. Si no hay datos cargados aún, muestra "Sin precios cargados" hasta que el admin suba los Excels reales.

### Por qué este cambio
Aunque el repositorio es privado, los precios de venta son información comercial crítica. Mantenerlos fuera del repo elimina riesgos si en algún momento el repo se hace público o se da acceso a un colaborador externo. La verdad de los precios vive ahora en Supabase, accesible solo via login al cotizador.

---

## v1.05 — Mayo 2026 — Bug fixes de spec real + warning de precios viejos

**Foco**: arreglar 3 bugs reportados al usar v1.04, y agregar un warning visible cuando el cotizador está usando precios viejos del build.

### Arreglado
- **🔴 Ancho/calibre se podían modificar en Tab 2 (Sugerencia para planta)**: el editor manual permitía editar `aReal` y `calReal`, lo cual rompe la regla de negocio (solo el largo se ajusta para subir margen, nunca el ancho ni el calibre). Ahora ambos campos están `read-only` (con icono de candado) y siguen automáticamente lo que escribiste en Tab 1.
- **🔴 `aReal`/`calReal` se quedaban desactualizados si editabas Tab 1 después de elegir un cono**: si después de elegir un cono cambiabas el ancho declarado al cliente, el ancho real se quedaba con el valor viejo. Ahora cuando modificas `ancho` o `calibre` en Tab 1, el spec real se actualiza automático.
- **🟡 Adders heredados al agregar línea nueva**: al hacer "+ Nueva línea", el item nuevo heredaba `costoBase`, `refilado` y `cono` del item activo. Eso causaba que la línea nueva apareciera con refilado o costo base ya seteados aunque el producto fuera distinto. Ahora SOLO se hereda lo que es del trailer compartido (tipo de resina, tarimas por trailer). Cada línea arranca limpia y usa su propio cone selector para autofill.

### Mejorado
- **Warning visible cuando se usan precios viejos**: si Diego no ha subido los Excels actuales, el cotizador usa el `precios.json` bundled del build (que tiene los datos de abril 2026). Antes funcionaba en silencio. Ahora en el panel de "Opciones de fabricación" aparece un banner amber que dice *"Precios viejos del build (referencia). Pídele a Diego que suba los Excels nuevos."* El sistema sigue funcionando con esos precios para no bloquear cotizaciones, pero el vendedor sabe que necesita actualizar.

### Pendiente para v1.06
- Multi-trailer con UI drag-and-drop: cuando un pedido excede capacidad de un camión (19,200 kg) o tiene múltiples destinos, mostrar bloques visuales por trailer y permitir arrastrar líneas entre ellos.
- Catálogo de rutas logísticas en lugar de teclear el costo de transporte.

---

## v1.04 — Mayo 2026 — Bug fixes críticos del autosave

**Foco**: arreglar los bugs que reportaron Fabrizzio y Evers después de probar v1.03 en vivo.

### Arreglado
- **🔴 "Error al guardar" en el autosave**: la policy RLS de `user_profiles` tenía recursión infinita (`error 42P17`). Eso bloqueaba todas las queries a `user_profiles` y, en cascada, las inserts en `cotizaciones` (porque la policy de cotizaciones consulta user_profiles). Fix SQL: dropear la policy `admins_see_all_profiles` recursiva. Los admins siguen viendo todas las cotizaciones porque su propio profile lo dice (vía `users_see_own_profile`).
- **🔴 Utilidad global mostrando "-100%" sin precio**: cuando agregabas un producto y todavía no llenabas el precio del cliente, la utilidad del trailer aparecía como -100% en rojo. Matemáticamente correcto (0 - costo)/costo = -100%, pero engañoso. Ahora muestra "Sin precio" en gris (consistente con la utilidad por línea individual).
- **🟡 Save fantasma del autosave**: cada save real generaba un segundo save inocuo 2 segundos después por un closure problem con React. Idempotente pero gastaba requests. Fix: usar `draftIdRef` en lugar de `state.draftId` en las deps del callback.

### Mejorado
- **Logging del API `/api/cotizaciones/draft`**: cuando Supabase rechaza un insert/update, el response ahora incluye `error.code`, `details` y `hint` (no solo `message`). Útil para diagnosticar problemas de RLS o schema en producción.

### Importante para el admin
- **Si tienes un proyecto Supabase ya migrado a v1.02**, corre este SQL en SQL Editor para aplicar el fix de recursión:
  ```sql
  DROP POLICY IF EXISTS "admins_see_all_profiles" ON user_profiles;
  ```

---

## v1.03 — Mayo 2026 — Auto-save de borradores + polish

**Foco**: cada cotización se guarda automáticamente en la nube, sin perder trabajo si cierras el browser.

### Nuevo
- **Auto-save cada 2 segundos** en Supabase. Cuando cambias cualquier dato (cliente, TC, items, precio), se guarda solo a los 2 segundos.
- **Indicador visual** "Guardando…" / "Guardado hace 3 seg" en el TopBar — sabes en todo momento si tu trabajo está seguro
- **Carga automática al entrar**: si tenías un borrador en marcha, lo vuelves a ver al volver al cotizador (incluso en otra computadora — está en BD, no localStorage)
- **Botón "Nueva cotización"** que borra el borrador actual y arranca uno limpio (con confirmación)
- **Banner cyan con templates** descargables al entrar a /cotizador/precios (Diego puede usar el formato limpio si quiere)
- **Indicador de "Precios actualizados hace X días"** visible para vendedores también (no solo admins)

### Arreglado
- **Admin fallback por email**: usuarios admin cuyo profile no se creó por timing del trigger ahora ven botones admin automáticamente. RLS sigue siendo la fuente de verdad en BD.
- **Build de Vercel** que fallaba con "Edge Function references unsupported modules": cliente Supabase ahora está inline en middleware y route handlers Edge-safe.
- **Login que rebotaba a /login**: el callback usaba un patrón incorrecto que no persistía cookies de sesión. Ahora usa `cookies()` de `next/headers` (patrón oficial Supabase).

### Técnico
- Nueva API `/api/cotizaciones/draft` con GET/POST/DELETE
- Hook `useCotizacionAutosave` con debounce 2s + status `idle/saving/saved/error`
- Componente `AutosaveIndicator` con tiempo relativo ("hace 5 min")
- SSOT `lib/adminEmails.ts` para la lista de admins

---

## v1.02 — Mayo 2026 — Auth y aislamiento por usuario

**Foco**: cada vendedor con su login + admins con privilegios distintos.

### Nuevo
- **Login por email** con enlace mágico (sin contraseñas)
- **Roles**: `admin` (Diego + Fabrizzio) vs `vendedor` (todos los demás)
- Aislamiento: cada vendedor solo ve sus propias cotizaciones (Row Level Security en BD)
- Admins ven todas las cotizaciones del equipo
- Botón **Logout** arriba a la derecha con nombre y rol del usuario actual
- Página `/login` con flow simple: email → revisa correo → click enlace → entras

### Cambios
- **Estado inicial vacío**: ya no aparece Level Packaging pre-cargado. Cada cotización arranca limpia
- **Botones admin ocultos** para vendedores ("Admin de costos" y "Carga Excel EDSA" solo visibles para admins)
- **Defensa en dos capas**: UI esconde botones + BD rechaza writes de no-admins

### Técnico
- Nueva dependencia: `@supabase/ssr` para cookies en Next.js App Router
- Middleware refresca sesión y protege todas las rutas excepto `/login` y `/auth/*`
- Migración SQL `002_auth_and_roles.sql` con tabla `user_profiles`, trigger auto-creación y policies RLS

---

## v1.01 — Mayo 2026 — Bug fixes y UX

**Foco**: arreglar bugs reportados en el primer test interno + mejorar feedback.

### Arreglado
- **Lookup de precio por intervalo (floor)**: si cotizabas PB=2.96 tomaba el row del Excel con PB=3.00 (precio incorrecto). Ahora toma el row PB=2.90 que es el correcto según la convención de Diego. La tabla de precios funciona por rangos: 2.90 cubre [2.90, 3.00), 3.00 cubre [3.00, 3.10), etc.
- **Botón "Reportar" en Windows**: el `mailto:` directo fallaba silencioso si el usuario no tenía app de correo configurada. Ahora abre un modal con 3 opciones cross-platform: Gmail web, mailto, copiar al portapapeles
- **Trailer max**: corregido a 19,200 kg (era 20,412 hardcoded del valor genérico US)

### Nuevo
- **Cards visibles de spec**: arriba del build-up de costo, 4 cards en vivo:
  - Peso del rollo (PN y PB)
  - Kilos por tarima (neto y bruto)
  - Total rollos del item
  - KG total item en el trailer
- Email de feedback corregido a `fabrizzio.guajardo@bionovapack.com`

### Verificación
- Test contra el camión real de Level Packaging: 24/26 checks pasan al céntimo (los 2 restantes son inconsistencia documentada de Diego en línea 5 caja blanca)
- Test del floor lookup: 4/4 casos pasan

---

## v1.0 — Mayo 2026 — Primer release

**Foco**: cotizador funcional con datos reales de BioNovaPack.

### Parsers
- Lectura automática de los 3 Excels de Diego:
  - `Precios de producto EDSA – Extruidos.xlsx` (8 hojas, 350 precios)
  - `Precios Color.xlsx` (35 hojas, 1310 precios)
  - `Cantidad Producto por Tarima.xlsx` (1064 SKUs + 13 reglas)
- Templates limpios alternativos para que Diego migre si quiere

### UI cotizador
- **Tab 1 — Pedido del cliente**: spec del cliente, build-up de costo, precio
- **Tab 2 — Sugerencia para planta**: algoritmo inverso que despeja largo real para alcanzar margen objetivo
- **Selector de cono inteligente**: aparece automáticamente al llenar ancho/calibre/largo, muestra opciones con cono histórico marcado ⭐
- Generación de PDF: cotización al cliente (spec declarado) + PO a Extruidos (spec real)

### Admin
- Subida de los 3 Excels desde la web (`/cotizador/precios`)
- Catálogo central de adders (master, intenso, aditivo, caja blanca, banding, refilado, aumentos) con tracking de fuente (WhatsApp / Email / Excel) y nota literal para auditoría
- Indicador de frescura por entrada (semáforo: verde ≤ 30d, amber 31-60d, rojo > 60d)

### Bug critical fix (durante desarrollo)
- `calcLineItem` multiplicaba por PB en vez de PN → costos inflados ~17%
- `suggestRealSpec` tenía el mismo bug → largo real sugerido era ~25% más corto
- Fixed: ambos ahora usan PN. Verificado contra el camión real (6/6 líneas matchean al céntimo).
