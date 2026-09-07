/**
 * 账单解析入口：根据扩展名分派到 xlsx / csv 读取器。
 * 输出统一的二维表，后续逻辑与文件格式无关。
 */

import { readCsv } from './readCsv';
import { readXlsx } from './readXlsx';

export type BillFileKind = 'xlsx' | 'csv';

export function detectKind(fileName: string): BillFileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return 'xlsx';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

/** 字节 -> 二维表。格式不受支持时抛出可读错误。 */
export function readBillFile(data: Uint8Array, fileName: string): string[][] {
  const kind = detectKind(fileName);
  if (kind === 'xlsx') return readXlsx(data);
  if (kind === 'csv') return readCsv(data);
  throw new Error('只支持 .xlsx 和 .csv 账单文件');
}
