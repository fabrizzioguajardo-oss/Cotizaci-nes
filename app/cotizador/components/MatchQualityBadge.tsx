'use client';

import { CheckCircle, AlertCircle, Activity } from 'lucide-react';

interface Props {
  quality: 'exact' | 'close' | 'interpolated' | null;
  source?: string;
}

// Badge que indica si el costo base que se está usando viene de un match
// directo del Excel, uno cercano (PB diff < 0.1kg), o interpolado.
export default function MatchQualityBadge({ quality, source }: Props) {
  if (!quality) return null;

  const config = {
    exact: {
      Icon: CheckCircle,
      label: 'Match exacto',
      color: '#5BAA47',
      bg: 'rgba(91, 170, 71, 0.1)',
      border: 'rgba(91, 170, 71, 0.4)',
    },
    close: {
      Icon: Activity,
      label: 'Match cercano',
      color: '#5BAA47',
      bg: 'rgba(91, 170, 71, 0.08)',
      border: 'rgba(91, 170, 71, 0.3)',
    },
    interpolated: {
      Icon: AlertCircle,
      label: 'Interpolado — verificar',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.4)',
    },
  };
  const { Icon, label, color, bg, border } = config[quality];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-semibold border"
      style={{ color, backgroundColor: bg, borderColor: border }}
      title={source ?? ''}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
