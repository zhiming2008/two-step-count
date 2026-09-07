"""开发辅助：统计账单字段取值分布，用于推导解析与退款配对规则。

只读，不修改源文件。用法：
    .venv/Scripts/python.exe tools/analyze_bill.py <账单文件路径>
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import openpyxl

HEADER_ROW = 18
EXPECTED_HEADER = [
    "交易时间",
    "交易类型",
    "交易对方",
    "商品",
    "收/支",
    "金额(元)",
    "支付方式",
    "当前状态",
    "交易单号",
    "商户单号",
    "备注",
]


def load_rows(path: Path) -> list[dict[str, str]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows: list[dict[str, str]] = []
    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        if i <= HEADER_ROW:
            continue
        cells = ["" if c is None else str(c).strip() for c in row]
        if not cells[0]:
            continue
        rows.append(dict(zip(EXPECTED_HEADER, cells)))
    wb.close()
    return rows


def group_report(rows: list[dict[str, str]], field: str) -> None:
    print(f"\n--- {field} 分布 ---")
    counter = Counter(r[field] or "(空)" for r in rows)
    for value, count in counter.most_common():
        print(f"  {count:>4}  {value}")


def refund_report(rows: list[dict[str, str]]) -> None:
    print("\n--- 疑似退款相关记录 ---")
    for idx, r in enumerate(rows, start=HEADER_ROW + 1):
        blob = r["当前状态"] + r["交易类型"] + r["备注"] + r["商品"]
        if any(k in blob for k in ("退款", "退回", "撤销", "冲正")):
            print(
                f"  行{idx:<4}{r['交易时间']}  {r['交易类型']:<6}"
                f"  {r['收/支']:<4}  {r['金额(元)']:>10}  {r['当前状态']:<12}"
                f"  {r['交易对方'][:16]:<16} {r['商品'][:20]}"
            )


def neutral_report(rows: list[dict[str, str]]) -> None:
    print("\n--- 中性交易（收/支 为 /）明细 ---")
    for idx, r in enumerate(rows, start=HEADER_ROW + 1):
        if r["收/支"] == "/":
            print(
                f"  行{idx:<4}{r['交易时间']}  {r['交易类型']:<22}"
                f"  {r['金额(元)']:>10}  {r['支付方式']:<18} {r['当前状态']}"
            )


def pair_report(rows: list[dict[str, str]]) -> None:
    """打印退款相关行的完整原始字段，用于确认单号能否配对。"""
    print("\n--- 退款相关记录完整字段 ---")
    for idx, r in enumerate(rows, start=HEADER_ROW + 1):
        blob = r["当前状态"] + r["交易类型"] + r["商品"] + r["备注"]
        if not any(k in blob for k in ("退款", "退回", "撤销", "冲正")):
            continue
        print(f"\n  行{idx}  {r['交易时间']}  {r['交易类型']}")
        for key in EXPECTED_HEADER:
            print(f"      {key:<8} = {r[key]}")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.exists():
        print(f"文件不存在: {path}")
        sys.exit(1)

    rows = load_rows(path)
    print(f"有效数据行数: {len(rows)}")
    for field in ("交易类型", "收/支", "当前状态", "支付方式"):
        group_report(rows, field)
    refund_report(rows)
    neutral_report(rows)
    pair_report(rows)


if __name__ == "__main__":
    main()
