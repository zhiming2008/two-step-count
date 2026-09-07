/**
 * 设置页 · 分类关键词编辑卡片。
 *
 * 每个有关键词的分类一个编辑框，空格/逗号分隔；
 * 保存后写入 localStorage 覆盖，导入新账单时生效。
 * 明确告知用户：改词不影响已导入流水的分类（那是用户手动确认过的领域）。
 */

import { useState } from 'react';
import { DEFAULT_KEYWORD_RULES, normalizeWords } from '../../../core/keywordRules';
import { getCategory } from '../../../core/categories';
import type { CategoryId } from '../../../core/types';
import {
  loadOverrides,
  resetOverrides,
  saveOverrides,
} from '../../../storage/keywordPrefs';

export function KeywordRulesCard() {
  /** 草稿：分类 id → 编辑框文本 */
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const overrides = loadOverrides();
    const out: Record<string, string> = {};
    for (const r of DEFAULT_KEYWORD_RULES) {
      const words = overrides?.[r.id] ?? r.words;
      out[r.id] = words.join(' ');
    }
    return out;
  });
  const [dirty, setDirty] = useState(false);

  const setOne = (id: string, text: string) => {
    setDraft((prev) => ({ ...prev, [id]: text }));
    setDirty(true);
  };

  const save = () => {
    const overrides: Partial<Record<CategoryId, string[]>> = {};
    let changed = false;
    for (const r of DEFAULT_KEYWORD_RULES) {
      const words = normalizeWords(draft[r.id] ?? '');
      if (words.join(' ') !== r.words.join(' ')) {
        overrides[r.id] = words;
        changed = true;
      }
    }
    if (changed) saveOverrides(overrides);
    else resetOverrides();
    setDirty(false);
    return changed;
  };

  const reset = () => {
    if (!window.confirm('恢复全部为默认关键词？当前修改会丢失。')) return;
    resetOverrides();
    const out: Record<string, string> = {};
    for (const r of DEFAULT_KEYWORD_RULES) out[r.id] = r.words.join(' ');
    setDraft(out);
    setDirty(false);
  };

  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold text-slate-800">分类关键词</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        导入账单时按这些词自动猜分类（匹配「交易类型 + 对方 + 商品」，命中即停，
        从上到下优先）。改动只影响<b>之后导入</b>的账单，已导入流水的分类不变。
      </p>
      <div className="mt-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {DEFAULT_KEYWORD_RULES.map((r) => (
          <label key={r.id} className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: getCategory(r.id).hex }}
              />
              {getCategory(r.id).label}
            </span>
            <textarea
              value={draft[r.id] ?? ''}
              onChange={(e) => setOne(r.id, e.target.value)}
              rows={2}
              spellCheck={false}
              placeholder="空格或逗号分隔"
              className="field w-full resize-y font-mono text-xs leading-relaxed"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const changed = save();
            window.alert(changed ? '已保存，之后导入的账单会按新关键词分类' : '与默认一致，无需保存');
          }}
        >
          保存
        </button>
        <button type="button" className="btn-ghost" onClick={reset} disabled={!dirty}>
          恢复默认
        </button>
      </div>
    </section>
  );
}
