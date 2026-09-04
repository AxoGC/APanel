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
- 日志流（服务、容器）每 300ms 推送一行循环 mock 日志
- 防火墙规则支持增删改（内存状态，刷新后重置）
- 文件上传操作直接返回成功，不实际存储文件
- 所有写操作（服务 start/stop、容器操作等）均返回成功，无副作用
- 导航模块（8 个可启停模块）默认全部启用；Settings 的启用/排序对话框可正常增删（内存状态，刷新后重置）
- 每个扩展模块（containers/history/firewall/proxy/database）的依赖检测默认返回健康状态；连接设置对话框可正常打开、保存
- Proxy 页面内置 3 个代理组（含 GLOBAL）及若干选项，可切换模式、切换选中项、测速（随机延迟）
- Database 页面内置 3 个数据库、若干表，容量/行数统计通过模拟 SSE 流异步推送
- Terminal 页面的目录导航栏返回固定目录列表；终端本身（WebSocket PTY）和容器 attach 控制台需要真实后端，mock 模式下无法连接

## 已知限制

- Terminal 页面与容器详情的 "attach" 控制台基于 WebSocket 双向流，mock 模式未模拟，连接会失败
