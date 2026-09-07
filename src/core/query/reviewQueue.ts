/**
 * 补备注队列。
 *
 * 语义（关键）：
 * - 队列是"全部流水按时间正序"，已处理的也留在里面。
 *   这样"上一条 / 下一条"永远是时间上紧邻的两笔，回想上下文才成立；
 *   如果只排未处理的，刚写完备注的那条会立刻消失，反而看不到。
 * - 游标推进时跳过已处理的，所以正常操作只会停在没处理过的条目上。
 */

import type { ImportBatch, Tx } from '../types';

/** 构建队列：排除被自动剔除的，按交易时间正序。 */
export function buildReviewQueue(txs: Tx[]): Tx[] {
  return txs
    .filter((t) => !t.dropped)
    .slice()
    .sort((a, b) => a.time - b.time);
}

/**
 * 回看模式（"从头再看一遍"）的推进：不管处理没处理过，顺序走下一条。
 * 全部流水的备注当时都已处理完，若复用 findNextUnreviewed 会一按回车就
 * 判"补完了" —— 回看的语义是浏览 + 可改，不是找未处理项。
 */
export function nextSequential(list: Tx[], index: number): number | null {
  return index + 1 < list.length ? index + 1 : null;
}

/**
 * 最新一个带指纹的批次的指纹集（"只看最近导入"的范围）。
 * 旧版本批次没有 fingerprints，跳过找更早的；一个都没有返回 null（退回全部）。
 */
export function latestBatchFingerprints(batches: ImportBatch[]): Set<string> | null {
  const sorted = [...batches].sort((a, b) => b.importedAt - a.importedAt);
  for (const b of sorted) {
    if (b.fingerprints && b.fingerprints.length > 0) return new Set(b.fingerprints);
  }
  return null;
}

/** 按指纹集筛选流水（"只看最近导入"用）。 */
export function filterByFingerprint(txs: Tx[], fps: Set<string>): Tx[] {
  return txs.filter((t) => fps.has(t.fingerprint));
}

/**
 * 从 fromIndex 之后找下一个未处理条目的下标（环形：走到末尾再从头）。
 * 找不到（全部已处理）返回 null。
 */
export function findNextUnreviewed(list: Tx[], fromIndex: number): number | null {
  if (list.length === 0) return null;

  for (let i = fromIndex + 1; i < list.length; i += 1) {
    if (!list[i].reviewed) return i;
  }
  for (let i = 0; i < Math.min(fromIndex + 1, list.length); i += 1) {
    if (!list[i].reviewed) return i;
  }
  return null;
}

/** 第一个未处理条目的下标；全部处理完返回 -1。 */
export function findFirstUnreviewed(list: Tx[]): number {
  return list.findIndex((t) => !t.reviewed);
}

/** 未处理条数。 */
export function countUnreviewed(list: Tx[]): number {
  return list.reduce((n, t) => (t.reviewed ? n : n + 1), 0);
}
