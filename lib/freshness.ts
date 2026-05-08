// Indicadores de frescura de datos.
// El user mencionó que precios se actualizan semana/mes — esto evita
// que se cotice con datos viejos sin que nadie se entere.

export type FreshnessLevel = 'fresh' | 'recent' | 'stale' | 'old';

export interface FreshnessInfo {
  daysSince: number;
  level: FreshnessLevel;
  label: string;
  color: string;
}

const COLORS: Record<FreshnessLevel, string> = {
  fresh:  '#5BAA47',  // verde
  recent: '#5BAA47',  // verde
  stale:  '#F59E0B',  // amber
  old:    '#EF4444',  // rojo
};

// Calcula los dias entre una fecha (ISO date string) y hoy.
// Categoriza en niveles: <7 fresh, <30 recent, <60 stale, >=60 old
export function freshnessFromDate(isoDate: string | null | undefined): FreshnessInfo | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const ms = now.getTime() - date.getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));

  let level: FreshnessLevel;
  let label: string;
  if (days <= 7) {
    level = 'fresh';
    label = days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days}d`;
  } else if (days <= 30) {
    level = 'recent';
    label = `hace ${days}d`;
  } else if (days <= 60) {
    level = 'stale';
    label = `hace ${days}d — revisar`;
  } else {
    level = 'old';
    label = `hace ${days}d — desactualizado`;
  }

  return { daysSince: days, level, label, color: COLORS[level] };
}

// Reduce: dada una lista de fechas, devuelve la mas vieja (la que dispara la alerta)
export function oldestFreshness(dates: (string | null | undefined)[]): FreshnessInfo | null {
  const valid = dates
    .map((d) => freshnessFromDate(d))
    .filter((f): f is FreshnessInfo => f !== null);
  if (valid.length === 0) return null;
  return valid.reduce((acc, f) => (f.daysSince > acc.daysSince ? f : acc));
}
