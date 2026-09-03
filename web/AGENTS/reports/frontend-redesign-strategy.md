# 前端重设计策略报告

**日期：** 2026-09-04
**状态：** 决策已定，待实施

---

## 一、现状问题

### 严重 bug

`index.css:127` 的 `body { font-family: system-ui, -apple-system... }` 写在 `@layer base` 外部，优先级高于第 174 行 `@layer base` 里的 `html { @apply font-sans }`，导致已引入的 Geist Variable 字体完全无效，全站渲染系统字体。

### 视觉层级缺失

- 所有页面标题用 `text-base`（16px），与正文无法区分（`DashboardPage.tsx:113`、`LoginPage.tsx:41`）
- Nav 导航项无 hover 状态，仅靠文字颜色区分 active，当前位置不明显（`Nav.tsx:27-34` 无任何 `hover:` class）
- 登录页是裸 form 浮在白色空间里，无容器、无品牌感
- 深色模式下侧边栏与主内容区背景色相同（均为 `oklch(13%...)`），无分层

### 布局打补丁

`Nav.tsx` 用 `hidden md:block` / `scrollbar-hide md:hidden` 在同一个 DOM 里维护两套结构（移动底部栏 + 桌面侧边栏）。随着功能增加，这种方式会越来越乱，两套结构的行为分歧也越来越难追踪。

---

## 二、为什么要做这次重设计

移动端和桌面端不只是宽度不同，是**交互模型不同**：

| 维度 | 移动端 | 桌面端 |
|------|--------|--------|
| 导航 | 底部 Tab，拇指可及 | 侧边栏，鼠标点击 |
| 弹层 | 全屏或底部 sheet | 居中 modal |
| 密度 | 低，单列，大目标 | 高，多列，紧凑 |
| 输入 | 触控，无 hover | 鼠标，有 hover 反馈 |

用 CSS `md:` 前缀打补丁处理这些差异，最终结果是两套逻辑混在同一组件里，维护成本随功能增长线性上升。两套显式布局更诚实，边界清晰。

---

## 三、布局策略

### 断点 + 指针类型双信号

**问题：** 宽度不等于交互模型。iPad Pro 竖屏是 1024px，但它是纯触控设备；三星 Fold 展开后约 884px，同样是触控优先。纯宽度断点会把这些设备错误地套入桌面交互模型。

**解法：** 宽度作为 shell 选择的依据，指针类型作为触控模式的信号。

```
< 768px
  → MobileShell（无论指针类型，这个宽度只有手机）

≥ 768px + pointer: fine（鼠标/触控板）
  → DesktopShell，标准密度

≥ 768px + pointer: coarse（触控屏：平板、折叠屏展开态）
  → DesktopShell，触控变体（44px 目标、无 hover-only 交互、更宽间距）
```

**不需要第三套布局。** 平板和折叠屏展开后使用桌面布局的信息密度（侧边栏、表格），但通过 `touch: boolean` 信号让交互元素走触控变体。对于服务器管理面板，用户在平板上期待的是信息密度，而不是大卡片式移动布局。

### 三信号融合：宽度 + 指针类型 + User-Agent

单独依赖任何一个信号都有盲区，三者结合才覆盖完整：

| 信号 | 能判断什么 | 盲区 |
|------|-----------|------|
| 视口宽度 | 当前可用空间 | 宽度≥768px 的触控平板会被误判为桌面 |
| `pointer: coarse` | 当前主要输入是触控还是鼠标 | 触控笔记本两者共存时结果不确定 |
| User-Agent | 设备类型（手机/平板/桌面） | 可伪造；服务端可用但客户端仍可读 |

**UA 的作用是初始化时的快速先验判断**，在 CSS 媒体查询还未渲染、JS 还未运行之前，服务端或 `<script>` 可以根据 UA 在 `<html>` 上打上 `data-device="mobile"` 标记，避免首屏布局闪烁（FOUC）。之后客户端 `matchMedia` 接管，动态响应窗口大小变化（如折叠屏展开）。

**判断优先级：**

```
1. 视口宽度 < 768px               → MobileShell（最强信号，无例外）
2. UA 明确包含 Mobile/iPhone/Android 手机关键词
   且宽度 < 1024px               → MobileShell
3. 宽度 ≥ 768px + pointer: coarse → DesktopShell + touch 变体
4. 其余                          → DesktopShell 标准密度
```

UA 不作为唯一判据，只在宽度信号模糊区间（768-1024px）作为辅助。折叠屏展开后宽度超过 768px，UA 仍是手机，但此时优先级 3 接管——DesktopShell + touch 变体，这是正确结果。

### Provider 接口

```ts
interface LayoutContext {
  shell: 'mobile' | 'desktop'
  touch: boolean         // pointer: coarse，影响组件内部尺寸和交互
}
```

单一 `LayoutProvider`，单个 `matchMedia` 实例，避免多处监听。`shell` 决定渲染哪个 Shell 组件树，`touch` 由组件消费来调整密度。UA 检测只在 Provider 初始化时运行一次，不做响应式监听。

### Shell 结构

```
MobileShell
  └── 底部 Tab 导航（拇指区，固定）
  └── 全屏页面区域（无侧边栏）

DesktopShell
  └── 可折叠侧边栏（含 logo）
  └── max-w-5xl 主内容区
  └── touch 变体：44px 行高、无 hover-only 状态
```

---

## 四、组件库重造范围

### Token 系统

现有 `--theme-*` 变量已经是对的方向，但需要补全：

- 明确定义 `surface`、`surface-raised`、`border`、`muted`、`body` 语义角色
- 深色模式侧边栏需要独立于主内容区的 surface 色（当前两者相同）
- 验证 body 文本对比度达到 WCAG AA（4.5:1）

### 每个组件需要的五态

hover、active、focus-visible、disabled、loading——缺一不可。现有 shadcn 默认组件普遍缺 hover 状态（Nav 是最明显的案例）。

### 移动端特有组件（新增）

- Bottom Sheet（替代 Dialog 在移动端的场景）
- Action Sheet（操作确认，替代 alert-dialog）
- Touch-friendly List Item（44px 行高，右侧箭头指示符）
- Mobile Nav（固定底部，含滚动溢出渐变提示——现有逻辑可复用）

### 桌面端组件（改造）

- Nav：拆掉重写，不再维护双 DOM
- Table：sticky header、数字右对齐、排序箭头
- Dialog：动画优化，聚焦陷阱

### 不动的

echarts Gauge 的 `matchMedia` 模式（`Gauge.tsx:34`）是正确的——canvas 内部字号只能通过 JS 传入，保留此模式。

---

## 五、实施顺序建议

1. **Token + 字体 bug 修复**（一行改动，影响全局，先做）
2. **LayoutProvider + 两个 Shell**（架构基础）
3. **Nav 重写**（依赖 Shell 完成）
4. **组件五态补全**（可并行逐个做）
5. **移动端特有组件**（最后，依赖上面的 token 稳定）
