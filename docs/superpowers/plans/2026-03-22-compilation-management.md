# 编译管理 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有“管理编译服务器”升级为统一的“编译管理”，把远程 HTTP 编译和本地 `lpccp` 编译统一纳入 `lpc-support.json`，并让 `compileFile` / `compileFolder` 按模式选择正确后端。

**Architecture:** 先扩展项目配置模型与迁移逻辑，把远程服务器和本地 `lpccp` 配置统一写入 `lpc-support.json`；再将 [`src/compiler.ts`](D:/code/lpc-support/src/compiler.ts) 重构为按模式分发的编排层，分别接入远程 HTTP 后端和本地 `lpccp` 后端；最后更新命令/UI 文案、补齐测试与文档，确保现有主路径不回退到旧的全局服务器配置真源。

**Tech Stack:** TypeScript, VS Code Extension API, Node child_process, Jest, ts-jest

**Spec:** `docs/superpowers/specs/2026-03-22-compilation-management-design.md`

**Primary validation:** `npx tsc --noEmit`

**Targeted test suites:** `npx jest --runInBand src/modules/__tests__/commandModule.test.ts src/projectConfig/__tests__/LpcProjectConfigService.test.ts src/projectConfig/__tests__/projectConfigMigration.test.ts`

---

## File Structure

### 新建文件
- `src/compilation/types.ts` - 编译配置、`lpccp` 响应与归一化结果类型
- `src/compilation/LocalLpccpCompilationBackend.ts` - 本地 `lpccp` 执行与 JSON 解析
- `src/compilation/RemoteCompilationBackend.ts` - 远程 HTTP 编译封装
- `src/compilation/CompilationService.ts` - 按模式调度 `compileFile` / `compileFolder`
- `src/compilation/__tests__/CompilationService.test.ts` - 模式分发与结果归一化测试
- `src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts` - `lpccp` 退出码、JSON、stderr 测试

### 重点修改文件
- `src/projectConfig/LpcProjectConfig.ts` - 扩展 `compile` 配置类型
- `src/projectConfig/LpcProjectConfigService.ts` - 读写、初始化、路径解析、迁移辅助
- `src/projectConfig/projectConfigMigration.ts` - 补充编译管理迁移入口
- `src/config.ts` - 暴露 legacy 服务器配置读取能力，供迁移复用
- `src/compiler.ts` - 转为兼容门面或薄包装，委托给 `CompilationService`
- `src/modules/coreModule.ts` - 注册新的编译服务依赖
- `src/core/ServiceKeys.ts` - 增加编译管理服务 key 或调整现有编译服务类型
- `src/modules/commandModule.ts` - 新增 `lpc.manageCompilation`，兼容 `lpc.manageServers`
- `src/modules/__tests__/commandModule.test.ts` - 更新命令集合与交互测试
- `package.json` - 更新命令、菜单和文案
- `README.md` - 更新“编译管理”与 `lpccp` 说明
- `CHANGELOG.md` - 记录新能力

### 参考文件
- `docs/lpccp.md`
- `docs/superpowers/specs/2026-03-22-compilation-management-design.md`
- `src/modules/commandModule.ts`
- `src/compiler.ts`
- `src/projectConfig/LpcProjectConfigService.ts`

---

## Chunk 1: 项目配置模型与迁移

### Task 1: 为 `lpc-support.json` 增加 `compile` 类型定义

