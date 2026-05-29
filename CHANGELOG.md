# Changelog — Cotizador SICE

Registro de cambios entre versiones. Las versiones más recientes aparecen primero.

> **Nota de versionado:** la versión que VE el usuario es **v1.10** — se presenta
> como una **actualización mayor** que consolida todo el arco de trabajo
> reciente. Internamente ese arco pasó por builds 1.09 → 1.22 (detallados abajo
> como historial técnico). El indicador de la app, el modal de Novedades y los
> documentos muestran **v1.10** a propósito.

---

## En desarrollo (post-v1.10) — Multi-empresa: BioNovaPack (USA) + Extruidos (México)

> Trabajo en progreso, **no anunciado al equipo todavía**. El indicador visible
> sigue en v1.10 hasta que la feature esté completa (Fase B pendiente).

### Fase A (lista) — fundación multi-empresa

- **Pregunta al inicio**: selector "Cotizar para BioNovaPack · USA / Extruidos · México"
  arriba del panel. Persiste en el draft (migración 011).
- **Modelo de moneda**: México (Extruidos) opera en **MXN sin tipo de cambio** —
  el costo ya está en MXN y el precio se captura en MXN; el divisor efectivo es 1.
  EUA sigue en USD con TC. Reusa el mismo motor (`tcEfectivo`), sin reescribirlo.
- **Transporte México**: panel con 2 opciones — recoge en almacén ($0) o envío
  por Castores (precio MXN). Modelado como un trailer único (sin multi-trailer
  ni límite de capacidad).
- **UI adaptada**: en México se oculta el campo de TC (muestra "MXN"), los KPIs
  se etiquetan con la moneda, el sidebar muestra el panel de transporte simple
  en vez de los bloques de trailer, y el acento de color sigue a la empresa.
- `lib/empresa.ts`: metadata por empresa (nombre, mercado, moneda, usaTC,
  multiTrailer, accent) — fuente única.

### Fase B1 (lista) — PDF de Extruidos (MXN)

- **`generateExtruidosQuotePDF`**: cotización con el formato y marca reales de
  Extruidos (basado en `COTIZACIÓN EXTRUIDOS.xlsx`): encabezado navy con razón
  social + domicilio, datos del cliente (correo, contacto, tel, forma de pago),
  nota de vigencia 7 días, tabla por tarima (cant. x tarima · unidad · no.
  tarimas · descripción · precio anterior · precio nuevo · total por tarima),
  **SUBTOTAL → I.V.A. 16% → TOTAL → ANTICIPO**, observaciones fijas y pie con el
  analista (nombre del vendedor + correo). Verificado con render de prueba.
- **Campos México** capturados en el sidebar: correo, teléfono, forma de pago
  (Contado / Crédito 30·60·90) y anticipo. `precioAnterior` opcional por línea
  en el tipo `LineItem` (la columna sale en blanco si no se captura).
- Al generar la cotización con empresa = Extruidos, se usa este PDF (MXN) en vez
  del de BioNovaPack.

### Fase B2a (lista) — logos reales en los PDFs

- **Logos embebidos**: el PDF de Extruidos lleva su logo (centrado arriba) y los
  PDFs de BioNovaPack (cotización + PO) llevan el logo BNP (arriba a la
  izquierda). Cargados desde `public/logos/` en el navegador (`loadLogo`),
  con fallback a encabezado de texto si la imagen no carga.
- Verificado con render de prueba del PDF Extruidos con logo.

### Fase B1.1 (lista) — persistencia de datos México + precio anterior

- Los campos México (correo, teléfono, forma de pago, anticipo) ahora se
  **persisten en el draft** (migración 012) — sobreviven refresh y reaperturas.
- **Input "precio anterior por rollo"** por línea, visible solo en modo
  Extruidos (Tab Pedido); alimenta la columna del PDF.

### Fase B2b (pendiente)

- Paleta de color completa por empresa (verde BNP / navy+azul Extruidos) en
  TODA la app (hoy la UI sigue verde; solo los PDFs, los logos y el acento del
  selector cambian por empresa).

### Migración requerida

```sql
-- 011_cotizaciones_empresa.sql
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS empresa TEXT NOT NULL DEFAULT 'bionovapack';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS transporte_mx TEXT NOT NULL DEFAULT 'pickup';
```

---

## v1.10 (versión visible) — Gran actualización del cotizador

Reúne todo lo construido en los builds internos 1.09–1.22. De cara al equipo es
**una sola actualización grande**, comunicada dentro de la app con un **modal de
Novedades** (aparece una vez por usuario; re-abrible con el botón "Novedades").

Resumen por área (el detalle técnico está en las entradas 1.09–1.22 de abajo):

