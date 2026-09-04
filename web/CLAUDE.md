# CLAUDE.md

APanel 是一个**移动端优先**的 Linux 服务器管理面板，本目录（`web/`）是 React 前端。
后端在 `../api/`，文档站在 `../docs/`。

## 永远生效的两条

1. **提交不可以留 claude 署名。** 不要在 commit message 或 PR 描述里加
   `Co-Authored-By: Claude ...`、`🤖 Generated with Claude Code` 或任何同类尾注。
2. **改完代码至少跑一次 `npm run build`。** 类型检查是构建的一部分，`npm run dev` 不做，
   历史上出现过 dev 正常但 `make build` 直接失败。

## 详细规则

规则正文按主题拆在 [`AGENTS/rules/`](AGENTS/rules/)，索引见
[`AGENTS/rules/INDEX.MD`](AGENTS/rules/INDEX.MD)。
**动到哪块就先读哪份**，别凭印象写：

| 你要做的事 | 先读 |
| --- | --- |
| 跑起来 / 装依赖 / 构建报错 | [stack-and-commands.md](AGENTS/rules/stack-and-commands.md) |
| 新增模块、决定文件放哪、写 import | [project-structure.md](AGENTS/rules/project-structure.md) |
| 调后端接口、写 `api.ts`、接 SSE/WebSocket | [api-conventions.md](AGENTS/rules/api-conventions.md) |
| 模块开关排序、外部依赖探测 | [module-gating.md](AGENTS/rules/module-gating.md) |
| 界面上出现任何文案 | [i18n.md](AGENTS/rules/i18n.md) |
| 写页面骨架、样式、深色模式、挑组件 | [styling.md](AGENTS/rules/styling.md) |
| 往 localStorage 存东西 | [storage-keys.md](AGENTS/rules/storage-keys.md) |
| 加了新接口、或用 `VITE_MOCK=true` 调试 | [mock-mode.md](AGENTS/rules/mock-mode.md) |
| 写 commit | [commit-convention.md](AGENTS/rules/commit-convention.md) |
| 写调研 / 计划 / 规范文档 | [docs-workflow.md](AGENTS/rules/docs-workflow.md) |

三个文档目录：`AGENTS/reports/`（现状分析）、`AGENTS/plans/`（实施计划）、
`AGENTS/rules/`（长期规范），各有一份 `INDEX.MD`，新增 `.md` 必须登记一行。
