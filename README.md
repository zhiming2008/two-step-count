# 两步记账

> 第一步：导入账单，自动清掉退款。第二步：逐条补备注。
> 之后按年月和用途查流水，一目了然。

一个本地优先的个人记账工具：不联网、不注册、数据不出本机。

## 它解决什么问题

微信账单导出后有三个天然难点，本项目都做了针对性处理：

1. **退款不是收入**——一次退款在账单里产生两行（原支出 + 一条「xx-退款」收入行），
   且两行的交易单号完全不同、商户单号为空，无法配对。
   本项目改为**按行独立判定**：退款回流行剔除、已全额退款的支出剔除、
   部分退款从状态里抠出金额按实付记账（如 80 元退 60 记 20）。
2. **xlsx 时间列是 Excel 序列号**（如 `46265.49862...`），需按 1900 日期系统还原。
3. **表头行不固定**——顶部有 16~17 行元数据，靠特征列扫描定位。

## 功能

- 📥 导入微信支付账单（xlsx / csv，自动识别 GBK 编码），按指纹去重、可撤销导入
- 🏷️ 第二步补备注：时间正序逐条过，上一条/下一条同屏回看，支持「只看最近导入」
- 🗂️ 自动分类（购物/餐饮/出行/缴费/转账/充值/娱乐/医疗/其他），关键词可在设置页自定义
- 📊 统计页：月度分类占比图表
- 🔍 流水页：年月筛选、用途筛选、批量删除
- 💾 导出 JSON 备份 / 导入恢复
- 🪟 Windows 桌面端（Tauri 2，NSIS 安装包）
- 🧩 京东订单备注增强：浏览器扩展收割订单商品名，补备注时按订单号自动预填（见 `tools/jd-ext/`）

## 隐私

- 所有数据存在浏览器 IndexedDB（桌面端存在 WebView2 用户目录），**不上传任何数据**
- 仓库内的测试样本是**脚本生成的合成数据**（`tools/make-sample-fixture.py`），不含任何真实信息

## 下载安装（Windows）

无需装环境，直接下安装包：

👉 [Releases · 下载最新版](https://github.com/zhiming2008/two-step-count/releases/latest)（附件名 `TwoStepCount_<版本>_x64-setup.exe`）

双击安装（装到用户目录，免管理员），开始菜单/桌面生成快捷方式，自带卸载器。

## 快速开始（网页版）

```bash
git clone https://github.com/zhiming2008/two-step-count.git
cd two-step-count
npm install
npm run dev        # 打开 http://127.0.0.1:5173
```

要求 Node.js ≥ 20。

## Windows 桌面端

```bash
npm run tauri:build
# 产出: src-tauri/target/release/bundle/nsis/两步记账_<版本>_x64-setup.exe
```

前置：Rust stable-msvc + VS Build Tools（VC++ 工具集 + Windows SDK）。
细节见 `docs/WINDOWS-DESKTOP.md`。

## 测试

```bash
npm test          # 53 项
npm run typecheck
```

账单解析测试使用合成样本 `tests/fixtures/wechat-sample.xlsx`
（已入库；用你自己的真实账单替换亦可，测试期望值需相应调整）。

## 目录结构

```
src/
  core/                 纯逻辑，无 UI 无 IO，可单测
    types.ts            领域模型（唯一真理来源）
    money.ts            金额：元字符串 <-> 分整数（一律用「分」存储）
    categories.ts       分类 + 关键词自动猜测
    keywordRules.ts     分类关键词规则（默认词表 + 用户覆盖合并）
    wechat/             账单解析（换账单格式只动这里）
      schema.ts         表头契约、表头自动定位
      readXlsx.ts       xlsx = zip + xml，自解析（零表格库依赖）
      readCsv.ts        含 GBK 编码嗅探
      refund.ts         退款判定（核心业务规则）
      pipeline.ts       二维表 -> Tx
    query/              筛选、聚合、补备注队列
    enrich/             京东订单快照匹配
  storage/              平台相关层（跨平台迁移只改这里）
    idb.ts              IndexedDB 实现（Dexie）
    keywordPrefs.ts     关键词覆盖持久化
  ui/features/          导入 / 补备注 / 流水 / 统计 / 设置
  hooks/useLedger.ts    UI 与存储之间唯一的桥
src-tauri/              Tauri 2 桌面壳（前端零改动）
tools/
  jd-ext/               京东订单快照收割扩展（MV3）
  make-sample-fixture.py  生成合成测试样本
  make-icon.py          生成应用图标
docs/                   京东增强路线、Windows 端文档
```

## 设计约定

- 金额一律以**分**（整数）存储，只在展示层转元
- `src/core/` 不碰 UI 不碰 IO；`src/storage/` 是唯一平台相关层
- 单文件控制在 200 行以内

## License

[MIT](LICENSE)
