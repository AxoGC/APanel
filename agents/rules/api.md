# API 设计规范

适用范围：`api/internal/handler/` 下的所有 HTTP 接口。

## 响应格式

所有接口统一返回：

```json
{
  "code": 0,
  "error": "",
  "data": {}
}
```

- `code`: `0` 表示成功，非零表示错误（见错误码表）
- `error`: 成功时为空字符串，失败时为用户可读的中文描述
- `data`: 成功时的业务数据，失败时为 `null`
- HTTP 状态码：成功一律 `200`，认证失败 `401`，其余业务错误也用 `200` + `code` 区分

## 路由设计

```
GET    /api/v1/<资源>          # 列表
GET    /api/v1/<资源>/:id      # 详情
POST   /api/v1/<资源>          # 创建
PUT    /api/v1/<资源>/:id      # 全量更新
PATCH  /api/v1/<资源>/:id      # 部分更新
DELETE /api/v1/<资源>/:id      # 删除
```

- 资源名用复数小写（`/api/v1/services`）
- 动作类操作（启动、停止）用 POST + 动词子路径：`POST /api/v1/services/:id/start`
- 不在 URL 中放动词（不用 `/startService`）

## 错误码

| code | 含义 |
|------|------|
| 0 | 成功 |
| 1 | 通用业务错误（见 error 字段） |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 实时接口

- 仪表盘指标推送：SSE，路径 `/api/v1/metrics/stream`
- 终端：WebSocket，路径 `/api/v1/terminal/ws`
- Docker attach：WebSocket，路径 `/api/v1/containers/:id/attach`
- SSE 和 WS 接口不走统一响应格式，直接流式输出
