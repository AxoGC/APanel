---
title: 编译
---

# 编译

如果不想使用发布的二进制文件，也可以自己从源码编译 Apanel。

## 依赖

- Go 1.25 及以上
- Node.js（用于编译前端和 VitePress 文档）
- `make`

## 克隆仓库

```bash
git clone https://github.com/axogc/apanel.git
cd apanel
```

## 编译

```bash
make build
```

`make build` 会先编译前端（`web/`），把产物拷贝进 `api/internal/httpserver/dist`，再把它连同后端一起编译成单一可执行文件，最终产物在 `api/apanel`。

只想单独编译某一部分时：

```bash
make build-web   # 只编译前端，并同步进 api/internal/httpserver/dist
make build-api   # 只编译后端（需要 dist 已经存在）
```

## 交叉编译

发布的二进制按架构区分文件名（`apanel-linux-amd64.gz` / `apanel-linux-arm64.gz`），可以通过 `GOOS`/`GOARCH` 交叉编译到目标架构：

```bash
cd api
GOOS=linux GOARCH=arm64 go build -trimpath -buildvcs=false -ldflags="-s -w -buildid=" -o apanel-arm64 ./cmd/apanel
```

`build-web` 产出的前端资源与架构无关，交叉编译后端前不需要重新编译前端。

## 运行编译产物

编译出的 `apanel` 是一个不依赖配置文件的单一可执行文件，可以直接运行来验证：

```bash
sudo ./api/apanel
```

首次运行会在标准输出打印自动生成的登录密码。想把编译产物部署为长期运行的服务，请参照[安装文档](./install)的「2. 手动安装」一节，把它放到 `/usr/local/bin/apanel` 并配上 systemd 单元。

## 编译文档站点

本文档站点是独立的 VitePress 项目，不包含在 `make build` 里：

```bash
make docs-dev     # 本地预览，带热重载
make docs-build   # 生成静态站点到 docs/.vitepress/dist
```