**Files:**
- Modify: `src/projectConfig/LpcProjectConfig.ts`
- Test: `src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 `compile` 字段可被读回**

在 [`src/projectConfig/__tests__/LpcProjectConfigService.test.ts`](D:/code/lpc-support/src/projectConfig/__tests__/LpcProjectConfigService.test.ts) 新增一个最小测试，向 `lpc-support.json` 写入以下结构并断言 `readConfigFile()` / `loadForWorkspace()` 能返回相同字段：

```ts
compile: {
    mode: 'local',
    local: {
        useSystemCommand: true,
        driverConfigPath: 'etc/config.test'
    },
    remote: {
        activeServer: 'Alpha',
        servers: [{ name: 'Alpha', url: 'http://127.0.0.1:8080' }]
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

Expected: FAIL，原因是类型或服务尚未支持 `compile` 字段约束。

- [ ] **Step 3: 最小实现 `compile` 类型**

在 [`src/projectConfig/LpcProjectConfig.ts`](D:/code/lpc-support/src/projectConfig/LpcProjectConfig.ts) 增加：

```ts
export interface LpcCompileLocalConfig {
    useSystemCommand?: boolean;
    lpccpPath?: string;
    driverConfigPath?: string;
}

export interface LpcCompileRemoteServer {
    name: string;
    url: string;
    description?: string;
}

export interface LpcCompileRemoteConfig {
    activeServer?: string;
    servers?: LpcCompileRemoteServer[];
}

export interface LpcCompileConfig {
    mode?: 'local' | 'remote';
    local?: LpcCompileLocalConfig;
    remote?: LpcCompileRemoteConfig;
}
```

并在 `LpcProjectConfig` 中加上：

```ts
compile?: LpcCompileConfig;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/projectConfig/LpcProjectConfig.ts src/projectConfig/__tests__/LpcProjectConfigService.test.ts
git commit -m "feat(project-config): add compilation config types"
```

---

### Task 2: 为项目配置服务增加 `compile` 初始化与路径辅助

**Files:**
- Modify: `src/projectConfig/LpcProjectConfigService.ts`
- Test: `src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

- [ ] **Step 1: 先写失败测试，锁定默认 `compile` 初始化**

新增测试覆盖以下行为：
- `ensureConfigForWorkspace()` 在创建新配置时不会破坏现有 `resolved`
- 当配置文件缺少 `compile` 时，可以补入空的 `compile.remote` 结构
- `driverConfigPath` 与 `lpccpPath` 的工作区相对路径解析符合预期

建议最小断言：

```ts
expect(config.compile?.remote?.servers).toEqual([]);
expect(config.compile?.local?.useSystemCommand).toBeUndefined();
expect(service.resolveWorkspacePath(workspaceRoot, 'tools/lpccp.exe')).toBe(path.resolve(workspaceRoot, 'tools/lpccp.exe'));
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

Expected: FAIL，原因是尚无 `compile` 初始化与路径 helper。

- [ ] **Step 3: 在服务中补最小实现**

在 [`src/projectConfig/LpcProjectConfigService.ts`](D:/code/lpc-support/src/projectConfig/LpcProjectConfigService.ts) 增加：
- `ensureCompileConfig(...)`
- `getCompileConfigForWorkspace(...)`
- `updateCompileConfigForWorkspace(...)`
- `resolveWorkspacePath(...)`
- `toWorkspaceRelativePath(...)`

实现约束：
- 不影响 `resolved` 同步逻辑
- 不把 `config.hell` 的解析职责混入 `compile`
- 仅在需要时补齐默认结构

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/projectConfig/LpcProjectConfigService.ts src/projectConfig/__tests__/LpcProjectConfigService.test.ts
git commit -m "feat(project-config): add compilation config helpers"
```

---

### Task 3: 将 legacy 远程服务器迁移到 `lpc-support.json`

**Files:**
- Modify: `src/config.ts`
- Modify: `src/projectConfig/projectConfigMigration.ts`
- Test: `src/projectConfig/__tests__/projectConfigMigration.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 legacy 服务器迁移**

在 [`src/projectConfig/__tests__/projectConfigMigration.test.ts`](D:/code/lpc-support/src/projectConfig/__tests__/projectConfigMigration.test.ts) 增加测试：
- mock 一个包含两个服务器和一个默认活动服务器的 `LPCConfigManager`
- 调用新的迁移入口后，断言 `lpc-support.json` 中存在：

```ts
compile: {
    mode: 'remote',
    remote: {
        activeServer: 'Alpha',
        servers: [...]
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/projectConfig/__tests__/projectConfigMigration.test.ts`

Expected: FAIL，原因是目前无法读取 legacy 服务器或迁移 `compile`。

- [ ] **Step 3: 最小实现 legacy 读取与迁移**

在 [`src/config.ts`](D:/code/lpc-support/src/config.ts) 增加只读能力，例如：

```ts
public getServers(): FluffOSServer[] { ... }
public getDefaultServerName(): string | undefined { ... }
```

在 [`src/projectConfig/projectConfigMigration.ts`](D:/code/lpc-support/src/projectConfig/projectConfigMigration.ts) 增加迁移入口，例如：

```ts
export async function migrateLegacyCompilationConfigForWorkspace(...)
```

迁移规则：
- 仅当项目配置尚未包含远程服务器时导入
- 不覆盖用户已有的项目级 `compile.remote`
- 导入后把 `mode` 设为 `remote`

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/projectConfig/__tests__/projectConfigMigration.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/config.ts src/projectConfig/projectConfigMigration.ts src/projectConfig/__tests__/projectConfigMigration.test.ts
git commit -m "feat(project-config): migrate legacy compilation servers"
```

---

## Chunk 2: 编译后端与编排层

### Task 4: 创建编译结果与后端类型

**Files:**
- Create: `src/compilation/types.ts`
- Test: `src/compilation/__tests__/CompilationService.test.ts`

- [ ] **Step 1: 先写失败测试，锁定统一结果形状**

新增 [`src/compilation/__tests__/CompilationService.test.ts`](D:/code/lpc-support/src/compilation/__tests__/CompilationService.test.ts) 的最小测试，先只断言未来服务能接受如下结果结构：

```ts
{
    ok: false,
    kind: 'file',
    target: '/single/master.c',
    diagnostics: [{ severity: 'error', file: '/single/master.c', line: 12, message: 'syntax error' }]
}
```

以及目录结构：

```ts
{
    ok: false,
    kind: 'directory',
    target: '/single/',
    files_total: 3,
    files_ok: 2,
    files_failed: 1,
    results: [...]
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/compilation/__tests__/CompilationService.test.ts`

Expected: FAIL，因为类型文件尚不存在。

- [ ] **Step 3: 添加最小类型文件**

在 [`src/compilation/types.ts`](D:/code/lpc-support/src/compilation/types.ts) 定义：
- `CompilationMode`
- `CompilationDiagnostic`
- `LpccpFileResponse`
- `LpccpDirectoryResponse`
- `CompilationExecutionResult`
- `CompilationBackend`

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/compilation/__tests__/CompilationService.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/compilation/types.ts src/compilation/__tests__/CompilationService.test.ts
git commit -m "feat(compilation): add shared compilation types"
```

---

### Task 5: 先为本地 `lpccp` 后端写失败测试

**Files:**
- Create: `src/compilation/LocalLpccpCompilationBackend.ts`
- Create: `src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts`

- [ ] **Step 1: 写单文件成功与失败测试**

在 [`src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts`](D:/code/lpc-support/src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts) 覆盖：
- `useSystemCommand = true` 时调用命令名 `lpccp`
- `useSystemCommand = false` 时调用显式 `lpccpPath`
- 退出码 `0` + JSON 成功返回
- 退出码 `1` + JSON 失败返回
- 退出码 `2` + stderr 返回请求级失败
- stdout 非法 JSON 时抛出清晰错误

mock `child_process`，最小断言例如：

```ts
expect(spawnMock).toHaveBeenCalledWith('lpccp', ['D:/mud/etc/config.test', '/single/master.c'], expect.anything());
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts`

Expected: FAIL，因为后端尚未实现。

- [ ] **Step 3: 写最小实现**

在 [`src/compilation/LocalLpccpCompilationBackend.ts`](D:/code/lpc-support/src/compilation/LocalLpccpCompilationBackend.ts) 实现：
- 命令解析
- child process 执行
- stdout/stderr 收集
- 退出码判断
- JSON 解析

先只满足测试，不扩展额外抽象。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/compilation/LocalLpccpCompilationBackend.ts src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts
git commit -m "feat(compilation): add local lpccp backend"
```

---

### Task 6: 为远程 HTTP 后端写最小封装测试与实现

**Files:**
- Create: `src/compilation/RemoteCompilationBackend.ts`
- Test: `src/compilation/__tests__/CompilationService.test.ts`

- [ ] **Step 1: 先写失败测试，锁定远程后端从项目配置读取活动服务器**

新增测试断言：
- 给定 `compile.remote.activeServer = 'Alpha'`
- 服务不会再直接依赖 legacy 全局配置文件真源
- 调用单文件编译时仍使用现有 `/update_code/update_file`

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/compilation/__tests__/CompilationService.test.ts`

Expected: FAIL

- [ ] **Step 3: 写最小实现**

在 [`src/compilation/RemoteCompilationBackend.ts`](D:/code/lpc-support/src/compilation/RemoteCompilationBackend.ts) 中搬运并包裹当前 HTTP 编译逻辑，只处理：
- 远程单文件编译
- 远程目录逐文件 fan-out 的最小封装
- 响应消息到统一结果的转换

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/compilation/__tests__/CompilationService.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/compilation/RemoteCompilationBackend.ts src/compilation/__tests__/CompilationService.test.ts
git commit -m "feat(compilation): add remote compilation backend"
```

---

### Task 7: 创建 `CompilationService` 并接管 `src/compiler.ts`

**Files:**
- Create: `src/compilation/CompilationService.ts`
- Modify: `src/compiler.ts`
- Modify: `src/modules/coreModule.ts`
- Modify: `src/core/ServiceKeys.ts`
- Test: `src/compilation/__tests__/CompilationService.test.ts`

- [ ] **Step 1: 先写失败测试，锁定模式分发**

新增测试断言：
- `compile.mode = 'local'` 时调用 `LocalLpccpCompilationBackend`
- `compile.mode = 'remote'` 时调用 `RemoteCompilationBackend`
- `compileFolder` 在本地模式下使用目录路径，而不是逐文件调 `compileFile`

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/compilation/__tests__/CompilationService.test.ts`

Expected: FAIL

- [ ] **Step 3: 实现最小编排层**

在 [`src/compilation/CompilationService.ts`](D:/code/lpc-support/src/compilation/CompilationService.ts) 实现：
- 工作区解析
- 项目配置加载
- `compile.mode` 分发
- LPC 路径与工作区路径转换
- diagnostics 设置与清理
- output channel 摘要输出

在 [`src/compiler.ts`](D:/code/lpc-support/src/compiler.ts) 中保留现有 `LPCCompiler` 类名，但内部改为委托 `CompilationService`，以减少外部调用面变化。

在 [`src/modules/coreModule.ts`](D:/code/lpc-support/src/modules/coreModule.ts) 与 [`src/core/ServiceKeys.ts`](D:/code/lpc-support/src/core/ServiceKeys.ts) 中接入新的依赖。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/compilation/__tests__/CompilationService.test.ts src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/compilation src/compiler.ts src/modules/coreModule.ts src/core/ServiceKeys.ts
git commit -m "refactor(compilation): route compiler through mode-aware service"
```

---

## Chunk 3: 命令、菜单、文案与回归验证

### Task 8: 先为“编译管理”命令写失败测试

**Files:**
- Modify: `src/modules/commandModule.ts`
- Modify: `src/modules/__tests__/commandModule.test.ts`

- [ ] **Step 1: 写失败测试，锁定命令集合变化**

在 [`src/modules/__tests__/commandModule.test.ts`](D:/code/lpc-support/src/modules/__tests__/commandModule.test.ts) 更新期望命令集合：
- 新增 `lpc.manageCompilation`
- 保留 `lpc.manageServers` 兼容别名
- 断言旧入口最终走统一的编译管理 handler

同时新增交互测试：
- 打开编译管理后可切换模式
- 本地模式可设置 `useSystemCommand`
- 远程模式可选择活动服务器

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts`

Expected: FAIL

- [ ] **Step 3: 实现最小命令流**

在 [`src/modules/commandModule.ts`](D:/code/lpc-support/src/modules/commandModule.ts) 中：
- 增加 `lpc.manageCompilation`
- 保留 `lpc.manageServers` 并转发
- 编译管理内通过 `LpcProjectConfigService` 读写 `compile`
- 不再把“管理服务器”作为唯一心智模型

实现时优先拆小 helper，例如：
- `showCompilationManager(...)`
- `showLocalCompilationManager(...)`
- `showRemoteCompilationManager(...)`

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/modules/commandModule.ts src/modules/__tests__/commandModule.test.ts
git commit -m "feat(commands): add compilation management flow"
```

---

### Task 9: 更新 `package.json` 命令、菜单与配置文案

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 先写一个最小文本断言测试或人工检查清单**

如果已有适合的 manifest 测试则补测试；若没有，则在本任务中先列人工检查项：
- 命令标题从“管理编译服务器”改为“编译管理”
- 编辑器右键菜单入口文案同步更新
- 不引入新的 legacy `lpc.*` 配置首选项

- [ ] **Step 2: 修改 `package.json`**

更新：
- `contributes.commands`
- `contributes.menus`
- 必要时增加 `lpc.manageCompilation`

保留：
- `lpc.manageServers` 作为兼容命令 ID，但标题可标记为兼容入口或不在菜单中主推

- [ ] **Step 3: 运行类型与现有命令测试**

Run: `npx tsc --noEmit`

Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add package.json
git commit -m "feat(manifest): rename compilation UI entry"
```

---

### Task 10: 更新 README / CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 更新 README**

补充：
- “编译管理”说明
- 本地 `lpccp` 模式两种配置方式
- `driverConfigPath` 示例
- 远程服务器迁移到 `lpc-support.json` 的行为说明

- [ ] **Step 2: 更新 CHANGELOG**

记录：
- 新增本地 `lpccp` 编译
- 编译管理统一入口
- 远程服务器迁移到项目级配置

- [ ] **Step 3: 快速校对文案**

人工检查：
- 中文术语统一为“编译管理”
- 不再把新主路径称为“服务器管理”

- [ ] **Step 4: 提交**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document compilation management and lpccp mode"
```

---

### Task 11: 最终回归验证

**Files:**
- Verify only

- [ ] **Step 1: 跑类型检查**

Run: `npx tsc --noEmit`

Expected: 无错误

- [ ] **Step 2: 跑目标测试集**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts src/projectConfig/__tests__/LpcProjectConfigService.test.ts src/projectConfig/__tests__/projectConfigMigration.test.ts src/compilation/__tests__/CompilationService.test.ts src/compilation/__tests__/LocalLpccpCompilationBackend.test.ts`

Expected: 全部 PASS

- [ ] **Step 3: 跑补充全量测试**

Run: `npm test`

Expected: 全部 PASS

- [ ] **Step 4: 跑构建**

Run: `npm run build`

Expected: 构建成功

- [ ] **Step 5: 人工回归检查**

在 VS Code 中手动验证：
- 右键菜单文案为“编译管理”
- 本地模式可切换“使用系统命令”
- 本地模式可设置 `lpccp` 路径和 driver config 路径
- 远程模式可添加/切换服务器
- `compileFile` / `compileFolder` 按模式走正确后端

- [ ] **Step 6: 最终提交**

```bash
git add .
git commit -m "feat(compilation): add unified compilation management"
```
