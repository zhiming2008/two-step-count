/**
 * 第一步：导入并识别账单。
 *
 * 流程：选文件 -> 本地解析（不出网）-> 预览清理结果 -> 确认入库。
 * 重复导入靠 fingerprint（交易单号）去重，不会记重。
 */

import { useMemo, useRef, useState } from 'react';
import type { Tx } from '../../../core/types';
import { readBillFile } from '../../../core/wechat/readBill';
import { analyzeBill, buildImport, type BillPreview } from '../../../core/wechat/pipeline';
import { formatCents } from '../../../core/money';
import { store } from '../../../storage';
import { effectiveRules } from '../../../storage/keywordPrefs';

interface Props {
  existingCount: number;
  onImported: (txs: Tx[], fileName: string) => void;
  onGoReview: () => void;
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export function ImportPage({ existingCount, onImported, onGoReview }: Props) {
  const [preview, setPreview] = useState<BillPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const droppedGroups = useMemo(() => {
    if (!preview) return [];
    const map = new Map<string, number>();
    for (const row of preview.rows) {
      if (!row.dropped) continue;
      const key = row.dropReason ?? '已剔除';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [preview]);

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const table = readBillFile(buffer, file.name);
      setPreview(analyzeBill(table));
      setFileName(file.name);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : '解析失败');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const { txs, batch } = buildImport(preview.rows, 'wechat', fileName, effectiveRules());
      const known = await store.knownFingerprints();
      const fresh = txs.filter((t) => !known.has(t.fingerprint));
      await store.putMany(fresh);
      // 批次只记录"实际写入"的指纹 —— 撤销时才不会误删更早批次已存在的重复项
      await store.addBatch({
        ...batch,
        keptRows: fresh.length,
        fingerprints: fresh.map((t) => t.fingerprint),
      });
      onImported(fresh, fileName);
      setResult({ added: fresh.length, skipped: txs.length - fresh.length });
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '写入失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-1 text-lg font-medium">导入账单</h2>
      <p className="mb-5 text-sm text-slate-500">
        文件只在本机解析，不上传。当前账本已有 {existingCount} 条流水。
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className="mb-5 cursor-pointer rounded-xl border-2 border-dashed border-slate-300
          bg-white px-6 py-10 text-center transition-colors hover:border-slate-400"
      >
        <div className="text-sm text-slate-600">把微信账单拖到这里，或点击选择</div>
        <div className="mt-1 text-xs text-slate-400">支持 .xlsx / .csv</div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          导入完成：新增 {result.added} 条
          {result.skipped > 0 && `，跳过重复 ${result.skipped} 条`}
          <button type="button" onClick={onGoReview} className="ml-3 underline">
            去补备注
          </button>
        </div>
      )}

      {busy && <div className="text-sm text-slate-500">解析中…</div>}

      {preview && !busy && (
        <div className="space-y-4">
          <div className="text-sm">
            <div className="font-medium">{fileName}</div>
            {preview.meta.owner && (
              <div className="text-xs text-slate-500">
                {preview.meta.owner} · {preview.meta.rangeStart} ~ {preview.meta.rangeEnd}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="识别总笔数" value={String(preview.stats.total)} />
            <Stat label="计入账本" value={String(preview.stats.kept)} />
            <Stat
              label="自动剔除"
              value={String(preview.stats.dropped)}
              tone="text-slate-400"
            />
            <Stat label="部分退款" value={String(preview.stats.partial)} tone="text-amber-600" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="支出合计" value={formatCents(preview.stats.expense)} tone="text-red-600" />
            <Stat
              label="收入合计"
              value={formatCents(preview.stats.income)}
              tone="text-emerald-600"
            />
          </div>

          {droppedGroups.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setShowDropped((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs text-slate-600"
              >
                <span>
                  剔除明细：
                  {droppedGroups.map(([reason, count]) => `${reason} ${count}`).join(' · ')}
                </span>
                <span className="text-slate-400">{showDropped ? '收起' : '展开'}</span>
              </button>
              {showDropped && (
                <div className="max-h-52 overflow-y-auto border-t border-slate-100">
                  {preview.rows
                    .filter((r) => r.dropped)
                    .map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 border-b border-slate-50 px-3 py-1.5 text-xs"
                      >
                        <span className="w-32 shrink-0 font-mono text-slate-400">{r.raw.time}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">
                          {r.raw.counterparty || r.raw.product}
                        </span>
                        <span className="shrink-0 text-slate-400">
                          {(r.amount / 100).toFixed(2)}
                        </span>
                        <span className="w-28 shrink-0 text-right text-slate-400">
                          {r.dropReason}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={() => void confirmImport()} className="btn-primary">
            确认导入 {preview.stats.kept} 条
          </button>
        </div>
      )}
    </div>
  );
}
