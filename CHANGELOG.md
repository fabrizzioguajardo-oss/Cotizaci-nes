# Changelog — Cotizador SICE

Registro de cambios entre versiones. Las versiones más recientes aparecen primero.

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
