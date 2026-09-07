/**
 * 两步记账 · 京东收割 —— 后台（MV3 service worker）。
 *
 * 唯一职责：浏览器开着 order.jd.com 时，旁观订单列表接口
 * （functionId=pcorder_center_list / _search）的响应，提取订单快照
 * （单号/父单号/提交时间/实付/店铺/商品名×数量）。
 *
 * 借力打力：h5st 签名由京东页面自己的 JS 计算，我们不碰、不逆向、
 * 不发任何请求 —— 只启用 CDP Network 域读响应，风控看到的就是正常浏览。
 *
 * 数据边界：快照只存本机（session + local 备份），用户手动导出后才离开浏览器。
 * 不读取、不存储 Cookie。
 */

const JD_RE = /^https?:\/\/([a-z0-9-]+\.)*(jd\.com|jd\.hk|360buy\.com)\//i;
const ORDER_API_RE = /functionId=pcorder_(center_list|center_search)/;
const BODY_MAX = 64 * 1024;

/** 是否正在收割 */
let running = false;
/** Map<orderId, 快照> */
const snapshots = new Map();
const attached = new Set();
/** requestId → url（只在收割中登记，用于识别订单接口） */
const requestUrls = new Map();

/* ---------- 订单提取 ---------- */

/** 从订单列表/搜索响应里提取快照，合并进本地（同 orderId 覆盖）。 */
function harvestOrders(body) {
  let j;
  try {
    j = JSON.parse(body);
  } catch {
    return;
  }
  const list = j && j.data && j.data.orderList;
  if (!Array.isArray(list)) return;
  let added = 0;
  for (const o of list) {
    if (!o || typeof o.orderId !== 'string') continue;
    const wares = (o.wareList || [])
      .filter((w) => w && typeof w.name === 'string' && w.name.trim())
      .map((w) => ({ name: w.name.trim(), num: Number(w.num) || 1 }));
    if (wares.length === 0) continue;
    snapshots.set(o.orderId, {
      orderId: o.orderId,
      parentId: typeof o.parentId === 'string' ? o.parentId : '',
      dateSubmit: typeof o.dateSubmit === 'string' ? o.dateSubmit : '',
      totalPrice: (o.itemPayInfo && Number(o.itemPayInfo.totalPrice)) || 0,
      shopName: (o.shopInfo && o.shopInfo.shopName) || '',
      wares,
    });
    added += 1;
  }
  if (added > 0) scheduleFlush();
}

/* ---------- Network 旁观 ---------- */

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!running || !source || !source.tabId) return;
  if (method === 'Network.requestWillBeSent') {
    const key = `${source.tabId}:${params.requestId}`;
    if (JD_RE.test(params.request.url)) {
      if (requestUrls.size > 2000) requestUrls.clear();
      requestUrls.set(key, params.request.url);
    } else {
      requestUrls.delete(key);
    }
    return;
  }
  if (method === 'Network.loadingFailed') {
    requestUrls.delete(`${source.tabId}:${params.requestId}`);
    return;
  }
  if (method !== 'Network.loadingFinished') return;
  const url = requestUrls.get(`${source.tabId}:${params.requestId}`);
  if (!url || !ORDER_API_RE.test(url)) return;
  chrome.debugger
    .sendCommand({ tabId: source.tabId }, 'Network.getResponseBody', {
      requestId: params.requestId,
    })
    .then((r) => {
      if (!r || !r.body) return;
      const body = r.base64Encoded ? atob(r.body) : r.body;
      harvestOrders(body.slice(0, BODY_MAX));
    })
    .catch(() => {});
});

chrome.debugger.onDetach.addListener((source) => {
  if (source && source.tabId) attached.delete(source.tabId);
});

/* ---------- attach 管理 ---------- */

async function attach(tabId) {
  if (attached.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {});
    attached.add(tabId);
  } catch {
    /* 目标页关了，或用户自己开着 DevTools —— 跳过 */
  }
}

async function syncTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.filter((t) => t.url && JD_RE.test(t.url)).map((t) => attach(t.id)));
}

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (running && info.url && JD_RE.test(info.url)) void attach(tabId);
});

/* ---------- 开关 / 持久化 ---------- */

async function start() {
  running = true;
  await persist();
  await syncTabs();
}

async function stop() {
  running = false;
  for (const tabId of attached) chrome.debugger.detach({ tabId }).catch(() => {});
  attached.clear();
  requestUrls.clear();
  await persist();
}

let flushTimer = null;
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void persist();
  }, 300);
}

async function persist() {
  const orders = [...snapshots.values()];
  await chrome.storage.session.set({ running, snapshots: orders });
  // local 备份：浏览器重启 session 会清空，忘了导出也不至于全丢
  if (orders.length > 0) {
    try {
      await chrome.storage.local.set({ jdSnapshotsBackup: orders });
    } catch {
      /* 超配额就放弃备份 */
    }
  }
}

/* service worker 重启后恢复状态（session 优先，空了用 local 备份兜底） */
(async () => {
  const saved = await chrome.storage.session.get(['running', 'snapshots']);
  running = saved.running === true;
  for (const o of saved.snapshots || []) snapshots.set(o.orderId, o);
  if (snapshots.size === 0) {
    const { jdSnapshotsBackup } = await chrome.storage.local.get('jdSnapshotsBackup');
    for (const o of jdSnapshotsBackup || []) snapshots.set(o.orderId, o);
  }
  if (running) await syncTabs();
})();

/* ---------- popup 消息 ---------- */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg && msg.cmd) {
      case 'status':
        sendResponse({ running, tabs: attached.size, snapCount: snapshots.size });
        break;
      case 'start':
        await start();
        sendResponse({ ok: true });
        break;
      case 'stop':
        await stop();
        sendResponse({ ok: true });
        break;
      case 'exportSnapshot': {
        await persist();
        const orders = [...snapshots.values()];
        sendResponse({
          json: JSON.stringify({ exportedAt: new Date().toISOString(), orders }, null, 2),
          count: orders.length,
        });
        break;
      }
      case 'clearSnapshot':
        snapshots.clear();
        await chrome.storage.local.remove('jdSnapshotsBackup');
        await persist();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ error: 'unknown cmd' });
    }
  })();
  return true;
});
