/**
 * 微信账单的文件契约。
 *
 * 关键点：微信导出的 xlsx/csv 顶部有 16~17 行元数据（昵称、统计、注意事项），
 * 表头行位置并不固定。因此不写死行号，而是"扫描定位表头行"。
 */

import type { RawBillRow } from '../types';

/** 微信账单标准列名（顺序即列序）。 */
export const WECHAT_COLUMNS = [
  '交易时间',
  '交易类型',
  '交易对方',
  '商品',
  '收/支',
  '金额(元)',
  '支付方式',
  '当前状态',
  '交易单号',
  '商户单号',
  '备注',
] as const;

/** 表头行必须具备的特征列。 */
const HEADER_MARKERS = ['交易时间', '交易类型', '金额'];

/** 交易类型中属于"账户内部搬运"的模式：提现 / 零钱通存取 / 信用卡还款。 */
export const INTERNAL_TYPE_PATTERN =
  /零钱提现|零钱通|信用卡还款|亲属卡|理财通|转入零钱|零钱转出/;

/** 交易类型后缀为 "-退款" 的是退款流水（资金回流，不是收入）。 */
export const REFUND_TYPE_PATTERN = /-退款$|退款$/;

/**
 * 在二维表里定位表头行下标，找不到返回 -1。
 * 用"包含全部特征列"判定，避免把统计行误当表头。
 */
export function findHeaderRow(table: string[][]): number {
  for (let i = 0; i < table.length; i += 1) {
    const line = table[i].join('|');
    if (HEADER_MARKERS.every((m) => line.includes(m))) return i;
  }
  return -1;
}

/**
 * 判断该行是否为有效数据行。
 * 微信账单里存在空行与说明行，用"首列是否像时间戳"过滤最可靠。
 */
const TIME_PATTERN = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;

export function isDataRow(row: string[]): boolean {
  return TIME_PATTERN.test((row[0] ?? '').trim());
}

/** 按表头列序把一行原始值映射成 RawBillRow；列数不足时补空串。 */
export function toRawBillRow(row: string[]): RawBillRow {
  const get = (i: number) => (row[i] ?? '').trim();
  return {
    time: get(0),
    txType: get(1),
    counterparty: get(2),
    product: get(3),
    inOut: get(4),
    amount: get(5),
    payMethod: get(6),
    status: get(7),
    orderId: get(8),
    merchantId: get(9),
    note: get(10),
  };
}

/** 交易时间字符串 -> 毫秒时间戳。格式 "2026-08-31 11:58:01"。 */
export function parseBillTime(text: string): number {
  const normalized = text.trim().replace(/\//g, '-');
  const ts = Date.parse(normalized.replace(' ', 'T'));
  if (Number.isNaN(ts)) return 0;
  // 账单时间为 UTC+8，无时区标记；按本地时区解析时若偏差过大则补 8 小时。
  return ts;
}
