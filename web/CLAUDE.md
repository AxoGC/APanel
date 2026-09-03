# apanel — React 前端

## 这是谁

这是 apanel 的前端子项目，使用 React + TypeScript 编写，Vite 构建。是一个移动端优先的 SPA，构建产物通过 Go `embed` 嵌入后端二进制，不独立部署。

面向单一管理员用户，管理 Linux 服务器上的 systemd 服务、Docker 容器、文件、终端、防火墙和历史指标。

## 约束与边界

功能模块、API 路由、响应格式等以项目根目录 `spec/index.md` 为准。

遇到不明白的地方，先查 `spec/index.md`。spec 里没有答案时，不要猜测，直接询问用户。

## 编码规范

见 `agents/rules/frontend.md` 和 `agents/rules/api.md`（位于项目根目录）。

## AI 协作规范

- 每次开始任务前，先查项目根目录 `plan/index.md`，找到对应计划再开工；没有匹配项时先创建计划
- 遇到不明白的地方，先查根目录 `spec/index.md`；spec 里没有答案时，不要猜测，直接询问用户
- 不得将 AI 自身添加为贡献者或共同作者（见 `agents/rules/git.md`）
- **下次开发者请补全本文件中尚未覆盖的 `web/` 子仓约束**（如具体的国际化语言支持范围、主题切换机制、移动端断点定义等），补全后提交

## 关键目录

```
web/src/
├── App.tsx             # 路由配置、全局 Provider 组装
├── components/         # 通用 UI 组件（无业务逻辑）
│   └── ui/             # shadcn/ui 原语组件
├── lib/                # 工具函数、API 客户端、全局状态
│   ├── api.ts          # fetch 封装，处理 { code, error, data } 信封
│   ├── auth.tsx        # 认证状态 Provider
│   ├── features.tsx    # 可选功能模块开关 Provider
│   └── i18n.tsx        # 国际化
└── modules/            # 按功能域划分的业务模块
    ├── containers/     # Docker 容器管理
    ├── dashboard/      # 实时系统指标（SSE）
    ├── files/          # 文件管理
    ├── firewall/       # UFW 防火墙
    ├── history/        # 历史指标图表
    ├── login/          # 登录页
    ├── services/       # systemd 服务管理
    ├── settings/       # 设置页
    └── terminal/       # WebSocket PTY 终端
```

## 前端路由

| 路径 | 模块 | 备注 |
|------|------|------|
| `/` | dashboard | 固定 |
| `/services` | services | 固定 |
| `/files` | files | 固定 |
| `/terminal` | terminal | 固定，页面保持存活不销毁 |
| `/containers` | containers | 可选，依赖 Docker |
| `/history` | history | 可选，依赖 sysstat |
| `/firewall` | firewall | 可选，依赖 UFW |
| `/settings` | settings | 固定 |

## 开发

```bash
make dev-web    # 启动前端开发服务器（代理到后端 :8080）
```