- **Funcionalidad nueva**: dos modos de cotización (Directa / Optimizada /
  Optimizada + revisión), pantalla comparativa económica, flag y captura de
  aprobación, historial inmutable de cotizaciones emitidas, tabla maestra EDSA
  (1,329 SKUs) como fuente de cono.
- **Lógica del cotizador y cálculos**: cono cliente vs cono real separados (la
  red de seguridad ya detecta sobrecompensación), PN truncado hacia abajo, TC
  real en la sugerencia, PDFs que cuadran (qty = total), preview de precio =
  precio aplicado, recálculo autoritativo del snapshot en el servidor.
- **Experiencia de usuario**: nombre real del vendedor en PDFs + onboarding,
  contacto/dirección del cliente persistentes, diagnóstico de "qué falta",
  edición de nombre sin recargar, input fantasma de transporte eliminado.
- **Flujos internos y control**: red de seguridad de invariantes (PB ≤
  PB_cliente, margen ≥ 12%, capacidad de trailer, etc.) con aviso antes de
  emitir, protección multi-pestaña (optimistic lock), un solo draft por usuario.

### Implementación de la presentación (build interno)

- `WhatsNewModal`: modal de novedades, auto-show una vez por versión
  (`localStorage`), re-abrible desde el botón "Novedades" del TopBar.
- `APP_VERSION` fijado en `1.10` (indicador visible). El historial granular
  1.09–1.22 se conserva abajo como referencia de desarrollo.

### Pasada de pulido visual (UI)

- **Tarjetas** con profundidad sutil (sombra tenue) para sensación de "elevado".
- **Botones** con anillo de foco accesible para teclado (`focus-visible`) y un
  ligero feedback al presionar; primary/purple con sombra sutil.
- **Inputs** con estado hover en el borde (mejor affordance).
- **Login** con logo en "mark" (contenedor redondeado) y más aire.
- **Modales** (Reportar, Onboarding, Novedades) con `backdrop-blur` — look más
  moderno. Cambios aditivos: no mueven el layout existente.

---

## v1.22 — Mayo 2026 — Aprobación + historial (Fase 1b)

**Foco**: cerrar la Fase 1 de los modos de cotización con el flujo de aprobación y el registro en historial.

### Nuevo

- **Flag "requiere aprobación comercial/técnica".** En modo **Optimizada + revisión**, si alguna línea reduce el material más de 35% (la spec crítica acordada), aparece un panel rojo que **bloquea la emisión** de la cotización y la PO hasta que se capture la aprobación.
- **Captura ligera de aprobación**: el vendedor escribe el nombre de quien aprueba y marca una casilla; el sistema estampa la fecha/hora. Cambiar el nombre o cualquier dato de la cotización re-exige confirmar (una aprobación no puede quedar "pegada" a algo que luego cambió).
- **Historial**: el snapshot inmutable ahora guarda **con qué modo se emitió** (`tipoCotizacion`) y **quién aprobó + cuándo** (`aprobacion`). Queda registrado en `cotizaciones_emitidas` qué opción se usó y quién la autorizó. Snapshot `schemaVersion` → 2.

### Comportamiento del gate

- **Directa** y **Optimizada**: nunca piden aprobación.
- **Optimizada + revisión**: solo pide aprobación cuando hay reducción > 35%. Si la reducción es menor, emite sin fricción.
- Sin migración (la aprobación y el modo viven en el snapshot JSON, que ya se persiste).

### Fase 1 completa

Con v1.21 (modos + comparación) y v1.22 (aprobación + historial), la feature de **dos modos de cotización** está completa en su Fase 1. Falta solo la **Fase 2**: ampliar la optimización a calibre/empaque/pallet con los rangos permitidos por la empresa (bloqueado hasta tener esos rangos de Diego/Evers).

---

## v1.21 — Mayo 2026 — Dos modos de cotización + comparación económica (Fase 1a)

**Foco**: formalizar dos modos de cotización claramente separados (directa vs optimización de margen) con una pantalla comparativa económica. Primera parte de la feature de modos.

### Nuevo

- **Selector de tipo de cotización** (arriba del panel central), con 3 opciones:
  - **Directa**: se cotiza y fabrica EXACTAMENTE lo que pide el cliente, sin optimización. Al elegirlo, el spec real se sincroniza al del cliente en todas las líneas (fabricar tal cual) y la pestaña de sugerencia muestra un aviso en vez de proponer cambios.
  - **Optimizada**: el sistema propone la alternativa más rentable (hoy: reducir largo + compensar cono) y el vendedor la aplica.
  - **Optimizada + revisión**: igual que optimizada, pero los cambios de spec crítica requerirán aprobación (la captura de aprobación llega en v1.22).
