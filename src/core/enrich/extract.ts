/**
 * 从账单文本里提取平台订单号。
 *
 * 这部分是纯函数且现在就有用（可用于展示"这笔是京东订单"），
 * 所以先实现；真正的网络反查留到 jd.ts 的 TODO。
 *
 * 真实样本：
 *   京东   商品 = "京东-订单编号3590998800099009"
 *   拼多多 商品 = "商户单号XP00000000000001"
 */

import type { Tx } from '../types';
import type { OrderQuery, Platform } from './types';

interface PlatformPattern {
  platform: Platform;
  /** 命中交易对方/商品即判定平台 */
  merchant: RegExp;
  /** 从文本里抠订单号 */
  order: RegExp;
}

const PATTERNS: PlatformPattern[] = [
  {
    platform: 'jd',
    merchant: /京东/,
    order: /订单编号[:：]?\s*(\d{10,})/,
  },
  {
    platform: 'pdd',
    merchant: /拼多多/,
    order: /商户单号[:：]?\s*([A-Za-z0-9]{8,})/,
  },
  {
    platform: 'taobao',
    merchant: /淘宝|天猫/,
    order: /订单号[:：]?\s*(\d{10,})/,
  },
];

/** 识别该笔流水属于哪个平台。 */
export function detectPlatform(tx: Tx): Platform {
  const text = `${tx.counterparty} ${tx.product}`;
  for (const p of PATTERNS) {
    if (p.merchant.test(text)) return p.platform;
  }
  return 'unknown';
}

/**
 * 提取订单引用。找不到订单号时，若平台可识别也返回一条（orderId 为空，
 * 供 UI 显示"疑似 XX 订单但没解析出单号"，方便人工补）。
 */
export function extractOrderRefs(tx: Tx): OrderQuery[] {
  const platform = detectPlatform(tx);
  if (platform === 'unknown') return [];

  const pattern = PATTERNS.find((p) => p.platform === platform);
  const haystack = `${tx.product} ${tx.billNote} ${tx.merchantId}`;
  const matched = pattern ? haystack.match(pattern.order) : null;

  return [
    {
      platform,
      orderId: matched ? matched[1] : '',
      merchantId: tx.merchantId || undefined,
      raw: haystack.trim(),
    },
  ];
}

/** 判断这笔是否值得去反查（有单号才查，避免无谓请求）。 */
export function canEnrich(tx: Tx): boolean {
  return extractOrderRefs(tx).some((q) => q.orderId !== '');
}
