/**
 * 时间筛选与统计聚合的纯函数测试。
 * 重点覆盖：year=all + month=某月 的跨年份月份筛选（回归：曾漏掉该组合）。
 */

import { describe, expect, it } from 'vitest';
import type { Tx } from '../src/core/types';
import {
  applyQuery,
  availableYears,
  yearMonthQuery,
  type YearMonthFilter,
} from '../src/core/query/filter';
import { monthlyCategoryMatrix, summarizeByCategory, summarizeByMonth, summarizeTotals } from '../src/core/query/stats';
import { inferInternalFlow, statFlow } from '../src/core/query/flow';

function mkTx(partial: Partial<Tx> & { time: number }): Tx {
  return {
    id: `t-${partial.time}`,
    source: 'manual',
    time: partial.time,
    direction: 'out',
    amount: 100,
    effectiveAmount: 100,
    counterparty: '',
    product: '',
    payMethod: '',
    txType: '',
    status: '',
    orderId: '',
    merchantId: '',
    billNote: '',
    refundFlag: 'none',
    refundAmount: 0,
    dropped: false,
    dropReason: null,
    internal: false,
    category: 'food',
    note: '',
    reviewed: false,
    fingerprint: `fp-${partial.time}`,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

// 2026-08-15 / 2026-09-03 / 2025-08-20 / 2025-07-10
const T2026_08 = new Date(2026, 7, 15, 12, 0).getTime();
const T2026_09 = new Date(2026, 8, 3, 12, 0).getTime();
const T2025_08 = new Date(2025, 7, 20, 12, 0).getTime();
const T2025_07 = new Date(2025, 6, 10, 12, 0).getTime();

const TXS: Tx[] = [
  mkTx({ time: T2026_08 }),
  mkTx({ time: T2026_09 }),
  mkTx({ time: T2025_08 }),
  mkTx({ time: T2025_07 }),
];

describe('yearMonthQuery', () => {
  it('year=某年 + month=all -> 整年区间', () => {
    const q = yearMonthQuery({ year: 2026, month: 'all' } as YearMonthFilter);
    expect(q.from).toBe(new Date(2026, 0, 1).getTime());
    expect(q.to).toBe(new Date(2027, 0, 1).getTime());
    expect(q.months).toBeUndefined();
  });

  it('year=某年 + month=某月 -> 该月区间', () => {
    const q = yearMonthQuery({ year: 2026, month: 8 } as YearMonthFilter);
    expect(q.from).toBe(new Date(2026, 7, 1).getTime());
    expect(q.to).toBe(new Date(2026, 8, 1).getTime());
    expect(q.months).toBeUndefined();
  });

  it('year=all + month=all -> 空查询（不限时间）', () => {
    const q = yearMonthQuery({ year: 'all', month: 'all' } as YearMonthFilter);
    expect(q).toEqual({});
  });

  it('year=all + month=某月 -> months 通道（跨年份只看该月）', () => {
    const q = yearMonthQuery({ year: 'all', month: 8 } as YearMonthFilter);
    expect(q.months).toEqual([8]);
    expect(q.from).toBeUndefined();
  });
});

describe('applyQuery 时间筛选回归', () => {
  it('全部年份 + 8月 只出 8 月流水（跨 2025/2026）', () => {
    const visible = applyQuery(TXS, yearMonthQuery({ year: 'all', month: 8 }));
    expect(visible.map((t) => t.time).sort()).toEqual([T2025_08, T2026_08].sort());
  });

  it('2026年 + 全部月份 只出 2026 流水', () => {
    const visible = applyQuery(TXS, yearMonthQuery({ year: 2026, month: 'all' }));
    expect(visible.map((t) => t.time).sort()).toEqual([T2026_08, T2026_09].sort());
  });

  it('全部年份 + 全年 = 全部流水', () => {
    const visible = applyQuery(TXS, yearMonthQuery({ year: 'all', month: 'all' }));
    expect(visible).toHaveLength(TXS.length);
  });
});

describe('availableYears', () => {
  it('返回出现过的年份（倒序）', () => {
    expect(availableYears(TXS)).toEqual([2026, 2025]);
  });
});

describe('summarizeByMonth', () => {
  it('按月份升序聚合收支', () => {
    const income = mkTx({ time: T2026_08, direction: 'in', effectiveAmount: 500 });
    const months = summarizeByMonth([TXS[0], TXS[1], income]);
    expect(months.map((m) => m.key)).toEqual(['2026-08', '2026-09']);
    expect(months[0].expense).toBe(100);
    expect(months[0].income).toBe(500);
  });
});

describe('内部互转的统计口径', () => {
  it('银行 -> 微信 计收入', () => {
    expect(inferInternalFlow('转入零钱通-来自工商银行(7928)')).toBe('in');
    expect(inferInternalFlow('转入零钱-来自招商银行(8146)')).toBe('in');
  });

  it('提现 / 转出到银行 / 信用卡还款 计支出', () => {
    expect(inferInternalFlow('零钱提现')).toBe('out');
    expect(inferInternalFlow('零钱通转出-到招商银行(8146)')).toBe('out');
    expect(inferInternalFlow('信用卡还款')).toBe('out');
  });

  it('零钱通 <-> 零钱 内部倒手不计，避免重复', () => {
    expect(inferInternalFlow('零钱通转出-到零钱')).toBeNull();
    expect(inferInternalFlow('零钱转出-到零钱通')).toBeNull();
  });

  it('普通流水沿用收支方向，无关类型不猜方向', () => {
    expect(statFlow(mkTx({ time: T2026_08 }))).toBe('out');
    expect(
      statFlow(mkTx({ time: T2026_08, direction: 'neutral', internal: true, txType: '理财通' })),
    ).toBeNull();
  });

  it('月度收支纳入可判定的内部互转', () => {
    const withdraw = mkTx({
      time: T2026_08,
      direction: 'neutral',
      internal: true,
      txType: '零钱提现',
      effectiveAmount: 2000,
      category: 'transfer',
    });
    const fromBank = mkTx({
      time: T2026_08,
      direction: 'neutral',
      internal: true,
      txType: '转入零钱通-来自招商银行(8146)',
      effectiveAmount: 5000,
      category: 'transfer',
    });
    const shuffle = mkTx({
      time: T2026_08,
      direction: 'neutral',
      internal: true,
      txType: '零钱通转出-到零钱',
      effectiveAmount: 999,
      category: 'transfer',
    });

    const months = summarizeByMonth([withdraw, fromBank, shuffle, TXS[0]]);
    expect(months[0].expense).toBe(2000 + 100);
    expect(months[0].income).toBe(5000);

    const totals = summarizeTotals([withdraw, fromBank, shuffle, TXS[0]]);
    expect(totals.expense).toBe(2100);
    expect(totals.income).toBe(5000);
    expect(totals.net).toBe(2900);
  });

  it('分类占比不纳入内部互转（只看真实消费）', () => {
    const withdraw = mkTx({
      time: T2026_08,
      direction: 'neutral',
      internal: true,
      txType: '零钱提现',
      effectiveAmount: 2000,
      category: 'transfer',
    });

    expect(summarizeByCategory([withdraw], 'out')).toHaveLength(0);
    const rows = monthlyCategoryMatrix([withdraw, TXS[0]]);
    expect(rows[0].total).toBe(100);
  });
});

describe('monthlyCategoryMatrix', () => {
  it('按月×分类聚合支出，忽略收入与 dropped', () => {
    const foodAug = mkTx({ time: T2026_08, category: 'food', effectiveAmount: 300 });
    const shopAug = mkTx({ time: T2026_08, category: 'shopping', effectiveAmount: 700 });
    const dropped = mkTx({ time: T2026_08, dropped: true, effectiveAmount: 999 });
    const income = mkTx({ time: T2026_08, direction: 'in', effectiveAmount: 999 });

    const rows = monthlyCategoryMatrix([foodAug, shopAug, dropped, income]);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('2026-08');
    expect(rows[0].total).toBe(1000);
    // 分类金额倒序：shopping(700) 在前
    expect(rows[0].cells.map((c) => c.id)).toEqual(['shopping', 'food']);
  });

  it('按月份升序返回多个月', () => {
    const rows = monthlyCategoryMatrix([
      mkTx({ time: T2026_08 }),
      mkTx({ time: T2025_07, category: 'transport' }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(['2025-07', '2026-08']);
  });
});
