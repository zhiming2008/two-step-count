/**
 * 京东订单快照匹配 —— 把「订单中心收割的快照」接到账单流水上。
 *
 * 数据来源：浏览器扩展在 order.jd.com 收割的 pcorder_center_list 响应
 * （见 tools/jd-ext/），由设置页导入本机。
 *
 * 匹配规则（实测结论，见 docs/JD-ENRICH.md）：
 *   1. 账单里的「订单编号」= 京东 16 位 orderId，直接命中；
 *   2. 命中失败再按 parentId 找 —— 拆单合并支付时，账单记的是父单号，
 *      商品挂在子单上，需聚合所有子单的 wareList；
 *   3. 金额不严格相等（优惠券/e卡），不能拿金额做匹配键，只做展示参考。
 */

import type { Tx } from '../types';

/** 扩展导出的单笔订单快照（字段与 pcorder_center_list 响应对应，已裁剪）。 */
export interface JdOrderSnapshot {
  orderId: string;
  /** 父单号；"0" 或空串表示自己就是父单 */
  parentId: string;
  /** 提交时间 "2026-08-27 08:36:07" */
  dateSubmit: string;
  /** 订单实付（元） */
  totalPrice: number;
  shopName: string;
  wares: { name: string; num: number }[];
}

/** 扩展导出文件的顶层结构。 */
export interface JdSnapshotFile {
  exportedAt?: string;
  orders: JdOrderSnapshot[];
}

/** 校验导入文件（宽松：坏行丢弃，返回合法快照列表）。 */
export function parseSnapshotFile(data: unknown): JdOrderSnapshot[] {
  if (!data || typeof data !== 'object') return [];
  const orders = (data as JdSnapshotFile).orders;
  if (!Array.isArray(orders)) return [];
  const out: JdOrderSnapshot[] = [];
  for (const o of orders) {
    if (!o || typeof o.orderId !== 'string' || !/^\d{8,}$/.test(o.orderId)) continue;
    if (!Array.isArray(o.wares)) continue;
    const wares = o.wares
      .filter((w) => w && typeof w.name === 'string' && w.name.trim() !== '')
      .map((w) => ({ name: w.name.trim(), num: Number(w.num) || 1 }));
    if (wares.length === 0) continue;
    out.push({
      orderId: o.orderId,
      parentId: typeof o.parentId === 'string' ? o.parentId : '',
      dateSubmit: typeof o.dateSubmit === 'string' ? o.dateSubmit : '',
      totalPrice: Number(o.totalPrice) || 0,
      shopName: typeof o.shopName === 'string' ? o.shopName : '',
      wares,
    });
  }
  return out;
}

/** 按 orderId 建索引。 */
export function snapshotIndex(orders: JdOrderSnapshot[]): Map<string, JdOrderSnapshot> {
  return new Map(orders.map((o) => [o.orderId, o]));
}

/**
 * 账单单号 → 命中的订单（可能多笔：父单号命中所有子单）。
 * 命中不到返回空数组。
 */
export function matchSnapshot(
  billOrderId: string,
  index: Map<string, JdOrderSnapshot>,
): JdOrderSnapshot[] {
  if (!billOrderId) return [];
  const direct = index.get(billOrderId);
  if (direct) return [direct];
  const children: JdOrderSnapshot[] = [];
  for (const o of index.values()) {
    if (o.parentId && o.parentId === billOrderId) children.push(o);
  }
  // 按提交时间排，阅读顺序稳定
  return children.sort((a, b) => a.dateSubmit.localeCompare(b.dateSubmit));
}

/**
 * 快照 → 备注建议文本。
 * 多笔订单（拆单）用 "；" 分隔；同单多件商品带 ×数量。
 */
export function snapshotToNoteText(orders: JdOrderSnapshot[]): string {
  const parts: string[] = [];
  for (const o of orders) {
    for (const w of o.wares) {
      parts.push(w.num > 1 ? `${w.name} ×${w.num}` : w.name);
    }
  }
  return parts.join('；');
}

/** 从流水里提取京东订单号（与 extract.ts 的规则一致，这里独立引用避免循环依赖）。 */
export function jdOrderIdOf(tx: Tx): string {
  // tx.orderId 是微信交易单号；京东单号在商品/备注文本里
  const m = `${tx.product} ${tx.billNote} ${tx.merchantId}`.match(/订单编号[:：]?\s*(\d{10,})/);
  return m ? m[1] : '';
}
