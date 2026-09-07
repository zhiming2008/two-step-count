/**
 * 存储门面 —— UI 只认这里。
 * 迁移 Windows 时在此切换实现，其它文件一行不改。
 */

import type { LedgerStore } from './adapter';
import { idbStore } from './idb';

export const store: LedgerStore = idbStore;

export type { LedgerStore, TxQuery } from './adapter';
