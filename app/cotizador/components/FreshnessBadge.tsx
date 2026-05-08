'use client';

import { Clock, AlertCircle } from 'lucide-react';
import { freshnessFromDate, type FreshnessInfo } from '@/lib/freshness';

interface Props {
  date?: string | null | undefined;
  size?: 'sm' | 'md';
  prefix?: string;
  // Si pasas un FreshnessInfo lo usa directo (para combinar varias fechas)
  info?: FreshnessInfo | null;
}

export default function FreshnessBadge({ date, size = 'sm', prefix, info: explicitInfo }: Props) {
  const info = explicitInfo ?? freshnessFromDate(date);
  if (!info) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-text-muted">
        <Clock className="w-3 h-3" />
        sin fecha
      </span>
    );
  }

  const Icon = info.level === 'old' || info.level === 'stale' ? AlertCircle : Clock;
  const sizeClasses = size === 'md' ? 'text-xs' : 'text-2xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono ${sizeClasses}`}
      style={{ color: info.color }}
      title={`${info.daysSince} días desde última actualización`}
    >
      <Icon className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      {prefix ? `${prefix} ` : ''}{info.label}
    </span>
  );
}
