'use client';

import { X, Rocket, Building2, Eye, Layers, Calculator, User, History, ShieldCheck, Bug } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Clave de localStorage para no volver a mostrar el modal de novedades de
// esta versión. Cuando APP_VERSION cambie, la clave cambia y el modal vuelve
// a aparecer una vez.
export const WHATS_NEW_KEY = `sice_whatsnew_v${APP_VERSION}`;

interface Seccion {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  titulo: string;
  color: string;
  puntos: string[];
}

const SECCIONES: Seccion[] = [
  {
    icon: Rocket,
    color: '#5BAA47',
    titulo: 'Novedades de esta versión (v2.2) — reglas validadas con Diego',
    puntos: [
      'El límite de reducción de material cambió: la zona saludable es hasta 5%. Arriba del 5% se requiere aprobación de JN, y arriba del 10% el sistema lo marca fuera del ideal (antes solo pedía aprobación arriba del 35%).',
      'El peso facturable ahora se redondea como lo hace Diego (mitad o menos hacia abajo, más de la mitad hacia arriba), en lugar de truncar siempre hacia abajo.',
      'Rollos chicos: al elegir el cono, si el peso neto es menor a 1.3 kg el sistema suma solo el aumento de 2.5 pesos por kilo anunciado por EDSA, y te lo avisa.',
      'Color intenso: junto al campo Intenso hay un botón para aplicar el 1.25 por kilo de política con un clic.',
      'La tabla de márgenes por volumen y forma de pago (contado/crédito) quedó cargada como referencia; se conectará a las alertas cuando se confirmen los porcentajes de BNP en la visita.',
    ],
  },
  {
    icon: Rocket,
    color: '#3E8EDE',
    titulo: 'También reciente (v2.1)',
    puntos: [
      'Cotizar paso por paso: la pantalla ya no muestra todo en ceros de golpe. Arranca pidiendo solo el pedido del cliente (Paso 1); el cono y los cálculos (Paso 2) y el precio (Paso 3) se abren conforme llenas.',
      'Tu trabajo no se pierde: guarda desde el inicio (descripción y cantidad incluidas), conserva lo último al cerrar la pestaña, y ya no se duplican cotizaciones por doble-clic.',
      'Te avisa de los precios: marca si el costo es un cálculo aproximado, o si está usando precios de respaldo porque no se pudo conectar a los vigentes.',
      'Documentos más profesionales: montos con separador de miles, medidas legibles y el total que ya no se recorta.',
      'Más seguro y estable por dentro: reforzamos la protección de los datos confidenciales y la precisión con que se leen los precios.',
    ],
  },
  {
    icon: Building2,
    color: '#3E8EDE',
    titulo: 'Multi-empresa: cotizas para dos empresas',
    puntos: [
      'Al entrar eliges para quién cotizas: BioNovaPack (Estados Unidos, en dólares) o Extruidos (México, en pesos).',
      'Extruidos opera todo en pesos mexicanos, sin tipo de cambio, con su propio formato de cotización, su logo y sus colores de marca.',
      'En México el envío es por recolección en almacén o por Castores, y el documento al cliente sale con el formato de Extruidos e incluye IVA.',
      'El cotizador se adapta solo a la empresa que elijas: moneda, transporte, PDF e identidad cambian sin que hagas nada extra.',
    ],
  },
  {
    icon: Eye,
    color: '#3E8EDE',
    titulo: 'Más claro y a prueba de errores',
    puntos: [
      'Pantalla más despejada: la empresa y el tipo de cotización ahora viven en una sola barra compacta arriba, dejando más espacio para capturar el pedido.',
      'Formulario más corto: el desglose de costo (que casi siempre se llena solo al elegir el cono) ahora arranca plegado. Lo abres con "Ajustar a mano" solo si necesitas cambiarlo.',
      'Indicadores más claros arriba: la Utilidad (lo que más importa de un vistazo) ahora resalta, y Revenue/Costo pasan a segundo plano para leer rápido cómo va el margen.',
      'PDFs más profesionales: en las cotizaciones y órdenes de BioNovaPack los montos salen con separador de miles ($46,853.05), las medidas se leen bien (9.87" × 80GA × 5000\') y el total ya no se recorta.',
      'Sin cotizaciones duplicadas: si por error picas "Generar" dos veces (o la descarga tarda), el sistema ya no crea dos documentos repetidos de la misma cotización.',
      'Tu trabajo no se pierde: el cotizador guarda también la descripción y la cantidad desde el inicio, conserva lo último al cerrar la pestaña, y ya no se pisan cotizaciones cuando tienes dos pestañas abiertas.',
      'Te avisa de los precios: si el costo es un match aproximado, o si está usando precios de respaldo porque no pudo conectarse a los vigentes, ahora lo ves en pantalla antes de cotizar.',
      'Si pasas el cursor sobre un término técnico (Calibre/GA, Cono, TC, Base EDSA), aparece una explicación corta de qué significa.',
      'El tipo de cambio es obligatorio en cotizaciones de EUA: si lo dejas vacío se marca en rojo y no deja generar el documento, para que ningún precio salga mal calculado.',
      'Los campos numéricos ya no aceptan negativos por error, y el botón de cerrar sesión quedó separado para no picarlo sin querer.',
    ],
  },
  {
    icon: Layers,
    color: '#5BAA47',
    titulo: 'Dos modos claros de cotizar',
    puntos: [
      'Elige el tipo de cotización arriba del panel: Directa, Optimizada u Optimizada + revisión.',
      'Directa: cotizas exactamente lo que pide el cliente, sin cambios.',
      'Optimizada: el sistema propone una versión más rentable y te muestra una comparación lado a lado (ahorro por rollo, ahorro total, cuánto sube el margen y una recomendación).',
      'Optimizada + revisión: si la propuesta reduce el material más del 5% (política validada con Diego), te pide aprobación antes de generar el documento y lo deja registrado.',
    ],
  },
  {
    icon: Calculator,
    color: '#009FE3',
    titulo: 'Cálculos más exactos y confiables',
    puntos: [
      'El cono ahora distingue entre lo que el cliente espera y lo que se fabrica, y avisa si el paquete pesaría de más.',
      'El peso neto facturable se redondea con la regla de Diego: mitad o menos hacia abajo, más de la mitad hacia arriba.',
      'La sugerencia de largo usa el tipo de cambio real que pones en pantalla.',
      'Los PDFs cuadran: la cantidad por línea siempre suma con el total.',
      'Se agregaron 1,329 productos de la tabla maestra de EDSA como referencia para sugerir cono.',
    ],
  },
  {
    icon: User,
    color: '#6B2C91',
    titulo: 'Experiencia de uso',
    puntos: [
      'Cada cotización y PO se firma con tu nombre real (la primera vez te pide capturarlo).',
      'Campos nuevos de contacto y dirección del cliente, que se guardan entre sesiones.',
      'Si te falta llenar algo, el sistema te dice exactamente qué falta.',
      'Se quitó el cuadro de transporte que no servía; el flete se edita en cada trailer.',
      'Editar tu nombre ya no recarga la página ni te hace perder tu trabajo.',
    ],
  },
  {
    icon: History,
    color: '#F59E0B',
    titulo: 'Trazabilidad y flujos internos',
    puntos: [
      'Cada cotización y PO queda guardada en una bóveda interna, congelada con todos sus datos. Si un cliente reclama meses después, se reconstruye exactamente lo que se envió.',
      'Queda registrado qué tipo de cotización se usó y quién la aprobó.',
      'Si trabajas en dos pestañas a la vez, ya no se borra el trabajo de una con la otra.',
    ],
  },
  {
    icon: ShieldCheck,
    color: '#5BAA47',
    titulo: 'Herramientas de control',
    puntos: [
      'Antes de generar un PDF, el sistema revisa la cotización y avisa si el paquete pesaría de más, el margen quedó bajo el 12%, un trailer excede capacidad, o falta información.',
      'Las verificaciones corren solas y muestran las alertas antes de mandar el documento al cliente.',
      'En las cotizaciones de Extruidos, el total del PDF y el registro interno siempre coinciden al centavo.',
      'Una red de seguridad automática revisa la matemática del cotizador antes de publicar cualquier cambio nuevo.',
    ],
  },
  {
    icon: Bug,
    color: '#EF4444',
    titulo: 'Correcciones',
    puntos: [
      'Los conos sugeridos ya no se acumulan al picarles varias veces.',
      'El sistema ya no propone fabricar más material del que el cliente pide.',
      'El formulario de "Reportar" ya no conserva el texto anterior.',
      'Las cotizaciones con varios trailers ya no se corrompen al recargar.',
      'Y una larga lista de ajustes finos de precisión y consistencia.',
    ],
  },
];

