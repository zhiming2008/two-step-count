/**
 * IndexedDB 实现（网页端）。
 *
 * Windows 端迁移时只需另写一个实现 LedgerStore 的 sqlite.ts，
 * 在 storage/index.ts 里按平台切换即可，上层零改动。
 */

import Dexie, { type Table } from 'dexie';
import { CATEGORY_MIGRATION, type ImportBatch, type Tx } from '../core/types';
import type { JdOrderSnapshot } from '../core/enrich/snapshot';
import { applyQuery } from '../core/query/filter';
import type { LedgerStore, TxQuery } from './adapter';

class LedgerDatabase extends Dexie {
  txs!: Table<Tx, string>;
  batches!: Table<ImportBatch, string>;
  snapshots!: Table<JdOrderSnapshot, string>;

  constructor() {
    super('two-step-count');
    this.version(1).stores({
      txs: 'id, time, category, direction, dropped, reviewed, internal, fingerprint',
      batches: 'id, importedAt',
    });
    // v2: 京东订单快照（扩展收割），orderId 为主键；parentId 建索引供反查子单
    this.version(2).stores({
      snapshots: 'orderId, parentId',
    });
  }
}

class IdbLedgerStore implements LedgerStore {
  private db = new LedgerDatabase();

  async init(): Promise<void> {
    await this.db.open();
    // 分类合并迁移：旧版本的分类 id 重写到现役分类（housing → transport）。
    // 每次打开都跑一遍，无该分类时是零成本的空查询。
    for (const [from, to] of Object.entries(CATEGORY_MIGRATION)) {
      await this.db.txs.where('category').equals(from).modify({ category: to });
    }
  }

  async count(): Promise<number> {
    return this.db.txs.count();
  }

  async list(query: TxQuery = {}): Promise<Tx[]> {
    const all = await this.db.txs.toArray();
    return applyQuery(all, query);
  }

  async get(id: string): Promise<Tx | undefined> {
    return this.db.txs.get(id);
  }

  async putMany(txs: Tx[]): Promise<void> {
    await this.db.txs.bulkPut(txs);
  }

  async update(id: string, patch: Partial<Tx>): Promise<void> {
    await this.db.txs.update(id, { ...patch, updatedAt: Date.now() });
  }

  async remove(ids: string[]): Promise<void> {
    await this.db.txs.bulkDelete(ids);
  }

  async clearAll(): Promise<void> {
    await this.db.txs.clear();
    await this.db.batches.clear();
  }

  async knownFingerprints(): Promise<Set<string>> {
    const keys = await this.db.txs.orderBy('fingerprint').keys();
    return new Set(keys.map(String));
  }

  async listBatches(): Promise<ImportBatch[]> {
    return this.db.batches.orderBy('importedAt').reverse().toArray();
  }

  async addBatch(batch: ImportBatch): Promise<void> {
    await this.db.batches.put(batch);
  }

  /**
   * 撤销一次导入：先按批次指纹删除流水，再删批次记录。
   * 旧版本批次没有 fingerprints 字段，只能删批次记录、不动流水。
   * @returns 删除的流水条数
   */
  async removeBatch(id: string): Promise<number> {
    const batch = await this.db.batches.get(id);
    if (!batch) return 0;
    const fps = batch.fingerprints;
    if (fps && fps.length > 0) {
      // fingerprint 全局唯一（导入去重保证），可按指纹精确删除
      await this.db.txs.where('fingerprint').anyOf(fps).delete();
    }
    await this.db.batches.delete(id);
    return fps?.length ?? 0;
  }

  async listSnapshots(): Promise<JdOrderSnapshot[]> {
    return this.db.snapshots.toArray();
  }

  async putSnapshots(orders: JdOrderSnapshot[]): Promise<void> {
    await this.db.snapshots.bulkPut(orders);
  }

  async clearSnapshots(): Promise<void> {
    await this.db.snapshots.clear();
  }
}

export const idbStore: LedgerStore = new IdbLedgerStore();
