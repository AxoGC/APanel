---
title: 安装
---

# 安装

Apanel 支持 Linux AMD64 和 ARM64，依赖 systemd，并需要以 root 权限运行，才能管理本机的服务、文件、防火墙、Docker 和终端。

安装分为两组选择：

- 安装方式：选择「1. 一键安装」或「2. 手动安装」，不需要重复执行。
- HTTPS 方式：安装完成后，选择「3. Nginx 反向代理」或「4. 手动配置证书」。两种方式都能启用 HTTPS，也不需要同时配置。

::: warning
Apanel 包含终端、文件管理和服务控制等高权限功能，请勿通过明文 HTTP 暴露到公网。登录密码本身在明文 HTTP 下也受保护，但会话和登录后的所有操作都不受保护，详见[安全使用](./secure.md)。安装完成后，请继续配置以下任意一种 HTTPS 方案。
:::

Apanel 没有配置文件的概念：只使用 SQLite 存储自身数据（配置项、登录密码、会话），数据库文件固定为默认路径，不需要单独安装或配置数据库服务；登录密码首次启动时自动生成并打印到日志中，之后可以在「设置」里改成自己的密码。想覆盖监听端口或直接启用 HTTPS 时，把环境变量内联写进 systemd 单元文件即可，见下文示例。

Docker、UFW 和 sysstat 不是启动 Apanel 的必需依赖；缺少它们时，对应的容器管理、防火墙管理或历史状态功能将不可用。

## 1. 一键安装

一键安装适合绝大多数场景。脚本会自动识别 AMD64 或 ARM64 架构，下载最新版本，创建 systemd 服务并启动 Apanel。

先下载安装脚本，再以 root 权限执行：

```bash
curl -fsSL https://raw.githubusercontent.com/axogc/apanel/main/install.sh -o install.sh
sudo bash install.sh
```

脚本会使用以下默认位置：

| 内容 | 路径 |
| --- | --- |
| 可执行文件 | `/usr/local/bin/apanel` |
| SQLite 数据库 | `/var/lib/apanel/apanel.db` |
| systemd 单元 | `/etc/systemd/system/apanel.service` |

Apanel 首次启动时，如果数据库里还没有密码记录，会自动生成一个随机密码并打印到日志里；安装脚本会读取这条日志，在终端里直接显示这个密码。请立即妥善保存，登录后到「设置」中改成自己的密码。如果错过了这条输出，可以随时重新查看：

```bash
sudo journalctl -u apanel | grep "generated one"
```

查看运行状态和日志：

```bash
sudo systemctl status apanel
sudo journalctl -u apanel -f
```

一键安装完成后，Apanel 默认通过 `:8123` 提供明文 HTTP。不要直接将该端口暴露到公网，请继续选择「3. Nginx 反向代理」或「4. 手动配置证书」。

## 2. 手动安装

手动安装适合希望确认每个安装步骤或自定义安装路径的用户。以下示例仍使用推荐的默认路径。

### 下载可执行文件

AMD64：

```bash
curl -fL https://github.com/axogc/apanel/releases/latest/download/apanel-linux-amd64.gz \
  -o /tmp/apanel.gz
```

ARM64：

```bash
curl -fL https://github.com/axogc/apanel/releases/latest/download/apanel-linux-arm64.gz \
  -o /tmp/apanel.gz
```

解压并安装：

```bash
gunzip /tmp/apanel.gz
sudo install -m 0755 /tmp/apanel /usr/local/bin/apanel
```

### 创建 systemd 服务

Apanel 没有配置文件：登录密码存在它自己的 SQLite 数据库里（首次启动自动生成，之后可在「设置」中修改），数据库路径固定为 `/var/lib/apanel/apanel.db`（首次启动会自动创建），不需要预先创建或配置。如果想覆盖默认监听地址，把环境变量直接内联写进 systemd 单元文件。

创建 `/etc/systemd/system/apanel.service`：

```ini
[Unit]
Description=Apanel server management panel
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/apanel
#Environment=APANEL_LISTEN_ADDR=:8123
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

重新加载 systemd，并设置 Apanel 开机启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now apanel
sudo systemctl status apanel
```

