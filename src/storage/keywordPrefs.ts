/**
 * 分类关键词的用户覆盖（localStorage 持久化）。
 *
 * 分层：core/keywordRules.ts 管纯逻辑，这里只管存取。
 * localStorage 同步且小（几 KB），网页端与将来的 Tauri WebView 都支持。
 */

import { buildRules, type KeywordOverrides, type KeywordRule } from '../core/keywordRules';

const KEY = 'tsc.keyword-overrides';

export function loadOverrides(): KeywordOverrides | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KeywordOverrides;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOverrides(overrides: KeywordOverrides): void {
  localStorage.setItem(KEY, JSON.stringify(overrides));
}

export function resetOverrides(): void {
  localStorage.removeItem(KEY);
}

/** 合并后的生效规则（导入流水线用这个，别直接用默认表）。 */
export function effectiveRules(): KeywordRule[] {
  return buildRules(loadOverrides());
}
