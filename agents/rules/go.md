# Go 后端规范

适用范围：`api/` 目录下所有 Go 代码。

## 包结构

```
api/
├── cmd/apanel/     # 入口，只做初始化和启动
├── internal/
│   ├── handler/    # HTTP handler，薄层，只做请求解析和响应
│   ├── service/    # 业务逻辑
│   ├── model/      # 数据库模型（GORM struct）
│   └── infra/      # 外部依赖封装（systemd、docker、pty）
```

- 业务逻辑写在 `service/`，不写在 `handler/`
- `internal/` 外不暴露具体实现类型

## 命名

- 包名：小写单词，不用下划线，不用复数（`handler` 不是 `handlers`）
- 接口名：动词+er 或描述能力（`ServiceManager`、`Starter`）
- 错误变量：`ErrXxx` 形式，定义在包级别
- 不缩写（除 `id`、`url`、`api` 等约定俗成的）

## 错误处理

- 函数返回 `error`，调用方负责处理或向上传递
- 向上传递时用 `fmt.Errorf("操作描述: %w", err)` 包裹，保留原始错误
- handler 层统一用 `respondError(w, code, err)` 响应，不在 service 层写 HTTP 逻辑
- 禁止 `_ = someFunc()` 忽略错误（除非有注释说明原因）

## 测试

- 单元测试文件与被测文件同目录，命名 `xxx_test.go`
- 外部依赖（systemd、docker）用接口隔离，测试中注入 fake
- 不测试 GORM model 本身，测试 service 层行为
