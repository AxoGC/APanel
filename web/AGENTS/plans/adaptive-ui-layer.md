# 自适应组件层实施计划

*日期：2026-09-04 ｜ 分支：`webstyle-optimize`*
*依据：[前端重设计策略](../reports/frontend-redesign-strategy.md) · [实施进度复核](../reports/frontend-redesign-audit.md)*

## 一、这份计划要解决什么

把"移动端交互 / 桌面端交互"的分歧从散落的 `matchMedia` 和 CSS 隐藏，
收敛成**一个布局信号 + 一层自适应组件**。

起点问题是"是不是该给每个 radix 原语封两套"。**结论：不是。**
`src/components/ui/` 下 16 个原语里，**只有 6 个存在真实的交互分歧**，全是浮层类；
其余 9 个在触摸和鼠标下行为一致（Radix 走 Pointer Events，不区分输入源），
封两套只会得到 9 对内容相同的文件。

| 有分歧（做） | 无分歧（不做） |
| --- | --- |
| `dialog` `select` `dropdown-menu` `popover` `tooltip` `hover-card` | `button` `input` `label` `checkbox` `switch` `textarea` `scroll-area` `collapsible` `segmented-control` |
| 6 个组件 / ~16 个调用点 | 65+ 处引用，只需触摸尺寸令牌 |

`alert-dialog`（4 处）算边缘：居中确认框在移动端可用，但破坏性操作走 action sheet 更顺手，列为可选阶段。

## 二、一条核心约束

**不导出 `MobileDialog` / `DesktopDialog` 两个组件给调用方。**

那样每个调用点都要写 `isMobile ? <A> : <B>`——正是复核报告第 7 条
"同一段 `matchMedia` 复制三遍"的问题换个地方重演；而且 Radix 的状态机
（open state、focus trap、ESC、Portal）会被复制两份，迟早分叉。

正确形状是**一个 API，内部分流**，共享 Root/Portal/state，只替换 Content 的 presentation 层：

```tsx
// 调用点一行不改
<Dialog open={open} onOpenChange={setOpen}>…</Dialog>

// components/adaptive/dialog.tsx 内部
const { shell } = useLayout()
return shell === 'mobile' ? <SheetContent …/> : <ModalContent …/>
```

`ui/dialog.tsx` 里唯一带定位类名的是 `DialogContent`（`fixed top-1/2 left-1/2 … -translate-x-1/2`），
其余 Trigger / Close / Portal / Header / Title / Description 都是纯语义包装——
**分割线很干净，只有 Content 需要移动端变体。**

同时遵守 `CLAUDE.md` 的"`ui/` 下 shadcn 原语尽量不手改"：
分流层放在 `components/adaptive/`，`ui/dialog.tsx` 保持可从上游更新。

## 三、阶段划分

### 阶段 0 — `LayoutProvider`（前置，S）

现在全仓库**没有任何布局信号**，只有 5 处散落的宽度查询。浮层要分流，先得有它。

**新建 `src/lib/layout.tsx`：**

```ts
export interface Layout {
  shell: 'mobile' | 'desktop'  // >= 768px 为 desktop
  touch: boolean               // pointer: coarse
  isNarrow: boolean            // < 640px，Gauge 用
}
export function useLayout(): Layout
export function LayoutProvider({ children }: { children: ReactNode })
```

两个断点常量（768 / 640）在这个文件里集中定义，**成为全仓库唯一来源**。
Provider 挂在 `App.tsx` 最外层——要在 `Shell()` 之外，登录页也要能用。

**迁移 5 处调用点：**

| 位置 | 现状 | 改成 |
| --- | --- | --- |
| `lib/dataLayout.ts:21,24` | 本地 `useIsWideScreen()` | `useLayout().shell === 'desktop'`，删掉本地 hook |
| `dashboard/Gauge.tsx:34,36` | `max-width: 639px` | `useLayout().isNarrow` |
| `terminal/Page.tsx:100` | `if (matchMedia(768).matches) terminal.focus()` | `if (!touch) terminal.focus()` |
| `firewall/RuleDialog.tsx:201` | `onOpenAutoFocus` 里 `preventDefault()` | `if (touch) event.preventDefault()` |
| `containers/CreateContainerDialog.tsx:122` | 同上 | 同上 |

