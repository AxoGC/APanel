# apanel 约束与边界

从代码扫描提取，描述系统当前实际边界，非设计愿景。

---

## 认证与用户模型

- **单用户系统**：无用户表，只有一个管理员密码（`APANEL_PASSWORD`，启动必填）
- **会话机制**：Cookie + 数据库 Session token（有过期时间），无 JWT
- **无 RBAC**：没有角色、权限分组、多租户概念，不在此版本范围内
- **HTTPS 强制**：非 localhost/127.0.0.1 的访问，前端强制要求 HTTPS（`web/src/lib/https.ts`）

---

## 功能模块边界

### 固定模块（始终启用）
| 模块 | 前端路由 | 描述 |
|------|----------|------|
| 仪表盘 | `/` | 实时系统指标 + 进程列表，SSE 推送 |
| 终端 | `/terminal` | WebSocket PTY，页面保持存活不销毁 |
| 服务管理 | `/services` | systemd 服务列表、启停、日志 |
| 文件管理 | `/files` | 文件列表、读写、上传下载、重命名、删除 |

### 可选模块（依赖外部工具，可在设置中禁用）
| 模块 | 前端路由 | 外部依赖 |
|------|----------|---------|
| 容器管理 | `/containers` | Docker Engine（需运行中） |
| 历史指标 | `/history` | sysstat（sadf 命令） |
| 防火墙 | `/firewall` | UFW |

可选模块由后端探测依赖是否可用，前端通过 `GET /api/status` 获取启用状态，不可用时导航栏直接隐藏入口。

### 设置页
- 前端路由 `/settings`
- 管理功能开关（`PUT /api/status/features`）和历史采集配置

---

## API 契约

### 响应格式

所有 JSON 接口统一格式：

```json
{ "code": "OK", "error": "", "data": {} }
```

- `code` 为字符串，成功值为 `"OK"`（不是数字 0）
- 失败时 `code` 为具体错误标识字符串，`error` 为可读描述
- HTTP 状态码不作为业务判断依据，前端只看 `code`

### 路由清单

**认证**（无需登录态）
```
POST   /api/login
POST   /api/logout
GET    /api/session
```

**仪表盘**
```
GET    /api/dashboard/stream                        SSE，每 2 秒推送，?sort=cpu|mem
GET    /api/dashboard/processes/{pid}
POST   /api/dashboard/processes/{pid}/terminate
GET    /api/dashboard/network-settings
PUT    /api/dashboard/network-settings
```

**终端**
```
GET    /api/terminal                                WebSocket，PTY
GET    /api/terminal/directories
```

**服务管理**
```
GET    /api/services
GET    /api/services/{name}
POST   /api/services/{name}/start
POST   /api/services/{name}/stop
POST   /api/services/{name}/restart
POST   /api/services/{name}/enable
POST   /api/services/{name}/disable
GET    /api/services/{name}/logs
GET    /api/services/{name}/logs/stream             SSE
```

**容器管理**
```
GET    /api/containers
GET    /api/containers/images
POST   /api/containers/images/delete
GET    /api/containers/images/tags
GET    /api/containers/networks
POST   /api/containers/networks/{id}/delete
GET    /api/containers/{id}
POST   /api/containers/{id}/start
POST   /api/containers/{id}/stop
POST   /api/containers/{id}/restart
GET    /api/containers/{id}/logs
GET    /api/containers/{id}/logs/stream             SSE
GET    /api/containers/{id}/attach                  WebSocket
```

**历史指标**
```
GET    /api/history
GET    /api/history/settings
PUT    /api/history/settings
```

**防火墙**
```
GET    /api/firewall/status
POST   /api/firewall/rules
PUT    /api/firewall/rules
DELETE /api/firewall/rules
```

**文件管理**
```
GET    /api/files
GET    /api/files/content
PUT    /api/files/content
POST   /api/files/mkdir
POST   /api/files/rename
POST   /api/files/delete
GET    /api/files/download
POST   /api/files/upload
```

**系统**
```
GET    /api/status
PUT    /api/status/features
GET    /api/system/info
```

---

## 数据库约束

- 支持：SQLite（默认）、PostgreSQL、MySQL，通过 `APANEL_DSN` 区分
- 当前 schema 只有 2 张表：`config_entries`（键值配置）、`sessions`（登录会话）
- 无业务数据持久化，历史指标由 sysstat 自身存储，不入库

---

## 配置项（启动环境变量）

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `APANEL_PASSWORD` | 是 | 无 | 管理员登录密码 |
| `APANEL_LISTEN_ADDR` | 否 | `:8080` | 监听地址 |
| `APANEL_DSN` | 否 | `sqlite://./apanel.db` | 数据库连接串 |
| `APANEL_TLS_CERT` | 否 | 无 | TLS 证书路径，必须与 KEY 同时设置 |
| `APANEL_TLS_KEY` | 否 | 无 | TLS 私钥路径，必须与 CERT 同时设置 |

TLS 两个变量必须同时设置或同时不设置，否则启动报错。

---

## 系统权限边界

- 进程以 **root** 运行（systemd、Docker、PTY 操作需要）
- 文件管理无路径沙箱限制（可访问整个文件系统）
- systemd 通过 D-Bus API 操作，不调用 CLI
- Docker 通过 Docker Engine API 操作，不调用 docker CLI

---

## 构建与部署约束

- 产物是**单一可执行文件**：前端 SPA 通过 Go `embed` 嵌入 `api/internal/httpserver/dist/`
- 构建顺序：`make build` = 编译前端 → 复制到 dist → 编译 Go → 输出 `api/apanel`
- 开发模式前后端独立运行：`make dev-api` + `make dev-web`
- SPA 路由由后端兜底处理（所有非 `/api` 路径返回 `index.html`）

---

## 明确不做的事

- 无多用户 / 多管理员支持
- 无插件系统 / 应用商店
- 无商业版或付费功能分层
- 无 Docker Compose 编排（仅管理单容器）
- 无邮件 / 通知 / 告警集成
- 无审计日志（操作记录）
