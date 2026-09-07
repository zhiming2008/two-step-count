/** 弹窗：收割开关、导出快照、清空快照。 */

const $ = (id) => document.getElementById(id);

/**
 * 统一走这里发消息：后台没响应 / 回了 error / 回了旧版结构时，
 * 把状态栏变成红色错误提示，绝不静默导出垃圾文件。
 */
async function ask(msg) {
  const s = await chrome.runtime.sendMessage(msg);
  if (!s) throw new Error('后台无响应 —— 请到 edge://extensions 点本扩展的「重新加载」');
  if (s.error) throw new Error(`后台报错: ${s.error}（多半是扩展代码未更新，请重新加载扩展）`);
  return s;
}

async function refresh() {
  const stat = $('stat');
  try {
    const s = await ask({ cmd: 'status' });
    if (s.snapCount === undefined) {
      // 旧版后台没有 snapCount 字段 —— 代码没重新加载。
      stat.className = 'err';
      stat.textContent = '⚠ 扩展代码已更新：请到 edge://extensions 点本扩展的「重新加载」';
      return;
    }
    stat.className = '';
    const modeText = s.running ? `收割中 · 已挂 ${s.tabs} 个京东页` : '未运行';
    stat.textContent = `${modeText} · 已收割 ${s.snapCount} 单`;
  } catch (e) {
    stat.className = 'err';
    stat.textContent = `⚠ ${e.message}`;
  }
}

$('start').onclick = async () => {
  try {
    await ask({ cmd: 'start' });
    refresh();
  } catch (e) {
    $('stat').className = 'err';
    $('stat').textContent = `⚠ ${e.message}`;
  }
};

$('stop').onclick = async () => {
  try {
    await ask({ cmd: 'stop' });
    refresh();
  } catch (e) {
    $('stat').className = 'err';
    $('stat').textContent = `⚠ ${e.message}`;
  }
};

$('export').onclick = async () => {
  try {
    const r = await ask({ cmd: 'exportSnapshot' });
    if (!r.json || !r.count) {
      $('stat').className = 'err';
      $('stat').textContent = '⚠ 快照为空：请先「开始收割」并在 order.jd.com 翻页，再导出';
      return;
    }
    download(r.json, `jd-snapshot-${Date.now()}.json`);
    $('stat').className = '';
    $('stat').textContent = `已导出 ${r.count} 单 ✓`;
  } catch (e) {
    $('stat').className = 'err';
    $('stat').textContent = `⚠ ${e.message}`;
  }
};

$('clear').onclick = async () => {
  try {
    if (!window.confirm('清空本机已收割的快照？（不影响已导入两步记账的数据）')) return;
    await ask({ cmd: 'clearSnapshot' });
    refresh();
  } catch (e) {
    $('stat').className = 'err';
    $('stat').textContent = `⚠ ${e.message}`;
  }
};

function download(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

refresh();
setInterval(refresh, 1000);
