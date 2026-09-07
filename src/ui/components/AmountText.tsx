/** 金额展示：支出红、收入绿、中性灰。仅负责显示，不含业务逻辑。 */

import type { Direction } from '../../core/types';
import { formatCents } from '../../core/money';

interface Props {
  cents: number;
  direction: Direction;
  className?: string;
  showSign?: boolean;
}

const TONE: Record<Direction, string> = {
  out: 'text-red-600',
  in: 'text-emerald-600',
  neutral: 'text-slate-500',
};

const SIGN: Record<Direction, string> = {
  out: '-',
  in: '+',
  neutral: '',
};

export function AmountText({ cents, direction, className = '', showSign = true }: Props) {
  return (
    <span className={`tabular-nums ${TONE[direction]} ${className}`}>
      {showSign && SIGN[direction]}
      {formatCents(cents)}
    </span>
  );
}