- **Pantalla comparativa económica** (`ComparisonCard`) en la pestaña de optimización. Muestra lado a lado:
  - Solicitado por el cliente (spec, costo/rollo, margen, PN) vs Propuesta interna optimizada (lo mismo).
  - **Ahorro por rollo**, **diferencia económica total** (× número de rollos) y **Δ margen** en puntos.
  - **Riesgo + recomendación** del sistema: recomienda optimizar, advierte si no mejora el costo o el margen sigue bajo el mínimo, y marca "requiere aprobación" cuando la reducción supera 35%.
- El modo se **persiste en el draft** (migración 010) — sobrevive refresh y reaperturas.

### Cómo se calcula la comparación

El "costo directo" se calcula fabricando el spec exacto del cliente (`real = cliente`, `cono = conoCliente`) y se compara contra el costo optimizado actual. El flete usa el contexto del trailer (aproximación de Fase 1: el dominante — largo/material — sí se captura).

### Migración requerida en Supabase

```sql
-- 010_cotizaciones_tipo.sql
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS tipo_cotizacion TEXT NOT NULL DEFAULT 'directa';
```

### Siguiente (Fase 1b — v1.22)

Flag "requiere aprobación" con captura ligera (nombre + casilla + fecha) que gatea la emisión del PDF en modo "optimizada + revisión", y guardar en el historial (snapshot) qué modo se usó y quién aprobó.

### Pendiente (Fase 2)

Ampliar la optimización más allá de largo+cono (calibre, empaque, rollos/pallet) con los rangos permitidos por la empresa — bloqueado hasta tener esos rangos de Diego/Evers.

---

## v1.20 — Mayo 2026 — Cola de menores + deuda de altitud

**Foco**: cerrar la cola de hallazgos menores de la revisión, incluidos los dos puntos de "altitud" (deuda de diseño). Sin migraciones.

### Altitud (deuda de diseño)

- **`computeQuote` es ahora el ÚNICO punto de cálculo de la UI.** Antes la página calculaba `results` y `trailerTotals` por su cuenta (duplicando la fórmula que vive en `computeQuote`), y además `confirmarAntesPDF` y `persistirSnapshot` llamaban `computeQuote` otras dos veces por click — tres recálculos del mismo árbol. Ahora todo (render, PDFs, snapshot, warnings) sale de un solo `useMemo(computeQuote(...))`. Elimina la duplicación de fórmula (riesgo de divergencia UI↔PDF) y el triple-cómputo.
- **`getAuthedSupabase` dejó de estar copy-pasteado.** Los 5 route handlers (profile, draft, emitidas, data/current, data/upload) tenían la misma función idéntica, que además duplicaba el `getSupabaseServer` ya existente en `lib/supabaseServer.ts`. Ahora los 5 importan ese único helper. Un cambio de SSR/cookies se hace en un solo lugar.

### Menores

- **Editar el nombre ya no recarga la página.** `useAuth` expone `refreshProfile()` que re-lee el perfil sin `window.location.reload()` — antes el reload descartaba cualquier trabajo dentro de la ventana de autoguardado.
- **`tc` del draft solo se carga si es > 0** (un tipo de cambio de 0 no es usable; defaultea explícitamente).

### Ya estaban cerrados en pushes anteriores (de la misma cola)

`canonicalize` robusto ante NaN (v1.19) · preview con `calcPNFacturable` (v1.17) · `findClosestEDSAPriceOnly` eliminado (v1.17) · fallback `caja_mxn` sin 1kg ficticio (v1.19) · color `custom` filtrado (v1.19) · deps de `conoOverride` sincronizadas (v1.16).

### Pendiente (deuda de diseño mayor, no en esta cola)

Refactor del tipo `LineItem` plano → sub-objetos (`sale`/`clientSpec`/`realSpec`/`logistics`/`costBuildup`). Es el refactor grande que la Mesa Redonda recomendó posponer hasta resolver con los expertos si `calReal` debe poder diferir de `calCliente`.

---

## v1.19 — Mayo 2026 — Cierre de medios: integridad y datos

**Foco**: cerrar por completo los hallazgos de integridad/datos/robustez de la revisión que habían quedado a medias.

### Cambios

