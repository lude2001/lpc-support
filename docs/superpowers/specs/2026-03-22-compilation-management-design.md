# 编译管理设计

日期：2026-03-22

## 背景

当前扩展把“编译”基本等同于“远程编译服务器”工作流：

- [`src/compiler.ts`](D:/code/lpc-support/src/compiler.ts) 通过 `/update_code/update_file` 发起 HTTP 请求
- 服务器定义保存在全局存储 `lpc-servers.json`
- 命令与界面文案仍然以“管理编译服务器”为中心

这个模型已经不再完全匹配当前开发驱动场景。现在 driver 已支持 `lpccp`，可以在本地连接运行中的编译服务，对单文件或目录执行运行时重编译，并以 JSON 返回结构化结果。同时，项目配置也已经开始收敛到项目根目录的 `lpc-support.json`。

这次设计的目标，是把“服务器管理”升级为“编译管理”：在保留远程 HTTP 编译能力的前提下，新增本地 `lpccp` 编译模式，并把本地和远程两套配置统一纳入 `lpc-support.json`。

## 目标

- 将用户可见的“管理编译服务器”更名为“编译管理”
- 保留现有远程 HTTP 编译支持
- 新增基于 `lpccp` 的本地编译支持
- 本地模式支持两种方式：
  - 直接使用环境变量中的 `lpccp`
  - 指定 `lpccp` 可执行文件路径
- 本地与远程编译配置统一写入项目级 `lpc-support.json`
- `compileFile` / `compileFolder` 统一走一个编译管理层
- 本地目录编译优先使用 `lpccp` 原生目录能力，而不是逐文件 fan-out

## 非目标

- 不修改 compile 之外的 diagnostics 主链路
- 不改变 parser / syntax / semantic 的职责边界
- 本次不立即移除所有 legacy 设置
- 不引入新的离线编译器或静态编译流程

## 用户体验

### 命令

新增主命令：

- `lpc.manageCompilation`

用户可见标题：

- `编译管理`

兼容策略：

- 暂时保留 `lpc.manageServers`
- `lpc.manageServers` 内部直接转发到新的编译管理流程

现有编译命令保留：

- `lpc.compileFile`
- `lpc.compileFolder`

### 管理流程

`编译管理` 入口使用 Quick Pick 两层交互：

1. 先选择当前编译模式
   - `本地编译 (lpccp)`
   - `远程编译 (HTTP)`
2. 再进入对应模式的管理动作

本地模式动作：

- `切换为使用系统命令`
- `设置 lpccp 路径`
- `设置 driver config 路径`
- `查看当前本地编译配置`

远程模式动作：

- `选择活动服务器`
- `添加服务器`
- `编辑服务器`
- `删除服务器`
- `查看当前远程编译配置`

用户在这里选定的模式会成为当前活动编译模式，并持久化回 `lpc-support.json`。

## 配置模型

在 `lpc-support.json` 中新增 `compile` 配置块：

```json
{
  "version": 1,
  "configHellPath": "config.hell",
  "compile": {
    "mode": "local",
    "local": {
      "useSystemCommand": true,
      "lpccpPath": "",
      "driverConfigPath": "etc/config.test"
    },
    "remote": {
      "activeServer": "本地开发服",
      "servers": [
        {
          "name": "本地开发服",
          "url": "http://127.0.0.1:8080",
          "description": "旧的远程编译接口"
        }
      ]
    }
  }
}
```

### 建议类型

```ts
interface LpcCompileLocalConfig {
    useSystemCommand?: boolean;
    lpccpPath?: string;
    driverConfigPath?: string;
}

interface LpcCompileRemoteServer {
    name: string;
    url: string;
    description?: string;
}

interface LpcCompileRemoteConfig {
    activeServer?: string;
    servers?: LpcCompileRemoteServer[];
}

interface LpcCompileConfig {
    mode?: 'local' | 'remote';
    local?: LpcCompileLocalConfig;
    remote?: LpcCompileRemoteConfig;
}
```

项目配置根类型新增：

```ts
compile?: LpcCompileConfig;
```