后三处是**同一个"移动端别弹键盘"意图**用两种机制写了三遍，收编后消掉重复。

> ⚠️ **这是一次行为变更，不是纯重构。**
> 判据从"屏幕宽度"换成"指针类型"。触屏笔记本、iPad 横屏（宽 ≥768 但 `pointer: coarse`）
> 原来会自动聚焦弹出软键盘，改后不会。这是修正而非回归，但要在验收时确认是想要的。

**验收：** `grep -rn matchMedia src` 只剩 `lib/layout.tsx` 和 `lib/theme.ts:44,68`
（后者读 `prefers-color-scheme`，与布局无关，**不在范围内**）。

### 阶段 1 — `ui/sheet`（唯一的净新增工作量，M）

项目**没有 sheet/drawer 原语，`vaul` 也不是依赖**。移动端那一半得从头做。

**决策：自研，不引 vaul。**
理由：Radix Dialog 已在依赖里，sheet 只需换 Content 的定位与动画；
产物要 `embed` 进 Go 单二进制，少一个依赖少一份体积。
代价是拖拽关闭手势要自己写——**所以拆成两步，不让手势阻塞后续阶段**：

- **1a**：底部定位 + slide 动画 + 顶部 grabber 条。够用即可推进阶段 2。
- **1b**（可延后）：拖拽下滑关闭 + 惯性。

**新建 `src/components/ui/sheet.tsx`**，与 `ui/dialog.tsx` 平级、API 同名对齐
（`Sheet` / `SheetContent` / `SheetHeader` / `SheetTitle` / `SheetClose`）。

Content 类名要点：

```
fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] rounded-t-xl
data-open:slide-in-from-bottom data-closed:slide-out-to-bottom
pb-[env(safe-area-inset-bottom)]
```

- 用 `dvh` 不用 `vh`（项目布局已经是 `h-dvh`，移动端浏览器地址栏会吃掉 `vh`）
- 底部安全区必须留，否则 iPhone 上按钮被 home indicator 压住

### 阶段 2 — `dialog` 分流（试点，M）

**新建 `src/components/adaptive/dialog.tsx`**，导出与 `ui/dialog` 同名的一组。

**迁移 5 个 import**（`@/components/ui/dialog` → `@/components/adaptive/dialog`）：

```
components/SectionedDialog.tsx          ← 二次封装，改这个覆盖大量业务对话框
components/LogsDialog.tsx               ← 同上
modules/files/Page.tsx
modules/history/Page.tsx
modules/containers/ContainerLogsDialog.tsx
```

前两个是已有的二次封装层，改它们等于一次性覆盖设置、镜像/网络管理、服务日志等一大批对话框。

> 🔴 **本阶段最容易出 bug 的地方：`className` 透传。**
>
> 现有调用点往 `DialogContent` 传的类名是混合的：
> - `LogsDialog`：`flex h-[85vh] max-w-2xl flex-col gap-0 p-0`
> - `ContainerLogsDialog`：`flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0`
>
> 其中 `flex flex-col gap-0 p-0` 是**两端共用的内部布局**，
> 而 `max-w-2xl` / `h-[85vh]` 是**只有桌面模态才成立的尺寸**——
> 底部 sheet 上原样透传会得到一个宽 672px、高 85vh 却贴着底边的怪东西。
>
> API 因此要拆开：
> ```tsx
> <DialogContent className="flex flex-col gap-0 p-0" desktopClassName="h-[85vh] max-w-2xl">
> ```
> `desktopClassName` 在 mobile 分支直接丢弃。迁移时**逐个调用点分类每个类名**，不要整段搬。

**验收：**
- 375px 宽下 5 个对话框全部从底部升起，内容不溢出屏幕
- ≥768px 下视觉与行为和当前完全一致
- `npm run build` 通过

