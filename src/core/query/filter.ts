/**
 * 查询与聚合 —— 纯函数，不碰 IndexedDB，可单测。
 * 放在 core 而不是 storage，是为了让筛选规则与存储实现解耦。
 */

import type { Tx } from '../types';
import type { TxQuery } from '../../storage/adapter';

/** 关键字命中：备注 / 交易对方 / 商品 / 分类备注，忽略大小写。 */
function matchKeyword(tx: Tx, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  return [tx.note, tx.counterparty, tx.product, tx.billNote]
    .join(' ')
    .toLowerCase()
    .includes(kw);
}

/** 单条流水是否命中查询条件。 */
export function matchQuery(tx: Tx, query: TxQuery): boolean {
  if (!query.includeDropped && tx.dropped) return false;
  if (query.from !== undefined && tx.time < query.from) return false;
  if (query.to !== undefined && tx.time > query.to) return false;
  if (query.months?.length && !query.months.includes(new Date(tx.time).getMonth() + 1)) {
    return false;
  }
  if (query.categories?.length && !query.categories.includes(tx.category ?? 'other')) return false;
  if (query.directions?.length && !query.directions.includes(tx.direction)) return false;
  if (query.onlyUnreviewed && tx.reviewed) return false;
  if (query.excludeInternal && tx.internal) return false;
  if (query.keyword && !matchKeyword(tx, query.keyword)) return false;
  return true;
}

/** 默认按时间倒序（最新在前），符合流水查看习惯。 */
export function sortByTimeDesc(txs: Tx[]): Tx[] {
  return [...txs].sort((a, b) => b.time - a.time);
}

/** 按时间正序 —— 第二步逐条记录时按发生顺序回想更自然。 */
export function sortByTimeAsc(txs: Tx[]): Tx[] {
  return [...txs].sort((a, b) => a.time - b.time);
}

export function applyQuery(txs: Tx[], query: TxQuery, order: 'asc' | 'desc' = 'desc'): Tx[] {
  const filtered = txs.filter((t) => matchQuery(t, query));
  return order === 'asc' ? sortByTimeAsc(filtered) : sortByTimeDesc(filtered);
}

export interface AmountSummary {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function summarizeAmount(txs: Tx[]): AmountSummary {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.direction === 'in') income += tx.effectiveAmount;
    else if (tx.direction === 'out') expense += tx.effectiveAmount;
  }
  return { income, expense, net: income - expense, count: txs.length };
}

/** 按月份分组，key 形如 "2026-08"。 */
export function groupByMonth(txs: Tx[]): Map<string, Tx[]> {
  const groups = new Map<string, Tx[]>();
  for (const tx of txs) {
    const d = new Date(tx.time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const list = groups.get(key);
    if (list) list.push(tx);
    else groups.set(key, [tx]);
  }
  return groups;
}

/** 取某月的时间区间 [月初0点, 次月月初0点)。 */
export function monthRange(year: number, month1to12: number): { from: number; to: number } {
  const from = new Date(year, month1to12 - 1, 1, 0, 0, 0, 0).getTime();
  const to = new Date(year, month1to12, 1, 0, 0, 0, 0).getTime();
  return { from, to };
}

/** 取整年区间。 */
export function yearRange(year: number): { from: number; to: number } {
  return {
    from: new Date(year, 0, 1, 0, 0, 0, 0).getTime(),
    to: new Date(year + 1, 0, 1, 0, 0, 0, 0).getTime(),
  };
}

/** 年份/月份下拉的组合。 */
export interface YearMonthFilter {
  year: number | 'all';
  month: number | 'all';
}

/**
 * 把年/月下拉转成查询条件。
 * year=某年 → 时间区间；year=all + month=某月 → 走 months 通道（跨年份只看该月）。
 */
export function yearMonthQuery(ym: YearMonthFilter): Pick<TxQuery, 'from' | 'to' | 'months'> {
  if (ym.year === 'all' && ym.month !== 'all') {
    // 跨年份只看某月 —— 单独走 months 通道
    return { months: [ym.month] };
  }
  if (ym.year !== 'all') {
    return ym.month === 'all' ? yearRange(ym.year) : monthRange(ym.year, ym.month);
  }
  return {};
}

/** 从流水里提取出现过的年份，倒序。 */
export function availableYears(txs: Tx[]): number[] {
  const set = new Set<number>();
  for (const tx of txs) set.add(new Date(tx.time).getFullYear());
  return [...set].sort((a, b) => b - a);
}
