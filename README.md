# Apanel

Apanel 是一个移动端优先、面向 Linux 运维人员的轻量服务器管理面板。它将常见的状态查看和简单操作集中到一个响应式 Web 界面中，同时尽可能保留 Linux、systemd 和 Docker 原本的概念。

文档：[apanel.axogc.net](https://apanel.axogc.net)

> Apanel 目前仍处于早期开发阶段，接口、配置和功能可能继续调整。请勿在没有备份和访问控制的情况下直接用于重要生产环境。

## 1. 项目缘起

Apanel 受到 [1Panel](https://github.com/1Panel-dev/1Panel) 的启发。

我曾经是 1Panel 的用户和粉丝，也实际使用过一段时间。1Panel 拥有现代化的管理界面、成熟的 Docker 应用生态和较低的软件部署门槛。对于希望快速安装和管理常用服务的用户而言，它是一款优秀且完整的 Linux 运维面板。

随着使用深入，我发现自己的运维习惯与 1Panel 的产品方向并不完全相同：

- 1Panel 在 Docker 容器之上提供了更高层次的“应用”抽象，而我更希望直接管理 Docker 容器，并将 systemd 服务作为独立的一等功能。
- 应用商店、自动升级和商业版本构成了完整的产品生态，但同时也带来了更强的中心化和产品化。Apanel 希望保持为一个可以独立部署和维护的工具。
- 自动化安装降低了使用门槛，但我更希望清楚知道二进制文件、配置文件、数据文件和 systemd 服务分别位于什么位置。
- 我的许多服务直接由 systemd 管理，Docker 只用于依赖复杂或需要额外隔离的应用，因此 systemd 管理对我来说是一项核心能力。
- 1Panel 的桌面端体验和功能都很完整，但移动端并不是它的主要使用场景。

### 名称由来

`Apanel` 的命名灵感同样来自 1Panel：`1` 是第一个阿拉伯数字，`A` 是第一个英文字母。

字母 `A` 也代表作者创立的 [Axolotland Gaming Club（AxoGC）](https://www.axogc.net)，一个提供游戏服务器并进行独立游戏开发的非盈利圈子。

### 为什么移动端优先？

如果电脑就在身边，SSH、实体键盘和完整终端通常是最高效的运维方式，没有必要为了执行复杂操作而绕到 Web 面板中。

Web 面板真正有价值的场景，往往是运维人员不在电脑前，只能通过手机快速确认 CPU、内存、进程、服务和容器状态，或者执行启动、停止、重启等简单操作。Termux、Termius 等终端工具当然可以完成这些工作，但在手机软键盘上输入和编辑较长命令并不总是方便。

Apanel 因此优先考虑移动端布局：让常见状态可以快速浏览，让高频操作可以通过少量点击完成，同时保留 Web 终端处理特殊情况。

### Apanel 不准备提供什么？

Apanel 不计划提供中心化的软件商城、商业授权版本或自动安装更新功能，也不会在 Docker 容器之上再引入一套“应用”抽象。systemd 服务和 Docker 容器会作为两个独立模块存在。

新版本由用户自行前往 GitHub Releases 下载并手动更新。这样做不一定适合所有人，但安装内容、升级时机和运行方式都由服务器管理员自己掌握。

## 2. 功能与特点

### 移动端优先

- 对象列表在窄屏上使用适合触控和阅读的网格布局。
- 桌面端可以切换表格或网格布局。
- 响应式导航在桌面端支持收缩，在移动端显示为底部导航。
- 支持亮色、暗色和可切换的主题色。
- 支持中文和英文。

### 仪表盘与进程查看器

- 从 Linux `/proc` 读取 CPU、内存、交换空间、网络和进程数据。
- 使用 SSE 持续推送实时状态。
- 支持按 CPU 或内存排序。
- 支持平铺和进程树两种查看方式。
- 进程树可以收缩子进程，并统计收缩后整个子树的资源占用。

### systemd 服务管理

- 通过 D-Bus 读取和管理 `.service` 单元，而不是解析命令行输出。
- 支持查看运行状态和开机启用状态。
- 支持启动、停止、重启、启用和禁用服务。
- 支持查看和持续追踪服务日志。

systemd 服务和 Docker 容器是两个独立模块，Apanel 不会将它们合并成一个抽象的“应用”类型。

### 文件管理

- 浏览目录和文件。
- 新建文件夹、上传、下载、重命名和删除文件。
- 支持多选和批量删除。
- 支持文本文件预览和编辑。

### Docker 容器与镜像管理

- 通过 Docker Engine API 管理容器，不调用 Docker CLI。
- 支持搜索和筛选容器。
- 支持启动、停止、重启和查看容器日志。
- 支持查看本地镜像的名称、大小和使用情况。
- 支持筛选和批量删除未被容器使用的镜像。
- 正在使用的镜像不可选中，删除时也不会使用强制删除。

Docker 是可选功能。主机无法连接 Docker daemon 时，相关导航项会自动隐藏。

### 历史状态

- 通过 `sysstat` 提供的 `sadf` 读取结构化历史数据。
- 查看不同日期的 CPU 和内存使用情况。
- 可以分别配置采集开关、采集间隔和保留天数。

目前没有内置采集回退方案；主机未安装 `sadf` 时，历史状态模块会自动隐藏。

### 防火墙管理

- 读取 UFW 当前状态和编号规则。
- 将对应的 IPv4、IPv6 规则合并为一条逻辑规则展示。
- 支持添加 allow、deny、reject 和 limit 规则。
- 支持选择 TCP、UDP、IPv4 和 IPv6。

主机未安装 UFW 时，防火墙模块会自动隐藏。

### Web 终端

- 前端使用 xterm.js。
- 后端通过受登录状态保护的 WebSocket 连接 PTY。
- 默认使用 Bash，也可以切换到 sh、zsh 或 fish。
- 终端主题支持亮色、暗色和跟随应用。
- 提供当前目录的文件夹快捷列表，点击后执行 `cd`，不会自动执行 `ls`。

## 3. 安装

### 3.1 系统要求

Apanel 面向使用 systemd 的 Linux 发行版，目前需要：

- systemd 和可用的系统 D-Bus；
- 一个受支持的数据库，默认使用 SQLite；
- HTTPS，可选择由 Apanel 直接终止 TLS，或由反向代理终止 TLS；
- Bash，用作 Web 终端的默认 shell。

下列组件是可选的：

- Docker：启用容器和镜像管理；
- sysstat/sadf：启用历史状态；
- UFW：启用防火墙管理；
- zsh、fish：作为 Web 终端的可选 shell。

### 3.2 下载二进制文件

以 Linux AMD64 为例：

```bash
curl -fL \
  https://github.com/axogc/apanel/releases/latest/download/apanel-linux-amd64.gz \
  -o /tmp/apanel.gz

gunzip /tmp/apanel.gz
sudo install -m 0755 /tmp/apanel /usr/local/bin/apanel
```

安装后可以确认文件权限：

```bash
ls -l /usr/local/bin/apanel
```

正式发布时建议同时提供 AMD64、ARM64 构建和 SHA-256 校验文件。

### 3.3 创建配置和数据目录

```bash
sudo mkdir -p /etc/apanel /var/lib/apanel
```

创建 `/etc/apanel/config.env`：

```ini
APANEL_PASSWORD=请替换为一个足够长的随机密码
APANEL_LISTEN_ADDR=127.0.0.1:8080
APANEL_DSN=sqlite:///var/lib/apanel/apanel.db

# 仅在“Apanel 直接终止 TLS”方案中设置；两项必须同时设置。
#APANEL_TLS_CERT=/etc/letsencrypt/live/panel.example.com/fullchain.pem
#APANEL_TLS_KEY=/etc/letsencrypt/live/panel.example.com/privkey.pem
```

限制配置文件权限：

```bash
sudo chmod 600 /etc/apanel/config.env
```

支持的数据库 DSN：

| 数据库 | DSN 示例 |
| --- | --- |
| SQLite | `sqlite:///var/lib/apanel/apanel.db` |
| PostgreSQL | `postgres://user:password@127.0.0.1:5432/apanel` |
| MySQL | `mysql://user:password@tcp(127.0.0.1:3306)/apanel` |

`APANEL_PASSWORD` 是必填项。监听地址默认是 `:8080`，数据库默认是当前工作目录下的 `apanel.db`，但生产环境建议显式配置二者。`APANEL_TLS_CERT` 与 `APANEL_TLS_KEY` 必须同时设置或同时留空。

### 3.4 创建 systemd 服务

创建 `/etc/systemd/system/apanel.service`：

```ini
[Unit]
Description=Apanel server management panel
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/lib/apanel
ExecStart=/usr/local/bin/apanel
EnvironmentFile=/etc/apanel/config.env
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

当前阶段的 Apanel 需要管理 systemd、文件、防火墙、Docker 和本机终端，因此该服务默认以 root 身份运行。请阅读后面的安全说明。

重新加载 systemd 并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now apanel
sudo systemctl status apanel
```

查看日志：

```bash
sudo journalctl -u apanel -f
```

### 3.5 启用 HTTPS：二选一

Apanel 必须通过 HTTPS 使用。请选择以下一种方式；不需要同时配置两者。

#### 方式 A：由 Apanel 直接终止 TLS

适合不需要反向代理、愿意让 Apanel 直接监听 HTTPS 端口的部署。

此方式下，普通 HTTP API 与 Web 终端 WebSocket 都由 Apanel 的同一个 HTTPS 监听器直接提供，无需额外的 WebSocket 配置。

在 `/etc/apanel/config.env` 中设置证书、私钥和 HTTPS 监听地址：

```ini
APANEL_LISTEN_ADDR=:443
APANEL_TLS_CERT=/etc/letsencrypt/live/panel.example.com/fullchain.pem
APANEL_TLS_KEY=/etc/letsencrypt/live/panel.example.com/privkey.pem
```

重启服务后，直接访问 `https://panel.example.com`：

```bash
sudo systemctl restart apanel
sudo systemctl status apanel
```

证书续期后，重启 Apanel 以重新加载证书：

```bash
sudo systemctl restart apanel
```

#### 方式 B：由 Nginx 终止 TLS 并反向代理

适合已经使用 Nginx、希望在同一个反向代理中统一管理证书和站点的部署。

保持 `APANEL_TLS_CERT` 与 `APANEL_TLS_KEY` 留空，并让 Apanel 只监听本机回环地址：

```ini
APANEL_LISTEN_ADDR=127.0.0.1:8080
```

Web 终端需要 WebSocket 升级头。在 Nginx 的 `http` 块中加入：

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}
```

站点配置示例：

```nginx
server {
  listen 443 ssl;
  server_name panel.example.com;

  ssl_certificate     /path/to/fullchain.pem;
  ssl_certificate_key /path/to/private.key;

  location = /api/terminal {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        $connection_upgrade;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 1h;
    proxy_send_timeout 1h;
    proxy_buffering off;
  }

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
  }
}
```

检查配置并重新加载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

最后访问 `https://panel.example.com`，使用 `APANEL_PASSWORD` 登录。

## 4. 手动升级

Apanel 不会自动下载或安装更新。升级由管理员自行控制：

1. 从 GitHub Releases 下载新版本并验证校验值；
2. 备份 `/etc/apanel/config.env` 和数据库；
3. 用新二进制文件替换 `/usr/local/bin/apanel`；
4. 重启服务并检查状态。

```bash
sudo install -m 0755 /tmp/apanel /usr/local/bin/apanel
sudo systemctl restart apanel
sudo systemctl status apanel
```

## 5. 从源码构建

开发环境需要近期版本的 Go、Node.js 和 npm。

构建前端并将产物复制到 Go 的嵌入目录，然后构建后端：

```bash
make build
```

生成的可执行文件位于：

```text
api/apanel
```

分别启动开发服务器：

```bash
make dev-api
make dev-web
```

运行检查：

```bash
cd api
go test ./...

cd ../web
npm run build
npm run lint
```

## 6. 项目结构

```text
apanel/
├── api/                    # Go 后端
│   ├── cmd/apanel/         # 程序入口
│   └── internal/           # 按领域划分的后端模块
├── web/                    # React 前端
│   └── src/
│       ├── components/     # 跨模块基础组件
│       ├── lib/            # API、主题、认证和国际化
│       └── modules/        # 仪表盘、服务、文件、容器等功能模块
├── deploy/                 # systemd 与环境变量示例
├── Makefile
└── plan.txt                # 最初的设计计划
```

前端构建为 CSR SPA，构建产物会复制到 Go 包内并通过 `embed` 嵌入，最终形成单一可执行文件。后端使用 `net/http`，API 不携带版本号，并采用统一响应信封：

```json
{
  "code": "OK",
  "error": "",
  "data": {}
}
```

## 7. 技术栈

前端：

- React、TypeScript、Vite
- Tailwind CSS
- Radix UI、shadcn/ui、Lucide
- ECharts
- xterm.js

后端：

- Go、`net/http`
- GORM
- SQLite、PostgreSQL、MySQL
- systemd D-Bus API
- Docker Engine API
- UFW、sysstat/sadf
- PTY、WebSocket

## 8. 安全说明

Apanel 是高权限管理工具，不是普通网站。

- 当前阶段服务默认以 root 身份运行。
- 登录用户可以操作 systemd 服务、Docker、文件、防火墙和本机终端。
- Web 终端实际执行的是服务器命令，权限与 Apanel 进程相同。
- 必须通过 HTTPS 部署，避免密码和会话被窃取。
- 请使用足够长的随机密码，并妥善保护 `/etc/apanel/config.env`。
- 建议通过 VPN、访问控制列表或可信反向代理限制访问来源。
- 不建议将未采取额外安全措施的实例直接暴露到公网。
- 执行升级、删除文件、删除镜像或修改防火墙前，请先做好备份并确认影响范围。

Apanel 当前采用单管理员密码和 Cookie Session，不提供多用户、角色或细粒度权限系统。

## 9. 设计原则

- 移动端优先，但不牺牲桌面端效率。
- systemd 和 Docker 分开管理。
- 不为了统一概念而过度抽象。
- 单一二进制、明确配置、透明安装。
- 默认值保持实用，关键配置必须显式提供。
- 界面保持极简和扁平，主题色只用于克制的强调。
- 不提供应用商店、商业授权和自动更新。
- 面板负责快速查看和简单操作，复杂运维仍然交给 SSH 和标准 Linux 工具。
