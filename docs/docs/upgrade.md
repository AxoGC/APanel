---
title: 升级
---

# 升级

Apanel 没有配置文件，升级只替换可执行文件本身：数据库、systemd 单元和其中的环境变量都不受影响。

## 1. 一键升级脚本

```bash
curl -fsSL https://raw.githubusercontent.com/axogc/apanel/main/upgrade.sh | sudo bash
```

如果你的服务器因网络问题无法访问 GitHub，可以尝试下面的命令：

```bash
curl -fsSL https://apanel.axogc.net/upgrade.sh | sudo bash
```

脚本会下载并解压最新版本程序，停止服务、替换旧的可执行文件，然后重启 Apanel。已有的 `.service` 文件和 SQLite 数据库都会原样保留，登录密码不会被重置。

## 2. 手动升级

如果不想用一键脚本，也可以手动替换二进制文件。步骤和[手动安装](./install#_2-手动安装)下载可执行文件的部分基本一致，多了停止/启动服务这两步：

```bash
sudo systemctl stop apanel
```

下载并安装新版本（以 AMD64 为例，ARM64 把文件名换成 `apanel-linux-arm64.gz` 即可）：

```bash
curl -fL https://github.com/axogc/apanel/releases/latest/download/apanel-linux-amd64.gz \
  -o /tmp/apanel.gz
gunzip /tmp/apanel.gz
sudo install -m 0755 /tmp/apanel /usr/local/bin/apanel
```

```bash
sudo systemctl start apanel
sudo systemctl status apanel
```

数据库文件和 `/etc/systemd/system/apanel.service` 都不需要改动；如果之前在 `.service` 里内联声明过端口或证书路径的环境变量，升级后依然生效。

## 3. 升级前建议

- 升级前先确认当前版本运行正常，避免把已有问题一并带入新版本。
- 升级、删除文件、删除镜像或修改防火墙前，建议先做好数据备份并确认影响范围。
