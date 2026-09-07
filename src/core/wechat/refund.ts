/**
 * 退款判定 —— 本项目最核心的业务规则。
 *
 * 真实账单观察（微信 2026-08 导出，77 笔）：
 *   1. 一次退款会产生两行：原支出行 + 一条 "xxx-退款" 收入行；
 *   2. 退款行的交易单号与原支出行完全不同，商户单号为空 —— 无法靠单号配对；
 *   3. 交易对方还可能对不上（"京东" vs "京东商城平台商户"），金额也可能不等。
 *
 * 因此放弃"配对"，改为按行独立判定：
 *   - 退款收入行：交易类型以 "-退款" 结尾 -> 剔除（资金回流，不是收入）
 *   - 已全额退款的支出：剔除（钱没真花出去）
 *   - 部分退款的支出：状态里自带退款额（"已退款(¥60.00)"）-> 实付 = 原额 - 退款额
 *
 * 这样两边各自处理，不依赖配对，对账目自平衡。
 */

import type { Direction, RawBillRow, RefundFlag } from '../types';
import { parseRefundAmount, toCents } from '../money';
import { INTERNAL_TYPE_PATTERN, REFUND_TYPE_PATTERN } from './schema';

/** 全额退款 / 撤销 / 冲正：这笔支出等于没发生。 */
const FULL_REFUND_PATTERN = /已全额退款|全额退款|已撤销|已冲正|已关闭/;
/** 部分退款：状态中会带金额。 */
const PARTIAL_REFUND_PATTERN = /已退款/;

export interface RowVerdict {
  direction: Direction;
  amount: number;
  refundFlag: RefundFlag;
  refundAmount: number;
  effectiveAmount: number;
  dropped: boolean;
  dropReason: string | null;
  internal: boolean;
}

/** 收/支 列 -> Direction。'/' 与 '不计收支' 都算中性。 */
export function parseDirection(inOut: string): Direction {
  const text = inOut.trim();
  if (text === '支出') return 'out';
  if (text === '收入') return 'in';
  return 'neutral';
}

/** 是否为账户内部搬运（提现 / 零钱通存取 / 信用卡还款）。 */
export function isInternal(raw: RawBillRow, direction: Direction): boolean {
  return direction === 'neutral' || INTERNAL_TYPE_PATTERN.test(raw.txType);
}

/** 是否为退款回流行。 */
export function isRefundIncome(raw: RawBillRow, direction: Direction): boolean {
  return direction === 'in' && REFUND_TYPE_PATTERN.test(raw.txType);
}

/**
 * 对单行做完整判定。纯函数，便于单测。
 */
export function judgeRow(raw: RawBillRow): RowVerdict {
  const direction = parseDirection(raw.inOut);
  const amount = toCents(raw.amount);
  const internal = isInternal(raw, direction);

  const base = {
    direction,
    amount,
    internal,
    refundFlag: 'none' as RefundFlag,
    refundAmount: 0,
    effectiveAmount: amount,
    dropped: false,
    dropReason: null as string | null,
  };

  // 规则 1：退款回流行 —— 不是收入，剔除
  if (isRefundIncome(raw, direction)) {
    return {
      ...base,
      dropped: true,
      dropReason: '退款回流，不计收入',
    };
  }

  if (direction === 'out') {
    // 规则 2：全额退款 -> 整笔剔除
    if (FULL_REFUND_PATTERN.test(raw.status)) {
      return {
        ...base,
        refundFlag: 'full',
        effectiveAmount: 0,
        dropped: true,
        dropReason: '已全额退款',
      };
    }
    // 规则 3：部分退款 -> 从状态里抠出退款额，按实付记账
    if (PARTIAL_REFUND_PATTERN.test(raw.status)) {
      const refundAmount = parseRefundAmount(raw.status);
      if (refundAmount > 0) {
        const effective = amount - refundAmount;
        if (effective <= 0) {
          return {
            ...base,
            refundFlag: 'full',
            refundAmount,
            effectiveAmount: 0,
            dropped: true,
            dropReason: '退款覆盖全额',
          };
        }
        return {
          ...base,
          refundFlag: 'partial',
          refundAmount,
          effectiveAmount: effective,
        };
      }
      // 状态写了"已退款"但没抠出金额 —— 保守处理：标记但保留原额，交由用户确认
      return {
        ...base,
        refundFlag: 'partial',
        effectiveAmount: amount,
      };
    }
  }

  return base;
}
