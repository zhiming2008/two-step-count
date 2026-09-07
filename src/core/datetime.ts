/** 时间格式化。纯函数，集中放置避免各页面各写一套。 */

const pad = (n: number) => String(n).padStart(2, '0');

/** 2026-08-31 */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 08-31 11:58 */
export function formatShort(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 2026-08-31 11:58:01 */
export function formatFull(ts: number): string {
  const d = new Date(ts);
  return `${formatDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 2026-08 */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 用于按键分组的日期（同一天归一组） */
export function dayKey(ts: number): string {
  return formatDate(ts);
}