如果启动失败，可以查看服务日志：

```bash
sudo journalctl -u apanel -n 100 --no-pager
```

首次启动会在日志里打印自动生成的登录密码：

```bash
sudo journalctl -u apanel | grep "generated one"
```

此时 Apanel 默认监听 `:8123`，提供明文 HTTP，适合继续配置 Nginx。如果要让 Apanel 直接提供 HTTPS，请按照第 4 节修改监听地址并配置证书。

## 3. Nginx 反向代理

本方案由 Nginx 提供 HTTPS，Apanel 在本机回环地址上提供 HTTP。使用本方案时，不要设置 `APANEL_TLS_CERT` 和 `APANEL_TLS_KEY`。

编辑`/etc/systemd/system/apanel.service`，在`[Service]`部分内联声明监听地址，限制 Apanel 只监听回环地址：

```ini
[Service]
ExecStart=/usr/local/bin/apanel
Environment=APANEL_LISTEN_ADDR=127.0.0.1:8123
Restart=on-failure
```

修改单元文件后需要重新加载并重启 Apanel：

```bash
sudo systemctl daemon-reload
sudo systemctl restart apanel
```

Web 终端和容器 Attach 使用 WebSocket，仪表盘和日志还会使用长连接。先在 Nginx 的 `http` 块中加入以下 `map`：

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}
```

然后创建站点配置。请将域名和证书路径替换为自己的实际值：

```nginx
server {
  listen 80;
  server_name panel.example.com;

  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name panel.example.com;

  ssl_certificate     /etc/letsencrypt/live/panel.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/panel.example.com/privkey.pem;

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

检查配置并重新加载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

现在可以通过 `https://panel.example.com` 访问 Apanel。建议在防火墙中只开放 HTTPS 端口，不要开放 Apanel 的 `8123` 端口。

## 4. 手动配置证书

如果不需要反向代理，Apanel 可以直接加载证书并提供 HTTPS。使用本方案时不需要安装或配置 Nginx。

准备好域名对应的证书和私钥后，编辑`/etc/systemd/system/apanel.service`，在`[Service]`部分内联声明监听地址和证书路径：

```ini
[Service]
ExecStart=/usr/local/bin/apanel
Environment=APANEL_LISTEN_ADDR=:443
Environment=APANEL_TLS_CERT=/etc/letsencrypt/live/panel.example.com/fullchain.pem
Environment=APANEL_TLS_KEY=/etc/letsencrypt/live/panel.example.com/privkey.pem
Restart=on-failure
```

`APANEL_TLS_CERT` 和 `APANEL_TLS_KEY` 必须同时设置，分别指向 PEM 格式的完整证书链和私钥。Apanel 默认以 root 身份运行，因此可以直接读取上述证书文件并监听 443 端口。

重新加载并重启服务使配置生效：

```bash
sudo systemctl daemon-reload
sudo systemctl restart apanel
sudo systemctl status apanel
```

随后通过 `https://panel.example.com` 访问 Apanel。普通 HTTP API、Web 终端和容器 Attach 的 WebSocket 都由同一个 HTTPS 监听端口提供，不需要额外配置 WebSocket 转发。

证书续期后，Apanel 不会自动重新读取证书文件，需要再次重新加载并重启服务：

```bash
sudo systemctl daemon-reload
sudo systemctl restart apanel
```

## 5. 忘记密码

如果忘记了登录密码，选择以下一种方式重置：

- **重置整个数据库**：删除 `/var/lib/apanel/apanel.db` 并重启服务。Apanel 会把这当成全新安装，重新生成一个随机密码并打印到日志中，但此前保存的所有设置（已启用的模块、数据库/代理连接信息等）也会一并丢失。
- **只删除密码记录**：保留其余数据，只清掉密码这一条：

  ```bash
  sudo systemctl stop apanel
  sqlite3 /var/lib/apanel/apanel.db "DELETE FROM config_entries WHERE key = 'auth.password_hash';"
  sudo systemctl start apanel
  sudo journalctl -u apanel | grep "generated one"
  ```

  重启后 Apanel 发现密码记录缺失，会重新生成一个新密码并打印到日志中，其余设置不受影响。