- **El snapshot ahora se recalcula en el servidor (#10b).** Antes el registro inmutable guardaba los totales/costos/márgenes tal como los mandaba el navegador, y el hash solo certificaba "lo que el cliente envió" — un navegador modificado podía persistir cifras falsas con hash válido. Ahora `/api/cotizaciones/emitidas` recalcula el árbol completo desde los inputs crudos (items, trailers, TC) con el mismo motor (`computeQuote`) y sobreescribe los totales con el resultado autoritativo antes de hashear. El registro histórico ya es fuente de verdad real, no copia de lo declarado.
- **Aviso cuando la logística está en cero (#13b).** Si una línea tiene spec y precio pero `rollos/tarima × tarimas/trailer = 0`, el kg neto y el costo salían en cero en silencio (y el resumen del trailer mostraba utilidad infinita). Pasa típico cuando el cono viene del fallback de tabla maestra EDSA sin regla de tarima. Ahora se levanta un error visible antes de generar el PDF.
- **Número de cotización con más entropía (#14b).** Era `Q-` + 6 dígitos del timestamp → dos emisiones cercanas, o de distintos vendedores en el mismo instante, podían colisionar y romper la trazabilidad. Ahora es timestamp en base36 + 3 caracteres aleatorios — colisión despreciable.
- **Caja blanca ya no inventa un costo fantasma.** El fallback que derivaba el costo de la caja usaba `pnReal || 1`, fabricando un cargo sobre 1 kg ficticio cuando aún no había spec real. Ahora, sin PN real, deja la caja en 0 hasta que el spec exista.
- **Producto color "custom" ya no mezcla precios de otros colores.** En el lookup de precio, `custom` no filtraba nada y el mejor match podía caer en el master de un color arbitrario (orange/black). Ahora prefiere los rows genéricos (sin color específico).
- **Hash del snapshot robusto ante NaN/Infinity.** `canonicalize` ahora normaliza números no finitos a un marcador explícito (antes `JSON.stringify` los volvía `null` en silencio, así que un NaN y un null serializaban igual).

### Estado de la revisión

Con v1.16–v1.19 quedan resueltos **todos** los hallazgos de la revisión de código: 5 críticos (🔴), altos (🟠) y medios (🟡). Lo único pendiente es la **deuda de altitud** (refactors de diseño, no bugs): `LineItem` plano → sub-objetos, UI consumiendo `computeQuote` como único camino, y dedup de `getAuthedSupabase`.

---

## v1.18 — Mayo 2026 — Backend hardening (medios de la revisión)

**Foco**: cierra los hallazgos de la revisión que viven en el backend (endpoints, persistencia, concurrencia). Con esto queda resuelta toda la lista de altos/medios de la revisión de código.

### Cambios

- **Candado multi-tab ya no tiene hueco (#8).** El optimistic lock se saltaba si el cliente no mandaba `base_updated_at` (hacía blind overwrite). Ahora: si el cliente conoce un draft (manda `id`) pero no trae base, no se pisa — se fuerza recarga. La protección dejó de ser opt-in.
- **Un solo draft por usuario, sin duplicados (#14).** Si el cliente guarda sin `id` (cree que es nuevo) y ya existe un draft suyo, ahora se actualiza ese en vez de crear un segundo huérfano. Backstop a nivel BD: índice único parcial `(user_id) WHERE status='draft'` (migración 009, que primero limpia duplicados existentes conservando el más reciente).
- **El registro inmutable se firma con identidad del servidor (#10).** `/api/cotizaciones/emitidas` ahora toma el nombre del vendedor del perfil del usuario autenticado (servidor), no del `vendedor` que mandó el cliente. Antes un vendedor podía firmar el registro con el nombre de otra persona.
- **El PDF se descarga primero, el snapshot después (#11).** Antes se hacía `await` del guardado del snapshot ANTES de generar el PDF, así que una red lenta retrasaba la descarga que el cliente espera. Ahora el PDF sale de inmediato y el snapshot se guarda en segundo plano (fire-and-forget), como siempre fue la intención.
- **Contacto/dirección solos ya se autoguardan (#12).** El chequeo de "cotización vacía" ignoraba contacto y dirección, así que si el vendedor llenaba solo esos (sin cliente ni specs) no se guardaba nada. Ahora cuentan.

### Migración requerida en Supabase

```sql
-- 009_unique_draft_por_usuario.sql (incluye limpieza de duplicados + índice)
```

### Estado de la revisión de código

Con v1.16 (5 críticos), v1.17 (altos del camino de cotización) y v1.18 (medios de backend), **toda la lista de hallazgos de la revisión está resuelta**, salvo la cola de menores (cosmética/robustez de parser) y los puntos de altitud (refactor `LineItem`, `computeQuote` como único camino de la UI, dedup de `getAuthedSupabase`) que son deuda de diseño, no bugs.

---

## v1.17 — Mayo 2026 — Cluster de sugerencia/cono/lookup (altos de la revisión)

**Foco**: hallazgos altos/medios de la revisión de código que viven en el camino de cotización (Tab Sugerencia + selector de cono + lookup de precio). No tocan backend.

### Cambios

- **TC real en Tab Sugerencia (#6).** `suggestRealSpec` y `diagnoseSuggestion` se llamaban con `tc: 18` hardcodeado mientras el resto de la app usa el TC editable (18.5 default). El TC convierte el precio USD a MXN para despejar el largo — un TC errado desviaba el largo sugerido ~2.7% y la sugerencia divergía del PDF. Ahora se pasa el TC real del global.
- **Re-elegir un cono ya no revierte la reducción de largo (#7).** En `handleConePick`, volver a elegir un cono forzaba `lReal = lCliente`, borrando en silencio la reducción de material que el vendedor aplicó en Tab 2 (y el margen ganado), mandando a planta el largo completo. Ahora se preserva el `lReal` reducido.
- **Aviso visible cuando el cono escogido excede el PB esperado (#9).** Al elegir un cono alternativo por arriba del sugerido, la tarjeta seguía "verde" aunque el paquete fuera a pesar de más. Ahora muestra un aviso rojo inmediato con cuánto excede, antes de aplicar.
- **Preview de precio = precio aplicado para virgen con color (#15).** La derivación del `resin_class` estaba duplicada y divergente: el preview ignoraba el color (mostraba precio virgen ~$47) y el apply sí lo consideraba (color ~$36). Ahora ambos usan un único helper `deriveResinClass`.
- **El fallback de tabla maestra EDSA ya no pierde el código del SKU (#13).** El match contra `productosEDSA` filtraba por peso neto del cliente contra el peso de fábrica del SKU (otro largo) → casi nunca matcheaba → se perdía el `codigo_alterno`. Ahora matchea por ancho/calibre/cono.
- **Preview de PN usa el peso facturable (truncado).** El selector de cono calculaba el PB con PN crudo, así que cerca de un borde de intervalo de precio podía caer en un row distinto al que cobra el costo real. Ahora usa `calcPNFacturable`, consistente con el costo.
- **Limpieza**: eliminado `findClosestEDSAPriceOnly` (código muerto sin llamadas).

### Pendiente para v1.18 (backend hardening, también de la revisión)

Candado multi-tab opt-in (#8), snapshot que confía en `vendedor` del cliente (#10), `await` que bloquea la descarga del PDF (#11), `isEmpty` que ignora contacto/dirección (#12), draft duplicado posible / `numero` sin UNIQUE (#14).

---

## v1.16 — Mayo 2026 — Hotfix de 5 bugs críticos (revisión de código)

**Foco**: una revisión de código extra-alta (9 ángulos de búsqueda + verificación adversaria) sobre el arco v1.09–v1.15 destapó 5 bugs críticos — varios en código de esta misma tanda, incluido uno en la propia red de seguridad de v1.10. Esta versión los arregla todos.

### Críticos arreglados

1. **La invariante `pb_excedido` no podía detectar sobrecompensación de cono.** En `computeQuote` el chequeo calculaba `pbCliente` y `pbReal` con el MISMO `item.cono`, así que el término se cancelaba y se reducía a "¿hicimos más película de la declarada?" — incapaz de ver el exceso de cono, que es justo lo que la regla existe para vigilar. **Fix de raíz**: nuevo campo `conoCliente` en `LineItem`, separado del `cono` real de fabricación. El cliente espera `conoCliente`; la compensación sube solo `cono`. Ahora `pbCliente = pnTeoricoCliente + conoCliente` y el chequeo sí detecta cuando el cono real infla el peso bruto arriba de lo esperado. Caso de regresión agregado a `npm run verify`.
   - `LineItemEditor` y el catálogo de conos ahora setean `conoCliente` y `cono` juntos (espejo, como ancho/calibre cliente→real); Tab 2 sube solo `cono`.
   - Migración automática de drafts viejos: `conoCliente ??= cono` al cargar.

2. **Los PDFs mostraban QTY de línea que no cuadraba con el total.** La columna QTY y el total de línea usaban `item.qty`, pero el gran total usaba `rollosPallet × palletTrailer` (lo que usa el motor para revenue/costo). Si no coincidían, **el documento al cliente tenía aritmética que no cerraba**. Ahora ambos PDFs usan `rollosPallet × palletTrailer` consistentemente. (La semántica de venta por Cases/Pallets queda pendiente de confirmar con el área comercial.)

3. **Editar el nombre podía atorarse en loop infinito.** Si la fila de perfil no existía, el `UPDATE` matcheaba 0 filas, devolvía "ok" sin guardar, el modal recargaba y reaparecía para siempre — vendedor encerrado. **Fix**: `/api/profile` ahora hace upsert (crea la fila si falta) y verifica que volvió fila antes de reportar éxito. Migración 007 agrega la policy INSERT.

4. **PDFs podían salir firmados con un genérico cuando el perfil no cargaba.** El modal de onboarding solo aparece si `profile` existe; si era `null` (RLS/sesión), no aparecía y el PDF se firmaba "BioNovaPack LLC". **Fix**: guard duro en los generadores de PDF — sin nombre real de vendedor, se bloquea con aviso.

5. **Cotización multi-trailer se corrompía al recargar.** El draft nunca persistía el arreglo `trailers` (destinos, kg_max, flete por trailer); al recargar se colapsaba a un solo trailer y los items de trailers 2/3 quedaban huérfanos, con flete y destino perdidos. **Fix**: migración 008 agrega columna `trailers` JSONB; el draft ahora persiste y restaura el arreglo completo. Fallback legacy para drafts viejos sin la columna.

### Mejora incluida (de la misma revisión)

- El reset del override de cono en Tab 2 ahora también observa `conoCliente`, `aReal` y `calReal` — evita aplicar un cono "pegado" que ya no corresponde al spec.

### Migraciones requeridas en Supabase (aplicar en orden)

```sql
-- 007_user_profile_self_insert.sql
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 008_cotizaciones_trailers.sql
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS trailers JSONB;
```

### Pendiente (de la misma revisión, no crítico)

Hallazgos "altos/medios" que quedan para próximos pushes: TC hardcodeado `18` en Tab Sugerencia, `handleConePick` revierte la reducción de Tab 2, candado multi-tab opt-in, snapshot hash sobre datos del cliente, fallback EDSA pierde código SKU, y la cola de menores. Ver el reporte de la revisión.

---

## v1.15 — Mayo 2026 — Protección multi-pestaña + fix de persistencia

**Foco**: Push #4 (primera parte). Cierra el último bug del Adversario (autosave race condition multi-tab) y corrige una regresión de v1.13 que dejó la persistencia de contacto/dirección a medias.

### Cambios

- **Protección contra edición simultánea en dos pestañas (concurrencia optimista).** Hasta v1.14, si un vendedor abría el cotizador en dos pestañas y editaba en ambas, la última en guardar **pisaba silenciosamente** el trabajo de la otra (last-write-wins, sin aviso). Ahora cada draft tiene un `updated_at`; cada guardado exige que coincida con la última versión que la pestaña vio. Si otra pestaña ya guardó, el servidor responde **409** y la pestaña conflictiva:
  - Deja de autoguardar (para no pisar el trabajo de la otra).
  - Muestra un aviso rojo *"Cambió en otra pestaña"* con un botón **Recargar**.
  - El vendedor recarga y ve la versión más reciente, sin pérdida silenciosa.
  - Cubre también dos dispositivos distintos (no solo dos pestañas del mismo navegador).
- **Fix de persistencia de contacto/dirección (regresión de v1.13).** En v1.13 anuncié que el contacto y la dirección del cliente persistían entre sesiones. La escritura sí funcionaba (POST guardaba en la BD), pero `loadDraft` en el hook de autosave **descartaba ambos campos al releer** — así que al refrescar seguían apareciendo vacíos. Ahora `loadDraft` los retorna correctamente. La persistencia que prometí en v1.13 ya funciona de verdad.

### Migración requerida en Supabase

```sql
-- supabase/migrations/006_cotizaciones_updated_at.sql
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE cotizaciones SET updated_at = COALESCE(updated_at, created_at, NOW()) WHERE updated_at IS NULL;
```

Sin esta migración el optimistic lock se desactiva (best-effort): el endpoint sigue guardando pero sin la protección multi-tab, porque la columna no existiría.

### Estado del plan post-auditoría

Con v1.15, los **4 bugs del Adversario** quedan cerrados:
- ✅ PB inflado / lReal explotando (v1.09)
- ✅ Sugerencia null silenciosa (v1.13)
- ✅ Flete fantasma de trailer vacío (v1.13)
- ✅ Autosave race multi-tab (v1.15)

### Push siguiente (Push #4 — resto)

- **UI de historial de cotizaciones emitidas** (consume el snapshot de v1.14).
- **Chips de PB esperado vs PB real** visibles en el editor.
- **Bloqueado en respuestas de expertos**: renombrar "Aumento 1/2" (necesita vocabulario de Diego), ambigüedad Cases-vs-rollo (necesita confirmar con Evers si el precio es por rollo o por unidad de venta).

---

## v1.14 — Mayo 2026 — Snapshot inmutable de cotizaciones emitidas

**Foco**: Push #3 (segunda mitad) del plan post-auditoría. Cierra uno de los 4 puntos ciegos sistémicos que cazó la Mesa Redonda: hasta v1.13 no había forma de reconstruir una cotización emitida si los precios EDSA cambiaban después o si el vendedor modificaba el draft. Esta versión guarda un snapshot inalterable cada vez que se genera un PDF.

### Cambios

- **Nueva tabla `cotizaciones_emitidas`** en Supabase con RLS configurada para inmutabilidad:
  - Solo el dueño (o admin) puede SELECT.
  - Solo el dueño puede INSERT (con `user_id = su uid`).
  - **NO hay policies de UPDATE ni DELETE** — una vez guardado, el snapshot no se puede modificar ni borrar vía cliente. Si hay error tipográfico, se emite una nueva cotización con número nuevo; la original queda como registro histórico.
- **`lib/snapshotEmitida.ts`** — helper que construye el snapshot serializable (`{ schemaVersion, snapshotAt, meta, items, trailers, quote }`) y calcula su SHA-256 canonicalizado. El hash sirve como huella de integridad: si alguien con acceso directo a la base modifica el JSON, el hash deja de matchear y queda evidencia auditable.
- **Endpoint `POST /api/cotizaciones/emitidas`** — recibe `{ tipo, numero, snapshot }`, valida, hashea, e inserta. El endpoint NO acepta cambios en el snapshot post-creación; es solo INSERT.
- **Endpoint `GET /api/cotizaciones/emitidas`** — lista las cotizaciones emitidas del usuario (admin ve todas). Por default solo metadata; `?id=UUID` para snapshot completo. Hoy lo consumirá el script de validación; la UI de historial es Push #4.
- **Integración en `page.tsx`** — los handlers `handleGenerateQuote` y `handleGeneratePO` ahora persisten el snapshot **antes** de descargar el PDF. Si el guardado falla (red, RLS, schema desactualizado), se loguea pero NO se bloquea la descarga — la prioridad es entregar el documento al cliente, no obstaculizar la operación por un problema de histórico interno.

### Por qué importa

Tres escenarios reales que esta tabla habilita:

1. **Reclamación del cliente meses después**: "esto no es lo que me cotizaste". Se busca por número de quote, se reabre el snapshot, se confirma exactamente qué se envió.
2. **Cambio de precios EDSA**: Diego sube nuevos precios el mes siguiente. La cotización emitida hace dos semanas sigue siendo reproducible con los precios viejos congelados en su snapshot.
3. **Auditoría / contabilidad**: cualquiera con acceso admin puede listar las cotizaciones emitidas del trimestre y verificar márgenes reales reportados.

### Migración requerida en Supabase

```sql
-- supabase/migrations/005_cotizaciones_emitidas.sql
-- Aplicar en Supabase Dashboard → SQL Editor
```

Sin esta migración el endpoint POST va a fallar — la tabla no existe en producción.

### Push siguiente

- Autosave race condition multi-tab (ETag / `updated_at` optimista).
- UI de historial de cotizaciones emitidas (vista admin + vista vendedor).
- Catálogo nombrado de aumentos + ambigüedad Cases vs rollo + chips PB esperado.

---

## v1.13 — Mayo 2026 — Persistencia + dos bugs del Adversario

**Foco**: Push #3 (primera mitad) del plan post-auditoría. Cierra la limitación que dejó v1.11 (contacto/dirección se perdían al refrescar) y mata dos bugs identificados por el Adversario en la Mesa Redonda.

### Cambios

- **Contacto y dirección del cliente persisten entre sesiones.** Hasta v1.12 estos campos solo vivían en state local — el vendedor refrescaba la pestaña y se borraban. Ahora se guardan en `cotizaciones` como parte del draft autosave (junto con cliente, tc, items). Sobreviven refresh, cierre del browser y reaperturas del draft.
- **Bug del Adversario — sugerencia null sin explicación.** Hasta v1.12, cuando `suggestRealSpec` retornaba `null` (porque faltaba precio, costo base, ancho/calibre, o el `costoTotalKg` salía absurdamente bajo por lookup fallido), la tarjeta de Tab Sugerencia solo decía *"Ingresa precio del cliente y costo base para ver la sugerencia"* — confuso cuando el vendedor ya había llenado todo. Ahora un nuevo helper `diagnoseSuggestion` (en `lib/pricingEngine`) detecta cuál(es) campo(s) específicos están faltando y la tarjeta muestra una lista clara: *"Falta: costo base MXN/kg (¿seleccionaste un cono del catálogo?)"*. Era un sales blocker silencioso.
- **Bug del Adversario — flete fantasma de trailer vacío.** Si el vendedor arrastra todas las líneas de un trailer a otro, el trailer original queda **sin items pero conserva su `transport_usd > 0`**. Ese flete fantasma se sumaba al total del PDF al cliente — el cliente pagaba flete por un camión vacío. Dos correcciones:
  - En `page.tsx`, el cálculo de `transportUSDTotal` ahora solo suma trailers que efectivamente llevan líneas.
  - En `computeQuote`, nueva invariante `flete_fantasma` (warn) que detecta el caso y lo levanta como warning para que el vendedor lo vea antes de descargar el PDF.

### Migración requerida en Supabase

```sql
-- supabase/migrations/004_cotizaciones_contacto_direccion.sql
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS contacto VARCHAR(255);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS direccion TEXT;
```

Sin esto, el endpoint `/api/cotizaciones/draft` va a rechazar el save porque las columnas no existen en producción. Aplicar en Supabase Dashboard → SQL Editor.

### Casos de prueba agregados a `npm run verify`

- Trailer fantasma con flete asignado pero sin líneas (debe dispararse `flete_fantasma`).

### Push siguiente del plan

- Snapshot inmutable de cotizaciones emitidas (Push #3 segunda mitad).
- Autosave race condition multi-tab (ETag/updated_at).

---

## v1.12 — Mayo 2026 — Captura intrusiva del nombre del vendedor

**Foco**: cerrar el gap que dejó v1.11 — el vendedor "real" en los PDFs venía de `profile.name` de Supabase, pero ese campo se queda `null` por default porque el magic link solo captura email. En v1.11 los PDFs salían firmados con `email.split('@')[0]` (ej. `evers.lopez` en vez de `Evers López`). Esta versión obliga a capturar el nombre completo.

### Cambios

- **Modal bloqueante al primer login**. Si `profile.name` está vacío cuando un vendedor entra al cotizador, aparece un modal que NO se puede cerrar sin escribir el nombre completo. Incluye texto claro: "este nombre aparece como firma en cada cotización y orden de compra que generes". Una sola vez por usuario en toda la vida de la cuenta.
- **Botón "editar nombre" en el TopBar**. Junto al avatar/email del usuario hay un ícono de lápiz que abre el mismo modal en modo edición (cancelable). Para que cualquiera corrija un error tipográfico después.
- **Nuevo endpoint `PATCH /api/profile`**. Recibe `{ name }`, valida (no vacío, ≤200 chars), y hace `UPDATE user_profiles SET name = ?` del usuario autenticado. NO acepta cambios a `role` ni `email` — un vendedor no puede auto-promoverse a admin aunque la RLS lo permita a nivel de fila.
- **Migración `003_user_profile_self_update.sql`**: nueva policy `users_update_own_profile` en `user_profiles` que permite UPDATE de la propia fila (`auth.uid() = user_id`). Necesaria porque hasta v1.11 solo había policies de SELECT.

### Cómo se aplica la migración

```sql
-- En Supabase dashboard → SQL editor → pegar y correr:
-- supabase/migrations/003_user_profile_self_update.sql
```

Sin esta migración el endpoint falla con RLS rejection en producción. El admin (Fabrizzio) tiene que aplicarla manualmente en Supabase.

### Push siguiente

- Snapshot inmutable de cotizaciones emitidas (Push #3 del plan).
- Persistir contacto/dirección en draft autosave (task #18).
- Bugs del Adversario (autosave race multi-tab, `costoTotalKg ≤ 1` silencioso, flete fantasma trailer vacío).

---

## v1.11 — Mayo 2026 — Vendedor real en PDFs + datos del cliente editables

**Foco**: Push #2 del plan post-auditoría. Cambios visibles al vendedor que cierran tres fallas de identidad/defaults que el equipo reportaba o sospechaba.

### Cambios

- **El nombre del vendedor en cada PDF ahora es el del usuario logueado.** Hasta v1.10 todas las cotizaciones y POs salían firmadas `Evers Lopez` (un default hardcoded del primer test). Ahora se lee `profile.name` de `useAuth()` y, si no está, cae a la parte local del email del usuario. Cada vendedor firma sus propios documentos.
- **Cliente / contacto / dirección sin defaults de prueba.** Hasta v1.10 si un vendedor no editaba estos campos, el PDF salía con `Chad Bartling` y `EVANS FREIGHT — 2060 Williams Rd, Columbus OH` (el cliente de prueba inicial). Ahora el formulario inicia limpio.
  - Cliente: input ya existente, ahora sin placeholder específico.
  - **Contacto cliente**: input nuevo al lado de Cliente en el TopBar.
  - **Dirección de entrega**: textarea de 2 renglones debajo del KPI strip, multilínea (calle / ciudad / país).
  - Los tres campos se editan en pantalla y se mandan al PDF de cotización.
- **Eliminado el input "Transporte (USD)" fantasma del TopBar.** En v1.08 multi-trailer el flete pasó a editarse por bloque de trailer en el sidebar izquierdo. El input del TopBar quedó como readonly informativo en v1.09, pero seguía ocupando espacio y confundiendo. Hoy se elimina del header. Para ver el flete total sigue disponible la barra de capacidad por trailer.

### Limitación conocida

- Los campos `contacto` y `direccion` persisten **solo en sesión**. Si el vendedor refresca la página, se pierden. El draft autosave actual (`/api/cotizaciones/draft`) todavía no los guarda — se arregla en el push siguiente con extensión del schema y endpoint.

### Push siguiente del plan post-auditoría

- Snapshot inmutable de cotizaciones emitidas (guardar inputs/precios/PDFs congelados al momento del envío).
- Persistir `contacto/direccion` en el draft autosave.
- Bugs del Adversario (autosave race multi-tab, `costoTotalKg ≤ 1` silencioso, flete fantasma trailer vacío).

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
