# Windows 桌面端（Tauri 2）

## 产出物是什么

`npm run tauri:build` 最终产出：

```
src-tauri/target/release/bundle/nsis/两步记账_0.1.0_x64-setup.exe
```

- 这是一个 **NSIS 安装程序**：双击安装（默认装到当前用户目录 `%LOCALAPPDATA%\两步记账`，
  **不需要管理员权限**），生成开始菜单 + 桌面快捷方式，可在"设置 → 应用"里卸载。
- 装完就是一个**独立桌面软件**：自己的窗口和图标，不依赖打开浏览器。
- 渲染用 Windows 自带的 WebView2（Win10/11 内置），安装包体积只有几 MB。
- 除安装包外，`src-tauri/target/release/two-step-count.exe` 是绿色单文件，
  直接双击也能跑（不带快捷方式/卸载器）。

## 数据在哪

数据继续存在 WebView2 的 IndexedDB / localStorage 里，路径：

```
%LOCALAPPDATA%\com.zhiming2008.twostepcount\EBWebView\Default\IndexedDB
```

浏览器版（Edge 里打开 5173）和桌面版是**两份独立数据**，互不相通。
以后需要迁移时可以走「设置 → 导出 JSON 备份 / 导入」。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run tauri:dev` | 开发模式：Rust 壳 + Vite 热更新 |
| `npm run tauri:build` | 产出 release exe + NSIS 安装包 |
| `npx tauri icon <png>` | 重新生成全套图标（源图在 `src-tauri/icons/icon-source.png`） |

## 前置环境（已装好，仅记录）

- Rust stable-msvc 1.98：`~/.cargo` + `~/.rustup`（用户目录，免管理员）。
  注意：本机 rustup 代理创建（硬链接）失败，cargo.exe/rustc.exe 是手工复制的，
  以后 rustup 升级工具链后如报找不到 cargo，重新 `cp ~/.cargo/bin/rustup.exe ~/.cargo/bin/cargo.exe` 即可。
- VS Build Tools 2022（VC++ 工具集 + Windows SDK）：机器级安装，需要管理员。
- PATH 需包含 `C:/Users/<用户名>/.cargo/bin`（长期可加进用户环境变量）。

## 架构说明

桌面端 = 同一套 Web 代码（`dist/`）套 Tauri 壳，前端零改动。
按项目铁律，若将来要原生能力（文件对话框、开机自启等），通过 Tauri 的
`invoke` 在 `src/storage/` 层扩展，不侵入 `src/core/`。
