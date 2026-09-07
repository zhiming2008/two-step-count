/**
 * 统计聚合 —— 纯函数，不碰 UI。
 * 分类占比只看支出（收入单独列），内部转账默认排除。
 */

import type { CategoryId, Cents, Direction, Tx } from '../types';
import { CATEGORIES, getCategory } from '../categories';

const CATEGORY_HEX = new Map(CATEGORIES.map((c) => [c.id, c.hex]));

/** 分类的十六进制色 —— SVG 着色用。 */
export function categoryHex(id: CategoryId | null): string {
  return CATEGORY_HEX.get(id ?? 'other') ?? '#9ca3af';
}

export interface CategorySlice {
  id: CategoryId;
  label: string;
  amount: Cents;
  count: number;
  /** 占比 0~1，总额为 0 时为 0 */
  ratio: number;
}

/** 按用途聚合金额。只统计指定方向（默认支出），按金额倒序。 */
export function summarizeByCategory(
  txs: Tx[],
  direction: Direction = 'out',
): CategorySlice[] {
  const buckets = new Map<CategoryId, { amount: number; count: number }>();

  for (const tx of txs) {
    if (tx.direction !== direction) continue;
    if (tx.dropped) continue;
    const id = tx.category ?? 'other';
    const bucket = buckets.get(id) ?? { amount: 0, count: 0 };
    bucket.amount += tx.effectiveAmount;
    bucket.count += 1;
    buckets.set(id, bucket);
  }

  const total = [...buckets.values()].reduce((n, b) => n + b.amount, 0);

  return [...buckets.entries()]
    .map(([id, b]) => ({
      id,
      label: getCategory(id).label,
      amount: b.amount,
      count: b.count,
      ratio: total > 0 ? b.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** 按交易对方聚合，找出最花钱的几个。 */
export function topCounterparties(txs: Tx[], limit = 5): Array<{ name: string; amount: Cents }> {
  const buckets = new Map<string, number>();
  for (const tx of txs) {
    if (tx.direction !== 'out' || tx.dropped) continue;
    const name = tx.counterparty || tx.product || '未知';
    buckets.set(name, (buckets.get(name) ?? 0) + tx.effectiveAmount);
  }
  return [...buckets.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/** 按月份聚合收支。返回按月份升序的列表。 */
export interface MonthSummary {
  key: string;
  income: Cents;
  expense: Cents;
}

export function summarizeByMonth(txs: Tx[]): MonthSummary[] {
  const buckets = new Map<string, MonthSummary>();
  for (const tx of txs) {
    if (tx.dropped) continue;
    const d = new Date(tx.time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key) ?? { key, income: 0, expense: 0 };
    if (tx.direction === 'in') bucket.income += tx.effectiveAmount;
    else if (tx.direction === 'out') bucket.expense += tx.effectiveAmount;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** 月度 × 分类的支出矩阵：堆叠图数据源。按月份升序、分类金额倒序。 */
export interface MonthCategoryCell {
  id: CategoryId;
  amount: Cents;
}

export interface MonthCategoryRow {
  key: string;
  total: Cents;
  cells: MonthCategoryCell[];
}

export function monthlyCategoryMatrix(txs: Tx[]): MonthCategoryRow[] {
  const buckets = new Map<string, Map<CategoryId, number>>();
  for (const tx of txs) {
    if (tx.dropped || tx.direction !== 'out') continue;
    const d = new Date(tx.time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const id = tx.category ?? 'other';
    const catMap = buckets.get(key) ?? new Map<CategoryId, number>();
    catMap.set(id, (catMap.get(id) ?? 0) + tx.effectiveAmount);
    buckets.set(key, catMap);
  }
  return [...buckets.entries()]
    .map(([key, catMap]) => ({
      key,
      total: [...catMap.values()].reduce((a, b) => a + b, 0),
      cells: [...catMap.entries()]
        .map(([id, amount]) => ({ id, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
