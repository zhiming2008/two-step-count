import { describe, expect, it } from 'vitest';
import type { Tx } from '../src/core/types';
import {
  jdOrderIdOf,
  matchSnapshot,
  parseSnapshotFile,
  snapshotIndex,
  snapshotToNoteText,
  type JdOrderSnapshot,
} from '../src/core/enrich/snapshot';

function snap(partial: Partial<JdOrderSnapshot>): JdOrderSnapshot {
  return {
    orderId: '3600998800010001',
    parentId: '0',
    dateSubmit: '2026-08-24 21:53:59',
    totalPrice: 239,
    shopName: 'tomtoc官方旗舰店',
    wares: [{ name: 'tomtoc轻便斜挎包', num: 1 }],
    ...partial,
  };
}

function tx(partial: Partial<Tx>): Tx {
  return {
    id: 't1',
    source: 'wechat',
    time: 0,
    direction: 'out',
    amount: 20100,
    effectiveAmount: 20100,
    counterparty: '京东',
    product: '京东-订单编号3600998800010001',
    payMethod: '零钱',
    txType: '商户消费',
    status: '支付成功',
    orderId: '4200998800000000123456789',
    merchantId: '',
    billNote: '',
    refundFlag: 'none',
    refundAmount: 0,
    dropped: false,
    dropReason: null,
    internal: false,
    category: null,
    note: '',
    reviewed: false,
    fingerprint: 'f1',
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  } as Tx;
}

describe('parseSnapshotFile', () => {
  it('接受合法文件并裁剪坏行', () => {
    const orders = parseSnapshotFile({
      exportedAt: '2026-09-07',
      orders: [
        snap({}),
        { orderId: 'bad', wares: [] },
        null,
        snap({ orderId: '3590998800020002', wares: [{ name: '  ', num: 1 }] }), // 空商品名 → 丢弃
      ],
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].orderId).toBe('3600998800010001');
  });

  it('非数组/非法输入返回空', () => {
    expect(parseSnapshotFile(null)).toEqual([]);
    expect(parseSnapshotFile({})).toEqual([]);
    expect(parseSnapshotFile({ orders: 'x' })).toEqual([]);
  });
});

describe('matchSnapshot', () => {
  const index = snapshotIndex([
    snap({ orderId: '3600998800010001', parentId: '0' }),
    snap({ orderId: '3600998800030003', parentId: '3590998800020002', wares: [{ name: '吊扇', num: 1 }] }),
    snap({ orderId: '3600998800040004', parentId: '3590998800020002', wares: [{ name: '发泡胶', num: 2 }] }),
  ]);

  it('直接命中 orderId', () => {
    expect(matchSnapshot('3600998800010001', index)).toHaveLength(1);
  });

  it('父单号命中全部子单，按时间排序', () => {
    const hit = matchSnapshot('3590998800020002', index);
    expect(hit.map((o) => o.orderId)).toEqual(['3600998800030003', '3600998800040004']);
  });

  it('未命中返回空数组', () => {
    expect(matchSnapshot('3590998800060006', index)).toEqual([]);
    expect(matchSnapshot('', index)).toEqual([]);
  });
});

describe('snapshotToNoteText', () => {
  it('多订单多商品拼接，带数量', () => {
    const text = snapshotToNoteText([
      snap({ wares: [{ name: '吊扇', num: 1 }] }),
      snap({ wares: [{ name: '发泡胶', num: 2 }, { name: '杀虫剂', num: 1 }] }),
    ]);
    expect(text).toBe('吊扇；发泡胶 ×2；杀虫剂');
  });
});

describe('jdOrderIdOf', () => {
  it('从商品字段提取 16 位京东单号', () => {
    expect(jdOrderIdOf(tx({}))).toBe('3600998800010001');
  });

  it('容忍账单脏数据（重复前缀）', () => {
    expect(jdOrderIdOf(tx({ product: '京东-订单编号京东-订单编号3590998800050005' }))).toBe(
      '3590998800050005',
    );
  });

  it('非京东交易返回空', () => {
    expect(jdOrderIdOf(tx({ product: '外卖订单', counterparty: '美团' }))).toBe('');
  });
});
