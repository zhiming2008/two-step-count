/** 补备注队列的游标行为。 */

import { describe, expect, it } from 'vitest';
import type { ImportBatch, Tx } from '../src/core/types';
import {
  buildReviewQueue,
  countUnreviewed,
  filterByFingerprint,
  findFirstUnreviewed,
  findNextUnreviewed,
  latestBatchFingerprints,
  nextSequential,
} from '../src/core/query/reviewQueue';

function tx(id: string, time: number, reviewed = false, dropped = false): Tx {
  return {
    id,
    source: 'wechat',
    time,
    direction: 'out',
    amount: 100,
    effectiveAmount: 100,
    counterparty: '',
    product: '',
    payMethod: '',
    txType: '',
    status: '',
    orderId: id,
    merchantId: '',
    billNote: '',
    refundFlag: 'none',
    refundAmount: 0,
    dropped,
    dropReason: null,
    internal: false,
    category: null,
    note: '',
    reviewed,
    fingerprint: id,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('队列构建', () => {
  it('按时间正序且剔除 dropped', () => {
    const queue = buildReviewQueue([
      tx('c', 300),
      tx('a', 100),
      tx('x', 200, false, true),
    ]);
    expect(queue.map((t) => t.id)).toEqual(['a', 'c']);
  });
});

describe('游标推进', () => {
  const list = [
    tx('1', 100, true),
    tx('2', 200),
    tx('3', 300, true),
    tx('4', 400),
  ];

  it('跳到下一个未处理项', () => {
    expect(findNextUnreviewed(list, 0)).toBe(1);
    expect(findNextUnreviewed(list, 1)).toBe(3);
  });

  it('走到末尾会绕回开头找漏掉的', () => {
    expect(findNextUnreviewed(list, 3)).toBe(1);
  });

  it('全部处理完返回 null', () => {
    const allDone = list.map((t) => ({ ...t, reviewed: true }));
    expect(findNextUnreviewed(allDone, 2)).toBeNull();
  });

  it('空队列不炸', () => {
    expect(findNextUnreviewed([], 0)).toBeNull();
  });
});

describe('进度统计', () => {
  it('首个未处理与剩余数正确', () => {
    const list = [tx('1', 100, true), tx('2', 200)];
    expect(findFirstUnreviewed(list)).toBe(1);
    expect(countUnreviewed(list)).toBe(1);
  });

  it('全部处理完时首个未处理为 -1', () => {
    const list = [tx('1', 100, true)];
    expect(findFirstUnreviewed(list)).toBe(-1);
  });
});

describe('回看模式（从头再看一遍）', () => {
  it('顺序推进，不管处理没处理过', () => {
    const list = [tx('1', 100, true), tx('2', 200, true), tx('3', 300, true)];
    expect(nextSequential(list, 0)).toBe(1);
    expect(nextSequential(list, 1)).toBe(2);
  });

  it('到末尾返回 null（触发"看到头了"）', () => {
    const list = [tx('1', 100, true)];
    expect(nextSequential(list, 0)).toBeNull();
  });

  it('关键回归：全部已处理时回看不再复用 findNextUnreviewed', () => {
    // 全部已处理 + 从第 0 条回看：旧逻辑走 findNextUnreviewed 会返回 null 秒退
    const allDone = [tx('1', 100, true), tx('2', 200, true)];
    expect(findNextUnreviewed(allDone, 0)).toBeNull(); // 旧行为（bug）
    expect(nextSequential(allDone, 0)).toBe(1); // 新行为（修复）
  });
});

describe('只看最近导入（按批次指纹圈定范围）', () => {
  const t1 = tx('a', 100);
  const t2 = tx('b', 200);
  const t3 = tx('c', 300);
  const all = [t1, t2, t3];

  const batch = (id: string, importedAt: number, fps: string[]): ImportBatch => ({
    id,
    source: 'wechat',
    fileName: `${id}.xlsx`,
    importedAt,
    totalRows: fps.length,
    keptRows: fps.length,
    droppedRows: 0,
    fingerprints: fps,
  });

  it('取最新（importedAt 最大）且带指纹的批次', () => {
    const fps = latestBatchFingerprints([
      batch('old', 1000, ['a']),
      batch('new', 2000, ['b', 'c']),
    ]);
    expect(fps).not.toBeNull();
    expect(filterByFingerprint(all, fps!)).toEqual([t2, t3]);
  });

  it('最新批次无指纹时跳过，找更早的', () => {
    const fps = latestBatchFingerprints([
      batch('legacy', 3000, []), // 旧版本导入，无指纹
      batch('prev', 2000, ['a']),
    ]);
    expect(fps).not.toBeNull();
    expect(filterByFingerprint(all, fps!)).toEqual([t1]);
  });

  it('全部批次都无指纹 → null（退回全部流水）', () => {
    expect(latestBatchFingerprints([batch('legacy', 1000, [])])).toBeNull();
    expect(latestBatchFingerprints([])).toBeNull();
  });
});
