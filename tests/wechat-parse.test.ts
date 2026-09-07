/**
 * 用合成账单样本验证解析链路。
 * 样本由 tools/make-sample-fixture.py 生成，数据全部虚构，结构复刻微信导出账单：
 *   总 10 笔；剔除 2（全额退款 1 + 退款回流 1）
 *   部分退款 1 笔（80 元退 60，实付 20）
 *   中性（提现）1 笔；支出合计 222.40 / 收入合计 88.88
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { readXlsx } from '../src/core/wechat/readXlsx';
import { findHeaderRow } from '../src/core/wechat/schema';
import { analyzeBill, parseBillTable } from '../src/core/wechat/pipeline';
import { judgeRow } from '../src/core/wechat/refund';
import { toCents } from '../src/core/money';
import type { RawBillRow } from '../src/core/types';

const samplePath = fileURLToPath(new URL('./fixtures/wechat-sample.xlsx', import.meta.url));
const table = readXlsx(new Uint8Array(readFileSync(samplePath)));

function raw(partial: Partial<RawBillRow>): RawBillRow {
  return {
    time: '2026-08-01 00:00:00',
    txType: '商户消费',
    counterparty: '',
    product: '',
    inOut: '支出',
    amount: '0',
    payMethod: '零钱',
    status: '支付成功',
    orderId: '',
    merchantId: '',
    note: '/',
    ...partial,
  };
}

describe('xlsx 读取', () => {
  it('能解出二维表并定位表头', () => {
    expect(table.length).toBeGreaterThan(27);
    expect(findHeaderRow(table)).toBe(17);
  });

  it('表头行包含微信标准列名', () => {
    const header = table[findHeaderRow(table)].join('|');
    expect(header).toContain('交易时间');
    expect(header).toContain('当前状态');
    expect(header).toContain('商户单号');
  });
});

describe('解析流水线', () => {
  const rows = parseBillTable(table);

  it('识别出全部 10 笔', () => {
    expect(rows).toHaveLength(10);
  });

  it('剔除 2 笔（1 笔退款回流 + 1 笔全额退款支出）', () => {
    const dropped = rows.filter((r) => r.dropped);
    expect(dropped).toHaveLength(2);
    const refundIncome = dropped.filter((r) => r.dropReason === '退款回流，不计收入');
    const fullRefund = dropped.filter((r) => r.dropReason === '已全额退款');
    expect(refundIncome).toHaveLength(1);
    expect(fullRefund).toHaveLength(1);
  });

  it('部分退款按实付记账：80 退 60 -> 20', () => {
    const partial = rows.filter((r) => r.refundFlag === 'partial' && !r.dropped);
    expect(partial).toHaveLength(1);
    expect(partial[0].amount).toBe(8000);
    expect(partial[0].refundAmount).toBe(6000);
    expect(partial[0].effectiveAmount).toBe(2000);
  });

  it('中性交易（提现）保留但标记 internal', () => {
    const neutral = rows.filter((r) => r.direction === 'neutral');
    expect(neutral).toHaveLength(1);
    expect(neutral.every((r) => r.internal)).toBe(true);
    expect(neutral.every((r) => !r.dropped)).toBe(true);
  });

  it('收支合计正确', () => {
    const { stats } = analyzeBill(table);
    // 29.90 + 23.50 + 4.00 + 100.00 + 实付 20.00 + 45.00 = 222.40
    expect(stats.expense).toBe(toCents('222.40'));
    // 红包收入 88.88（退款回流已剔除）
    expect(stats.income).toBe(toCents('88.88'));
  });
});

describe('退款判定规则', () => {
  it('全额退款的支出整笔剔除', () => {
    const v = judgeRow(raw({ inOut: '支出', amount: '152.74', status: '已全额退款' }));
    expect(v.dropped).toBe(true);
    expect(v.effectiveAmount).toBe(0);
  });

  it('退款回流收入行剔除', () => {
    const v = judgeRow(raw({ txType: '某平台商户-退款', inOut: '收入', amount: '12.5', status: '已全额退款' }));
    expect(v.dropped).toBe(true);
  });

  it('部分退款从状态里抠出金额', () => {
    const v = judgeRow(raw({ inOut: '支出', amount: '80', status: '已退款(¥60.00)' }));
    expect(v.refundFlag).toBe('partial');
    expect(v.effectiveAmount).toBe(2000);
  });

  it('退款额覆盖全额时按剔除处理', () => {
    const v = judgeRow(raw({ inOut: '支出', amount: '60', status: '已退款¥60.00' }));
    expect(v.dropped).toBe(true);
  });

  it('普通消费不受影响', () => {
    const v = judgeRow(raw({ inOut: '支出', amount: '9', status: '支付成功' }));
    expect(v.dropped).toBe(false);
    expect(v.effectiveAmount).toBe(900);
  });

  it('提现标记为内部搬运', () => {
    const v = judgeRow(raw({ txType: '零钱提现', inOut: '/', amount: '3403.4', status: '提现已到账' }));
    expect(v.direction).toBe('neutral');
    expect(v.internal).toBe(true);
    expect(v.dropped).toBe(false);
  });
});
