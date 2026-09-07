/**
 * 流水页：筛选 + 批量删除 + 汇总。
 * 数据筛选全部走 core/query/filter，本文件只负责交互。
 */

import { useMemo, useState } from 'react';
import type { Tx } from '../../../core/types';
import {
  applyQuery,
  availableYears,
  summarizeAmount,
  yearMonthQuery,
} from '../../../core/query/filter';
import { formatCents } from '../../../core/money';
import { FilterBar, EMPTY_FILTER, type LedgerFilter } from './FilterBar';
import { TxRow } from './TxRow';

interface Props {
  txs: Tx[];
  onPatch: (id: string, patch: Partial<Tx>) => void;
  onDelete: (ids: string[]) => void;
}

function Summary({ income, expense }: { income: number; expense: number }) {
  return (
    <div className="flex items-center gap-5 border-b border-slate-200 bg-white px-4 py-2.5 text-xs">
      <span className="text-slate-500">
        收入 <b className="text-emerald-600">{formatCents(income)}</b>
      </span>
      <span className="text-slate-500">
        支出 <b className="text-red-600">{formatCents(expense)}</b>
      </span>
      <span className="text-slate-500">
        净额{' '}
        <b className={income - expense >= 0 ? 'text-slate-900' : 'text-red-600'}>
          {formatCents(income - expense)}
        </b>
      </span>
    </div>
  );
}

export function LedgerPage({ txs, onPatch, onDelete }: Props) {
  const [filter, setFilter] = useState<LedgerFilter>(EMPTY_FILTER);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const years = useMemo(() => availableYears(txs), [txs]);

  const visible = useMemo(() => {
    // year=all + month=某月：走 months 通道（跨年份只看该月），见 yearMonthQuery
    return applyQuery(txs, {
      ...yearMonthQuery(filter),
      categories: filter.categories.length ? filter.categories : undefined,
      directions: filter.directions.length ? filter.directions : undefined,
      keyword: filter.keyword || undefined,
      excludeInternal: filter.excludeInternal,
    });
  }, [txs, filter]);

  const summary = useMemo(() => summarizeAmount(visible), [visible]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allChecked = visible.length > 0 && visible.every((t) => selected.has(t.id));

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(visible.map((t) => t.id)));
  };

  const removeSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`确认删除选中的 ${ids.length} 条流水？`)) return;
    await onDelete(ids);
    setSelected(new Set());
    setSelectMode(false);
  };

  return (
    <div className="flex h-full flex-col">
      <FilterBar value={filter} years={years} onChange={setFilter} />

      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 text-xs">
        <span className="text-slate-500">共 {visible.length} 条</span>
        <button
          type="button"
          onClick={() => {
            setSelectMode((v) => !v);
            setSelected(new Set());
          }}
          className="btn-ghost px-2.5 py-1 text-xs"
        >
          {selectMode ? '退出多选' : '批量管理'}
        </button>

        {selectMode && (
          <>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-slate-300"
              />
              全选
            </label>
            <button
              type="button"
              onClick={() => void removeSelected()}
              disabled={selected.size === 0}
              className="btn-danger px-2.5 py-1 text-xs"
            >
              删除选中（{selected.size}）
            </button>
          </>
        )}
      </div>

      <Summary income={summary.income} expense={summary.expense} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            {txs.length === 0 ? '还没有流水，先去导入账单' : '当前筛选条件下没有记录'}
          </div>
        ) : (
          <div className="card overflow-hidden rounded-none border-0">
            {visible.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                selectable={selectMode}
                selected={selected.has(tx.id)}
                onSelect={toggleSelect}
                onPatch={onPatch}
                onDelete={(id) => {
                  if (window.confirm('确认删除这条流水？')) void onDelete([id]);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
