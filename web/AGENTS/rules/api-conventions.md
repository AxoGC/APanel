# API 约定

## 统一信封

所有请求走 `src/lib/api.ts` 的 `apiFetch`，响应统一信封：

```ts
{ code: string, error: string, data: T }
```

`code !== 'OK'` 时抛 `ApiError`（带 `code` 和已本地化的 `message`）。

**不要自己 `fetch` 业务接口**，否则会绕过三件事：信封解包、401 跳登录、错误码翻译。

- 错误码集中在 `src/lib/errors.ts`，与后端 `api/internal/response` 一一对应
- 鉴权是 cookie session，前端不持有 token
- 每个模块的请求函数写在自己的 `api.ts` 里，只导出领域函数，不导出裸 URL（流地址除外）

## 流式接口

### SSE

用于 dashboard 概览、服务/容器日志、数据库容量与表统计。

通过 `src/lib/mock.ts` 的 `openDashboardStream` / `openLogStream` 打开，
它们内部按 `MOCK` 分流，返回统一的 `StreamSource`。

**不要在调用处自己写 `MOCK ? new MockXxx : new EventSource`**——
那样拿到的是联合类型，`onmessage` 的参数推导不出来，会报 TS7006。

### WebSocket

用于终端 PTY、容器 attach。mock 模式下**未模拟**，连接会失败，属预期行为。
