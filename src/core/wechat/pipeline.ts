/**
 * 导入流水线：二维表 -> 可入库的 Tx 列表。
 *
 * 分层：readBill（文件格式） -> parseBillTable（业务判定） -> buildTxList（落库形态）
 * 每一层都可单独测试。
 */

import type { BillSource, ImportBatch, ParsedRow, RawBillRow, Tx } from '../types';
import { guessCategory } from '../categories';
import type { KeywordRule } from '../keywordRules';
import { findHeaderRow, isDataRow, parseBillTime, toRawBillRow } from './schema';
import { judgeRow } from './refund';

export interface BillStats {
  total: number;
  kept: number;
  dropped: number;
  partial: number;
  internal: number;
  income: number;
  expense: number;
}

export interface BillPreview {
  rows: ParsedRow[];
  stats: BillStats;
  /** 账单文件里的元信息（昵称、区间），用于导入页展示 */
  meta: BillMeta;
}

export interface BillMeta {
  owner: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
}

/** 把一行原始值转成带判定结果的 ParsedRow。 */
export function toParsedRow(raw: RawBillRow): ParsedRow {
  const verdict = judgeRow(raw);
  return { raw, ...verdict };
}

/** 二维表 -> ParsedRow[]。找不到表头时抛错，由 UI 提示。 */
export function parseBillTable(table: string[][]): ParsedRow[] {
  const headerIndex = findHeaderRow(table);
  if (headerIndex < 0) {
    throw new Error('未识别为微信账单：找不到表头行');
  }
  return table
    .slice(headerIndex + 1)
    .filter(isDataRow)
    .map((row) => toParsedRow(toRawBillRow(row)));
}

/** 从账单头部元信息里抽取昵称与时间区间。 */
export function extractMeta(table: string[][]): BillMeta {
  const flat = table.slice(0, 20).map((r) => r.join(' '));
  const owner = flat.map((l) => l.match(/微信昵称：\[(.+?)\]/)?.[1]).find(Boolean) ?? null;

  const rangeLine = flat.find((l) => l.includes('起始时间'));
  const rangeStart = rangeLine?.match(/起始时间：\[([\d-]+)/)?.[1] ?? null;
  const rangeEnd = rangeLine?.match(/终止时间：\[([\d-]+)/)?.[1] ?? null;
  return { owner, rangeStart, rangeEnd };
}

/** 统计一次导入的概况。 */
export function summarize(rows: ParsedRow[]): BillStats {
  const stats: BillStats = {
    total: rows.length,
    kept: 0,
    dropped: 0,
    partial: 0,
    internal: 0,
    income: 0,
    expense: 0,
  };
  for (const row of rows) {
    if (row.dropped) stats.dropped += 1;
    else stats.kept += 1;
    if (row.refundFlag === 'partial') stats.partial += 1;
    if (row.internal && !row.dropped) stats.internal += 1;
    if (!row.dropped && row.direction === 'out') stats.expense += row.effectiveAmount;
    if (!row.dropped && row.direction === 'in') stats.income += row.effectiveAmount;
  }
  return stats;
}

/** 完整解析：二维表 -> 预览（含统计与元信息）。 */
export function analyzeBill(table: string[][]): BillPreview {
  const rows = parseBillTable(table);
  return { rows, stats: summarize(rows), meta: extractMeta(table) };
}

/** 去重指纹。订单号唯一且稳定，够用；缺失时退回全字段组合。 */
export function fingerprintOf(raw: RawBillRow, source: BillSource): string {
  if (raw.orderId) return `${source}:${raw.orderId}`;
  return [source, raw.time, raw.amount, raw.counterparty, raw.product, raw.merchantId].join('|');
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ParsedRow -> Tx。分类只给初始值，最终由用户在第二步确认。 */
export function toTx(row: ParsedRow, source: BillSource, rules?: KeywordRule[]): Tx {
  const now = Date.now();
  const time = parseBillTime(row.raw.time);
  return {
    id: newId(),
    source,
    time,
    direction: row.direction,
    amount: row.amount,
    effectiveAmount: row.effectiveAmount,
    counterparty: row.raw.counterparty,
    product: row.raw.product,
    payMethod: row.raw.payMethod,
    txType: row.raw.txType,
    status: row.raw.status,
    orderId: row.raw.orderId,
    merchantId: row.raw.merchantId,
    billNote: row.raw.note === '/' ? '' : row.raw.note,

    refundFlag: row.refundFlag,
    refundAmount: row.refundAmount,
    dropped: row.dropped,
    dropReason: row.dropReason,
    internal: row.internal,

    category: guessCategory(row.raw, row, rules),
    note: '',
    reviewed: false,

    fingerprint: fingerprintOf(row.raw, source),

    createdAt: now,
    updatedAt: now,
  };
}

/** 批量转换 + 生成批次记录。rules 传入用户自定义关键词（见 storage/keywordPrefs）。 */
export function buildImport(
  rows: ParsedRow[],
  source: BillSource,
  fileName: string,
  rules?: KeywordRule[],
): { txs: Tx[]; batch: ImportBatch } {
  const txs = rows.map((r) => toTx(r, source, rules));
  const stats = summarize(rows);
  return {
    txs,
    batch: {
      id: newId(),
      source,
      fileName,
      importedAt: Date.now(),
      totalRows: stats.total,
      keptRows: stats.kept,
      droppedRows: stats.dropped,
    },
  };
}
