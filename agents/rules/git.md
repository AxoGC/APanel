# Git 规范

## 提交信息格式

遵循 Conventional Commits：

```
<类型>(<范围>): <简短描述>
```

类型：`feat` / `fix` / `refactor` / `chore` / `docs` / `test` / `style`
范围（可选）：`api` / `web` / `deploy` / `spec` 等子目录名

- 描述用中文，简短（≤50字）
- 禁止 `fix bug`、`update`、`修改` 这类无信息提交

示例：
```
feat(web): 仪表盘新增磁盘 IO 历史图表
fix(api): 修复 Docker 容器列表空指针崩溃
refactor(web): 拆分 TerminalPanel 为独立组件
```

## 分支命名

```
<类型>/<简短描述>
```

示例：`feat/disk-io-chart`、`fix/docker-nil-panic`、`chore/update-deps`

- 主干：`main`
- 不得直接向 `main` 推送，必须通过 PR

## AI 协作规范

任何 AI 工具（Claude Code、Codex、Cursor 等）在生成提交、PR、注释或任何贡献记录时，**不得将自身添加为贡献者或共同作者**。贡献者署名只属于真实的人类开发者。

## PR 规范

- 标题遵循提交信息格式
- 描述包含：变更内容、测试方式、截图（UI 变更时）
- 合并前需通过 CI（构建 + 类型检查）
- 单个 PR 只做一件事；重构和功能不混在同一 PR
