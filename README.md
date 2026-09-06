<p align="center">
  <img src="docs/docs/public/assets/logo.png" width="48" align="middle" alt="APanel logo">
  &nbsp;<b>APanel</b> —— 你的掌上Linux系统
</p>

APanel 是一个移动端优先、Linux原生、轻量级的Web运维面板，使用Go + React开发，受到1Panel启发。

[文档：apanel.axogc.net](https://apanel.axogc.net)

> APanel 目前仍处于早期开发阶段，接口、配置和功能可能继续调整。

### 名称由来

`APanel` 的命名灵感借鉴 1Panel：`1` 是第一个阿拉伯数字，`A` 是第一个英文字母。

`A` 也代表作者创立的 [Axolotland Gaming Club（AxoGC）](https://www.axogc.net)，一个致力于开源软件、独立游戏、Minecraft服务器的非盈利圈子。

### APanel 特点

- **移动端优先**：优先为手机端做界面适配，方便不在电脑前时，快速查看服务状态，进行服务启停。
- **Linux原生**：暴露Linux基础概念，包括进程、systemd服务、Docker容器等，不做“应用”等高层抽象，适合有一定Linux经验的用户。
- **界面简洁**：界面风格扁平、朴素、低调、高效，以内容为主，而又不失美观。
- **轻量级**：单一二进制可执行程序，体积仅22MB，压缩后仅8MB。
- **非盈利**：软件完全开源免费，不提供商业化付费版本，使用GPL许可证。不提供官方应用商城。

### 为什么移动端优先？

- 如果电脑就在身边，完全可以用SSH和键盘进行更高效、更灵活的运维，没有理由去用Web面板。
- APanel的存在，就是为了解决：运维人不在电脑前，希望通过手机查看服务器占用、服务状态、执行启动/停止/重启等简单操作的场景。
- Termux/Termius等工具当然也能用，但在手机上输命令不是很方便。

### 1. 和1Panel的关系

APanel 受到 [1Panel](https://github.com/1Panel-dev/1Panel) 的启发。我曾经是 1Panel 的粉丝。1Panel 拥有现代化的界面、成熟的 Docker 生态和较低的门槛，是一款优秀的 Linux 面板。随着深入使用，我的需求与 1Panel 并不完全相同：

- 1Panel很多数据用表格展示，手机端适配差，用手机管理服务不是很方便；
- 1Panel不支持Docker Attach，无法交互式地向Minecraft服务器发送命令；
- 我的一部分服务由 systemd 管理，一部分 Docker 管理，1Panel不支持systemd；

## 2. 功能模块一览

### 仪表盘

- 仪表盘展示CPU、内存、带宽占用；进程管理，支持父子进程树、按CPU/内存排序、进程详情。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/dashboard.webp" height="420" alt="仪表盘与进程查看器 - 移动端">
  <img src="docs/docs/public/assets/screenshots/dashboard-desktop.webp" height="420" alt="仪表盘与进程查看器 - 桌面端">
</p>

### 设置

- 包括主机信息栏、支持亮色/暗色、主题色切换、中文/English切换、面板模块（容器/数据库）启用/禁用。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/mobile-first.webp" height="420" alt="移动端优先 - 移动端">
  <img src="docs/docs/public/assets/screenshots/mobile-first-desktop.webp" height="420" alt="移动端优先 - 桌面端">
</p>

### systemd 服务管理

- 基于systemd，包括服务列表、服务详情和日志、暂停和重启服务。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/services.webp" height="420" alt="systemd 服务管理 - 移动端">
  <img src="docs/docs/public/assets/screenshots/services-desktop.webp" height="420" alt="systemd 服务管理 - 桌面端">
</p>

### 文件管理

- 创建目录、上传/下载/删除、多选和批量操作、文本文件预览和编辑、图片预览。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/files.webp" height="420" alt="文件管理 - 移动端">
  <img src="docs/docs/public/assets/screenshots/files-desktop.webp" height="420" alt="文件管理 - 桌面端">
</p>

### Docker 容器管理

- 容器详情和日志、关闭/重启/创建容器、docker exec/attach、镜像管理、网络管理、数据卷管理。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/containers.webp" height="420" alt="Docker 容器与镜像管理 - 移动端">
  <img src="docs/docs/public/assets/screenshots/containers-desktop.webp" height="420" alt="Docker 容器与镜像管理 - 桌面端">
</p>

### 数据库管理

- 支持`MySQL`/`PostgreSQL`，统计显示数据库列表、表列表、磁盘占用、字段数、总数据行数。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/database.webp" height="420" alt="数据库管理 - 移动端">
  <img src="docs/docs/public/assets/screenshots/database-desktop.webp" height="420" alt="数据库管理 - 桌面端">
</p>

### 历史状态

- 基于`sysstat`，支持CPU、内存、硬盘I/O、上行速率、负载的存储和统计，支持查看历史数据。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/history.webp" height="420" alt="历史状态 - 移动端">
  <img src="docs/docs/public/assets/screenshots/history-desktop.webp" height="420" alt="历史状态 - 桌面端">
</p>

### 防火墙管理

- 基于`UFW`，支持添加/编辑/删除规则，支持设置允许/拒绝、TCP/UDP、IPv4/IPv6、来源地址。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/firewall.webp" height="420" alt="防火墙管理 - 移动端">
  <img src="docs/docs/public/assets/screenshots/firewall-desktop.webp" height="420" alt="防火墙管理 - 桌面端">
</p>

### 代理设置

- 基于`clash`/`mihomo`，支持修改全局/规则/直连、按规则设置代理、代理测速。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/proxy.webp" height="420" alt="代理设置 - 移动端">
  <img src="docs/docs/public/assets/screenshots/proxy-desktop.webp" height="420" alt="代理设置 - 桌面端">
</p>

### Web 终端

- 支持`sh`/`bash`/`zsh`/`fish`，连接状态持久化，切换页面后连接不断开。

<p align="center">
  <img src="docs/docs/public/assets/screenshots/terminal.webp" height="420" alt="Web 终端 - 移动端">
  <img src="docs/docs/public/assets/screenshots/terminal-desktop.webp" height="420" alt="Web 终端 - 桌面端">
</p>

## 3. 安装

### 3.1 系统要求

- APanel需要一个使用systemd的Linux系统，例如Ubuntu/Debian/CentOS/Arch Linux等，不支持使用OpenRC的Alpine Linux等。

### 3.2 一键安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/axogc/apanel/main/install.sh | sudo bash
```

如果你的服务器因网络问题无法访问GitHub，可以尝试下面的命令：

```bash
curl -fsSL https://apanel.axogc.net/install.sh | sudo bash
```
这个脚本将会下载并解压最新版本程序，删除并替换旧的可执行文件，如果有旧的数据和`.service`文件，则保留，如果没有，则创建最小化的`.service`文件，然后重启apanel服务。

如果你想手动逐步安装，不想用一键脚本，请参阅[apanel.axogc.net/install.md](https://apanel.axogc.net/install.md)

如果你想自己编译程序，请参阅[apanel.axogc.net/build.md](https://apanel.axogc.net/build.md)

APanel 没有配置文件的概念：默认端口是`8123`，数据（包括登录密码）都存放在自己的 sqlite 数据库里，不需要单独部署或配置数据库。首次启动时，如果数据库里还没有任何用户，APanel 会自动创建一个、生成一个随机密码并打印到日志中：

```bash
sudo journalctl -u apanel | grep "generated one"
```

用这个密码登录后，请尽快到「设置」里改成自己的密码。如果想更换监听端口或直接用 APanel 终止 HTTPS，请编辑`/etc/systemd/system/apanel.service`，在`[Service]`部分内联声明环境变量（见下一节示例），而不是去找一个配置文件。

### 3.3 启用 HTTPS：二选一

APanel 强烈建议通过 HTTPS 使用：登录密码本身在传输时已加密保护，但登录后的会话与所有后续操作（文件内容、终端输入输出等）在明文 HTTP 下都会被暴露，详见[安全使用](https://apanel.axogc.net/secure.html)。请选择以下一种方式启用 HTTPS；不需要同时配置两者。

#### 方式 A：由 APanel 直接终止 TLS

适合不需要反向代理、愿意让 APanel 直接监听 HTTPS 端口的部署。

此方式下，普通 HTTP API 与 Web 终端 WebSocket 都由 APanel 的同一个 HTTPS 监听器直接提供，无需额外的 WebSocket 配置。

编辑`/etc/systemd/system/apanel.service`，在`[Service]`部分内联声明证书、私钥和 HTTPS 监听地址：

```ini
[Service]
ExecStart=/usr/local/bin/apanel
Environment=APANEL_LISTEN_ADDR=:443
Environment=APANEL_TLS_CERT=/etc/letsencrypt/live/panel.example.com/fullchain.pem
Environment=APANEL_TLS_KEY=/etc/letsencrypt/live/panel.example.com/privkey.pem
Restart=on-failure
```

重新加载并重启服务后，直接访问 `https://panel.example.com`：

```bash
sudo systemctl daemon-reload
sudo systemctl restart apanel
sudo systemctl status apanel
```

证书续期后，同样重新加载并重启 APanel 以应用新证书：

```bash
sudo systemctl daemon-reload
sudo systemctl restart apanel
```

#### 方式 B：由 Nginx 终止 TLS 并反向代理

站点配置示例：

```nginx
server {
  listen 443 ssl;
  server_name panel.example.com;

  ssl_certificate     /path/to/fullchain.pem;
  ssl_certificate_key /path/to/private.key;
  location / {
    proxy_pass http://127.0.0.1:8123;
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

### 3.4 升级

升级只替换可执行文件，数据库和 systemd 单元都不受影响，具体步骤（含一键脚本和手动升级）请参阅[apanel.axogc.net/upgrade.md](https://apanel.axogc.net/upgrade.md)。

## 4. 安全说明

APanel 是高权限管理工具，不是普通网站。

- 当前阶段服务默认以 root 身份运行。
- 登录用户可以操作 systemd 服务、Docker、文件、防火墙和本机终端。
- Web 终端实际执行的是服务器命令，权限与 APanel 进程相同。
- 强烈建议通过 HTTPS 部署。明文 HTTP 下登录密码本身受保护，但会话和登录后的所有操作都以明文传输，存在被窃取或篡改的风险；APanel 会在明文 HTTP 下显示风险提示，但不会阻止使用。
- 首次启动自动生成的密码请尽快在「设置」中改成自己的密码；密码经 bcrypt 哈希后存放在 APanel 自己的 sqlite 数据库里，不会以明文形式出现在任何配置文件中。
- 建议通过 VPN、访问控制列表或可信反向代理限制访问来源。
- 不建议将未采取额外安全措施的实例直接暴露到公网。
- 执行升级、删除文件、删除镜像或修改防火墙前，请先做好备份并确认影响范围。

APanel 支持多个登录账号（在「设置 → 用户管理」中添加，登录时仍然只需要输入密码，系统会自动匹配到对应账号），但目前所有账号权限完全相同，不提供角色或细粒度权限系统——多账号的作用仅仅是配合「审计日志」区分"是谁做的"，不能用来限制某个账号能做什么。

### 4.1 忘记密码

忘记登录密码时，可以重置整个数据库，也可以只删除密码记录、保留其余设置，具体步骤请参阅[apanel.axogc.net/install.md](https://apanel.axogc.net/install.md)的「5. 忘记密码」一节。

## 5. 许可证

APanel 使用 [GPLv3](./LICENSE) 许可证开源。
