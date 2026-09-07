"""开发辅助：探查微信/支付宝账单文件的真实结构。

只读，不修改源文件。用法：
    .venv/Scripts/python.exe tools/inspect_bill.py <账单文件路径> [行数]
"""

from __future__ import annotations

import sys
from pathlib import Path

import openpyxl


def inspect(path: Path, max_rows: int = 25) -> None:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    print(f"文件: {path.name}")
    print(f"工作表: {wb.sheetnames}")

    for name in wb.sheetnames:
        ws = wb[name]
        print(f"\n=== sheet [{name}] 维度={ws.calculate_dimension()} ===")
        for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if i > max_rows:
                print("  ...")
                break
            cells = ["" if c is None else str(c) for c in row]
            print(f"  {i:>3} | " + " | ".join(cells))
    wb.close()


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    target = Path(sys.argv[1])
    rows = int(sys.argv[2]) if len(sys.argv) > 2 else 25
    if not target.exists():
        print(f"文件不存在: {target}")
        sys.exit(1)
    inspect(target, rows)


if __name__ == "__main__":
    main()