### 阶段 3 — `select`（调用点最多，M）

7 个文件：`terminal/Page` `containers/Page` `containers/NetworkManagerDialog`
`services/Page` `history/Page` `containers/CreateContainerDialog` `containers/ImageManagerDialog`。

移动端渲染为半屏 picker（复用阶段 1 的 sheet），而不是浮动下拉。
选项多时下拉会顶到屏幕边缘、滚动与页面滚动打架，这是移动端最明显的体验缺口。

### 阶段 4 — `dropdown-menu` / `popover`（S）

- `dropdown-menu` → `modules/files/FileGrid.tsx`，移动端改 action sheet
- `popover` → `components/Combobox.tsx`，移动端改全屏搜索面板（输入框置顶，避开软键盘遮挡）

### 阶段 5 — `tooltip` / `hover-card`（S，但需要产品决策）

这两个不是"换个样式"，是**触摸端要不要存在**的问题——触摸设备没有 hover，
Radix 的 tooltip 在移动端要么永不触发，要么被点击误触发一次。

- `tooltip` → `modules/dashboard/Page.tsx`
- `hover-card` → `modules/containers/UsageCell.tsx`

建议：`UsageCell` 移动端把数值**直接内联显示**而不是藏在浮层里；
`dashboard` 的 tooltip 移动端不渲染，信息另找位置。
**动手前先确认这两处 hover 里放的是什么内容**，如果是必要信息，隐藏就是丢功能。

### 阶段 6 — `alert-dialog` action sheet（可选，S）

4 个调用点。破坏性确认在移动端走底部 action sheet 更符合直觉，但不紧急。

## 四、明确不做

- **不给 9 个无分歧原语做双份**：`button` `input` `label` `checkbox` `switch`
  `textarea` `scroll-area` `collapsible` `segmented-control`
- 它们真正缺的是**触摸尺寸令牌**（触摸目标 44px / 桌面 32px），
  那是 CSS 变量的活，列为独立小任务，不在本计划内
- **不导出 `MobileX` / `DesktopX` 双组件**（见第二节）
- **不动 `lib/theme.ts` 的两处 `matchMedia`**，那是配色查询

## 五、风险清单

1. **`className` 透传**（阶段 2）——最高风险，处理方式见上
2. **`touch` 语义变更**（阶段 0）——判据从宽度换成指针类型，是行为变更
3. **sheet 内的滚动链**——项目大量用 `<ScrollArea className="min-h-0 grow">`，
   sheet 用 `max-h-[90dvh]` 时 `min-h-0` / `grow` 链必须接对，否则内容溢出屏幕外且无法滚动
4. **mock 模式覆盖不全**——纯 UI 改动 mock 下可验，但 **WebSocket 在 mock 模式未模拟**，
   终端和容器 attach 相关的对话框只能连真后端验证
5. **`npm run dev` 不做类型检查**——每阶段结束必须跑一次 `npm run build`（`tsc -b` 是它的一部分），
   复核期间已经踩过一次"dev 正常但 `make build` 全挂"

## 六、与本计划无依赖的低成本项

这三项可以随时插入，不必等布局层：

- **Geist 字体**——删 `src/index.css:127` 的 `font-family` 一行即可生效
  （现在字体文件被打包却从没上过屏）
- **登录页 `h1` 补 `dark:text-gray-100`**——一个类名
- **六个无标题页面补 `h1`**——`containers` `files` `firewall` `history` `services` `terminal`
- **Nav 折叠态持久化**——加 `apanel:nav-collapsed`，现在是裸 `useState(false)`，刷新回弹

## 七、提交粒度

每阶段一个 commit，遵循 `type: 小写英文摘要`：

```
feat: add LayoutProvider, collapse ad-hoc media queries
feat: add bottom sheet primitive
refactor: route dialogs through adaptive layer
```

阶段 2 若单个 commit 过大，可按"新增 adaptive 层"和"迁移调用点"拆两个。
