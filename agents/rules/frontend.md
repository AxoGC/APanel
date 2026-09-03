# 前端规范

适用范围：`web/` 目录下所有 React / TypeScript 代码。

## 组件结构

```
src/
├── components/   # 通用 UI 组件（无业务逻辑）
├── modules/      # 按功能域划分的业务模块
│   └── docker/
│       ├── DockerPage.tsx
│       ├── ContainerList.tsx
│       └── useContainers.ts
└── lib/          # 工具函数、API 客户端、类型定义
```

- 每个模块一个目录，业务逻辑写在 `useXxx` hook 中，不散落在组件
- `components/` 下的组件不得直接调用 API
- 组件文件与 hook 文件分开，不合并在同一文件

## 命名

- 组件：PascalCase（`ContainerList.tsx`）
- Hook：camelCase，以 `use` 开头（`useContainers.ts`）
- 工具函数：camelCase（`formatBytes.ts`）
- CSS 类名用 Tailwind，不写内联 style（动态值除外）

## 样式

- 优先用 shadcn/ui 组件，不重新造轮子
- Tailwind 类名按功能分组书写（布局 → 尺寸 → 颜色 → 交互）
- 移动端优先：先写移动样式，用 `md:` / `lg:` 向上扩展
- 不引入新的 CSS 文件，除非有充分理由

## 状态管理

- 服务端数据用 `fetch` + `useState`/`useEffect` 或自定义 hook
- 本地 UI 状态（展开/收起、弹窗）放在组件内部，不提升到全局
- 不引入 Redux / Zustand 等全局状态库，除非经过讨论

## TypeScript

- 所有函数参数和返回值标注类型，不用 `any`
- API 响应类型定义在 `lib/types.ts`，与后端 `{ code, error, data }` 结构对应
- 优先用 `interface` 描述对象形状，`type` 用于联合/交叉类型
