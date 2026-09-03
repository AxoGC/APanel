# apanel — Go 后端

## 这是谁

这是 apanel 的后端子项目，使用 Go 编写。负责所有业务逻辑、系统集成（systemd、Docker、UFW、PTY）、HTTP API 和数据库操作。以 root 权限运行，是整个应用的唯一服务进程。

编译产物是单一可执行文件 `apanel`，前端 SPA 通过 `embed` 嵌入其中。

## 约束与边界

功能边界、API 路由、响应格式等以项目根目录 `spec/index.md` 为准。

遇到不明白的地方，先查 `spec/index.md`。spec 里没有答案时，不要猜测，直接询问用户。

## 编码规范

见 `agents/rules/go.md` 和 `agents/rules/api.md`（位于项目根目录）。

## AI 协作规范

- 每次开始任务前，先查项目根目录 `plan/index.md`，找到对应计划再开工；没有匹配项时先创建计划
- 遇到不明白的地方，先查根目录 `spec/index.md`；spec 里没有答案时，不要猜测，直接询问用户
- 不得将 AI 自身添加为贡献者或共同作者（见 `agents/rules/git.md`）
- **下次开发者请补全本文件中尚未覆盖的 `api/` 子仓约束**（如具体的错误码定义、数据库迁移规范、systemd/Docker 集成的边界条件等），补全后提交

## 关键目录

```
api/
├── cmd/apanel/         # 入口，只做初始化和启动
└── internal/
    ├── auth/           # 认证、会话、中间件
    ├── config/         # 启动配置（从环境变量读取）
    ├── container/      # Docker Engine API 集成
    ├── db/             # 数据库连接初始化
    ├── files/          # 文件系统操作
    ├── firewall/       # UFW 集成
    ├── history/        # sysstat/sadf 历史指标
    ├── httpserver/     # 路由注册、handler 实现
    ├── model/          # GORM 数据库模型
    ├── response/       # 统一响应格式工具
    ├── service/        # systemd D-Bus 服务管理
    ├── settings/       # 运行时配置键值管理
    ├── stats/          # 实时系统指标采集
    └── sysinfo/        # 系统基本信息
```

## 启动配置

| 环境变量 | 必填 | 默认值 |
|----------|------|--------|
| `APANEL_PASSWORD` | 是 | 无 |
| `APANEL_LISTEN_ADDR` | 否 | `:8080` |
| `APANEL_DSN` | 否 | `sqlite://./apanel.db` |
| `APANEL_TLS_CERT` | 否 | 无 |
| `APANEL_TLS_KEY` | 否 | 无 |

## 开发

```bash
make dev-api    # 启动后端开发服务器
make build      # 完整构建（需先构建前端）
```
