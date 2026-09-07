/**
 * 分类关键词规则（纯逻辑，无 IO）。
 *
 * 默认规则写死在代码里作为兜底；用户可在设置页按分类改关键词，
 * 覆盖值由 storage 层持久化，经 buildRules() 合并后生效。
 * 匹配范围 = 交易类型 + 交易对方 + 商品，全部小写后 contains。
 * 顺序敏感：越靠前优先级越高，所以"改词"只改词表，不动顺序。
 */

import type { CategoryId } from './types';

export interface KeywordRule {
  id: CategoryId;
  words: string[];
}

/** 用户覆盖表：分类 id → 关键词数组（整体替换该分类的默认词表）。 */
export type KeywordOverrides = Partial<Record<CategoryId, string[]>>;

export const DEFAULT_KEYWORD_RULES: KeywordRule[] = [
  {
    id: 'medical',
    words: ['医院', '药房', '药店', '诊所', '医疗', '体检', '挂号'],
  },
  {
    id: 'recharge',
    words: ['充值中心', 'q币', 'qq币', '游戏充值', '会员充值', '流量包', '话费充值'],
  },
  {
    id: 'entertainment',
    words: ['电影', '影院', 'ktv', '演出', '门票', '视频会员', '音乐', '游乐', '游戏'],
  },
  {
    // 酒店住宿归出行（原"居住"分类已并入）
    id: 'transport',
    words: [
      '滴滴', '出行', '打车', '高德', '地铁', '公交', '高铁', '火车', '机票',
      '航空', '加油', '停车', '单车', '助力车', '共享', '客运', '铁路',
      '酒店', '住宿', '民宿', '宾馆', '公寓',
    ],
  },
  {
    id: 'utility',
    words: ['电费', '水费', '燃气', '宽带', '物业', '房租', '租金', '学费', '校园', '一卡通', '缴存'],
  },
  {
    id: 'food',
    words: [
      '餐饮', '美食', '外卖', '美团', '饿了么', '咖啡', '奶茶', '食堂', '饭店',
      '餐厅', '汉堡', '小吃', '火锅', '瑞幸', '星巴克', '蜜雪', '烘焙', '面馆', '烧烤',
    ],
  },
  {
    id: 'shopping',
    words: [
      '京东', '淘宝', '天猫', '拼多多', '商城', '超市', '便利店', '唯品会',
      '服饰', '数码', '书店', '购物',
    ],
  },
];

/**
 * 把用户输入的一坨文本规范化成词表：
 * 支持空格/逗号/顿号/分号/换行分隔，去空去重，统一小写（英文词）。
 */
export function normalizeWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of text.split(/[\s,，、;；\n]+/)) {
    const word = w.trim().toLowerCase();
    if (word && !seen.has(word)) {
      seen.add(word);
      out.push(word);
    }
  }
  return out;
}

/**
 * 合并默认规则与用户覆盖：
 * - 覆盖了词表的分类用用户的（空数组 = 该分类不参与关键词匹配）；
 * - 没覆盖的保持默认；默认之外的分类（理论上没有）追加到末尾。
 * 顺序 = 默认顺序，用户改词不影响优先级。
 */
export function buildRules(overrides: KeywordOverrides | null): KeywordRule[] {
  if (!overrides) return DEFAULT_KEYWORD_RULES;
  const rules = DEFAULT_KEYWORD_RULES.map((r) =>
    Array.isArray(overrides[r.id]) ? { id: r.id, words: overrides[r.id]! } : r,
  );
  const known = new Set(rules.map((r) => r.id));
  for (const [id, words] of Object.entries(overrides)) {
    if (!known.has(id as CategoryId) && Array.isArray(words) && words.length > 0) {
      rules.push({ id: id as CategoryId, words });
    }
  }
  return rules;
}

/** 按词表匹配（已小写的 haystack），命中返回分类，否则 null。 */
export function matchCategory(rules: KeywordRule[], haystack: string): CategoryId | null {
  for (const rule of rules) {
    if (rule.words.some((w) => haystack.includes(w))) return rule.id;
  }
  return null;
}
