/** 分类关键词规则：规范化、覆盖合并、匹配。 */

import { describe, expect, it } from 'vitest';
import {
  buildRules,
  matchCategory,
  normalizeWords,
} from '../src/core/keywordRules';

describe('normalizeWords', () => {
  it('支持空格/逗号/顿号/换行混排，去空去重，转小写', () => {
    expect(normalizeWords('京东, 淘宝、拼多多 KFC\n京东')).toEqual([
      '京东',
      '淘宝',
      '拼多多',
      'kfc',
    ]);
  });

  it('纯分隔符得到空数组', () => {
    expect(normalizeWords('  ，、\n ')).toEqual([]);
  });
});

describe('buildRules（默认 + 用户覆盖）', () => {
  it('无覆盖时返回默认表（同一引用语义）', () => {
    const rules = buildRules(null);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].words.length).toBeGreaterThan(0);
  });

  it('覆盖只替换该分类词表，不动顺序', () => {
    const rules = buildRules({ food: ['螺蛳粉'] });
    const food = rules.find((r) => r.id === 'food')!;
    expect(food.words).toEqual(['螺蛳粉']);
    // 其他分类不受影响
    const transport = rules.find((r) => r.id === 'transport')!;
    expect(transport.words).toContain('酒店');
  });

  it('空数组 = 该分类退出关键词匹配', () => {
    const rules = buildRules({ shopping: [] });
    expect(rules.find((r) => r.id === 'shopping')!.words).toEqual([]);
    expect(matchCategory(rules, '京东商城购物')).toBeNull();
  });

  it('酒店归出行（居住分类已并入）', () => {
    const rules = buildRules(null);
    expect(matchCategory(rules, '汉庭酒店 住宿费')).toBe('transport');
    expect(matchCategory(rules, '如家民宿')).toBe('transport');
  });

  it('房租/租金归缴费', () => {
    const rules = buildRules(null);
    expect(matchCategory(rules, '房租 10 月')).toBe('utility');
  });
});
