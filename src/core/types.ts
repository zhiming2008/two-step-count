/**
 * 领域模型 —— 全项目唯一的真理来源。
 *
 * 设计原则：
 * 1. 金额一律用「分」存整数（Cents），只在展示层转元，杜绝浮点误差。
 * 2. Tx 是可持久化的最终形态；原始账单行用 RawBillRow 表示，两者由 normalize 转换。
 */

/** 金额，单位：分。始终为整数。 */
export type Cents = number;

/** 资金方向。neutral = 自己账户间搬运（提现/零钱通存取），不是真实收支。 */
export type Direction = 'in' | 'out' | 'neutral';

/** 账单来源，为将来接入支付宝预留。 */
export type BillSource = 'wechat' | 'alipay' | 'manual';

export type CategoryId =
  | 'shopping'
  | 'food'
  | 'transport'
  | 'utility'
  | 'transfer'
  | 'recharge'
  | 'entertainment'
  | 'medical'
  | 'other';

/**
 * 分类合并迁移表：旧版本存在、后来被并入其他分类的 id。
 * 数据加载时按此重写 category 字段（如 housing → transport）。
 */
export const CATEGORY_MIGRATION: Partial<Record<string, CategoryId>> = {
  housing: 'transport',
};

export interface Category {
  id: CategoryId;
  label: string;
  /** 用于列表圆点配色，Tailwind 类名片段 */
  tone: string;
  /** SVG/图表用的十六进制色 —— 动态拼接的 Tailwind 类名不会被 JIT 扫到 */
  hex: string;
}

/** 退款判定结果。 */
export type RefundFlag = 'none' | 'full' | 'partial';

/**
 * 原始账单行 —— 与微信/支付宝导出文件的列一一对应，不做任何加工。
 * 保持"原始"是为了解析层与业务层解耦：换格式只改解析层。
 */
export interface RawBillRow {
  time: string;
  txType: string;
  counterparty: string;
  product: string;
  /** 收/支：'收入' | '支出' | '/'（中性） */
  inOut: string;
  amount: string;
  payMethod: string;
  status: string;
  orderId: string;
  merchantId: string;
  note: string;
}

/** 解析阶段产出的中间态：原始行 + 已识别的退款信息。 */
export interface ParsedRow {
  raw: RawBillRow;
  direction: Direction;
  amount: Cents;
  refundFlag: RefundFlag;
  /** 部分退款时从状态里解出的退款额（分） */
  refundAmount: Cents;
  /** 实际计入账本的金额（分）：原额 - 退款额 */
  effectiveAmount: Cents;
  /** 是否需要从账本中剔除（退款收入行 / 已全额退款的支出） */
  dropped: boolean;
  dropReason: string | null;
  /** 是否为账户内部搬运（提现 / 零钱通存取 / 信用卡还款） */
  internal: boolean;
}

/** 账本中的一条流水。 */
export interface Tx {
  id: string;
  source: BillSource;
  /** 交易时间戳（毫秒） */
  time: number;
  direction: Direction;
  /** 账单原金额（分） */
  amount: Cents;
  /** 实际计入金额（分），扣掉退款后 */
  effectiveAmount: Cents;
  counterparty: string;
  product: string;
  payMethod: string;
  txType: string;
  status: string;
  orderId: string;
  merchantId: string;
  billNote: string;

  refundFlag: RefundFlag;
  refundAmount: Cents;
  /** 被自动剔除的条目仍入库，但默认不展示，便于追溯 */
  dropped: boolean;
  dropReason: string | null;
  /** 账户内部搬运：用户要求保留但单列，统计时可排除 */
  internal: boolean;

  category: CategoryId | null;
  /** 用户备注 —— 本软件的核心产出 */
  note: string;
  /** 第二步是否已处理过 */
  reviewed: boolean;

  /** 去重指纹：同一条流水重复导入时用于识别 */
  fingerprint: string;

  createdAt: number;
  updatedAt: number;
}

/** 导入一次账单的批次记录，便于"撤销这次导入"。 */
export interface ImportBatch {
  id: string;
  source: BillSource;
  fileName: string;
  importedAt: number;
  /** 文件内总行数（含被剔除的） */
  totalRows: number;
  /** 实际写入账本的条数 */
  keptRows: number;
  /** 被剔除的条数 */
  droppedRows: number;
  /**
   * 本次实际写入账本的流水的指纹集。
   * 撤销导入时按这组指纹删除流水（指纹与流水一一对应）。
   * 可选：旧版本数据没有此字段，撤销时只能删批次记录、不动流水。
   */
  fingerprints?: string[];
}
