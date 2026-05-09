# Guía de uso — Cotizador SICE BioNovaPack

> **Versión:** v0.1.0 BETA · **Última actualización:** Mayo 2026

Esta guía explica paso a paso cómo usar el cotizador. Está dividida en dos secciones:
- **Para vendedores** (Evers y equipo comercial)
- **Para administradores** (Diego y Fabrizzio)

Si tienes dudas o algo no funciona, usa el botón **"Reportar"** abajo a la derecha en cualquier pantalla del cotizador.

---

## Acceso

Abre el navegador (Chrome / Safari / Edge) y entra a:

```
https://cotizaci-nes-fabrizzioguajardo-4543s-projects.vercel.app/cotizador
```

> *La URL exacta puede variar — Fabrizzio te la mandará por correo o WhatsApp.*

📷 **[CAPTURA 1 — pantalla principal del cotizador, mostrando los dos tabs y el sidebar de líneas]**

Te recibe la pantalla del cotizador con un cliente de ejemplo cargado (Level Packaging). Para empezar de cero, edita los campos o agrega líneas nuevas.

---

# Parte 1 — Para vendedores

## 1. Conoce la pantalla principal

📷 **[CAPTURA 2 — vista completa de la pantalla con anotaciones numeradas]**

Tres áreas principales:

| # | Área | Función |
|---|---|---|
| 1 | **Top bar** (arriba) | Cliente, fecha, TC, costo de transporte, totales del camión |
| 2 | **Sidebar izquierdo** | Lista de productos del pedido (líneas) |
| 3 | **Panel central** | Editor de la línea seleccionada — dos tabs: **Pedido del cliente** y **Sugerencia para planta** |

---

## 2. Llenar los datos generales del camión

📷 **[CAPTURA 3 — top bar con flechas señalando cada campo]**

Antes de empezar a cotizar productos:

1. **Cliente** — escribe el nombre del cliente (ej. *Level Packaging LLC*)
2. **TC (MXN/USD)** — el tipo de cambio del día. Default 18.5 — actualízalo cada mañana
3. **Transporte (USD)** — costo del flete completo del trailer. Ej. 6900 USD para Ohio, 5871 para Monterrey

> 💡 **Tip:** En el lado derecho del top bar verás 4 indicadores en vivo: **Revenue**, **Costo**, **Utilidad** y **KG trailer**. Se actualizan automáticamente cuando cambias cualquier dato.

---

## 3. Agregar / editar productos del camión

### Sidebar de líneas

📷 **[CAPTURA 4 — sidebar mostrando varias líneas + botón "Nueva línea"]**

Cada producto del camión es una **línea**. En el sidebar izquierdo:

- Click una línea para editarla
- Botón **"Nueva línea"** abajo para agregar otra
- Hover sobre una línea: aparecen botones de **duplicar** 📋 y **borrar** 🗑

> Los puntos de color (verde / amber / rojo) al lado de cada línea muestran el **margen** de esa línea de un vistazo:
> - 🟢 Verde: margen ≥ 12% (OK)
> - 🟡 Amber: margen entre 0% y 12% (bajo)
> - 🔴 Rojo: pérdida (margen negativo)

---

## 4. Tab 1 — Pedido del cliente

Este es donde vives el 90% del tiempo. Se divide en 4 secciones:

### 4.1 Spec declarado al cliente (cyan)

📷 **[CAPTURA 5 — sección cyan "Spec declarado al cliente" con flechas a cada campo]**

Aquí pones lo que el cliente pidió **literal en el PO**:

- **Ancho** (in) — ej. 18, 19.7, 20
- **Calibre** (GA) — ej. 70, 80, 90, 120
- **Largo** (ft) — lo que dice la etiqueta y la cotización al cliente
- **Tipo de resina** — Virgen / Reciclado / Color
- **Color** — Clear / Orange / Black / etc.

> ⚠️ Estos valores son los que aparecen en el **invoice y la cotización al cliente**. NO son lo que se fabrica realmente.

### 4.2 Selector de cono (sugerencia automática)

📷 **[CAPTURA 6 — panel "Opciones de fabricación" con cards de cada cono]**

Apenas llenas ancho/calibre/largo, **aparece automáticamente** un panel con todas las opciones de cono disponibles para ese producto.

Cada card muestra:

- **Cono** (kg) — peso del cono
- **PN / PB** — peso neto y peso bruto del rollo
- **Rollos por tarima** — del archivo de tarima de Diego
- **Precio EDSA estimado** — para saber cuánto te va a costar
- ⭐ **Histórico** — si esta combinación ya se ha producido antes (existe en el catálogo de Diego)

**Click cualquier card** → el sistema auto-llena:
- Cono
- Rollos por tarima
- Costo base MXN/kg
- Master color (si aplica)
- Intenso (si aplica)

> 💡 **Tip:** Si ves la marca ⭐ Histórico, **prefiere esa opción** — es lo que Diego ya está acostumbrado a fabricar y es más rápido en planta.

### 4.3 Configuración logística

📷 **[CAPTURA 7 — sección morada "Configuración logística"]**

