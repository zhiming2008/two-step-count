/**
 * 读取 xlsx —— 只做一件事：把 .xlsx 解成二维字符串数组。
 *
 * 为什么不用 SheetJS：
 * 1. 供应链干净，不引 1MB 的表格全家桶；
 * 2. 微信账单结构规整（纯文本单元格），自解析足够；
 * 3. 无 DOM 依赖，node 测试环境也能跑。
 *
 * xlsx 本质 = zip + 一堆 xml：
 *   xl/sharedStrings.xml  共享字符串池（文本单元格存的是下标）
 *   xl/worksheets/sheetN.xml  真正的单元格网格
 */

import { strFromU8, unzipSync } from 'fflate';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** 反转义 XML 实体，含 &#123; 数字引用。 */
export function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (_m, name: string) => {
    if (name.startsWith('#')) {
      const code = Number(name.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    return NAMED_ENTITIES[name] ?? '';
  });
}

/** 取出一段 xml 中所有 <t> 的文本并拼接（富文本 <si><r><t> 需要拼接）。 */
function extractText(block: string): string {
  let out = '';
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m = re.exec(block);
  while (m) {
    out += decodeEntities(m[1]);
    m = re.exec(block);
  }
  return out;
}

/** 解析 sharedStrings.xml，返回字符串池数组。 */
export function parseSharedStrings(xml: string): string[] {
  const pool: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m = re.exec(xml);
  while (m) {
    pool.push(m[1] ? extractText(m[1]) : '');
    m = re.exec(xml);
  }
  return pool;
}

/** "A19" / "AB3" -> 列下标（0 起）。 */
export function columnRefToIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) n = n * 26 + (code - 64);
    else if (code >= 97 && code <= 122) n = n * 26 + (code - 96);
    else break;
  }
  return Math.max(n - 1, 0);
}

/** Excel 序列号 -> "YYYY-MM-DD HH:mm:ss"。 */
export function excelSerialToText(serial: number): string {
  if (!Number.isFinite(serial) || serial <= 0) return '';
  const MS_PER_DAY = 86_400_000;
  const days = Math.floor(serial);
  const rest = Math.round((serial - days) * MS_PER_DAY);
  // Excel 1900 日期系统：serial 1 = 1900-01-01，且含虚构的 1900-02-29，
  // 因此基准取 1899-12-30。用 UTC getter 读取，输出不受运行环境时区影响。
  const d = new Date(Date.UTC(1899, 11, 30) + days * MS_PER_DAY + rest);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

/** 时间列序列号下限（约 1954 年），低于此值视为普通数字。 */
const SERIAL_THRESHOLD = 20_000;

interface CellHit {
  col: number;
  value: string;
}

/**
 * 解析一行 <row> 内的所有 <c>，得到 {列下标, 值}。
 * @param dateColumns 需要把 Excel 序列号还原成日期文本的列（微信账单即第 0 列）
 */
export function parseRow(
  rowXml: string,
  shared: string[],
  dateColumns: number[] = [0],
): CellHit[] {
  const hits: CellHit[] = [];
  const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m = re.exec(rowXml);
  while (m) {
    const attrs = m[1] ?? '';
    const inner = m[2] ?? '';

    const refMatch = attrs.match(/\br="([A-Za-z]+)\d*"/);
    const col = refMatch ? columnRefToIndex(refMatch[1]) : hits.length;

    const typeMatch = attrs.match(/\bt="([a-zA-Z]+)"/);
    const type = typeMatch ? typeMatch[1] : 'n';

    let value = '';
    const vMatch = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
    if (type === 's') {
      const idx = vMatch ? Number(decodeEntities(vMatch[1])) : NaN;
      value = Number.isFinite(idx) ? (shared[idx] ?? '') : '';
    } else if (type === 'inlineStr') {
      value = extractText(inner);
    } else if (vMatch) {
      value = decodeEntities(vMatch[1]);
    } else {
      value = extractText(inner);
    }

    // 时间列在 xlsx 里存的是数字序列号，还原成与 CSV 一致的文本格式
    if (dateColumns.includes(col)) {
      const num = Number(value);
      if (value !== '' && Number.isFinite(num) && num > SERIAL_THRESHOLD) {
        value = excelSerialToText(num);
      }
    }

    hits.push({ col, value });
    m = re.exec(rowXml);
  }
  return hits;
}

/** 解析 worksheet xml -> 二维数组。 */
export function parseSheetXml(xml: string, shared: string[]): string[][] {
  const table: string[][] = [];
  const re = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let m = re.exec(xml);
  while (m) {
    const attrs = m[1] ?? '';
    const inner = m[2] ?? '';
    const cells = parseRow(inner, shared);

    const rowIndexMatch = attrs.match(/\br="(\d+)"/);
    const rowIndex = rowIndexMatch ? Number(rowIndexMatch[1]) - 1 : table.length;

    const width = cells.reduce((max, c) => Math.max(max, c.col + 1), 0);
    const row: string[] = new Array(width).fill('');
    for (const cell of cells) row[cell.col] = cell.value;

    while (table.length < rowIndex) table.push([]);
    table[rowIndex] = row;
    m = re.exec(xml);
  }
  return table;
}

/** zip 内文件名 -> 内容文本。找不到返回 null。 */
function readEntry(files: Record<string, Uint8Array>, pattern: RegExp): string | null {
  const name = Object.keys(files)
    .filter((k) => pattern.test(k))
    .sort()[0];
  return name ? strFromU8(files[name]) : null;
}

/**
 * 入口：xlsx 二进制 -> 二维数组。
 * 抛出可读错误，便于 UI 提示（文件损坏 / 不是账单）。
 */
export function readXlsx(data: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error('文件不是有效的 xlsx（解压失败）');
  }

  const sheetXml = readEntry(files, /^xl\/worksheets\/sheet\d*\.xml$/);
  if (!sheetXml) throw new Error('xlsx 中找不到工作表');

  const sharedXml = readEntry(files, /^xl\/sharedStrings\.xml$/);
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];

  return parseSheetXml(sheetXml, shared);
}
