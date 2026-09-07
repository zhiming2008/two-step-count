/**
 * 账本数据钩子 —— UI 与 store 之间唯一的桥。
 * 页面组件不直接 import store，方便将来换实现或加缓存。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ImportBatch, Tx } from '../core/types';
import { snapshotIndex, type JdOrderSnapshot } from '../core/enrich/snapshot';
import { store } from '../storage';

export interface LedgerState {
  txs: Tx[];
  batches: ImportBatch[];
  /** 京东订单快照索引（orderId → 快照），补备注自动填商品名用 */
  snapshotIndex: Map<string, JdOrderSnapshot>;
  loading: boolean;
  reload: () => Promise<void>;
  updateTx: (id: string, patch: Partial<Tx>) => Promise<void>;
  removeTx: (ids: string[]) => Promise<void>;
  addTxs: (txs: Tx[]) => Promise<void>;
  clearAll: () => Promise<void>;
  reloadBatches: () => Promise<void>;
  removeBatch: (id: string) => Promise<number>;
  restoreBackup: (txs: Tx[], batches: ImportBatch[]) => Promise<void>;
  importSnapshots: (orders: JdOrderSnapshot[]) => Promise<void>;
  clearSnapshots: () => Promise<void>;
}

export function useLedger(): LedgerState {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [snapIdx, setSnapIdx] = useState<Map<string, JdOrderSnapshot>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const all = await store.list({ includeDropped: true });
    setTxs(all);
    setLoading(false);
  }, []);

  const reloadBatches = useCallback(async () => {
    setBatches(await store.listBatches());
  }, []);

  const reloadSnapshots = useCallback(async () => {
    setSnapIdx(snapshotIndex(await store.listSnapshots()));
  }, []);

  useEffect(() => {
    void store.init().then(async () => {
      await reload();
      await reloadBatches();
      await reloadSnapshots();
    });
  }, [reload, reloadBatches, reloadSnapshots]);

  const updateTx = useCallback(async (id: string, patch: Partial<Tx>) => {
    await store.update(id, patch);
    setTxs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeTx = useCallback(async (ids: string[]) => {
    const set = new Set(ids);
    await store.remove(ids);
    setTxs((prev) => prev.filter((t) => !set.has(t.id)));
  }, []);

  const addTxs = useCallback(async (list: Tx[]) => {
    await store.putMany(list);
    setTxs((prev) => [...prev, ...list]);
  }, []);

  const clearAll = useCallback(async () => {
    await store.clearAll();
    setTxs([]);
    setBatches([]);
  }, []);

  /**
   * 撤销一次导入：store 会按批次指纹删除对应流水，这里同步内存态。
   * @returns 删除的流水条数（旧批次无指纹则 0）
   */
  const removeBatch = useCallback(
    async (id: string): Promise<number> => {
      const removed = await store.removeBatch(id);
      setBatches((prev) => prev.filter((b) => b.id !== id));
      if (removed > 0) {
        const all = await store.list({ includeDropped: true });
        setTxs(all);
      }
      return removed;
    },
    [],
  );

  /**
   * 从备份恢复：先清空再整体写入。
   * 不做增量合并 —— 备份是某时刻的快照，恢复即"回到那一刻"。
   */
  const restoreBackup = useCallback(
    async (newTxs: Tx[], newBatches: ImportBatch[]) => {
      await store.clearAll();
      await store.putMany(newTxs);
      for (const b of newBatches) await store.addBatch(b);
      setTxs(newTxs);
      setBatches(newBatches);
    },
    [],
  );

  /** 导入京东订单快照：覆盖合并（同 orderId 以新数据为准），不删旧单 */
  const importSnapshots = useCallback(async (orders: JdOrderSnapshot[]) => {
    await store.putSnapshots(orders);
    setSnapIdx(snapshotIndex(await store.listSnapshots()));
  }, []);

  const clearSnapshots = useCallback(async () => {
    await store.clearSnapshots();
    setSnapIdx(new Map());
  }, []);

  return useMemo(
    () => ({
      txs,
      batches,
      snapshotIndex: snapIdx,
      loading,
      reload,
      reloadBatches,
      updateTx,
      removeTx,
      addTxs,
      clearAll,
      removeBatch,
      restoreBackup,
      importSnapshots,
      clearSnapshots,
    }),
    [
      txs,
      batches,
      snapIdx,
      loading,
      reload,
      reloadBatches,
      updateTx,
      removeTx,
      addTxs,
      clearAll,
      removeBatch,
      restoreBackup,
      importSnapshots,
      clearSnapshots,
    ],
  );
}