// Modal de novedades de la versión actual. Aparece una vez por usuario
// (controlado con localStorage) y se puede reabrir desde el botón "Novedades".
export default function WhatsNewModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm modal-overlay"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="card max-w-2xl w-full max-h-[88vh] overflow-y-auto modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="card-header sticky top-0 bg-bg-elevated z-10">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-bnp-green" />
            <div>
              <h3 className="text-sm font-semibold">
                Novedades del cotizador · v{APP_VERSION}
              </h3>
              <p className="text-2xs text-text-muted">
                Arriba, lo más reciente; abajo, el resumen completo por área.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-bg-hover rounded" title="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="card-body space-y-5">
          <p className="text-xs text-text-secondary">
            Esta no es una mejora menor. La <strong>versión {APP_VERSION}</strong> reúne una
            renovación profunda del cotizador — la actualización más grande del sistema hasta ahora.
          </p>

          {SECCIONES.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.titulo}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: s.color }} />
                  <h4 className="text-xs font-semibold" style={{ color: s.color }}>
                    {s.titulo}
                  </h4>
                </div>
                <ul className="space-y-1 pl-6">
                  {s.puntos.map((p, i) => (
                    <li key={i} className="text-2xs text-text-secondary list-disc list-outside">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="border-t border-border-subtle pt-3">
            <p className="text-2xs text-text-muted">
              Cualquier cosa que veas rara, repórtala desde el botón <strong>Reportar</strong> de la
              app. Cada reporte ayuda.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border-subtle flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Entendido, empezar a cotizar
          </button>
        </div>
      </div>
    </div>
  );
}
