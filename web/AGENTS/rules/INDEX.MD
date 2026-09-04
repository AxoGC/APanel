# Rules Index

前端开发的长期约定。与另外两个目录的区别：
[`../reports/`](../reports/) 记录**现状分析**，[`../plans/`](../plans/) 记录**一次性的实施计划**，
rules 记录**以后一直生效的规范**。

[`web/CLAUDE.md`](../../CLAUDE.md) 只保留最小索引，正文都在这里。

## 规则列表

<!-- 每新增一份规则在下面加一行：- [标题](文件名.md) — 一行摘要 -->

- [技术栈与常用命令](stack-and-commands.md) — 项目定位、Node 版本坑、dev/build/lint、产物内嵌进 Go 二进制
- [目录结构与新增模块](project-structure.md) — `src/` 分层、`@/` 别名规则、新增模块的五步登记
- [API 约定](api-conventions.md) — `apiFetch` 统一信封、错误码、SSE/WebSocket 流式接口
- [模块启停与依赖探测](module-gating.md) — 两套独立机制：`/status` 开关排序 vs `/modules/:key/dependency` 依赖门禁
- [i18n](i18n.md) — 点号 key、插值、en/zh 双字典必须同步
- [样式与布局约定](styling.md) — 页面骨架、滚动区、深色模式、优先复用的现成组件表
- [localStorage 键名](storage-keys.md) — 统一 `apanel:` 前缀与现有键清单
- [Mock 模式](mock-mode.md) — `VITE_MOCK=true` 的拦截路径与新增接口必加 handler
- [提交规范](commit-convention.md) — 不留 AI 署名、`type: 摘要` 格式
- [调研文档去处](docs-workflow.md) — reports / plans / rules 三个目录怎么选

---

*目录自动维护——每份规则对应一个独立 .md 文件，在此处登记。*
