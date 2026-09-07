/**
 * 订单增强（预留功能）的类型契约。
 *
 * 目标：用账单里的订单号反查商品信息，自动填进备注。
 * 现阶段只定义接口与订单号提取，不实现任何网络请求。
 */

import type { Cents } from '../types';

export type Platform = 'jd' | 'pdd' | 'taobao' | 'unknown';

/** 从账单里识别出的订单引用。 */
export interface OrderQuery {
  platform: Platform;
  /** 平台订单号（京东：纯数字；拼多多：字母数字混合） */
  orderId: string;
  /** 微信商户单号，可作为兜底线索 */
  merchantId?: string;
  /** 命中的原始文本，便于用户核对 */
  raw: string;
}

/** 反查到的商品信息。 */
export interface ProductInfo {
  title: string;
  /** 规格，如 "黑色 / 128G" */
  spec?: string;
  /** 单价（分） */
  price?: Cents;
  quantity?: number;
  /** 订单详情链接 */
  url?: string;
}

/**
 * 凭据：由用户用浏览器调试工具自行抓取，本软件不代劳。
 * 只存在内存或本地存储，绝不外传。
 */
export interface Credential {
  /** 京东登录态 Cookie（含 pt_key / pt_pin） */
  cookie?: string;
  /** 部分接口需要的 token */
  token?: string;
  /** 抓取时间，用于提示过期 */
  updatedAt: number;
}

/** 平台增强器接口。新增平台 = 多实现一个类，其它代码不动。 */
export interface OrderEnricher {
  readonly platform: Platform;
  /** 该增强器是否支持此凭据形态（用于 UI 提示"请先抓 Cookie"） */
  needsCredential(): boolean;
  /** 拉取订单对应的商品信息；失败返回 null，不抛异常 */
  fetchOne(order: OrderQuery, credential: Credential): Promise<ProductInfo | null>;
}

/** 把商品信息渲染成备注文本的策略，用户可在设置里改模板。 */
export type NoteTemplate = (info: ProductInfo) => string;

export const DEFAULT_NOTE_TEMPLATE: NoteTemplate = (info) =>
  info.spec ? `${info.title}（${info.spec}）` : info.title;
