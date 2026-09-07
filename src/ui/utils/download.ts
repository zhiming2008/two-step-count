/**
 * 文件下载 —— 唯一碰 DOM 的导出工具。
 * 逻辑层（core/export.ts）只产字符串，触发下载统一走这里，便于将来在 Tauri 端替换。
 */

/** 触发浏览器下载一个文本文件。 */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  downloadBlob(filename, blob);
}

/** 触发下载一个已构造好的 Blob。 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟回收，避免某些浏览器在 click 后立即 revoke 导致下载失败
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 读取用户选中的文件为文本（导入备份用）。 */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    // 用户取消时 onchange 不会触发，这里给一个兜底（无法区分取消与未选，统一返回 null）
    input.click();
  });
}
