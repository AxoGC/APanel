# 目录结构与新增模块

## 目录结构

```
src/
├── components/    跨模块共享组件（Nav、LogsDialog、SectionedDialog、TextReader…）
│   └── ui/        shadcn 原语，尽量不手改
├── modules/       按业务模块分目录，每个含 Page.tsx + api.ts + 自己的对话框
│   ├── dashboard  services  files  terminal  containers
│   └── history  firewall  proxy  database  settings  login
└── lib/           api / auth / i18n / theme / features / modules / mock / format …
```

## 引用路径

`@/` 别名指向 `src/`。**跨模块引用一律走 `@/`，模块内部用相对路径。**

## 新增业务模块

1. 建 `src/modules/<key>/`，至少含 `Page.tsx` 和 `api.ts`
2. 在 `src/lib/modules.tsx` 的 `MODULE_ORDER` 和 `MODULE_META` 里登记
3. i18n 两份字典都加 `nav.<key>` 文案，见 [i18n.md](i18n.md)
4. 若依赖外部服务（Docker、nftables、数据库…），接依赖探测，见
   [module-gating.md](module-gating.md)
5. 新接口同步在 mock 里加 handler，见 [mock-mode.md](mock-mode.md)
