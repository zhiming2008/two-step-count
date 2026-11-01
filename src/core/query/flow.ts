/**
 * 内部互转的统计口径。
 *
 * 微信账单里提现 / 零钱通 / 信用卡还款的「收/支」列都是「不计收支」，
 * 方向只能从交易类型推断。这里只统计跨越「微信 ↔ 银行」边界的流动：
 *
 *   银行 → 微信   转入零钱通-来自X银行            计收入
 *   微信 → 银行   零钱提现 / 零钱通转出-到X银行 / 信用卡还款   计支出
 *   微信内部倒手  零钱通转出-到零钱、零钱转出-到零钱通        不计（避免重复）
 *
 * 目的：总收支反映真实资金进出，又不让账户间挪钱把金额算两遍。
 */

import type { Direction, Tx } from '../types';

/** 资金流向；null = 无法判定或属于内部倒手，不计入统计。 */
export type Flow = Extract<Direction, 'in' | 'out'> | null;

/** 银行 → 微信。 */
const IN_FROM_BANK = /^转入(零钱通|零钱)-来自/;
/** 微信 → 银行。 */
const OUT_TO_BANK = /零钱提现|信用卡还款/;
/** 纯内部倒手：零钱通 ↔ 零钱。 */
const SHUFFLE = /转出-到零钱(通)?$/;

/** 从交易类型推断内部互转的资金流向。 */
export function inferInternalFlow(txType: string): Flow {
  const text = txType.trim();
  if (IN_FROM_BANK.test(text)) return 'in';
  if (OUT_TO_BANK.test(text)) return 'out';
  if (text.includes('转出-到') && !SHUFFLE.test(text)) return 'out';
  return null;
}

/**
 * 统计口径下的方向：
 * 普通流水沿用「收/支」列；内部互转按资金流向补上方向。
 */
export function statFlow(
  tx: Pick<Tx, 'direction' | 'internal' | 'txType'>,
): Flow {
  if (tx.direction !== 'neutral') return tx.direction;
  if (!tx.internal) return null;
  return inferInternalFlow(tx.txType);
}
