# Apanel

APanel 是一个移动端优先、Linux原生、轻量级的Web运维面板，受到1Panel启发。

[文档：apanel.axogc.net](https://apanel.axogc.net)

> Apanel 目前仍处于早期开发阶段，接口、配置和功能可能继续调整。

### 名称由来

`Apanel` 的命名灵感借鉴 1Panel：`1` 是第一个阿拉伯数字，`A` 是第一个英文字母。

`A` 也代表作者创立的 [Axolotland Gaming Club（AxoGC）](https://www.axogc.net)，致力于开源软件、独立游戏、Minecraft服务器的非营利圈子。

### Apanel 特点

- **移动端优先**：优先为手机端做界面适配，方便不在电脑前时，快速查看服务状态，进行服务启停。
- **Linux原生**：暴露Linux基础概念，包括进程、systemd服务、Docker容器等，不做“应用”等高层抽象，适合有一定Linux经验的用户。
- **界面简洁**：界面风格扁平、朴素、低调、高效，以内容为主，而又不失美观。
- **非盈利**：软件完全开源免费，不提供商业化付费版本，使用GPL许可证。不提供官方应用商城。

### 为什么移动端优先？

如果电脑就在身边，完全可以用SSH和键盘进行更高效、更灵活的运维，没有理由去用Web面板。
APanel的存在，就是为了解决：运维人不在电脑前，希望通过手机查看服务器占用、服务状态、执行启动/停止/重启等简单操作的场景。
Termux/Termius等工具当然也能用，但在手机上输命令不是很方便。
因此，Apanel 优先适配移动端：让常见状态可以快速浏览，让高频操作可以通过少量点击完成，同时保留 Web 终端处理特殊情况。

## 1. 和1Panel的关系

APanel 受到 [1Panel](https://github.com/1Panel-dev/1Panel) 的启发。我曾经是 1Panel 的粉丝。1Panel 拥有现代化的界面、成熟的 Docker 生态和较低的门槛，是一款优秀的 Linux 面板。随着深入使用，我的需求与 1Panel 并不完全相同：

- 1Panel很多数据用表格展示，手机端适配差，用手机对管理服务不是很方便；
- 1Panel不支持Docker Attach，无法交互式地向Minecraft服务器发送命令；
- 我的一部分服务由 systemd 管理，一部分 Docker 管理，1Panel不支持systemd；

## 2. 功能模块一览

### 仪表盘

- 仪表盘展示CPU、内存、带宽占用；进程管理，支持父子进程树、按CPU/内存排序、进程详情。

<p align="center">
  <img src="assets/screenshots/dashboard.webp" height="420" alt="仪表盘与进程查看器 - 移动端">
  <img src="assets/screenshots/dashboard-desktop.webp" height="420" alt="仪表盘与进程查看器 - 桌面端">
</p>

### 设置

- 包括主机信息栏、支持亮色/暗色、主题色切换、中文/English切换、面板模块（容器/数据库）启用/禁用。

<p align="center">
  <img src="assets/screenshots/mobile-first.webp" height="420" alt="移动端优先 - 移动端">
  <img src="assets/screenshots/mobile-first-desktop.webp" height="420" alt="移动端优先 - 桌面端">
</p>

### systemd 服务管理

- 基于systemd，包括服务列表、服务详情和日志、暂停和重启服务。

<p align="center">
  <img src="assets/screenshots/services.webp" height="420" alt="systemd 服务管理 - 移动端">
  <img src="assets/screenshots/services-desktop.webp" height="420" alt="systemd 服务管理 - 桌面端">
</p>

### 文件管理

- 创建目录、上传/下载/删除、多选和批量操作、文本文件预览和编辑、图片预览。

<p align="center">
  <img src="assets/screenshots/files.webp" height="420" alt="文件管理 - 移动端">
  <img src="assets/screenshots/files-desktop.webp" height="420" alt="文件管理 - 桌面端">
</p>

### Docker 容器管理

- 容器详情和日志、关闭/重启/创建容器、docker exec/attach、镜像管理、网络管理、数据卷管理。

<p align="center">
  <img src="assets/screenshots/containers.webp" height="420" alt="Docker 容器与镜像管理 - 移动端">
  <img src="assets/screenshots/containers-desktop.webp" height="420" alt="Docker 容器与镜像管理 - 桌面端">
</p>

### 数据库管理

- 支持`MySQL`/`PostgreSQL`，统计显示数据库列表、表列表、磁盘占用、字段数、总数据行数。

<p align="center">
  <img src="assets/screenshots/database.webp" height="420" alt="数据库管理 - 移动端">
  <img src="assets/screenshots/database-desktop.webp" height="420" alt="数据库管理 - 桌面端">
</p>

### 历史状态

- 基于`sysstat`，支持CPU、内存、硬盘I/O、上行速率、负载的存储和统计，支持查看历史数据。

<p align="center">
  <img src="assets/screenshots/history.webp" height="420" alt="历史状态 - 移动端">
  <img src="assets/screenshots/history-desktop.webp" height="420" alt="历史状态 - 桌面端">
</p>

### 防火墙管理

- 基于`UFW`，支持添加/编辑/删除规则，支持设置允许/拒绝、TCP/UDP、IPv4/IPv6、来源地址。

<p align="center">
  <img src="assets/screenshots/firewall.webp" height="420" alt="防火墙管理 - 移动端">
  <img src="assets/screenshots/firewall-desktop.webp" height="420" alt="防火墙管理 - 桌面端">
</p>

### 代理设置

- 基于`clash`/`mihomo`，支持修改全局/规则/直连、按规则设置代理、代理测速。

<p align="center">
  <img src="assets/screenshots/proxy.webp" height="420" alt="代理设置 - 移动端">
  <img src="assets/screenshots/proxy-desktop.webp" height="420" alt="代理设置 - 桌面端">
</p>

### Web 终端

- 支持`sh`/`bash`/`zsh`/`fish`，连接状态持久化，切换页面后连接不断开。

<p align="center">
  <img src="assets/screenshots/terminal.webp" height="420" alt="Web 终端 - 移动端">
  <img src="assets/screenshots/terminal-desktop.webp" height="420" alt="Web 终端 - 桌面端">
</p>

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

### 3.2 一键安装脚本

如果接受默认路径（二进制装到 `/usr/local/bin/apanel`，配置在 `/etc/apanel`，SQLite 数据库在 `/var/lib/apanel`，监听 `:8080`），可以直接运行仓库里的 [`deploy/install.sh`](deploy/install.sh)：

```bash
curl -fsSL https://raw.githubusercontent.com/axogc/apanel/main/deploy/install.sh -o install.sh
sudo bash install.sh
```

脚本会依次完成：检查依赖命令和安装路径是否已被占用（已安装则直接退出，不会覆盖任何现有文件）；下载并解压最新版本二进制；生成一个 12 位随机密码写入 `config.env`；写入最小化的 systemd 单元并启动服务；最后把密码打印到控制台，并检查 ufw、docker、sysstat 是否已安装，逐项提示对应功能是否可用。

脚本装好后仍是明文 HTTP，请继续阅读 3.6 节启用 HTTPS。如果需要自定义安装路径、使用 PostgreSQL/MySQL，或者只是想清楚了解每一步具体做了什么，可以跳过脚本，按下面的手动步骤操作。

### 3.3 下载二进制文件

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

### 3.4 创建配置和数据目录

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

### 3.5 创建 systemd 服务

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

### 3.6 启用 HTTPS：二选一

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

  # A single location handles both plain requests and the Web 终端's
  # WebSocket upgrade — $connection_upgrade (map above) only sends
  # "Connection: upgrade" when the client actually asked to upgrade, so
  # normal requests are unaffected. proxy_read_timeout/proxy_send_timeout
  # apply panel-wide as a result, which is fine: apanel has other
  # long-lived streams (the dashboard/log SSE feeds) that benefit from the
  # same slack.
  location / {
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
- 单一二进制、明确配置。
- 默认值保持实用，关键配置必须显式提供。
- 界面保持极简和扁平，主题色只用于克制的强调。
- 不提供应用商店、商业授权和自动更新。
- 面板负责快速查看和简单操作，复杂运维仍然交给 SSH 和标准 Linux 工具。
