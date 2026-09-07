/**
 * 第二步：逐条补备注。
 *
 * 队列 = 范围内流水按时间正序（已处理的也留在队列里），
 * 所以"上一条 / 下一条"永远是时间上紧邻的两笔，回想上下文才成立。
 * 正常操作只会停在未处理的条目上：保存/跳过/删除后游标自动跳到下一个未处理项。
 *
 * 两种推进语义（勿混）：
 * - 正常模式：advance → findNextUnreviewed，只停在未处理项；
 * - 回看模式（"从头再看一遍"）：advance → nextSequential 顺序浏览，
 *   Enter 保存并看下一条 —— 全部已处理时若复用前者会一按回车就"补完了"。
 *
 * 范围：默认"只看最近导入"（按最新批次的指纹圈定），可切"全部流水"。
 */

import { useMemo, useState } from 'react';
import type { CategoryId, ImportBatch, Tx } from '../../../core/types';
import {
  jdOrderIdOf,
  matchSnapshot,
  snapshotToNoteText,
  type JdOrderSnapshot,
} from '../../../core/enrich/snapshot';
import {
  buildReviewQueue,
  countUnreviewed,
  filterByFingerprint,
  findFirstUnreviewed,
  findNextUnreviewed,
  latestBatchFingerprints,
  nextSequential,
} from '../../../core/query/reviewQueue';
import { CurrentCard } from './CurrentCard';
import { NeighborCard } from './NeighborCard';

interface Props {
  txs: Tx[];
  /** 导入批次记录 —— 用于"只看最近导入"的范围圈定 */
  batches: ImportBatch[];
  /** 京东订单快照索引（orderId → 快照），可为空 Map */
  snapshots: Map<string, JdOrderSnapshot>;
  onPatch: (id: string, patch: Partial<Tx>) => void;
  onDelete: (ids: string[]) => void;
  onGoLedger: () => void;
}

/** null = 跟随默认（有批次指纹就只看最近导入，否则全部） */
type Scope = 'latest' | 'all' | null;

export function ReviewPage({
  txs,
  batches,
  snapshots,
  onPatch,
  onDelete,
  onGoLedger,
}: Props) {
  /** null = 自动停在第一个未处理项；数字 = 用户手动移动过游标 */
  const [cursor, setCursor] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  /** 回看模式：全部流水已处理完后的顺序浏览，Enter 保存并看下一条 */
  const [replay, setReplay] = useState(false);
  const [scope, setScope] = useState<Scope>(null);

  const latestFps = useMemo(() => latestBatchFingerprints(batches), [batches]);
  const effectiveScope: 'latest' | 'all' =
    scope ?? (latestFps ? 'latest' : 'all');

  const queue = useMemo(() => {
    const scoped =
      effectiveScope === 'latest' && latestFps
        ? filterByFingerprint(txs, latestFps)
        : txs;
    return buildReviewQueue(scoped);
  }, [txs, batches, effectiveScope, latestFps]);

  const pendingCount = useMemo(() => countUnreviewed(queue), [queue]);
  const doneCount = queue.length - pendingCount;

  const autoIndex = useMemo(() => findFirstUnreviewed(queue), [queue]);
  const index =
    cursor === null
      ? autoIndex >= 0
        ? autoIndex
        : 0
      : Math.min(cursor, Math.max(queue.length - 1, 0));

  const current = queue[index];
  const prev = index > 0 ? queue[index - 1] : undefined;
  const next = index + 1 < queue.length ? queue[index + 1] : undefined;

  // 只有游标处于"自动"状态时才用"没有未处理项"判定结束；
  // 用户手动点了某一条（cursor 有值）就必须照常显示，否则"从头再看一遍"会立刻被判完成。
  const isDone = queue.length === 0 || (cursor === null && (finished || autoIndex === -1));

  /** 推进：正常模式跳到下一个未处理项；回看模式顺序下一条。 */
  const advance = (from: number) => {
    const nextIndex = replay ? nextSequential(queue, from) : findNextUnreviewed(queue, from);
    if (nextIndex === null) {
      setFinished(true);
      setReplay(false);
      setCursor(null);
    } else {
      setFinished(false);
      setCursor(nextIndex);
    }
  };

  const save = (patch: { note: string; category: CategoryId | null }) => {
    if (!current) return;
    void onPatch(current.id, { ...patch, reviewed: true });
    advance(index);
  };

  /** 当前流水按京东快照推出的商品名建议（无匹配为 null） */
  const suggestion = useMemo(() => {
    if (!current || snapshots.size === 0) return null;
    const orderId = jdOrderIdOf(current);
    if (!orderId) return null;
    const hits = matchSnapshot(orderId, snapshots);
    return hits.length > 0 ? snapshotToNoteText(hits) : null;
  }, [current, snapshots]);

  const remove = () => {
    if (!current) return;
    if (!window.confirm('删除这条流水？')) return;
    void onDelete([current.id]);
    // 删除后本条消失、后一项补位，从 index-1 起查找即覆盖该位置
    advance(index - 1);
  };

  const goPrev = () => {
    if (index <= 0) return;
    setFinished(false);
    setCursor(index - 1);
  };

  const startReplay = () => {
    setFinished(false);
    setReplay(true);
    setCursor(0);
  };

  /** 切范围：游标/完成态/回看全部重置 */
  const changeScope = (s: Scope) => {
    setScope(s);
    setCursor(null);
    setFinished(false);
    setReplay(false);
  };

  if (!current || isDone) {
    const empty = queue.length === 0;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="text-lg font-medium">
          {empty ? '还没有流水' : finished && !replay ? '看到头了' : '全部处理完了'}
        </div>
        <div className="text-sm text-slate-500">
          {empty
            ? '先去导入账单'
            : `${effectiveScope === 'latest' ? '最近导入范围内' : ''}共 ${queue.length} 条流水，已补备注 ${doneCount} 条`}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onGoLedger} className="btn-primary">
            查看流水
          </button>
          {queue.length > 0 && (
            <button type="button" onClick={startReplay} className="btn-ghost">
              从头再看一遍
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-2">
            {replay ? (
              <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">
                回看模式 · 回车顺序浏览，可随时改备注
              </span>
            ) : (
              <>
                待处理 <b className="text-slate-900">{pendingCount}</b> 条 · 已完成 {doneCount}/
                {queue.length}
              </>
            )}
          </span>
          <span className="flex items-center gap-2">
            {latestFps && (
              <span className="flex overflow-hidden rounded border border-slate-200">
                <button
                  type="button"
                  onClick={() => changeScope('latest')}
                  className={`px-2 py-0.5 ${effectiveScope === 'latest' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  只看最近导入
                </button>
                <button
                  type="button"
                  onClick={() => changeScope('all')}
                  className={`px-2 py-0.5 ${effectiveScope === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  全部流水
                </button>
              </span>
            )}
            <span className="font-mono">
              {index + 1} / {queue.length}
            </span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all"
            style={{ width: `${queue.length ? (doneCount / queue.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <NeighborCard tx={prev} label="上一条" />

          <CurrentCard
            key={current.id}
            tx={current}
            suggestion={suggestion}
            onSave={save}
            onDelete={remove}
            onPrev={goPrev}
            hasPrev={index > 0}
          />

          <NeighborCard tx={next} label="下一条" />
        </div>
      </div>
    </div>
  );
}
