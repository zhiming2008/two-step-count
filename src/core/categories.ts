/**
 * 用途分类。
 *
 * 定位：这里的自动猜测只是"给个默认值"，省去重复点击；
 * 真正的分类权始终在用户手上（第二步逐条确认时可一键改）。
 * 因此规则宁可保守（猜不出就给 other），不做激进匹配。
 *
 * 关键词词表在 keywordRules.ts（默认值 + 用户覆盖合并），
 * guessCategory 的 rules 参数由调用方注入（UI 层从 keywordPrefs 读）。
 */

import type { Category, CategoryId, ParsedRow, RawBillRow } from './types';
import { DEFAULT_KEYWORD_RULES, matchCategory, type KeywordRule } from './keywordRules';

export const CATEGORIES: Category[] = [
  { id: 'shopping', label: '购物', tone: 'bg-rose-500', hex: '#f43f5e' },
  { id: 'food', label: '餐饮', tone: 'bg-orange-500', hex: '#f97316' },
  { id: 'transport', label: '出行', tone: 'bg-sky-500', hex: '#0ea5e9' },
  { id: 'utility', label: '缴费', tone: 'bg-amber-500', hex: '#f59e0b' },
  { id: 'transfer', label: '转账', tone: 'bg-slate-500', hex: '#64748b' },
  { id: 'recharge', label: '充值', tone: 'bg-violet-500', hex: '#8b5cf6' },
  { id: 'entertainment', label: '娱乐', tone: 'bg-pink-500', hex: '#ec4899' },
  { id: 'medical', label: '医疗', tone: 'bg-emerald-500', hex: '#10b981' },
  { id: 'other', label: '其他', tone: 'bg-gray-400', hex: '#9ca3af' },
];

const CATEGORY_MAP = new Map<CategoryId, Category>(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: CategoryId | null): Category {
  return CATEGORY_MAP.get(id ?? 'other') ?? CATEGORIES[CATEGORIES.length - 1];
}

/** 仅凭交易类型即可定类的情况（内部转账优先于关键词）。 */
const TYPE_RULES: Array<{ test: RegExp; id: CategoryId }> = [
  { test: /零钱提现|零钱通|信用卡还款|亲属卡/, id: 'transfer' },
  { test: /转账|红包/, id: 'transfer' },
];

/**
 * 猜一个初始分类。
 * @param raw 原始账单行
 * @param parsed 解析结果（用到了 internal / direction）
 * @param rules 关键词规则（默认用内置词表；设置页改词后由调用方传入合并结果）
 */
export function guessCategory(
  raw: RawBillRow,
  parsed: ParsedRow,
  rules: KeywordRule[] = DEFAULT_KEYWORD_RULES,
): CategoryId {
  if (parsed.internal) return 'transfer';
  if (parsed.direction === 'in') return 'transfer';

  for (const rule of TYPE_RULES) {
    if (rule.test.test(raw.txType)) return rule.id;
  }

  const haystack = `${raw.txType} ${raw.counterparty} ${raw.product}`.toLowerCase();
  return matchCategory(rules, haystack) ?? 'other';
}
