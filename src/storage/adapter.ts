/**
 * 存储接口 —— 跨平台迁移的唯一契约。
 *
 * 网页端：IndexedDB（本文件下的 idb.ts）
 * Windows 端：Tauri + SQLite（将来实现同一个接口即可，UI 与 core 一行不改）
 *
 * 约定：所有查询返回已过滤 dropped 的流水；需要看被剔除项时显式传 includeDropped。
 */

import type { ImportBatch, Tx } from '../core/types';
import type { JdOrderSnapshot } from '../core/enrich/snapshot';

export interface TxQuery {
  /** 时间区间（毫秒，含边界） */
  from?: number;
  to?: number;
  /** 只看某几个月份（1~12），跨年份生效 —— 配合「全部年份 + 某月」 */
  months?: number[];
  categories?: string[];
  directions?: string[];
  /** 只取未备注的（第二步待办） */
  onlyUnreviewed?: boolean;
  /** 排除内部转账（提现/零钱通） */
  excludeInternal?: boolean;
  /** 关键字：备注 / 对方 / 商品 */
  keyword?: string;
  /** 含被自动剔除的条目 */
  includeDropped?: boolean;
}

export interface LedgerStore {
  init(): Promise<void>;
  count(): Promise<number>;
  /** 全量拉取后在内存筛选（数据量级：一年千余笔，够用） */
  list(query?: TxQuery): Promise<Tx[]>;
  get(id: string): Promise<Tx | undefined>;
  putMany(txs: Tx[]): Promise<void>;
  update(id: string, patch: Partial<Tx>): Promise<void>;
  remove(ids: string[]): Promise<void>;
  clearAll(): Promise<void>;

  /** 已存在的指纹集合，用于导入去重 */
  knownFingerprints(): Promise<Set<string>>;
  listBatches(): Promise<ImportBatch[]>;
  addBatch(batch: ImportBatch): Promise<void>;
  /** 撤销导入：按批次指纹删除流水并删批次记录，返回删除的流水条数 */
  removeBatch(id: string): Promise<number>;

  /** 京东订单快照（扩展收割、设置页导入），按 orderId 索引 */
  listSnapshots(): Promise<JdOrderSnapshot[]>;
  putSnapshots(orders: JdOrderSnapshot[]): Promise<void>;
  clearSnapshots(): Promise<void>;
}
