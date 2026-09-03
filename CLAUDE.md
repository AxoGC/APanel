# apanel 项目总管

## 角色定位

这是 apanel 项目的根协调目录，**不是可直接开发的子项目**。

核心原则：**未经用户明确要求，不得编写或修改任何业务代码。** 此目录的职责是协调各子系统、管理 AI 协作规范、跟踪联调任务。

子项目目录：
- `api/` — Go 后端（内有独立的 `CLAUDE.md`）
- `web/` — React 前端（内有独立的 `CLAUDE.md`）

每个子项目目录内均有自己的 `CLAUDE.md`，定义该子项目的开发规范和上下文。根目录的 `CLAUDE.md` 只做协调，不覆盖子项目的具体规则。

协调目录：
- `plan/` — 任务计划与进度追踪
- `agents/rules/` — 编码与协作规范，适用于所有 AI 工具（Claude Code / Codex / Cursor 等）
- `spec/` — 功能约束与边界定义
- `joint/` — 跨子系统联调任务
- `agents/` — AI 工具专属配置

## 任务开始前

**每次开始任何任务，必须先查 `plan/index.md`。**

- 找到匹配的计划：按计划执行，完成后更新状态和变更记录
- 没有匹配的计划：先创建计划文件（复制 `plan/PLN-000-template.md`），更新 `plan/index.md`，再开工
- 计划文件命名：`plan/PLN-XXX-slug.md`，编号递增

## 约束与边界

功能边界、API 契约、系统权限边界等定义见 `spec/index.md`。**遇到规范与实现有冲突时，以 `spec/index.md` 为准。**

## 多开发者 / 多设备协作

本项目由多名开发者在多台设备上协作，可能同时使用多个 AI 工具（Claude Code、Codex、Cursor 等）。

**规则：**

- 开始任务前 `git pull`，确保基于最新主干
- 任何人（人类或 AI）不得直接向 `main` 推送，必须通过 PR
- `plan/` 是任务协调的唯一来源：认领任务时在计划文件中更新 `assignee` 和 `status`，防止重复工作
- AI 工具生成的提交，`author` 必须是实际操作的人类开发者（参见 `agents/rules/git.md`）
- 跨子系统的联调任务记录在 `joint/`，不得在单个子项目的计划里处理跨边界问题
- 发现 `plan/` 或 `spec/` 与代码现状不一致时，先同步文档再继续开发，不得静默跳过

## 规范文件索引

各规范完整内容见对应文件，此处仅列路径与用途：

| 文件 | 适用范围 |
|------|----------|
| `agents/rules/git.md` | 提交信息格式、分支命名、PR 流程 |
| `agents/rules/go.md` | Go 后端编码规范（命名、错误处理、包结构） |
| `agents/rules/frontend.md` | React 前端规范（组件结构、样式、状态） |
| `agents/rules/api.md` | HTTP API 设计规范（响应格式、路由、错误码） |

所有规范的摘要索引见 `agents/rules/index.md`。
