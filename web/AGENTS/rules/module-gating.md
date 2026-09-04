# 模块启停与依赖探测

**两套独立机制，别混。**

## 1. 启停 / 排序

接口 `GET /status`、`PUT /status/features`。

8 个模块可开关排序，其中 `terminal` / `services` / `files` 三个是必选，不可关闭。

状态由 `src/lib/features.tsx` 持有。注意它在请求失败时会 `.catch` 成空列表，
**导航会静默变空**——排查"侧栏没东西"时先看这个接口。

## 2. 依赖探测

接口 `GET/PUT /modules/:key/dependency`。

`containers` / `history` / `firewall` / `proxy` / `database` 五个模块使用，
检测外部依赖是否就绪，并提供连接配置表单。

- 页面侧用 `useDependencyGate(key)` 接入
- UI 复用 `components/DependencyDialog.tsx`，不要另写一套状态提示
