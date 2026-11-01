/**
 * 当前待处理条目卡片：展示细则 + 选分类 + 写备注 + 就地删除。
 *
 * 交互约定：
 *   Enter  保存并跳到下一条。备注留空直接回车也是保存（等价于"跳过"），
 *          因为留空的条目同样要标记为已处理，否则进度永远走不完。
 *   删除按钮  删除本条
 * 父组件用 key={tx.id} 强制重挂载，避免上一条的输入串到下一条。
 */

import { useEffect, useRef, useState } from 'react';
import type { CategoryId, Tx } from '../../../core/types';
import { formatFull } from '../../../core/datetime';
import { AmountText } from '../../components/AmountText';
import { CategoryPicker } from '../../components/CategoryPicker';

interface Props {
  tx: Tx;
  /** 京东快照匹配出的商品名建议（无匹配为 null） */
  suggestion: string | null;
  onSave: (patch: { note: string; category: CategoryId | null }) => void;
  onDelete: () => void;
  onPrev: () => void;
  hasPrev: boolean;
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-16 shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 break-all text-slate-800">{value}</span>
    </div>
  );
}

export function CurrentCard({ tx, suggestion, onSave, onDelete, onPrev, hasPrev }: Props) {
  // 备注为空且有快照命中 → 自动预填商品名（已写备注的绝不覆盖，符合设计约束）
  const [note, setNote] = useState(tx.note || suggestion || '');
  const [category, setCategory] = useState<CategoryId | null>(tx.category);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs text-slate-400">{formatFull(tx.time)}</div>
          <AmountText
            cents={tx.effectiveAmount}
            direction={tx.direction}
            className="text-3xl font-semibold"
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          {tx.refundFlag === 'partial' && (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
              部分退款，实付已按 {tx.effectiveAmount / 100} 元计入
            </span>
          )}
          {tx.internal && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              内部转账 · 计入总收支
            </span>
          )}
        </div>
      </div>

      <div className="mb-5 space-y-1.5 rounded-lg bg-slate-50 p-3">
        <Row label="交易对方" value={tx.counterparty} />
        <Row label="商品" value={tx.product} />
        <Row label="支付方式" value={tx.payMethod} />
        <Row label="交易类型" value={tx.txType} />
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-xs text-slate-500">用途分类</div>
        <CategoryPicker value={category} onChange={setCategory} />
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-slate-500">备注</span>
          <span className="text-[11px] text-slate-400">留空直接回车 = 跳过这笔</span>
        </div>
        {suggestion && (
          <div className="mb-1.5 flex items-center gap-2 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] text-violet-700">
            <span className="min-w-0 flex-1 truncate" title={suggestion}>
              京东快照：{suggestion}
            </span>
            <button
              type="button"
              onClick={() => setNote(suggestion)}
              className="shrink-0 rounded bg-violet-600 px-1.5 py-0.5 text-white"
            >
              填入
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave({ note, category });
          }}
          placeholder="这笔钱花在哪了？写一句，日后才想得起来"
          className="field"
        />
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onSave({ note, category })} className="btn-primary">
          保存，下一条 <span className="text-[10px] opacity-60">Enter</span>
        </button>
        <button type="button" onClick={onPrev} disabled={!hasPrev} className="btn-ghost">
          上一条
        </button>
        <button type="button" onClick={onDelete} className="btn-danger ml-auto">
          删除本条
        </button>
      </div>
    </div>
  );
}
