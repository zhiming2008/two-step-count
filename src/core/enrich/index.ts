/**
 * 增强器注册表。
 * 未来接拼多多 / 淘宝就在这里多注册一个，UI 与 core 都不用改。
 */

import { JdEnricher } from './jd';
import type { OrderEnricher, Platform } from './types';

const registry = new Map<Platform, OrderEnricher>();

/** 注册增强器。jd 目前是未实现的骨架，因此默认不启用。 */
export function registerEnricher(enricher: OrderEnricher): void {
  registry.set(enricher.platform, enricher);
}

export function getEnricher(platform: Platform): OrderEnricher | undefined {
  return registry.get(platform);
}

export function listEnrichers(): OrderEnricher[] {
  return [...registry.values()];
}

/** 功能开关：默认关闭，实现完成并验证后再打开。 */
export const ENRICH_ENABLED = false;

if (ENRICH_ENABLED) {
  registerEnricher(new JdEnricher());
}
