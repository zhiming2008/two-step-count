/**
 * 流水列表的单行。
 * 折叠态只显示：时间 / 收支 / 用户备注（没有备注就退回显示商品名）/ 金额。
 * 细则（对方、商品、支付方式、单号、原始状态）点开才展示 —— 符合"列表要干净"的要求。
 */

import { useState } from 'react';
import type { CategoryId, Tx } from '../../../core/types';
import { formatShort, formatFull } from '../../../core/datetime';
import { AmountText } from '../../components/AmountText';
import { CategoryPicker } from '../../components/CategoryPicker';
import { getCategory } from '../../../core/categories';

interface Props {
  tx: Tx;
  selectable: boolean;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onPatch: (id: string, patch: Partial<Tx>) => void;
  onDelete: (id: string) => void;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-16 shrink-0 text-slate-400">{label}</span>
      <span className="break-all text-slate-700">{value}</span>
    </div>
  );
}

export function TxRow({ tx, selectable, selected, onSelect, onPatch, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(tx.note);
  const category = getCategory(tx.category);

  const commitNote = () => {
    if (note !== tx.note) void onPatch(tx.id, { note, reviewed: true });
  };

  return (
    <div className={`border-b border-slate-100 ${selected ? 'bg-slate-50' : ''}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(tx.id, e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-slate-300"
            aria-label="选择该条"
          />
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="w-24 shrink-0 font-mono text-xs text-slate-500">
            {formatShort(tx.time)}
          </span>

          <span
            className={`h-2 w-2 shrink-0 rounded-full ${category.tone}`}
            title={category.label}
          />

          <span className="min-w-0 flex-1 truncate text-sm">
            {tx.note || <span className="text-slate-400">{tx.product || tx.counterparty}</span>}
          </span>

          {tx.internal && (
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
              内部
            </span>
          )}
          {tx.refundFlag === 'partial' && (
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
              部分退款
            </span>
          )}

          <AmountText
            cents={tx.effectiveAmount}
            direction={tx.direction}
            className="w-24 shrink-0 text-right text-sm font-medium"
          />
        </button>
      </div>

      {open && (
        <div className="space-y-3 bg-slate-50/60 px-3 pb-3 pt-1">
          <div className="grid gap-1">
            <DetailItem label="交易对方" value={tx.counterparty} />
            <DetailItem label="商品" value={tx.product} />
            <DetailItem label="支付方式" value={tx.payMethod} />
            <DetailItem label="交易类型" value={tx.txType} />
            <DetailItem label="原始状态" value={tx.status} />
            <DetailItem label="交易时间" value={formatFull(tx.time)} />
            {tx.refundAmount > 0 && (
              <DetailItem label="退款额" value={`${(tx.refundAmount / 100).toFixed(2)} 元`} />
            )}
            <DetailItem label="交易单号" value={tx.orderId} />
            <DetailItem label="商户单号" value={tx.merchantId} />
          </div>

          <div className="space-y-2">
            <CategoryPicker
              value={tx.category}
              onChange={(id: CategoryId) => void onPatch(tx.id, { category: id })}
            />
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={commitNote}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                placeholder="写点备注，方便日后回想"
                className="field"
              />
              <button type="button" onClick={() => void onDelete(tx.id)} className="btn-danger shrink-0">
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
