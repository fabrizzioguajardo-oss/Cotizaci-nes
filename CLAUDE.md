# SICE Cotizador — Contexto para Claude Code

Este archivo lo lee Claude Code automáticamente al iniciar una sesión en esta carpeta.
Aquí vive todo el contexto del proyecto para que cualquier sesión nueva (independiente de
la cuenta de Anthropic) pueda continuar sin re-derivar nada.

Si vas a hacer cambios grandes en este archivo, ten en cuenta que está en git: NO pongas
precios, emails de clientes, secrets, ni API keys. Solo arquitectura, convenciones y
domain knowledge.

---

## TL;DR — qué es este proyecto

**SICE Cotizador** es la herramienta interna de BioNovaPack LLC (proveedor de stretch
film) para reemplazar un flujo de cotización en Excel con una web app. Hace 3 cosas:

1. **Tab 1 — Cotizar con el spec real del cliente** (lo que el cliente cree que recibe).
2. **Tab 2 — Sugerir un spec reducido para fabricar** (algoritmo inverso: dado el precio
   negociado, despeja largo/cono real para alcanzar margen objetivo).
3. **Admin — Cargar Excels de Diego** (EDSA, Color, Tarima) que alimentan el lookup de
   precios y catálogo. Diego = supply chain, Fabrizzio = founder/admin, los demás =
   vendedores.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind + Supabase + Vercel**.

---

## Reglas de oro — NO ROMPER NUNCA

1. **Precios = ultra-confidenciales.** Jamás van a GitHub. Los Excels de Diego viven
   solo en Supabase Storage o en `public/data/precios.json` (gitignored). El
   `.gitignore` ya bloquea `.env*`, `*.xlsx`, `public/data/precios.json` y la carpeta
   `private/`. **Antes de cada commit revisar `git status` para confirmar.**
2. **`lib/version.ts` es la Single Source Of Truth de la versión.** Se cambia ahí y se
   propaga automático a TopBar, FeedbackModal, login page.
