# 前端重设计——实施进度复核

*日期：2026-09-04 ｜ 分支：`webstyle-optimize` ｜ 基线：[前端重设计策略](frontend-redesign-strategy.md)*

对策略文档中列出的十项判断逐条回到代码里复核。
结论：**十项全部仍然成立，一项都没被实施过**——七项是"问题依旧"，三项是"从未开工"。
另有三处策略文档写成之后发生的新情况，其中一处会影响实施顺序。

部分条目复核出的实际情况**比策略文档描述的更严重**（第 2、7 条），已在下面标注。

## 一、问题依旧（7）

### 1. Geist 字体实际没生效

`src/index.css:78` 定义了 `--font-sans: 'Geist Variable', sans-serif;`，
`165-175` 的 `@layer base` 里 `html { @apply font-sans }` 也在，但 `125-129` 有一条
**未分层**的裸 `body` 规则：

```css
body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
```

Tailwind 4 的 `@layer base` 优先级低于任何未分层规则，`body` 又比 `html` 更具体，
两重叠加下 Geist 完全没上过屏。字体文件照常被打进产物（构建产物里 5 个 woff2 分片），
**属于纯浪费**。

修法：删掉 `body` 规则里的 `font-family` 一行即可，不需要动 `@layer`。

### 2. 所有页面标题都是 `text-base`——**实际比策略文档描述的更糟**

有 `h1` 的页面一律 `text-base`（dashboard / login / settings / proxy / database）。
但复核发现**六个页面根本没有标题元素**，只有一个裸的 header flex 行：

```
containers  files  firewall  history  services  terminal
```

全仓库 `Page.tsx` 里没有任何 `text-lg` / `text-xl` / `text-2xl`。

更刺眼的对比：`Nav.tsx:73` 的 wordmark 是 `text-lg font-semibold italic`，
**是全站唯一大于 `text-base` 的文字**——也就是说侧栏 logo 比所有页面标题都大。

### 3. 导航项没有 hover 态

`src/components/Nav.tsx:17-25` 的 `itemClasses(isActive, collapsed)` 只区分选中/未选中，
没有任何 `hover:` 类。桌面端鼠标划过毫无反馈。

### 4. 登录页是一个裸表单

`src/modules/login/Page.tsx` 无插图、无品牌区、无卡片容器。
**新发现**：`login/Page.tsx:41` 的标题写的是 `text-base text-gray-900`，
**漏了 `dark:text-gray-100`**——全站其它 `h1` 都有这个变体，只有登录页没有，
深色模式下标题是深灰配深底，对比度不足。

### 5. 侧栏与主内容共用同一个背景色

`src/index.css` 里 `--sidebar` 令牌是有的，但 `Nav.tsx` 从没应用任何背景类，
侧栏直接继承 `--background`。所谓"深色侧栏"在实现上并不存在，
两块区域之间只靠一条边框分隔。

### 6. Nav 渲染了两棵 DOM 树

`Nav.tsx:78-94` 是 `md:hidden` 的移动端列表，`96-111` 是 `hidden md:block` 的桌面列表，
内容基本重复。两份同时在 DOM 里，靠 CSS 隐藏其一。

### 7. 散落的 `matchMedia`——比策略文档列的多

不止 Gauge 一处。除去 `theme.ts:44,68`（那两处读 `prefers-color-scheme`，
与布局无关，不在范围内），**其余五处全是宽度查询**：

| 位置 | 查询 | 用途 |
| --- | --- | --- |
| `lib/dataLayout.ts:21,24` | `min-width: 768px` | grid / table 切换 |
| `modules/dashboard/Gauge.tsx:34,36` | `max-width: 639px` | `isNarrow` 窄屏渲染 |
| `modules/terminal/Page.tsx:100` | `min-width: 768px` | 仅桌面自动聚焦终端 |
| `modules/firewall/RuleDialog.tsx:201` | `min-width: 768px` | 移动端抑制对话框 autofocus |
| `modules/containers/CreateContainerDialog.tsx:122` | `min-width: 768px` | 同上 |

后三处是同一个模式复制了三遍——**"移动端不要自动弹键盘"**。
这正是 `LayoutContext` 里 `touch` 信号该解决的问题，收编后能直接消掉三份重复。

四处 `768px` 字面量各自独立，改断点要同时改四个地方。

## 二、从未开工（3）

