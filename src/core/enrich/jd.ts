/**
 * 京东订单增强器 —— 骨架，未实现。
 *
 * 为什么留空：
 * 1. 接口未逆向，先定契约，将来照着填即可，不会污染已完成的代码；
 * 2. 抓取需要用户登录态，属于高风险操作，等主流程稳定后再单独做。
 *
 * 实现时参考 docs/JD-ENRICH.md。
 */

import type { Credential, OrderEnricher, OrderQuery, ProductInfo } from './types';

export class JdEnricher implements OrderEnricher {
  readonly platform = 'jd' as const;

  needsCredential(): boolean {
    return true;
  }

  async fetchOne(_order: OrderQuery, _credential: Credential): Promise<ProductInfo | null> {
    // TODO(第二阶段)：
    // 1. 用 credential.cookie 调京东订单详情接口
    // 2. 解析出商品标题 / 规格 / 单价
    // 3. 失败返回 null，任何异常都在这里吞掉，绝不影响主流程
    throw new Error('京东订单增强尚未实现');
  }
}
