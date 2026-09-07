/** 应用外壳：五个页签 —— 导入 / 补备注 / 流水 / 统计 / 设置。 */

import { useState } from 'react';
import { useLedger } from './hooks/useLedger';
import { ImportPage } from './ui/features/import/ImportPage';
import { ReviewPage } from './ui/features/review/ReviewPage';
import { LedgerPage } from './ui/features/ledger/LedgerPage';
import { StatsPage } from './ui/features/stats/StatsPage';
import { SettingsPage } from './ui/features/settings/SettingsPage';

type Tab = 'import' | 'review' | 'ledger' | 'stats' | 'settings';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'import', label: '导入' },
  { id: 'review', label: '补备注' },
  { id: 'ledger', label: '流水' },
  { id: 'stats', label: '统计' },
  { id: 'settings', label: '设置' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('import');
  const ledger = useLedger();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-6 border-b border-slate-200 bg-white px-5 py-3">
        <div className="text-base font-semibold tracking-tight">两步记账</div>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto text-xs text-slate-400">
          {ledger.loading ? '加载中…' : `${ledger.txs.length} 条流水`}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === 'import' && (
          <div className="h-full overflow-y-auto">
            <ImportPage
              existingCount={ledger.txs.length}
              onImported={(txs) => {
                void ledger.addTxs(txs);
                void ledger.reloadBatches();
              }}
              onGoReview={() => setTab('review')}
            />
          </div>
        )}

        {tab === 'review' && (
          <ReviewPage
            txs={ledger.txs}
            batches={ledger.batches}
            snapshots={ledger.snapshotIndex}
            onPatch={ledger.updateTx}
            onDelete={ledger.removeTx}
            onGoLedger={() => setTab('ledger')}
          />
        )}

        {tab === 'ledger' && (
          <LedgerPage txs={ledger.txs} onPatch={ledger.updateTx} onDelete={ledger.removeTx} />
        )}

        {tab === 'stats' && <StatsPage txs={ledger.txs} />}

        {tab === 'settings' && (
          <SettingsPage
            txs={ledger.txs}
            batches={ledger.batches}
            snapshotCount={ledger.snapshotIndex.size}
            onClearAll={ledger.clearAll}
            onRestore={ledger.restoreBackup}
            onRemoveBatch={ledger.removeBatch}
            onImportSnapshots={ledger.importSnapshots}
            onClearSnapshots={ledger.clearSnapshots}
          />
        )}
      </main>
    </div>
  );
}