### 路径规则

- `driverConfigPath` 应尽量以相对工作区路径保存
- 当 `useSystemCommand` 为 `true` 时，`lpccpPath` 可为空
- 当 `lpccpPath` 有值且为相对路径时，按工作区根目录解析

## 架构设计

### 高层方向

编译逻辑不应继续被单一传输方式写死。需要引入一个小型的编译管理层，负责：

- 加载项目级编译配置
- 选择当前活跃的编译后端
- 执行编译
- 将结果统一映射为 VS Code diagnostics 和输出通道信息

### 建议服务划分

可以保留现有 `LPCCompiler` 作为对外入口，但内部应重构为按后端委派：

- `CompilationService`
  - `compileFile` / `compileFolder` 的统一编排入口
  - 负责读取 `lpc-support.json`
  - 按 `compile.mode` 选择后端
- `RemoteCompilationBackend`
  - 封装当前 HTTP 编译逻辑
- `LocalLpccpCompilationBackend`
  - 调用 `lpccp`
  - 解析 stdout JSON、stderr 和退出码

这部分既可以拆成新文件，也可以先在 [`src/compiler.ts`](D:/code/lpc-support/src/compiler.ts) 内部分阶段重构，但目标形态应保持后端边界清晰。

## 执行模型

### 共享前置步骤

`compileFile` 和 `compileFolder` 都应先完成：

- 解析工作区根目录
- 通过 `LpcProjectConfigService` 加载项目配置
- 确定当前编译模式
- 将工作区相对路径转换为 LPC / MUD 路径

### 远程模式

远程模式保留当前行为，但做一个关键调整：

- 服务器列表与活动服务器改为从 `lpc-support.json` 读取，而不是继续依赖全局 `lpc-servers.json`

本次变更中，远程目录编译仍可继续使用现有逐文件 fan-out 行为，除非后续远程协议补齐目录级编译接口。

### 本地模式

单文件编译命令：

```bash
lpccp <config-path> <mud-path>
```

目录编译命令：

```bash
lpccp <config-path> <mud-dir>
```

执行规则：

- `useSystemCommand === true` 时直接调用 `lpccp`
- 否则调用配置中的可执行文件路径
- 第一个位置参数为解析后的 driver config 路径
- 第二个位置参数为目标 MUD 文件或目录

实现上应使用 Node 的 child process API，并捕获：

- stdout
- stderr
- exit code

## 结果归一化

`lpccp` 的 stdout 始终是 JSON，应作为主要结构化结果源。

### 退出码处理

- `0`：请求成功，且顶层 `ok: true`
- `1`：请求已送达，但编译返回失败；仍要解析 stdout JSON 并展示 diagnostics
- `2`：本地连接或请求级失败；以 stderr 为主，并给出 driver/config 检查提示

### 单文件响应映射

重点字段：

- `ok`
- `kind: "file"`
- `target`
- `diagnostics`

每条诊断映射到 `vscode.Diagnostic` 时：

- `severity: "warning"` 映射为 `DiagnosticSeverity.Warning`
- 其他情况默认映射为 `DiagnosticSeverity.Error`

如果行号缺失或非法，回退到第 0 行。

### 目录响应映射

重点字段：

- `ok`
- `kind: "directory"`
- `files_total`
- `files_ok`
- `files_failed`
- `results`

行为约定：

- 将整体成功/失败统计写入 output channel
- 遍历 `results`，把每个文件的 diagnostics 映射回工作区内对应 URI
- 对本次返回中成功编译的文件清除旧 diagnostics

### 输出通道行为

继续复用现有 LPC Compiler 输出通道，并打印：

- 当前编译模式
- 实际命令或服务器目标
- 编译目标
- 高层摘要
- stderr 或请求级失败信息

## 迁移策略

### 已有项目配置的增量初始化

如果 `lpc-support.json` 已存在但尚未包含 `compile` 字段，则在以下时机惰性初始化：

- 用户打开 `编译管理`
- 用户执行 `compileFile`
- 用户执行 `compileFolder`

