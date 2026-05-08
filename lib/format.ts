// Helpers de formateo de números, dinero y porcentajes

export function fmtUSD(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '$—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtMXN(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtNum(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtPct(n: number | null, decimals = 1): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}

export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}
