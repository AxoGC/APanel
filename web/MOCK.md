# Mock 模式

不连接后端，所有 API 请求由前端内置数据响应，SSE 流使用定时器模拟。

## 启动

```bash
cd web
VITE_MOCK=true npm run dev
```

Windows cmd：

```cmd
set VITE_MOCK=true && npm run dev
```

PowerShell：

```powershell
$env:VITE_MOCK="true"; npm run dev
```

## 登录凭据

- 用户名：root
- 密码：**123456**

## 切换回真实后端

不设置 `VITE_MOCK`，或将其设为 `false`，正常启动即可：

```bash
npm run dev
```

## 说明

- Dashboard 仪表盘每 1.5 秒推送一次随机 CPU/内存/网络数据
- 日志流每 300ms 推送一行循环 mock 日志
- 防火墙规则支持增删改（内存状态，刷新后重置）
- 文件上传操作直接返回成功，不实际存储文件
- 所有写操作（服务 start/stop、容器操作等）均返回成功，无副作用
