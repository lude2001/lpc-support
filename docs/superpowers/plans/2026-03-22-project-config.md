# Project Config Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 LPC Support 引入项目级 `lpc-support.json` 配置文件，自动解析 `config.hell` 并替代手工填写的关键 VS Code 配置项。

**Architecture:** 新增 `src/projectConfig/` 作为项目配置子系统，负责 `lpc-support.json` 的查找、读写、同步和旧配置迁移。业务模块不直接读旧 `lpc.*` 设置，而是统一通过 `LpcProjectConfigService` 获取项目配置结果；旧设置只保留在服务内部作为兼容兜底。

**Tech Stack:** TypeScript, VS Code Extension API, Node `fs/path`, Jest + ts-jest

**Spec:** `docs/superpowers/specs/2026-03-22-project-config-design.md`

**Test command:** `npm test`

**Validation rule:** 每个 Task 完成时至少运行对应测试与 `npx tsc --noEmit`；每个 Chunk 结束时运行相关集成测试。

---

## File Structure

### New Files

- `src/projectConfig/LpcProjectConfig.ts`
  - 定义 `lpc-support.json` 结构、解析结果契约和迁移提示类型
- `src/projectConfig/configHellParser.ts`
  - 解析 `config.hell` 的 key/value 内容，输出结构化结果
- `src/projectConfig/LpcProjectConfigService.ts`
  - 查找项目根目录、读取/写入 `lpc-support.json`、同步 `config.hell`
- `src/projectConfig/projectConfigMigration.ts`
  - 检测旧配置、构建迁移提示与迁移动作
- `src/projectConfig/__tests__/configHellParser.test.ts`
  - `config.hell` 解析测试
- `src/projectConfig/__tests__/LpcProjectConfigService.test.ts`
  - 项目配置服务测试
- `src/projectConfig/__tests__/projectConfigMigration.test.ts`
  - 迁移提示与迁移动作测试

### Modified Files

- `src/core/ServiceKeys.ts`
  - 注册项目配置服务 key
- `src/modules/coreModule.ts`
  - 初始化并注册 `LpcProjectConfigService`
- `src/macroManager.ts`
  - include 路径优先从项目配置读取
- `src/efun/SimulatedEfunScanner.ts`
  - 模拟函数库路径优先从项目配置读取
- `src/compiler.ts`
  - 为后续编译入口读取项目配置打基础
- `src/modules/commandModule.ts`
  - 增加迁移命令与首次迁移入口
- `src/modules/__tests__/commandModule.test.ts`
  - 覆盖迁移命令注册与行为
- `src/core/__tests__/coreModule.test.ts`
  - 覆盖项目配置服务注册
- `README.md`
  - 增加 `lpc-support.json` 示例
- `CHANGELOG.md`
  - 增加 `0.2.9` 用户视角变更说明
- `AGENTS.md`
  - 补充项目级配置约束（如果实现过程中需要继续同步）

---

## Chunk 1: Parser And Project Config Service

### Task 1: 定义 `lpc-support.json` 契约

**Files:**
- Create: `src/projectConfig/LpcProjectConfig.ts`
- Test: `src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

- [x] **Step 1: 写失败测试，锁定基础配置对象形状**

```typescript
test('project config shape stores configHellPath and resolved fields', () => {
    const config: LpcProjectConfig = {
        version: 1,
        configHellPath: 'config.hell',
        resolved: {
            includeDirectories: ['/include']
        }
    };

    expect(config.version).toBe(1);
    expect(config.configHellPath).toBe('config.hell');
    expect(config.resolved.includeDirectories).toEqual(['/include']);
});
```

- [x] **Step 2: 运行测试，确认初始失败或类型缺失**

Run: `npx jest --runInBand src/projectConfig/__tests__/LpcProjectConfigService.test.ts -t "project config shape stores configHellPath and resolved fields"`

Expected: FAIL，提示 `LpcProjectConfig` 不存在或结构不匹配

- [x] **Step 3: 创建类型文件**

```typescript
export interface LpcResolvedConfig {
    name?: string;
    mudlibDirectory?: string;
    binaryDirectory?: string;
    includeDirectories?: string[];
    simulatedEfunFile?: string;
    masterFile?: string;
    globalIncludeFile?: string;
}