| 项 | 状态 |
| --- | --- |
| `LayoutProvider` / `MobileShell` / `DesktopShell` | 全仓库搜不到；`pointer: coarse` / `useMediaQuery` / `isMobile` 均无 |
| `surface` / `surface-raised` 语义令牌 | 见下 |
| Bottom Sheet / Action Sheet / 触摸列表项 | 无 sheet/drawer 原语，`vaul` 也不是依赖 |

关于语义令牌，需要比策略文档说得更准确一点：**语义层不是不存在，是没接上**。
`--theme-50…950` 是纯数字色阶（`lib/theme.ts` 运行时换色相用）；
shadcn 那套 `--background` / `--card` / `--muted` / `--accent` / `--border` / `--sidebar*`
在 `index.css` 里齐全，但**没有一个接到可切换的色相上**，
而且 `--sidebar*` 和 `--card` 在组件里一次都没被引用过（见第 5 条）。
所以要做的不是"从零加语义层"，而是把现有 shadcn 令牌接进 `--theme-*` 并真正用起来。

### 一个容易误判的坑

`App.tsx` 里的 `Shell()` **不是**策略文档说的布局 shell，它是鉴权闸门 + 路由出口；
布局仍然是一句 `<div className="mx-auto flex h-dvh max-w-5xl flex-col md:flex-row-reverse">`。
命名撞车，读代码时容易误判成"已经做了一半"，实际一行没动。

## 三、策略文档写成之后的新情况（3）

### 1. Nav 增加了折叠/展开

`Nav.tsx:58` 的 `collapsed` state + `113-120` 的折叠按钮（带
`aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}`）是新加的。
所有折叠效果都是 `md:` 作用域，移动端不受影响。
这是策略文档没有覆盖的既有功能，**做双 shell 拆分时必须一并迁移**，否则会丢功能。

顺带一个小缺陷：`collapsed` 是裸 `useState(false)`，**没有持久化**，刷新就回到展开态。
按 `CLAUDE.md` 的约定，该加一个 `apanel:nav-collapsed` 键。

### 2. `src/lib/dataLayout.ts` 已经是布局信号的雏形

新增的 `useIsWideScreen()` 走 768px 断点，配合 localStorage 的 grid/table 偏好。
它和策略文档设想的 `LayoutContext { shell, touch }` 是同一类东西的局部实现。
**做 LayoutProvider 时应该把它并进去，而不是并排再造一个断点源**——
否则会出现两处 768px 定义各自演化。

### 3. 构建一度是坏的（已修）

复核期间发现 `npm run build` 失败：mock 模式在三处 SSE 调用点写成
`MOCK ? new MockXxx(...) : new EventSource(...)`，联合类型导致 `onmessage`
参数推不出来，报两个 TS7006。因为 `tsc -b` 是 build 的一部分，**`make build` 整个挂掉**，
而 `npm run dev` 不做类型检查所以毫无征兆。

已通过在 `mock.ts` 里引入 `StreamSource` 接口 + `openDashboardStream` /
`openLogStream` 两个工厂函数修复，调用点不再自己分流。

> 教训：改完前端至少跑一次 `npm run build`，只跑 dev 发现不了类型错误。已写进 `../../CLAUDE.md`。

## 四、结论

策略文档十项判断**全部仍然成立，一项都没被实施过**，可以直接作为落地依据。
但有四处需要在动工前修订/扩充：

1. **`matchMedia` 的收编范围要扩大**——不是策略文档列的一处，而是五处宽度查询
   （只排除 `theme.ts` 那两处配色查询）。其中三处是同一个"移动端别弹键盘"模式的复制品，
   收进 `touch` 信号能直接消掉重复。
2. **`dataLayout.ts` 的 768px 定为唯一断点来源**，而不是新起一套——
   现在有四处独立的 `768px` 字面量。
3. **语义令牌是"接线"不是"新建"**：shadcn 那套令牌已经齐了，缺的是接到 `--theme-*`
   并真正在组件里用起来。
4. 双 shell 拆分的验收标准里补上 **Nav 折叠功能**（并顺手给它加持久化）。

建议先摘掉三个低成本、高可见度、且与布局重构无依赖的问题：

- **字体**——删 `index.css:127` 一行，Geist 立刻生效（现在字体文件是白打包的）
- **登录页 `h1` 补 `dark:text-gray-100`**——一个类名
- **六个无标题页面补 `h1`**——顺便解决"侧栏 logo 比页面标题大"的观感问题
