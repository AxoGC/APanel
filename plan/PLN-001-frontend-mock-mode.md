---
id: PLN-001
title: 前端 Mock 模式（仅样式调整用）
status: draft
priority: P2
owner: nerakolo
assignee: 
created: 2026-09-03
updated: 2026-09-03
target: 
scope: web
spec_ref: 
depends_on: []
blocks: []
---

## 目标

在 `web/` 前端增加一个 mock 模式，通过 `vite --mode mock` 启动，无需后端即可运行，所有 API 调用返回静态假数据，用于纯前端样式调整。

## 背景

前端开发时经常需要在无后端环境下调整 UI 样式。目前所有 API 调用直接打到后端，无法脱离后端独立运行。mock 模式旨在填补这个缺口。

## 范围

### 在做的

- 新建 `web/src/lib/mock.ts`：实现所有 API handler 的静态假数据返回
- 修改 `web/src/lib/api.ts`：在 mock 模式下（`import.meta.env.MODE === 'mock'`）动态导入 mock handler，拦截 `apiFetch` 调用
- 新建 `web/.env.mock`：设置 `VITE_MODE=mock`（如需额外环境变量）
- 修改 `web/package.json` 或根 `Makefile`：增加 `mock` 启动命令（`vite --mode mock`）
- mock 数据覆盖范围：auth、services、containers、firewall、dashboard stats、system info

### 不做的

- 不修改 SSE（EventSource）的实际网络连接逻辑，mock 模式下 dashboard stats 用定时器模拟推送即可
- 不引入任何 mock 相关的 npm 依赖（如 msw），纯手写实现
- 不修改后端代码
- 不实现 mock 数据的持久化或编辑功能

## 任务拆解

- [ ] 创建 `web/src/lib/mock.ts`，实现全部 API 路径的假数据 handler
- [ ] 修改 `web/src/lib/api.ts`，在 mock 模式下拦截 `apiFetch`
- [ ] mock 模式下用 `MockEventSource` 替换 `window.EventSource`（dashboard SSE）
- [ ] 增加 `make mock-web` 或 `vite --mode mock` 启动入口
- [ ] 本地验证：`vite --mode mock` 启动后各模块页面均可正常渲染

## 当前阻塞

无

## 变更记录

| 日期 | 操作者 | 变更内容 |
|------|--------|----------|
| 2026-09-03 | nerakolo | 创建计划 |
