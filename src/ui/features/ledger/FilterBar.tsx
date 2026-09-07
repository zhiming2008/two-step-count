/** 流水筛选栏：时间（年/月）、用途、方向、关键字。 */

import { CATEGORIES } from '../../../core/categories';
import type { CategoryId, Direction } from '../../../core/types';

export interface LedgerFilter {
  year: number | 'all';
  month: number | 'all';
  categories: CategoryId[];
  directions: Direction[];
  keyword: string;
  excludeInternal: boolean;
}

export const EMPTY_FILTER: LedgerFilter = {
  year: 'all',
  month: 'all',
  categories: [],
  directions: [],
  keyword: '',
  excludeInternal: false,
};

const DIRECTIONS: Array<{ id: Direction; label: string }> = [
  { id: 'out', label: '支出' },
  { id: 'in', label: '收入' },
  { id: 'neutral', label: '内部转账' },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Props {
  value: LedgerFilter;
  years: number[];
  onChange: (next: LedgerFilter) => void;
}

export function FilterBar({ value, years, onChange }: Props) {
  const patch = (p: Partial<LedgerFilter>) => onChange({ ...value, ...p });

  const toggleCategory = (id: CategoryId) => {
    const has = value.categories.includes(id);
    patch({
      categories: has ? value.categories.filter((c) => c !== id) : [...value.categories, id],
    });
  };

  const toggleDirection = (id: Direction) => {
    const has = value.directions.includes(id);
    patch({
      directions: has ? value.directions.filter((d) => d !== id) : [...value.directions, id],
    });
  };

  return (
    <div className="space-y-2.5 border-b border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value.year === 'all' ? 'all' : String(value.year)}
          onChange={(e) =>
            patch({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })
          }
          className="field w-28"
        >
          <option value="all">全部年份</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>

        <select
          value={value.month === 'all' ? 'all' : String(value.month)}
          onChange={(e) =>
            patch({ month: e.target.value === 'all' ? 'all' : Number(e.target.value) })
          }
          className="field w-24"
        >
          <option value="all">全年</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m} 月
            </option>
          ))}
        </select>

        <input
          value={value.keyword}
          onChange={(e) => patch({ keyword: e.target.value })}
          placeholder="搜备注 / 对方 / 商品"
          className="field w-56"
        />

        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={value.excludeInternal}
            onChange={(e) => patch({ excludeInternal: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
          />
          隐藏内部转账
        </label>

        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTER)}
          className="btn-ghost ml-auto px-2.5 py-1.5 text-xs"
        >
          重置
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {DIRECTIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => toggleDirection(d.id)}
            className={value.directions.includes(d.id) ? 'chip-on' : 'chip-off'}
          >
            {d.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggleCategory(c.id)}
            className={value.categories.includes(c.id) ? 'chip-on' : 'chip-off'}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
