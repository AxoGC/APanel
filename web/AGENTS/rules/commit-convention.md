# 提交规范

## 不留 claude 署名

**commit message 里不可以出现任何 AI 署名。**

禁止 `Co-Authored-By: Claude ...`、`🤖 Generated with Claude Code` 及任何同类尾注。
PR 描述同理。

## 格式

`type: 小写英文摘要`，type 用 `feat` / `fix` / `refactor` / `docs` / `chore`。

```
feat: add upload-rate history chart, migrate history page layout
refactor: render service logs through TextReader
```