- **Cono (kg)** — se autollenó al elegir cono arriba; puedes ajustar manual
- **Rollos / tarima** — se autollenó; ajusta si necesitas otra config
- **Tarimas / trailer** — cuántas tarimas de este producto entran en el camión

> 💡 **Tip:** El total `rollos × tarimas` te dice cuántos rollos vas a entregar de esta línea.

### 4.4 Build-up de costo (MXN/kg)

📷 **[CAPTURA 8 — sección amber con todos los adders]**

Aquí ves cada componente del costo. Cada uno tiene un link **"catálogo"** al lado que abre el catálogo central:

| Adder | Cuándo se usa |
|---|---|
| **Base EDSA** | Costo del stretch film (47.08 virgen, 38.45 R-V, etc.) |
| **Master color** | Si el producto es de color (~1.5 MXN/kg típico) |
| **Intenso** | Para colores con pigmento concentrado |
| **Aditivo** | UV (3.9 MXN/kg para 12 meses), VCI, antiestático |
| **Aumento 1 / 2** | Escalones de planta cuando aplica |
| **Refilado** | Si hay slitting/rewinding (1.3-3.0 típico) |
| **Caja blanca** | Costo de la caja por unidad (ej. 14.43 MXN por caja) |

> ⚠️ **El badge verde "Match exacto" / amber "Interpolado"** te indica si el costo viene directo del Excel de Diego o si fue aproximado. Si dice "Interpolado", **verifica con Diego** antes de mandar la cotización.

### 4.5 Precio negociado con el cliente (verde)

📷 **[CAPTURA 9 — sección verde con campo de precio grande y métricas]**

- **Campo de precio grande** — pon el precio en USD por unidad (case / roll / pallet) que negociaste con el cliente
- A la derecha verás: **Costo USD**, **Margen $**, **Price/lb**

> 💡 **Tip:** El precio se compara automáticamente contra el costo. Si el margen baja del 12%, te aparece amber "Bajo mínimo" y deberías validar con tu jefe antes de mandar.

---

## 5. Tab 2 — Sugerencia para planta

📷 **[CAPTURA 10 — Tab 2 con slider de margen y card de sugerencia]**

Este tab es la **innovación clave** del cotizador.

**Problema que resuelve:** El cliente pide 1000 ft pero a tu margen objetivo solo le puedes mandar 715 ft. ¿Qué le digo a Diego?

### Cómo usarlo

1. **Slider de margen objetivo** arriba. Default 12%
2. Mueve el slider — el sistema calcula en vivo:
   - **Largo real** que debes pedir a Extruidos para alcanzar ese margen
   - **Reducción de material** vs el spec declarado
   - **Price/lb entregado** al cliente

3. Si te gusta la sugerencia:
   - Click **"Aplicar sugerencia al spec real"** → actualiza tu línea
   - Click **"Cotización al cliente (PDF)"** → descarga el PDF con el spec **declarado**
   - Click **"PO para Extruidos (PDF)"** → descarga el PDF con el spec **real**

> ⚠️ **El sistema te avisa con warnings** si:
> - La reducción es > 35% (revisar con Jennifer)
> - El price/lb sale muy bajo o alto del rango histórico
> - El largo real es muy corto (<500 ft)

---

## 6. Reportar bugs y sugerencias

📷 **[CAPTURA 11 — botón flotante "Reportar" en la esquina inferior derecha]**

Al pie de la pantalla, abajo a la derecha, hay un botón amber redondo que dice **"Reportar"**.

Al darle click:
- Se abre tu app de correo con un mensaje pre-rellenado
- Solo escribe arriba qué viste / qué no funcionó
- Click **Enviar**

El mensaje llega a Fabrizzio quien revisa y responde.

> 💡 **Tip:** Si el botón no abre el correo (por falta de configuración del Mac), mándame WhatsApp / mensaje directo. Cualquier reporte es útil aunque sea "esto está confuso" sin ser un bug.

---

# Parte 2 — Para administradores (Diego y Fabrizzio)

## 7. Acceder al panel de admin

📷 **[CAPTURA 12 — botón "Admin de costos" en el top bar]**

Arriba a la derecha en el cotizador hay un botón **"Admin de costos"**. Click lleva a `/cotizador/admin`.

> ⚠️ **Por ahora todos los usuarios ven este botón.** En la siguiente versión solo lo verán Diego y Fabrizzio.

---

## 8. Subir los 3 archivos de Diego

📷 **[CAPTURA 13 — página /cotizador/precios con 3 zonas de upload]**

Click **"Carga Excel EDSA"** en el top bar (o desde Admin → "Cargar archivos"). Te lleva a la página de upload con 3 zonas separadas:

### 8.1 EDSA Extruidos (verde)
- Acepta el archivo *Precios de producto EDSA – Extruidos.xlsx*
- Drag-drop el archivo o click para seleccionar
- El servidor lo parsea y muestra stats: filas, hojas procesadas, warnings

### 8.2 Color (cyan)
- Acepta *Precios Color.xlsx*
- Mismo flujo

### 8.3 Tarima (morado)
- Acepta *Cantidad Producto por Tarima.xlsx*

