/** 邻居卡片：上一条 / 下一条，只读，用来帮助回想。 */

import type { Tx } from '../../../core/types';
import { formatShort } from '../../../core/datetime';
import { AmountText } from '../../components/AmountText';

interface Props {
  tx: Tx | undefined;
  label: string;
}

export function NeighborCard({ tx, label }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2">
      <div className="mb-1 text-[11px] text-slate-400">{label}</div>
      {tx ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-slate-400">{formatShort(tx.time)}</span>
          <span className="min-w-0 flex-1 truncate text-slate-500">
            {tx.note || tx.product || tx.counterparty}
          </span>
          <AmountText cents={tx.effectiveAmount} direction={tx.direction} className="text-xs" />
        </div>
      ) : (
        <div className="text-xs text-slate-300">没有了</div>
      )}
    </div>
  );
}
