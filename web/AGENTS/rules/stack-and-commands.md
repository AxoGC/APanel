# 技术栈与常用命令

## 项目概览

APanel 是一个**移动端优先**的 Linux 服务器管理面板。`web/` 是前端。

```
APanel/
├── api/      Go 后端
├── web/      React 前端（本目录）
└── docs/     VitePress 文档站
```

前端构建产物会被 `make build-web` 复制进 `api/internal/httpserver/dist/`，
由 Go 二进制通过 `embed` 一起分发——**生产环境只有一个可执行文件，没有独立的静态服务器**。
所以不要依赖任何需要运行时静态服务器配置的特性（自定义 header、rewrite 规则等）。

## 技术栈

React 19 · TypeScript ~6.0 · Vite 8 · Tailwind CSS 4 · shadcn/radix-ui ·
react-router-dom 7 · echarts 6 · xterm 6 · lucide-react · oxlint

> Node 版本要求 22.12+（Vite 8 依赖 `node:util` 的 `styleText`，Node 18 直接起不来）。
> 本机用 nvm：`source ~/.nvm/nvm.sh && nvm use 22.11.0`（22.11 会告警但能跑）。

## 常用命令

在 `web/` 下：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器（默认代理到本地后端） |
| `VITE_MOCK=true npm run dev` | mock 模式，不需要后端，见 [mock-mode.md](mock-mode.md) |
| `npm run build` | `tsc -b && vite build`，**类型检查是构建的一部分** |
| `npm run lint` | oxlint |

仓库根目录的 Makefile：`make dev-web` / `make build-web` / `make build`。

> **改完代码至少跑一次 `npm run build`。** 它会做全量类型检查，而 `npm run dev`
> 不会——历史上出现过 dev 一切正常、`make build` 直接失败的情况。