默认初始化策略：

- 如果存在 legacy 远程服务器配置，则先初始化 `compile.remote`
- 否则初始化为空远程配置
- `compile.mode` 默认值：
  - 有远程服务器时默认 `remote`
  - 否则只有在用户显式创建本地配置后才切到 `local`

### 全局服务器迁移

现有远程服务器定义仍在全局存储 `lpc-servers.json` 中。

迁移方式：

1. 通过 `LPCConfigManager` 读取 legacy 服务器配置
2. 首次加载某个工作区的编译管理时，如果 `compile.remote.servers` 缺失或为空：
   - 将 legacy 服务器导入项目配置
   - 将 legacy 活动服务器写入 `compile.remote.activeServer`
3. 将迁移结果写回 `lpc-support.json`
4. 后续统一以项目配置为编译真源

这样可以避免让用户手工重新录入远程服务器。

### legacy 提示逻辑

现有迁移检测只关注：

- `lpc.includePath`
- `lpc.simulatedEfunsPath`
- `lpc.driver.command`

本次可以在提示逻辑中补充考虑 legacy 编译服务器来源，但提示主旨仍保持为：

- 推荐迁移到项目根目录 `lpc-support.json`

## 校验规则

本地编译前需要校验：

- `driverConfigPath` 必填
- `useSystemCommand === true` 或 `lpccpPath` 非空

需要给出清晰报错的场景：

- 缺少 config 路径
- 未勾选系统命令且缺少可执行文件路径
- 进程启动失败
- `lpccp` 返回非法 JSON
- 无法确定工作区根目录

远程编译前需要校验：

- 至少存在一个服务器
- 必须有活动服务器，或自动回退到第一个服务器

## 测试方案

### 单元测试

新增或补充以下测试：

- `compile` 配置块的读写
- legacy 全局服务器迁移到项目配置
- 命令注册更名与兼容别名
- 本地模式命令解析
- 本地模式退出码与 JSON 解析
- 远程模式从项目配置而不是全局文件读取服务器

建议重点覆盖文件：

- [`src/projectConfig/__tests__/LpcProjectConfigService.test.ts`](D:/code/lpc-support/src/projectConfig/__tests__/LpcProjectConfigService.test.ts)
- [`src/projectConfig/__tests__/projectConfigMigration.test.ts`](D:/code/lpc-support/src/projectConfig/__tests__/projectConfigMigration.test.ts)
- [`src/modules/__tests__/commandModule.test.ts`](D:/code/lpc-support/src/modules/__tests__/commandModule.test.ts)
- 编译实现附近新增 compile-management 相关测试

### 行为测试

覆盖以下场景：

- `lpc.compileFile` 在本地模式下使用系统命令
- `lpc.compileFile` 在本地模式下使用显式可执行路径
- `lpc.compileFolder` 在本地模式下消费目录 JSON 返回
- `lpc.compileFile` 在远程模式下走项目配置中的迁移后服务器

mock 重点验证：

- 实际调用的命令与参数
- 返回 diagnostics 后是否正确写入
- output channel 是否输出摘要

## 风险

- legacy 全局服务器与项目配置在迁移期并存时，若优先级不明确，可能让用户困惑
- 目录编译结果需要准确把 MUD 路径映射回工作区文件路径
- `lpccp` JSON 解析失败时必须有清晰的兜底日志
- Windows 下本地可执行路径处理需要稳妥

## 落地说明

- 本次版本中继续保留 `lpc.manageServers` 作为兼容别名
- README 与命令文案统一从“管理编译服务器”更新为“编译管理”
- 文档中补充 `lpccp` 本地模式的配置方式和示例

## 推荐实施顺序

1. 扩展项目配置类型与 `LpcProjectConfigService`，支持 `compile`
2. 增加 legacy 远程服务器向 `lpc-support.json` 的迁移
3. 将编译器重构为按模式分发的编排层
4. 实现本地 `lpccp` 编译后端
5. 更新命令、菜单和文案为“编译管理”
6. 补齐测试
7. 更新 README / CHANGELOG
