/**
 * 读取 CSV —— 微信账单另一种导出格式，且通常是 GBK 编码。
 *
 * 编码策略：BOM 优先，其次 UTF-8 严格解码，失败再退回 GBK。
 * 直接用 GBK 解 UTF-8 会得到锟斤拷，所以顺序不能反。
 */

/** 嗅探并用正确编码解码字节流。 */
export function decodeBytes(data: Uint8Array): string {
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(data.subarray(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    // 不是合法 UTF-8，按 GBK 处理
  }
  try {
    return new TextDecoder('gbk').decode(data);
  } catch {
    return new TextDecoder('utf-8').decode(data);
  }
}

/**
 * 极简 CSV 解析器（RFC 4180 子集）。
 * 支持：引号包裹、字段内逗号、字段内换行、双写引号转义。
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (row.some((c) => c !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  return rows;
}

/** 入口：CSV 字节 -> 二维数组。 */
export function readCsv(data: Uint8Array): string[][] {
  return parseCsv(decodeBytes(data));
}
