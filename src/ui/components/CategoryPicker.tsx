/** 分类选择器：一行 chips，点击即选。分类权在用户手上，这里不做自动折叠。 */

import { CATEGORIES } from '../../core/categories';
import type { CategoryId } from '../../core/types';

interface Props {
  value: CategoryId | null;
  onChange: (id: CategoryId) => void;
}

export function CategoryPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={value === c.id ? 'chip-on' : 'chip-off'}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