export interface LpcProjectConfig {
    version: 1;
    configHellPath: string;
    resolved?: LpcResolvedConfig;
    lastSyncedAt?: string;
}
```

- [x] **Step 4: 运行测试，确认通过**

Run: `npx jest --runInBand src/projectConfig/__tests__/LpcProjectConfigService.test.ts -t "project config shape stores configHellPath and resolved fields"`

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/projectConfig/LpcProjectConfig.ts src/projectConfig/__tests__/LpcProjectConfigService.test.ts
git commit -m "feat(project-config): add project config contracts"
```

### Task 2: 实现 `config.hell` 解析器

**Files:**
- Create: `src/projectConfig/configHellParser.ts`
- Test: `src/projectConfig/__tests__/configHellParser.test.ts`

- [x] **Step 1: 写失败测试，覆盖单值、多值、注释跳过**

```typescript
test('parses config.hell key value pairs and include directories', () => {
    const source = [
        '# comment',
        'name : 武侠黎明',
        'include directories : /include:/include2',
        'simulated efun file : /adm/single/simul_efun'
    ].join('\n');

    const result = parseConfigHell(source);

    expect(result.name).toBe('武侠黎明');
    expect(result.includeDirectories).toEqual(['/include', '/include2']);
    expect(result.simulatedEfunFile).toBe('/adm/single/simul_efun');
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `npx jest --runInBand src/projectConfig/__tests__/configHellParser.test.ts`

Expected: FAIL，提示 `parseConfigHell` 未定义

- [x] **Step 3: 实现最小解析器**

```typescript
const FIELD_MAP: Record<string, keyof LpcResolvedConfig> = {
    'name': 'name',
    'mudlib directory': 'mudlibDirectory',
    'binary directory': 'binaryDirectory',
    'include directories': 'includeDirectories',
    'simulated efun file': 'simulatedEfunFile',
    'master file': 'masterFile',
    'global include file': 'globalIncludeFile'
};
```

实现要求：
- 忽略空行和 `#` 注释
- 使用首个 `:` 分隔 key/value
- key 小写归一化
- `include directories` 拆成数组

- [x] **Step 4: 扩充测试**

增加测试：
- 重复 `global include file` 时采用最后一个值
- 无关 key 被忽略
- 空 `include directories` 返回空数组或 `undefined`

- [x] **Step 5: 运行测试，确认通过**

Run: `npx jest --runInBand src/projectConfig/__tests__/configHellParser.test.ts`

Expected: PASS

- [x] **Step 6: 提交**

```bash
git add src/projectConfig/configHellParser.ts src/projectConfig/__tests__/configHellParser.test.ts
git commit -m "feat(project-config): add config.hell parser"
```

### Task 3: 实现 `LpcProjectConfigService`

