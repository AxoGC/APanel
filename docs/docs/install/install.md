---
title: 安装
---

# 安装

Apanel 支持 Linux AMD64 和 ARM64，依赖 systemd，并需要以 root 权限运行，才能管理本机的服务、文件、防火墙、Docker 和终端。

安装分为两组选择：

- 安装方式：选择「1. 一键安装」或「2. 手动安装」，不需要重复执行。
- HTTPS 方式：安装完成后，选择「3. Nginx 反向代理」或「4. 手动配置证书」。两种方式都能启用 HTTPS，也不需要同时配置。

::: warning
Apanel 包含终端、文件管理和服务控制等高权限功能，请勿通过明文 HTTP 暴露到公网。安装完成后，请继续配置以下任意一种 HTTPS 方案。
:::

Docker、UFW 和 sysstat 不是启动 Apanel 的必需依赖；缺少它们时，对应的容器管理、防火墙管理或历史状态功能将不可用。

## 1. 一键安装

一键安装适合使用默认目录和 SQLite 数据库的服务器。脚本会自动识别 AMD64 或 ARM64 架构，下载最新版本，生成随机登录密码，创建 systemd 服务并启动 Apanel。

先下载安装脚本，再以 root 权限执行：

```bash
curl -fsSL https://raw.githubusercontent.com/axogc/apanel/main/deploy/install.sh -o install.sh
sudo bash install.sh
```

脚本会使用以下默认位置：

| 内容 | 路径 |
| --- | --- |
| 可执行文件 | `/usr/local/bin/apanel` |
| 配置文件 | `/etc/apanel/config.env` |
| SQLite 数据库 | `/var/lib/apanel/apanel.db` |
| systemd 单元 | `/etc/systemd/system/apanel.service` |

安装成功后，终端会显示自动生成的登录密码。请立即妥善保存；也可以稍后编辑 `/etc/apanel/config.env` 中的 `APANEL_PASSWORD`，然后重启服务：

```bash
sudo systemctl restart apanel
```

查看运行状态和日志：

```bash
sudo systemctl status apanel
sudo journalctl -u apanel -f
```

一键安装完成后，Apanel 默认通过 `:8080` 提供明文 HTTP。不要直接将该端口暴露到公网，请继续选择「3. Nginx 反向代理」或「4. 手动配置证书」。

## 2. 手动安装

手动安装适合希望确认每个安装步骤、自定义路径，或者使用 PostgreSQL/MySQL 的用户。以下示例仍使用推荐的默认目录。

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

### 创建配置文件

创建配置和数据目录：

```bash
sudo mkdir -p /etc/apanel /var/lib/apanel
sudo chmod 700 /etc/apanel /var/lib/apanel
```

创建 `/etc/apanel/config.env`：

```ini
APANEL_PASSWORD=请替换为足够长的随机密码
APANEL_LISTEN_ADDR=127.0.0.1:8080
APANEL_DSN=sqlite:///var/lib/apanel/apanel.db
```

限制配置文件权限：

```bash
sudo chmod 600 /etc/apanel/config.env
```

`APANEL_PASSWORD` 是必填项。Apanel 支持以下数据库 DSN：

| 数据库 | DSN 示例 |
| --- | --- |
| SQLite | `sqlite:///var/lib/apanel/apanel.db` |
| PostgreSQL | `postgres://user:password@127.0.0.1:5432/apanel` |
| MySQL | `mysql://user:password@tcp(127.0.0.1:3306)/apanel` |

### 创建 systemd 服务

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

此时 Apanel 仅监听 `127.0.0.1:8080`，适合继续配置 Nginx。如果要让 Apanel 直接提供 HTTPS，请按照第 4 节修改监听地址并配置证书。

## 3. Nginx 反向代理

本方案由 Nginx 提供 HTTPS，Apanel 在本机回环地址上提供 HTTP。使用本方案时，不要设置 `APANEL_TLS_CERT` 和 `APANEL_TLS_KEY`。

先确认 `/etc/apanel/config.env` 中的监听地址为：

```ini
APANEL_LISTEN_ADDR=127.0.0.1:8080
```

修改配置后需要重启 Apanel：

```bash
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

现在可以通过 `https://panel.example.com` 访问 Apanel。建议在防火墙中只开放 HTTPS 端口，不要开放 Apanel 的 `8080` 端口。

## 4. 手动配置证书

如果不需要反向代理，Apanel 可以直接加载证书并提供 HTTPS。使用本方案时不需要安装或配置 Nginx。

准备好域名对应的证书和私钥后，编辑 `/etc/apanel/config.env`：

```ini
APANEL_LISTEN_ADDR=:443
APANEL_TLS_CERT=/etc/letsencrypt/live/panel.example.com/fullchain.pem
APANEL_TLS_KEY=/etc/letsencrypt/live/panel.example.com/privkey.pem
```

`APANEL_TLS_CERT` 和 `APANEL_TLS_KEY` 必须同时设置，分别指向 PEM 格式的完整证书链和私钥。Apanel 默认以 root 身份运行，因此可以直接读取上述证书文件并监听 443 端口。

重启服务使配置生效：

```bash
sudo systemctl restart apanel
sudo systemctl status apanel
```

随后通过 `https://panel.example.com` 访问 Apanel。普通 HTTP API、Web 终端和容器 Attach 的 WebSocket 都由同一个 HTTPS 监听端口提供，不需要额外配置 WebSocket 转发。

证书续期后，Apanel 不会自动重新读取证书文件，需要再次重启服务：

```bash
sudo systemctl restart apanel
```
