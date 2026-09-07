/**
 * 设置页：数据备份 / 恢复 / 清空 / 导入批次撤销。
 * 危险操作全部带二次确认；清空还会要求输入"清空"二字。
 */

import { useState } from 'react';
import type { ImportBatch, Tx } from '../../../core/types';
import { formatFull, formatDate } from '../../../core/datetime';
import {
  toBackupJson,
  parseBackupJson,
  toCsv,
  BACKUP_VERSION,
} from '../../../core/export';
import { getCategory } from '../../../core/categories';
import { parseSnapshotFile } from '../../../core/enrich/snapshot';
import { downloadText, pickTextFile } from '../../utils/download';
import { KeywordRulesCard } from './KeywordRulesCard';

interface Props {
  txs: Tx[];
  batches: ImportBatch[];
  /** 已导入的京东订单快照条数 */
  snapshotCount: number;
  onClearAll: () => Promise<void>;
  onRestore: (txs: Tx[], batches: ImportBatch[]) => Promise<void>;
  onRemoveBatch: (id: string) => Promise<number>;
  onImportSnapshots: (orders: ReturnType<typeof parseSnapshotFile>) => Promise<void>;
  onClearSnapshots: () => Promise<void>;
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export function SettingsPage({
  txs,
  batches,
  snapshotCount,
  onClearAll,
  onRestore,
  onRemoveBatch,
  onImportSnapshots,
  onClearSnapshots,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [clearText, setClearText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (s: string) => {
    setMsg(s);
    setTimeout(() => setMsg(null), 2500);
  };

  const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const exportJson = () => {
    const json = toBackupJson(txs, batches);
    downloadText(`two-step-backup-${stamp()}.json`, json, 'application/json');
    flash('已导出 JSON 备份');
  };

  const exportCsv = () => {
    const csv = toCsv(txs, (id) => getCategory(id as never).label);
    downloadText(`two-step-ledger-${stamp()}.csv`, csv, 'text/csv');
    flash('已导出 CSV');
  };

  const importBackup = async () => {
    const text = await pickTextFile('application/json,.json');
    if (text == null) return;
    try {
      const backup = parseBackupJson(text);
      if (!window.confirm(`将从备份恢复 ${backup.txs.length} 条流水、${backup.batches.length} 个导入批次。\n\n当前所有数据会被覆盖，确定继续吗？`)) {
        return;
      }
      await onRestore(backup.txs, backup.batches);
      flash(`已恢复 ${backup.txs.length} 条流水`);
    } catch (e) {
      window.alert(`恢复失败：${(e as Error).message}`);
    }
  };

  const doClear = async () => {
    if (clearText !== '清空') {
      window.alert('请输入"清空"二字以确认');
      return;
    }
    await onClearAll();
    setConfirming(false);
    setClearText('');
    flash('所有数据已清空');
  };

  const importSnapshot = async () => {
    const text = await pickTextFile('application/json,.json');
    if (text == null) return;
    try {
      const orders = parseSnapshotFile(JSON.parse(text));
      if (orders.length === 0) {
        window.alert('文件里没有找到有效的订单快照。\n请确认导出的是扩展的「订单快照」文件。');
        return;
      }
      await onImportSnapshots(orders);
      flash(`已导入 ${orders.length} 条京东订单快照`);
    } catch (e) {
      window.alert(`导入失败：${(e as Error).message}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <h2 className="text-lg font-semibold text-slate-900">设置</h2>

        {/* 数据概览 */}
        <Card title="数据概览">
          <div className="w-full text-xs text-slate-600">
            共 <b className="text-slate-900">{txs.length}</b> 条流水、
            <b className="text-slate-900"> {batches.length} </b>次导入。
            备份格式 v{BACKUP_VERSION}。
          </div>
        </Card>

        {/* 备份与导出 */}
        <Card title="备份与导出" desc="建议每次导入完账单后导出一份 JSON 备份留存。">
          <button type="button" onClick={exportJson} className="btn-primary">
            导出 JSON 备份
          </button>
          <button type="button" onClick={exportCsv} className="btn-ghost">
            导出 CSV
          </button>
          <button type="button" onClick={() => void importBackup()} className="btn-ghost">
            从 JSON 备份恢复
          </button>
        </Card>

        {/* 京东订单快照 */}
        <Card
          title="京东订单快照"
          desc="用浏览器扩展在 order.jd.com「收割」订单快照（含商品名），导出 JSON 后在这里导入。补备注时会按订单号自动填商品名。"
        >
          <button type="button" onClick={() => void importSnapshot()} className="btn-primary">
            导入快照 JSON
          </button>
          <span className="self-center text-xs text-slate-500">
            当前缓存 <b className="text-slate-900">{snapshotCount}</b> 单
          </span>
          {snapshotCount > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('清空全部京东订单快照？流水不受影响。')) {
                  void onClearSnapshots().then(() => flash('快照已清空'));
                }
              }}
              className="btn-danger"
            >
              清空快照
            </button>
          )}
        </Card>

        {/* 分类关键词 */}
        <KeywordRulesCard />

        {/* 导入批次历史 */}
        <Card
          title="导入批次历史"
          desc="每次导入账单会留下批次记录。撤销会按批次指纹删除该次写入的流水；旧版本批次无指纹，只能移除批次记录。"
        >
          {batches.length === 0 ? (
            <div className="w-full text-xs text-slate-400">还没有导入记录</div>
          ) : (
            <div className="w-full space-y-1.5">
              {[...batches]
                .sort((a, b) => b.importedAt - a.importedAt)
                .map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-slate-800" title={b.fileName}>
                        {b.fileName}
                      </div>
                      <div className="text-slate-400">
                        {formatFull(b.importedAt)} · 保留 {b.keptRows} 条 / 剔除 {b.droppedRows} 条
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const hasFp = (b.fingerprints?.length ?? 0) > 0;
                        const ok = window.confirm(
                          hasFp
                            ? `撤销这次导入会删除它写入的 ${b.keptRows} 条流水。\n注意：如果你后来手动改过这些流水的备注/分类，撤销会一并丢失。\n\n确定撤销吗？`
                            : `这是旧版本导入的批次（无指纹记录），撤销只能移除批次记录、不会删除流水。\n\n仍要移除吗？`,
                        );
                        if (!ok) return;
                        void onRemoveBatch(b.id).then((removed) =>
                          flash(
                            removed > 0
                              ? `已撤销，删除 ${removed} 条流水`
                              : '批次记录已移除（旧批次，无流水可删）',
                          ),
                        );
                      }}
                      className="btn-danger px-2 py-1 text-xs"
                    >
                      撤销
                    </button>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* 危险区 */}
        <Card
          title="清空所有数据"
          desc="这会删除全部流水、备注、分类和导入历史。建议先导出 JSON 备份。"
        >
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="btn-danger"
            >
              我要清空
            </button>
          ) : (
            <div className="flex w-full flex-wrap items-center gap-2">
              <input
                value={clearText}
                onChange={(e) => setClearText(e.target.value)}
                placeholder='输入"清空"二字确认'
                className="field w-48"
                autoFocus
              />
              <button type="button" onClick={() => void doClear()} className="btn-danger">
                确认清空
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setClearText('');
                }}
                className="btn-ghost"
              >
                取消
              </button>
            </div>
          )}
        </Card>

        <div className="pb-2 text-center text-xs text-slate-400">
          两步记账 · 数据全部存在本机浏览器 · {formatDate(Date.now())}
        </div>

        {msg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white shadow-lg">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