3. **PN facturable: redondeo medio-para-abajo a 2 decimales** (regla corregida POR
   DIEGO en la validación del 10-jun-2026: "si es ≤.5 hacia abajo y si >.5, hacia
   arriba"; hasta v2.1 se truncaba con Math.floor). Usar `calcPNFacturable()` en
   cualquier flujo de costo/factura/kg trailer.
4. **Diego calcula costo por PN (peso neto), NO PB.** Verificado contra camiones reales.
   La fórmula es `costoRollo = (costoBase + transp/kg) * PN`.
5. **Tolerancia natural de planta = ±0.5% del largo.** Más allá es decisión comercial
   intencional (subir margen reduciendo material). POLÍTICA DIEGO (10-jun-2026):
   reducción saludable hasta 5%; >5% requiere aprobación de JN; >10% fuera del
   ideal ("35% sería bastante insano"). Cargo EDSA: +2.5 MXN/kg si PN < 1.3 kg.
   Intenso: +1.25 MXN/kg. Márgenes por volumen y forma de pago: tabla
   MARGEN_POLITICA (PUE 18/14/12.5/11, PPD 22/17/15.5/14.5) — BNP maneja otros
   porcentajes (pendiente visita CDMX); el mínimo operativo sigue en 12%.
6. **Multi-trailer**: el flete se distribuye SOLO entre las líneas de cada trailer
   individual (no global). Cada trailer tiene su propio `transport_usd` y `destino`.
7. **Admin emails con override**: `lib/adminEmails.ts` mantiene un fallback hardcoded
   por si la tabla `user_profiles` está caída. No quitar.
8. **RLS de Supabase es estricto**: el cliente API anon NO ve nada. Toda lectura/escritura
   protegida usa `getAuthedSupabase()` con cookies del usuario. Si una query devuelve 0
   rows cuando debería tener datos, casi siempre es RLS.

---

## Glosario de dominio (stretch film)

| Término | Significado |
|---|---|
| **PN** | Peso Neto del rollo (kg). Solo la película, sin cono. Diego factura por PN. |
| **PB** | Peso Bruto del rollo (kg). PN + cono. Lo que el cliente pesa en mano. |
| **Cono** | Tubo de cartón en el centro del rollo (kg). Hay tamaños estándar: 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.44, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0 |
| **GA / calibre** | Gauge = espesor de la película (mil-thousandths × 10). Típicos: 60–90. |
| **Largo / L** | Largo del rollo en pies (ft). |
| **Ancho / A** | Ancho del rollo en pulgadas (in). |
| **Cliente spec** | Lo declarado en la cotización/invoice/PO. Ej: `3″ × 70GA × 1000′`. |
| **Real spec** | Lo que realmente se fabrica (potencialmente reducido). Solo el **largo** difiere — `aReal = aCliente`, `calReal = calCliente`. Solo `lReal ≤ lCliente`. |
| **Compensación de cono** | Estrategia: al reducir `lReal`, el rollo pesa menos del PB cliente. Subir el cono compensa para que `PB_real ≈ PB_cliente`. El cliente pesa y "siente" lo esperado. |
| **EDSA** | Proveedor de extrusión histórico de BioNovaPack. Sus precios son la base. |
| **Reducción de material** | `1 - (PN_real / PN_cliente)`. Política Diego: saludable hasta 5%; >5% aprueba JN; >10% fuera del ideal. |

**Fórmula PN raw**: `ancho × largo × calibre × 1.8148e-6` (verificado contra todos los
camiones reales). Versión facturable: redondeo medio-para-abajo a 2 decimales (`Math.ceil(raw*100 - 0.5 - 1e-9)/100`).

**Fórmula Diego en Excel**: `=REDONDEAR(((B*(C/100)*D)/2500)*0.4536, 2)`. Redondeo
confirmado por Diego (10-jun-2026): medio-para-abajo (≤.5 baja, >.5 sube). La vieja
premisa "siempre trunca (no regalar producto)" quedó corregida — `calcPNFacturable`
ya NO usa Math.floor.

---

## Math del algoritmo inverso (Tab 2)

Dado precio cliente, costoBase, transpKgMXN y marginTarget → despeja `lReal`:

```
costoRolloUSD_max  = precio / (1 + marginTarget)
costoRolloMXN_max  = costoRolloUSD_max * tc
costoTotalKg       = costoBaseTotal + transpKgMXN
pnReal_needed      = costoRolloMXN_max / costoTotalKg
lReal_raw          = pnReal_needed / (aReal * calReal * 1.8148e-6)
lReal              = Math.ceil(lReal_raw)        // ceil para garantizar margen
pnReal_facturable  = calcPNFacturable(aReal, lReal, calReal)  // redondeo medio-para-abajo
```

**CAP importante**: si `lReal_raw >= lCliente`, el precio ya cubre el spec del cliente
con el margen objetivo → devolver `lReal = lCliente`, `conoSugerido = cono` (no
compensar), `reduction = 0`, warning explicativa. Este cap previene un bucle positivo
que antes hacía explotar el largo sugerido (1000 → 2540 → ... → 1.8e8) al picar conos
alternativos.

**Compensación de cono**:
```
pnReducido    = pnTeoricoCliente - pnReal_facturable
conoIdeal     = cono_cliente + pnReducido
conoSugerido  = findClosestStandardConoDown(conoIdeal)  // estandar más cercano sin exceder
```

---

## Mapa de carpetas

```
sice-cotizador/
├─ app/
│  ├─ cotizador/               # rutas del cotizador
│  │  ├─ page.tsx              # main page con multi-trailer state
│  │  ├─ admin/                # admin (Fabrizzio + Diego)
│  │  │  ├─ page.tsx           # tabs: base / master / intenso / aditivo / caja / banding / refilado / aumento
│  │  │  └─ components/        # CatalogSection, BasePricesView (lee /api/data/current)
│  │  ├─ precios/              # /cotizador/precios — upload de Excels
│  │  └─ components/           # LineItemEditor, TrailerStack, TrailerBlock, DraggableLineItem,
│  │                          #   SuggestionCard, RealSpecEditor, ConeSelectorPanel,
│  │                          #   ToleranceWarning, FeedbackModal, FeedbackButton, etc.
│  ├─ api/
│  │  └─ data/
│  │     ├─ current/route.ts   # GET /api/data/current — lee Supabase price_data_files
│  │     └─ upload/route.ts    # POST /api/data/upload — parsea Excel y guarda en Supabase
│  ├─ login/                   # magic link + check-email
│  └─ auth/callback/route.ts   # PKCE callback
├─ lib/
│  ├─ pricingEngine.ts         # calcPN, calcPNFacturable, calcLineItem, suggestRealSpec,
│  │                          #   calcAllTrailerTotals, STANDARD_CONOS, constantes
│  ├─ lookupEngine.ts          # lookupPrice, lookupConoOptions, buildAutoFill
│  ├─ parsers/                 # edsaParser, colorParser, tarimaParser, flatTemplateParser
│  ├─ dataStore.ts             # singleton + hook usePriceData (Supabase → fallback static)
│  ├─ supabaseServer.ts        # cliente con cookies (Node runtime)
│  ├─ supabaseClient.ts        # cliente browser
│  ├─ useAuth.ts               # hook auth con role + admin fallback
│  ├─ adminEmails.ts           # whitelist hardcoded (fallback)
│  ├─ version.ts               # APP_VERSION = SSOT
│  ├─ format.ts                # fmtUSD, fmtMXN, fmtNum, fmtPct, fmtInt
│  └─ freshness.ts             # FreshnessBadge helpers
├─ middleware.ts               # Edge runtime, refresh session, protege rutas
├─ supabase/migrations/        # 001_initial.sql, 002_auth_and_roles.sql, ...
├─ scripts/                    # verify-truck, build-static-data, convert-to-templates, etc.
├─ public/data/                # GITIGNORED — precios.json fallback estatico
├─ private/                    # GITIGNORED — Excels de Diego para tests locales
├─ types/index.ts              # LineItem, Trailer, CalcResult, SuggestionResult, etc.
├─ CHANGELOG.md
└─ CLAUDE.md                   # ← este archivo
```

---

## Comandos cheat sheet

```bash
# Desarrollo local
npm run dev                    # arranca en localhost:3000
npm run build                  # build de producción (lo mismo que corre Vercel)
npm run lint                   # ESLint
npm run typecheck              # tsc --noEmit
npm run verify                 # red de seguridad: invariantes margen/PB + paridad PDFs (cliente + Extruidos)

# Scripts útiles
npx tsx scripts/build-static-data.ts          # genera public/data/precios.json desde los Excels en private/
npx tsx scripts/verify-truck-10.ts            # valida algoritmo vs 10mo camion real
npx tsx scripts/convert-to-templates.ts       # convierte Excels legacy a templates planos
npx tsx scripts/generate-blank-templates.ts   # templates en blanco para Diego

# Git workflow estándar
git status                     # SIEMPRE primero
git diff                       # revisar cambios
git log --oneline -5           # ver estilo de commits
git add <archivos específicos> # NUNCA `git add .` (puede colar .env)
git commit -m "..."            # con HEREDOC para multi-línea
git push origin main           # auto-deploya Vercel

# Verificación post-push
gh run list --limit 3          # status de GitHub Actions (si hay)
# Vercel deploy se ve en https://vercel.com/dashboard
```

---

## Cómo hacer un commit + push (el flujo correcto)

1. `git status` → revisar qué cambió. **Confirmar que no hay `.env`, `*.xlsx`, ni
   `precios.json` en la lista.**
2. `git diff` → leer los cambios uno por uno.
3. `git log --oneline -5` → imitar el estilo (prefix `feat:`, `fix:`, `chore:`, `docs:`).
4. Si la versión cambió: actualizar `lib/version.ts` y agregar entrada al `CHANGELOG.md`.
5. `git add <files específicos>` — **listar uno por uno**, nunca usar `.` o `-A`.
6. `git commit` con HEREDOC:
   ```bash
   git commit -m "$(cat <<'EOF'
   fix: descripción breve del cambio

   - bullet con detalle 1
   - bullet con detalle 2
   - bullet con detalle 3

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```
7. `git push origin main`.
8. Vercel detecta el push, builda, deploya en ~90s. Verificable en el dashboard.

**Nunca**: `--no-verify`, `--amend` (a menos que el usuario lo pida explícito), `git
push --force` a main, `git add .`.

---

## Auth y roles (Supabase)

- **Magic link via PKCE flow**. Si no llega el email, revisar rate limits de Supabase
  (free tier limita ~3-4 por hora).
- **`user_profiles` table** con trigger `handle_new_user` que crea un row al
  registrarse.
- **Admin check**: prioridad 1 = `user_profiles.role === 'admin'`, prioridad 2 = email
  en `lib/adminEmails.ts` (fallback hardcoded).
- **RLS gotchas conocidos**:
  - `42P17 infinite recursion`: pasa cuando una RLS policy queryea la misma tabla. Ya
    se dropeó `admins_see_all_profiles` por eso. No volver a crearla recursiva.
  - `/api/data/upload` y `/api/data/current` **DEBEN** usar `getAuthedSupabase()` con
    cookies del request, no el cliente anon. Si usas anon, las queries devuelven 0
    rows aunque la data esté.

---

## Setup de GitHub y autenticación (no cambia entre cuentas de Claude)

**Importante**: la conexión con GitHub vive en la Mac del usuario, NO en la cuenta de
Anthropic. Cuando el usuario hace /logout y /login con otra cuenta de Claude, los
credenciales de git siguen exactamente igual. Claude solo ejecuta `git push` — el
sistema operativo es quien autentica.

Setup conocido del repo:

```
remote:       origin → https://github.com/fabrizzioguajardo-oss/Cotizaci-nes.git
protocolo:    HTTPS  (no SSH, no gh-cli)
identidad:    Fabrizzio <guajardofabrizzio@gmail.com>
default br:   main
auth method:  macOS Keychain (osxkeychain default)
```

**No instalar/cambiar nada** a menos que el usuario explícitamente lo pida. Si un push
falla con `authentication failed`, decirle al usuario que probablemente Keychain le va
a pedir el password de GitHub o que regenere su Personal Access Token en
https://github.com/settings/tokens.

Verificación rápida del estado:
```bash
git remote -v                     # debe apuntar al repo correcto
git config user.email             # debe ser el del autor esperado
git fetch origin --dry-run        # si corre sin pedir password, Keychain OK
```

## Vercel deploy

- **Auto-deploy**: cada push a `main` → build → producción.
- **Deployment Protection**: SI está activado, bloquea a usuarios anónimos con login
  de Vercel. Para que vendedores y Diego puedan entrar: Settings → Deployment
  Protection → **disable "Vercel Authentication"** (requiere plan Pro o trial).
- **Environment vars** en Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, etc. Cambiar ahí, no en código.
- **Rollback rápido**: dashboard → Deployments → versión verde anterior → "Promote to
  Production".

---

## Estado actual del proyecto

- **Versión vigente**: ver `lib/version.ts` (`APP_VERSION`).
- **CHANGELOG**: ver `CHANGELOG.md` (orden: más nuevo arriba).
- **Última gran feature**: multi-trailer con drag-and-drop (@dnd-kit) y multi-destino.
- **Últimos bug fixes importantes**:
  - Cono picker en Tab 2 ya no acumula `lReal` (solo cambia `cono`).
  - `suggestRealSpec` cap'ea `lReal` a `lCliente` cuando el precio ya cubre spec.
  - PN se factura truncado a 2 decimales (`calcPNFacturable`, convención Diego).
  - FeedbackModal limpia el textarea al cerrar.

---

## Gotchas y cosas que ya se rompieron antes

1. **Edge runtime no puede importar de `lib/supabaseServer.ts`** (usa `next/headers`).
   El middleware y `auth/callback/route.ts` **inlinean** el cliente Supabase con
   `createServerClient` directo.
2. **PN vs PB en pricing** (CRÍTICO): Diego usa PN, no PB. El bug original
   multiplicaba por PB → costo inflado.
3. **`utilidadGlobal` daba -100% cuando no había precio**: arreglado en
   `calcTrailerTotals` chequeando `revenue > 0 && cost > 0`.
4. **Autosave fantasma**: `draftId` se cerraba en stale closure → se guardaba 2 veces.
   Arreglado con `draftIdRef`.
5. **Upload sin sesión**: `/api/data/upload` usaba anon → RLS rechazaba. Ahora usa
   `getAuthedSupabase()`.
6. **`/api/data/current` devolvía 204 si faltaba algún kind**: ahora devuelve partial
   data (puede tener solo EDSA, sin Tarima, etc.).
7. **`buildAutoFill` no filtraba por color**: agregado parámetro `color` que prefiere
   match exacto y cae a `'generic'/null` si no hay.

---

## Cómo pedirle cosas a Claude (prompts útiles)

```
"Bump a vX.YZ. Actualiza lib/version.ts, agrega entrada al CHANGELOG con los cambios
desde el último push, y haz commit + push a main."
```

```
"Antes de pushear corre npm run build localmente y dime si pasó. Si falló, arregla
los errores antes del push."
```

```
"Lee los logs del último build de Vercel y dime qué falló."
```

```
"Revisa los últimos 3 commits, dime qué hace cada uno en lenguaje plano, y dime si
hay algo riesgoso para producción."
```

```
"Crea una rama nueva `fix/xxx`, haz los cambios ahí, y abre un PR a main en lugar
de pushear directo."
```

---

## Autoridad en reglas de negocio

**La palabra de Diego (supply chain) es ley** en reglas de costo y política
(instrucción de Fabrizzio, 10-jun-2026). Sus respuestas a la validación del
proceso están en los comentarios del PDF "Proceso Cotizacion - COMENTARIOS DRAN"
(Downloads) y resumidas en el CHANGELOG v2.2. Otras claves de esa validación:
el flete de Castores en México SÍ se cobra (impactado al precio del rollo, no
como línea aparte); el calibre NO afecta el precio (solo el peso; excepción:
automático calibre 50); la lista de tarimas se deriva de la tabla maestra; el
proceso completo de cotización es exclusivo de BNP (los vendedores de México
no lo hacen); quien aprueba reducciones >5% es JN.

## Rutinas con Fabrizzio (preferencias del usuario)

Cosas que Fabrizzio espera por default, sin tener que pedirlas cada vez:

1. **Después de cada cambio, feature o fix que se mete a producción**, hacer SIEMPRE estas tres cosas (no una, las tres):
   - **(a) Actualizar la pestaña de Novedades dentro de la app** (`app/cotizador/components/WhatsNewModal.tsx`): agregar/ajustar el punto correspondiente para que el equipo vea TODO lo que cambió y no se omita nada. Si quieres que el modal vuelva a saltar solo para todos, hay que subir `APP_VERSION` (la clave de localStorage depende de la versión); si no se sube, el cambio queda visible al picar el botón "Novedades".
   - **(b) Texto de anuncio corto estilo WhatsApp**: título corto ("Cotizador vX.XX disponible" / "Nueva mejora"), 2-5 bullets en lenguaje no técnico (QUÉ es nuevo y POR QUÉ le importa al vendedor, sin jerga de código), cerrando con "Cualquier cosa, repórtalo desde el botón Reportar de la app."
   - **(c) Mensaje para enviar por correo**: versión un poco más formal del anuncio (saludo + contexto breve + los cambios + cierre/firma), lista para copiar y pegar.
   - Las tres se entregan DESPUÉS del push exitoso a `main` (cuando Vercel ya está desplegando), no antes.
2. **Comunicación en español**, tono directo, sin emojis a menos que él los use.
3. **Cuando una pregunta técnica le requiera "pensar"**, preguntarle con opciones concretas en vez de respuestas abiertas (él lo prefiere para tomar decisiones rápido).
4. **No proponer cambios fuera de scope** — si veo algo más por arreglar, lo flageo como tarea aparte (`mcp__ccd_session__spawn_task`) en vez de meterlo al cambio actual.

---

## Si vienes nuevo a este repo

1. Lee este archivo (CLAUDE.md) — ya estás aquí ✓
2. Lee `CHANGELOG.md` para entender el historial reciente.
3. Lee `types/index.ts` para entender los tipos centrales (LineItem, Trailer,
   CalcResult, SuggestionResult).
4. Lee `lib/pricingEngine.ts` — es el corazón matemático del cotizador.
5. Si el usuario te pide algo de UI, busca en `app/cotizador/components/`.
6. Si es algo de costos/precios, busca en `lib/pricingEngine.ts` o `lib/lookupEngine.ts`.
7. Si es algo de carga de Excel, busca en `lib/parsers/` y `app/api/data/upload/`.

Cualquier cambio que toque la matemática del cotizador **debe** validarse mentalmente
contra el ejemplo verificado del 5to camión de Level Packaging (existe un script en
`scripts/verify-truck-*.ts`).
