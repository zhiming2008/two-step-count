/**
 * 备份与导出 —— 纯序列化逻辑，不碰 DOM（下载由 ui/utils/download 负责）。
 */

import type { ImportBatch, Tx } from './types';
import { formatFull } from './datetime';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'two-step-count';
  version: number;
  exportedAt: number;
  txs: Tx[];
  batches: ImportBatch[];
}

/** 生成 JSON 备份（格式化输出，方便 diff 与手工修）。 */
export function toBackupJson(txs: Tx[], batches: ImportBatch[]): string {
  const payload: BackupFile = {
    app: 'two-step-count',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    txs,
    batches,
  };
  return JSON.stringify(payload, null, 2);
}

/** 解析备份。结构不对就抛可读错误，由 UI 提示。 */
export function parseBackupJson(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('不是合法的 JSON 文件');
  }
  if (typeof data !== 'object' || data === null) throw new Error('备份内容为空');
  const file = data as Partial<BackupFile>;
  if (file.app !== 'two-step-count') throw new Error('这不是两步记账的备份文件');
  if (!Array.isArray(file.txs)) throw new Error('备份里缺少流水数据');
  return {
    app: 'two-step-count',
    version: file.version ?? BACKUP_VERSION,
    exportedAt: file.exportedAt ?? Date.now(),
    txs: file.txs as Tx[],
    batches: Array.isArray(file.batches) ? (file.batches as ImportBatch[]) : [],
  };
}

const CSV_COLUMNS = [
  '交易时间',
  '方向',
  '金额',
  '用途',
  '备注',
  '交易对方',
  '商品',
  '支付方式',
  '内部转账',
  '部分退款',
] as const;

const DIRECTION_LABEL = { out: '支出', in: '收入', neutral: '不计收支' } as const;

/** CSV 单元格转义：含逗号/引号/换行时加引号，内部引号翻倍。 */
function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * 流水导出为 CSV。
 * 带 UTF-8 BOM，Excel 直接双击不会乱码。
 */
export function toCsv(txs: Tx[], categoryLabel: (id: string | null) => string): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const tx of txs) {
    lines.push(
      [
        formatFull(tx.time),
        DIRECTION_LABEL[tx.direction],
        (tx.effectiveAmount / 100).toFixed(2),
        categoryLabel(tx.category),
        tx.note,
        tx.counterparty,
        tx.product,
        tx.payMethod,
        tx.internal ? '是' : '',
        tx.refundFlag === 'partial' ? `退${(tx.refundAmount / 100).toFixed(2)}` : '',
      ]
        .map((v) => escapeCell(String(v ?? '')))
        .join(','),
    );
  }
  return `﻿${lines.join('\r\n')}`;
}