📷 **[CAPTURA 14 — zona de upload después de cargar exitosamente, con badge "Match" + stats]**

> 💡 **Cada zona tiene un link "Descargar template limpio"** abajo. Diego puede usar ese template más simple en lugar de su formato actual (opcional, ambos funcionan).

---

## 9. Catálogo central de adders

📷 **[CAPTURA 15 — pantalla /cotizador/admin con las 8 tabs en el header]**

En `/cotizador/admin` hay 8 tabs:

| Tab | Para qué |
|---|---|
| **Base EDSA** | Tabla de precios actualmente cargados, con filtro y frescura |
| **Master color** | Costos de masterbatch por color (Orange, Black, etc.) |
| **Intenso** | Pigmento concentrado |
| **Aditivos** | UV, VCI, antiestático |
| **Caja blanca** | Costo de cajas con calculadora MXN/caja → MXN/kg |
| **Banding** | Marca de plástico al final del cono |
| **Refilado** | Costos de slitting / rewinding |
| **Aumentos** | Escalones 1ero / 2do / 3ro |

### Agregar una entrada nueva

📷 **[CAPTURA 16 — formulario de "Nueva entrada" en la tab de Master color]**

Click **"+ Nueva entrada"** en cualquier tab:

1. **Nombre / identificador** — ej. "Orange", "UV 12 month"
2. **Precio MXN/kg** — el costo unitario
3. **Fuente** — WhatsApp / Email / Excel / Manual
4. **Nota / referencia** — el mensaje literal o link (importante para auditoría)

Para **Caja blanca** específicamente, el formulario tiene 3 campos extra (caja_mxn, kg_caja, rollos_caja) y calcula MXN/kg automáticamente.

> 💡 **Tip:** El campo **Nota / referencia** es CLAVE. Pone el mensaje literal del proveedor o el link al correo. Así puedes auditar de dónde vino cada precio meses después.

### Frescura de los datos

📷 **[CAPTURA 17 — tabla con columna "Última actualización" mostrando colores]**

Cada entrada tiene una columna **"Última actualización"** con semáforo:
- 🟢 Verde: ≤ 30 días — fresco
- 🟡 Amber: 31-60 días — revisar
- 🔴 Rojo: > 60 días — desactualizado

En el top bar del cotizador hay un badge global **"Datos hace X días"** que muestra la frescura del dato más viejo. Click → te lleva al admin.

### Marcar como obsoleta

📷 **[CAPTURA 18 — fila de la tabla con el botón rojo de "Marcar como obsoleta"]**

Para retirar un precio sin borrar (mantener historial), click el ícono 🗑 rojo. La entrada se marca `vigente=false` pero queda en BD.

---

# FAQ — preguntas comunes

### "Mi producto no aparece en las opciones de cono"

Si pones un spec que Diego nunca ha producido, el panel dice "No hay opciones para [spec]". Llena el cono y costos manualmente, o pídele a Diego que valide la viabilidad.

### "El costo base que sale me parece raro"

Compara con el catálogo. Posibilidades:
1. El precio del Excel está desactualizado → revisa frescura en el admin
2. Es un contrato especial (ej. Level Packaging) → sobrescribe el campo `costoBase` manualmente
3. El producto no está en el catálogo → el sistema interpoló (badge amber) → verifica con Diego

### "Quiero ver mi cotización después"

⚠️ **Por ahora la persistencia de cotizaciones está limitada.** En la próxima versión cada vendedor tendrá su propio historial buscable.

### "El cotizador da números diferentes a mi Excel"

El cotizador da los precios estándar del Excel de Diego. Si tu cotización Excel tiene ajustes manuales (descuentos por contrato, mezclas R-V especiales, etc.), tienes que aplicarlos manualmente en el campo `costoBase`.

### "Puedo cambiar el TC del día?"

Sí, en el top bar arriba. Cámbialo cada mañana — toda la cotización se recalcula en vivo.

### "Quiero cotizar en pesos"

Por ahora todo se muestra en USD para el cliente y MXN para los costos. Podemos agregar opción dual si es importante.

---

# Próximas funcionalidades (en desarrollo)

- 🔐 **Login con email** — cada vendedor tiene su sesión, no se mezclan cotizaciones
- 👥 **Roles** — solo Diego y Fabrizzio ven el panel admin
- 💾 **Auto-save** — borradores se guardan cada 2 segundos
- 🔍 **Historial buscable** — "muéstrame las cotizaciones de Level Packaging del último mes"
- 📞 **WhatsApp directo** — botón "Enviar al cliente por WhatsApp"
- 🔔 **Alertas de cambio de costo** — si Diego sube precios nuevos, notificación a vendedores con cotizaciones pendientes

---

# Contacto y reporte de bugs

- **Botón "Reportar"** — abre correo con contexto pre-rellenado a `fabrizzio.guajardo@bionovapack.com`
- **WhatsApp** (urgentes) — Fabrizzio
- **Correo** — `fabrizzio.guajardo@bionovapack.com`

> *Esta es la versión BETA. Es esperado que encuentres bugs y cosas confusas. Cada reporte ayuda a mejorar la herramienta para todo el equipo.*
