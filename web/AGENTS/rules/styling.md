# 样式与布局约定

## 布局

- 页面根节点：`flex h-full flex-col`；页内每段自己加 `px-4 sm:px-6`
  （**不要在根节点统一加左右 padding**，否则滚动区域的滚动条会被挤进内容里）
- 列表滚动区：`<ScrollArea className="min-h-0 grow ...">`，`min-h-0` 不能省
- 标题统一 `text-base text-gray-900 dark:text-gray-100`

## 主题

- 深色模式靠 `document.documentElement.dataset.theme`，所有颜色都要写 `dark:` 变体
- 主题色 / 色相在 `src/lib/theme.ts`，配色令牌在 `src/index.css`

## 复用优先

写新 UI 前先看这几个现成件，别重复造：

| 组件 | 用途 |
| --- | --- |
| `SectionedDialog` | 带分节的管理类对话框（设置、镜像/网络管理等） |
| `LogsDialog` | 服务日志流对话框 |
| `TextReader` | 只读文本查看（日志、env、配置），带换行/行号开关 |
| `DependencyDialog` | 依赖状态 + 连接配置 |
| `ConfirmIconButton` | 需要二次确认的危险图标按钮 |
| `Combobox` / `ToggleButton` | 搜索下拉 / 分段开关 |

`src/components/ui/` 下是 shadcn 原语，尽量不手改；需要变体时在外层包一层。