**Files:**
- Create: `src/projectConfig/LpcProjectConfigService.ts`
- Modify: `src/projectConfig/LpcProjectConfig.ts`
- Test: `src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

- [x] **Step 1: 写失败测试，覆盖读取、同步、回写**

```typescript
test('loads lpc-support.json, parses config.hell, and rewrites resolved fields', async () => {
    const service = new LpcProjectConfigService(/* mocked vscode/fs */);

    const result = await service.loadForWorkspace('/workspace');

    expect(result?.configHellPath).toBe('config.hell');
    expect(result?.resolved?.includeDirectories).toEqual(['/include']);
    expect(result?.lastSyncedAt).toBeDefined();
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `npx jest --runInBand src/projectConfig/__tests__/LpcProjectConfigService.test.ts`

Expected: FAIL，提示服务不存在

- [x] **Step 3: 实现最小服务**

服务职责：
- 找到工作区根目录
- 读取 `lpc-support.json`
- 解析 `configHellPath`
- 同步 `resolved` 和 `lastSyncedAt`
- 解析失败时保留旧 `resolved`

建议公开接口：

```typescript
loadForWorkspace(workspaceRoot: string): Promise<LpcProjectConfig | undefined>
syncForWorkspace(workspaceRoot: string): Promise<LpcProjectConfig | undefined>
readConfigFile(configPath: string): Promise<LpcProjectConfig | undefined>
writeConfigFile(configPath: string, config: LpcProjectConfig): Promise<void>
```

- [x] **Step 4: 增加失败场景测试**

增加测试：
- 没有 `lpc-support.json` 时返回 `undefined`
- `config.hell` 不存在时保留旧 `resolved`
- `config.hell` 解析失败时不覆盖旧缓存

- [x] **Step 5: 运行测试与类型检查**

Run: `npx jest --runInBand src/projectConfig/__tests__/LpcProjectConfigService.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [x] **Step 6: 提交**

```bash
git add src/projectConfig/LpcProjectConfigService.ts src/projectConfig/LpcProjectConfig.ts src/projectConfig/__tests__/LpcProjectConfigService.test.ts
git commit -m "feat(project-config): add project config service"
```

---

## Chunk 2: Core Integration And Consumers

### Task 4: 在核心模块注册项目配置服务

**Files:**
- Modify: `src/core/ServiceKeys.ts`
- Modify: `src/modules/coreModule.ts`
- Modify: `src/core/__tests__/coreModule.test.ts`

- [x] **Step 1: 写失败测试，锁定服务注册**

```typescript
test('registerCoreServices registers project config service', () => {
    registerCoreServices(registry, context);
    expect(registry.get(Services.ProjectConfig)).toBeDefined();
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `npx jest --runInBand src/core/__tests__/coreModule.test.ts -t "registerCoreServices registers project config service"`

Expected: FAIL，提示 `Services.ProjectConfig` 不存在

- [x] **Step 3: 最小实现**

```typescript
ProjectConfig: new ServiceKey<LpcProjectConfigService>('ProjectConfig')
```

并在 `registerCoreServices()` 中初始化、注册、追踪。

- [x] **Step 4: 运行测试**

Run: `npx jest --runInBand src/core/__tests__/coreModule.test.ts`

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/core/ServiceKeys.ts src/modules/coreModule.ts src/core/__tests__/coreModule.test.ts
git commit -m "feat(project-config): register project config service"
```

### Task 5: `MacroManager` 接入项目配置

**Files:**
- Modify: `src/macroManager.ts`
- Test: `src/__tests__/providerIntegration.test.ts` or new `src/projectConfig/__tests__/macroManagerProjectConfig.test.ts`

- [x] **Step 1: 写失败测试，覆盖 include 路径优先级**

```typescript
test('MacroManager prefers includeDirectories from lpc-support.json over legacy setting', async () => {
    const manager = new MacroManager(projectConfigServiceMock);
    await manager.refreshMacros();
    expect(projectConfigServiceMock.getIncludeDirectories).toHaveBeenCalled();
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `npx jest --runInBand src/projectConfig/__tests__/macroManagerProjectConfig.test.ts`

Expected: FAIL

- [x] **Step 3: 最小实现**

调整 `MacroManager`：
- 注入或读取 `LpcProjectConfigService`
- 读取顺序：
  1. 项目配置里的 `resolved.includeDirectories`
  2. 旧 `lpc.includePath`
  3. 默认 `workspace/include`

首版策略：
- 若有多个 `includeDirectories`，`MacroManager` 先只使用第一个目录
- 在实现和文档中明确这是 `0.2.9` 的已知首版限制

- [x] **Step 4: 运行测试**

Run: `npx jest --runInBand src/projectConfig/__tests__/macroManagerProjectConfig.test.ts`

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/macroManager.ts src/projectConfig/__tests__/macroManagerProjectConfig.test.ts
git commit -m "feat(project-config): source include path from project config"
```

### Task 6: `SimulatedEfunScanner` 接入项目配置

**Files:**
- Modify: `src/efun/SimulatedEfunScanner.ts`
- Modify: `src/__tests__/efunDocs.test.ts`

- [x] **Step 1: 写失败测试，覆盖 simulated efun 路径来源**

```typescript
test('SimulatedEfunScanner loads from project config resolved.simulatedEfunFile', async () => {
    await scanner.load();
    expect(projectConfigServiceMock.getSimulatedEfunFile).toHaveBeenCalled();
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `npx jest --runInBand src/__tests__/efunDocs.test.ts -t "SimulatedEfunScanner loads from project config resolved.simulatedEfunFile"`

Expected: FAIL

- [x] **Step 3: 最小实现**

读取顺序：
  1. 项目配置 `resolved.simulatedEfunFile`
  2. 旧 `lpc.simulatedEfunsPath`
  3. 无配置则跳过

注意：
- `simulated efun file` 是文件路径，不是目录路径
- 现有 scanner 基于目录扫描，需要在服务层把文件路径转换成所在目录，或新增“单文件 + 同目录扫描”逻辑

- [x] **Step 4: 运行测试**

Run: `npx jest --runInBand src/__tests__/efunDocs.test.ts`

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/efun/SimulatedEfunScanner.ts src/__tests__/efunDocs.test.ts
git commit -m "feat(project-config): source simulated efuns from project config"
```

### Task 7: 编译入口接入项目配置

**Files:**
- Modify: `src/compiler.ts`
- Modify: `src/modules/commandModule.ts`
- Modify: `src/modules/__tests__/commandModule.test.ts`

- [x] **Step 1: 写失败测试，覆盖迁移后编译入口的配置读取**

```typescript
test('compile commands can resolve project config before falling back to legacy driver command', async () => {
    await registeredCommand();
    expect(projectConfigServiceMock.loadForWorkspace).toHaveBeenCalled();
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts`

Expected: FAIL

- [x] **Step 3: 最小实现**

首版目标不是完全替换编译服务器模型，而是：
- 编译命令能读取项目配置服务
- 为后续从 `config.hell` 推导路径保留入口
- 旧 `lpc.driver.command` 继续保留兜底

- [x] **Step 4: 运行测试与类型检查**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/compiler.ts src/modules/commandModule.ts src/modules/__tests__/commandModule.test.ts
git commit -m "feat(project-config): integrate project config into compiler flow"
```

---

## Chunk 3: Migration, UX, And Docs

### Task 8: 增加旧配置迁移检测与命令

**Files:**
- Create: `src/projectConfig/projectConfigMigration.ts`
- Modify: `src/modules/commandModule.ts`
- Modify: `src/modules/__tests__/commandModule.test.ts`
- Test: `src/projectConfig/__tests__/projectConfigMigration.test.ts`

- [x] **Step 1: 写失败测试，覆盖迁移提示条件**

```typescript
test('migration prompt appears when legacy lpc settings exist and lpc-support.json is missing', async () => {
    const shouldPrompt = await shouldPromptProjectConfigMigration(/* mocks */);
    expect(shouldPrompt).toBe(true);
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `npx jest --runInBand src/projectConfig/__tests__/projectConfigMigration.test.ts`

Expected: FAIL

- [x] **Step 3: 实现迁移逻辑**

新增命令：
- `lpc.migrateProjectConfig`

行为：
1. 检测工作区根目录
2. 若不存在 `lpc-support.json`，创建基础文件
3. 默认写入 `configHellPath: "config.hell"`
4. 若找到 `config.hell`，同步 `resolved`
5. 旧配置仅用于兜底初始化，不删除

- [x] **Step 4: 运行测试**

Run: `npx jest --runInBand src/projectConfig/__tests__/projectConfigMigration.test.ts src/modules/__tests__/commandModule.test.ts`

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/projectConfig/projectConfigMigration.ts src/projectConfig/__tests__/projectConfigMigration.test.ts src/modules/commandModule.ts src/modules/__tests__/commandModule.test.ts
git commit -m "feat(project-config): add project config migration flow"
```

### Task 9: 更新 README / CHANGELOG / AGENTS

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`

- [x] **Step 1: 更新 README**

补充：
- `lpc-support.json` 示例
- `config.hell` 自动同步说明
- 旧配置迁移说明

- [x] **Step 2: 更新 CHANGELOG**

从用户视角说明：
- 新增项目级配置文件
- 自动从 `config.hell` 同步
- 升级时会收到旧配置迁移提醒

- [x] **Step 3: 更新 AGENTS**

补充：
- 项目级配置优先于旧 `lpc.*` 设置
- 不要在新代码里直接读取旧配置项，优先走 `LpcProjectConfigService`

- [x] **Step 4: 运行文档相关检查**

Run: `npx tsc --noEmit`

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add README.md CHANGELOG.md AGENTS.md
git commit -m "docs(project-config): document project config workflow"
```

### Task 10: 最终回归

**Files:**
- Modify: none expected

- [x] **Step 1: 运行项目配置相关测试**

Run:

```bash
npx jest --runInBand src/projectConfig/__tests__/configHellParser.test.ts src/projectConfig/__tests__/LpcProjectConfigService.test.ts src/projectConfig/__tests__/projectConfigMigration.test.ts
```

Expected: PASS

- [x] **Step 2: 运行现有关键集成测试**

Run:

```bash
npx jest --runInBand src/core/__tests__/coreModule.test.ts src/modules/__tests__/commandModule.test.ts src/__tests__/efunDocs.test.ts
```

Expected: PASS

- [x] **Step 3: 运行全量类型检查**

Run: `npx tsc --noEmit`

Expected: PASS

- [x] **Step 4: 运行全量测试**

Run: `npm test -- --runInBand`

Expected: PASS

- [ ] **Step 5: 提交最终收尾**

```bash
git add .
git commit -m "feat(project-config): add project-level mudlib configuration support"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-03-22-project-config.md`. Ready to execute.
