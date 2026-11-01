/**
 * 统计页：按月/年看分类占比、月度走势、Top 交易对方、月度支出构成。
 * 纯 SVG/div 不引图表库 —— 数据量级小，自绘可控且包体轻。
 *
 * 筛选只暴露时间维度（年/月）：分类占比天然是按方向各自统计的，
 * 不让方向筛选介入，避免"选了收入却看支出占比"的语义混乱。
 */

import { useMemo, useState } from 'react';
import type { Tx } from '../../../core/types';
import { formatCents } from '../../../core/money';
import { CATEGORIES } from '../../../core/categories';
import {
  categoryHex,
  summarizeByCategory,
  summarizeByMonth,
  summarizeTotals,
  topCounterparties,
  monthlyCategoryMatrix,
} from '../../../core/query/stats';
import { applyQuery, availableYears, yearMonthQuery } from '../../../core/query/filter';

interface Props {
  txs: Tx[];
}

interface TimeFilter {
  year: number | 'all';
  month: number | 'all';
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 横向条形：分类占比。一条一行，宽度按比例。 */
function CategoryBars({ slices }: { slices: ReturnType<typeof summarizeByCategory> }) {
  const max = slices.reduce((m, s) => Math.max(m, s.amount), 0) || 1;
  return (
    <div className="space-y-1.5">
      {slices.length === 0 && (
        <div className="py-6 text-center text-xs text-slate-400">没有数据</div>
      )}
      {slices.map((s) => (
        <div key={s.id} className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-slate-600">{s.label}</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded transition-all"
              style={{ width: `${(s.amount / max) * 100}%`, background: categoryHex(s.id) }}
            />
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-slate-700">
            {formatCents(s.amount)}
          </span>
          <span className="w-12 shrink-0 text-right text-slate-400">
            {(s.ratio * 100).toFixed(1)}%
          </span>
          <span className="w-10 shrink-0 text-right text-slate-400">{s.count}笔</span>
        </div>
      ))}
    </div>
  );
}

/** 月度柱状：支出（红）/ 收入（绿）并列，按月份排开。 */
function MonthBars({ months }: { months: ReturnType<typeof summarizeByMonth> }) {
  if (months.length === 0) {
    return <div className="py-6 text-center text-xs text-slate-400">没有数据</div>;
  }
  const maxAbs = months.reduce((m, x) => Math.max(m, x.income, x.expense), 0) || 1;
  const maxH = 120;
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-2">
      {months.map((m) => (
        <div key={m.key} className="flex flex-col items-center gap-1">
          <div className="flex h-[120px] items-end gap-0.5">
            <div
              className="w-3 rounded-t bg-red-500"
              style={{ height: `${(m.expense / maxAbs) * maxH}px` }}
              title={`支出 ${formatCents(m.expense)}`}
            />
            <div
              className="w-3 rounded-t bg-emerald-500"
              style={{ height: `${(m.income / maxAbs) * maxH}px` }}
              title={`收入 ${formatCents(m.income)}`}
            />
          </div>
          <div className="text-[10px] text-slate-500">{m.key.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

/** Top 交易对方：横向条形。 */
function TopParties({ items }: { items: ReturnType<typeof topCounterparties> }) {
  if (items.length === 0) {
    return <div className="py-6 text-center text-xs text-slate-400">没有数据</div>;
  }
  const max = items[0].amount || 1;
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-slate-600" title={it.name}>
            {it.name}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded bg-slate-500"
              style={{ width: `${(it.amount / max) * 100}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-slate-700">
            {formatCents(it.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 月度支出构成：每月一条横向堆叠条，段=分类。展示月份内支出花在哪。
 */
function MonthStack({ rows }: { rows: ReturnType<typeof monthlyCategoryMatrix> }) {
  if (rows.length === 0) {
    return <div className="py-6 text-center text-xs text-slate-400">没有数据</div>;
  }
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0) || 1;
  return (
    <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 font-mono text-slate-500">{r.key}</span>
          <div
            className="flex h-5 min-w-0 flex-1 overflow-hidden rounded bg-slate-100"
            title={`${r.key} 支出 ${formatCents(r.total)}`}
          >
            {r.cells.map((c) => (
              <div
                key={c.id}
                style={{
                  width: `${(c.amount / max) * 100}%`,
                  background: categoryHex(c.id),
                }}
                title={`${CATEGORIES.find((x) => x.id === c.id)?.label ?? c.id} ${formatCents(c.amount)}`}
              />
            ))}
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-slate-700">
            {formatCents(r.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

/** 图例：分类色 + 名称。 */
function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {CATEGORIES.map((c) => (
        <div key={c.id} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.hex }} />
          <span className="text-slate-600">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsPage({ txs }: Props) {
  const [filter, setFilter] = useState<TimeFilter>({ year: 'all', month: 'all' });
  const years = useMemo(() => availableYears(txs), [txs]);

  const patch = (p: Partial<TimeFilter>) => setFilter((prev) => ({ ...prev, ...p }));

  const scoped = useMemo(() => applyQuery(txs, yearMonthQuery(filter)), [txs, filter]);

  const outSlices = useMemo(() => summarizeByCategory(scoped, 'out'), [scoped]);
  const inSlices = useMemo(() => summarizeByCategory(scoped, 'in'), [scoped]);
  const months = useMemo(() => summarizeByMonth(scoped), [scoped]);
  const stacks = useMemo(() => monthlyCategoryMatrix(scoped), [scoped]);
  const topOut = useMemo(() => topCounterparties(scoped, 8), [scoped]);

  const totals = useMemo(() => summarizeTotals(scoped), [scoped]);

  const avgExpense = months.length > 0 ? Math.round(totals.expense / months.length) : 0;

  return (
    <div className="h-full overflow-y-auto">
      {/* 只有时间筛选：年份 + 月份。月份可独立于年份选择（全部年份 + 某月 = 跨年同月） */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <label className="text-xs text-slate-500">统计区间</label>
        <select
          value={filter.year === 'all' ? 'all' : String(filter.year)}
          onChange={(e) =>
            patch({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })
          }
          className="field w-32"
        >
          <option value="all">全部年份</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>
        <select
          value={filter.month === 'all' ? 'all' : String(filter.month)}
          onChange={(e) =>
            patch({ month: e.target.value === 'all' ? 'all' : Number(e.target.value) })
          }
          className="field w-28"
        >
          <option value="all">全年</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m} 月
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3 p-4">
        {/* 总览 */}
        <Block title="总览">
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-slate-500">支出</div>
              <div className="text-base font-mono font-semibold text-red-600">
                {formatCents(totals.expense)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">收入</div>
              <div className="text-base font-mono font-semibold text-emerald-600">
                {formatCents(totals.income)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">净额</div>
              <div
                className={`text-base font-mono font-semibold ${
                  totals.net >= 0 ? 'text-slate-900' : 'text-red-600'
                }`}
              >
                {formatCents(totals.net)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">月均支出</div>
              <div className="text-base font-mono font-semibold text-slate-900">
                {formatCents(avgExpense)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            总收支含银行 / 零钱通转账（提现记支出、转入记收入）；下方分类占比只看真实消费，
            不含转账。
          </div>
        </Block>

        {/* 月度支出构成（堆叠） */}
        <Block title="月度支出构成（每月的钱花在哪些分类）">
          <MonthStack rows={stacks} />
        </Block>

        {/* 分类占比 */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Block title="支出分类占比">
            <CategoryBars slices={outSlices} />
          </Block>
          <Block title="收入来源分类">
            <CategoryBars slices={inSlices} />
          </Block>
        </div>

        {/* 月度趋势 */}
        <Block title="月度收支走势（红=支出 / 绿=收入）">
          <MonthBars months={months} />
        </Block>

        {/* Top 交易对方 */}
        <Block title="支出最多的交易对方">
          <TopParties items={topOut} />
        </Block>

        {/* 分类图例 */}
        <Block title="分类图例">
          <Legend />
        </Block>
      </div>
    </div>
  );
}
