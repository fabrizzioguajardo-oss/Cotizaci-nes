# Changelog — Cotizador SICE

Registro de cambios entre versiones. Las versiones más recientes aparecen primero.

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
