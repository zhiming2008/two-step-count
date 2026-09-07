/**
 * 金额工具：元字符串 <-> 分整数。
 *
 * 为什么用分：0.1 + 0.2 !== 0.3，记账软件里累积误差不可接受。
 * 所有入库金额必须是整数分；只有渲染时才调用 formatCents。
 */

import type { Cents } from './types';

/** 把 "152.74"、"¥152.74"、"1,234.5"、152.74 统一转成分。无法解析返回 0。 */
export function toCents(value: string | number): Cents {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }
  const cleaned = value.replace(/[¥￥,\s]/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** 分转元字符串，固定两位小数，如 15274 -> "152.74"。 */
export function centsToYuan(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const yuan = Math.floor(abs / 100);
  const fen = abs % 100;
  return `${sign}${yuan}.${String(fen).padStart(2, '0')}`;
}

/** 展示用：带符号的金额，支出为负、收入为正。 */
export function formatSigned(cents: Cents): string {
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${centsToYuan(Math.abs(cents))}`;
}

/** 展示用：千分位金额，如 1234567 -> "12,345.67"。 */
export function formatCents(cents: Cents): string {
  const [int, dec] = centsToYuan(cents).split('.');
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${withSep}.${dec}` : withSep;
}

/** 带符号 + 千分位，列表主金额用这个。 */
export function formatMoney(cents: Cents): string {
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${formatCents(Math.abs(cents))}`;
}

/**
 * 从微信状态文本中解出部分退款金额。
 * 支持："已退款¥60.00"、"已退款(¥60.00)"、"已退款60.00元"
 * 返回分；非部分退款返回 0。
 */
export function parseRefundAmount(status: string): Cents {
  const m = status.match(/已退款.*?([\d]+(?:\.\d{1,2})?)/);
  if (!m) return 0;
  return toCents(m[1]);
}
