# Mock 模式

`VITE_MOCK=true` 时，`apiFetch` 转发给 `src/lib/mock.ts` 的 `mockApiFetch`，
纯前端拦截，无后端参与。

**新增接口时同步在 `mock.ts` 里加 handler**——漏加会命中兜底的 `mock: unhandled`
reject，页面直接报错。

流式接口在 mock 下的行为见 [api-conventions.md](api-conventions.md)：SSE 有模拟，
WebSocket（终端、容器 attach）没有。

完整细节和已知限制见 [`web/MOCK.md`](../../MOCK.md)。
