# LPC Support 项目级配置设计

## 概述

`0.2.9` 引入项目级配置文件 `lpc-support.json`，用于让扩展在 Mudlib 工作区内以“项目配置”而不是“用户手填 VS Code 设置”为主进行工作。

目标是：

- 让 `LPC Support` 在真实 Mudlib 中更容易开箱即用
- 把 `include` 路径、模拟函数库路径等强依赖项目结构的信息，从用户全局设置迁移到项目内文件
- 复用 Mudlib 已经存在的 [`config.hell`](D:/code/shuiyuzhengfeng_lpc/config.hell) 作为权威来源
- 对旧配置用户提供平滑迁移提醒，而不是一次性打断

本设计聚焦首批对扩展核心能力直接有帮助的配置项，不一次性覆盖 `config.hell` 的所有字段。

---

## 用户价值

从用户视角，`0.2.9` 的变化应当是：

- 在项目根目录创建一次 `lpc-support.json` 后，扩展可以自动识别 Mudlib 关键配置
- 不再必须手工维护 `lpc.includePath`、`lpc.simulatedEfunsPath` 这类容易写错、容易漂移的 VS Code 设置
- 当项目中的 [`config.hell`](D:/code/shuiyuzhengfeng_lpc/config.hell) 更新后，扩展可以重新同步配置结果
- 旧用户在升级后会收到迁移提醒，但旧配置在一个兼容周期内仍可继续工作

---

## 非目标

- `0.2.9` 不尝试把 `config.hell` 中所有运行参数都纳入扩展配置模型
- 不在首版引入复杂的多工作区配置合并策略
- 不在首版移除所有旧 `lpc.*` VS Code 配置项
- 不把 `lpc-support.json` 做成完整的驱动配置编辑器

---

## 配置文件位置与结构

项目根目录新增：

- `lpc-support.json`

首版推荐结构：

```json
{
  "version": 1,
  "configHellPath": "config.hell",
  "resolved": {
    "name": "武侠黎明",
    "mudlibDirectory": "./",
    "binaryDirectory": "./",
    "includeDirectories": [
      "/include"
    ],
    "simulatedEfunFile": "/adm/single/simul_efun",
    "masterFile": "/adm/single/master",
    "globalIncludeFile": "<global.h>"
  },
  "lastSyncedAt": "2026-03-22T00:00:00.000Z"
}
```

### 字段说明

- `version`
  - 配置文件版本号，首版固定为 `1`
- `configHellPath`
  - 相对于项目根目录的路径
  - 由用户声明，扩展不自动改写
- `resolved`
  - 扩展根据 `config.hell` 解析出的结构化结果
  - 由扩展自动维护
- `lastSyncedAt`
  - 扩展最近一次成功同步 `resolved` 的时间戳

### 约束

- `lpc-support.json` 是项目文件，不是用户全局缓存
- `resolved` 视为“自动生成字段”，允许扩展覆盖更新
- 用户可以手工编辑 `configHellPath`
- 用户不需要手工编辑 `resolved`

---

## `config.hell` 首批解析字段

首版只解析以下字段：

- `name`
- `mudlib directory`
- `binary directory`
- `include directories`
- `simulated efun file`
- `master file`
- `global include file`

解析规则：

- 忽略空行与 `#` 注释
- 使用 `key : value` 形式切分
- key 比较时大小写不敏感，并保留原始 value 内容
- `include directories`
  - 使用 `:` 作为多路径分隔符
  - 输出为字符串数组
- 其他字段
  - 输出为字符串

---

## 读取优先级

扩展读取配置时，统一遵循以下优先级：

1. 项目根目录的 `lpc-support.json`
2. `lpc-support.json` 中声明的 `configHellPath` 对应的 `config.hell`
3. 解析结果回写到 `resolved`
4. 若项目文件不存在或解析失败，则回退到旧的 VS Code 配置项
5. 若旧配置也不存在，则回退到当前硬编码默认值或现有推导逻辑

### 设计原则

- 项目级配置优先于用户级配置
- 用户手工指定的 `configHellPath` 优先于自动猜测
- 旧配置只作为兼容兜底，不再是首选来源

---

## 回写策略

当扩展成功解析 `config.hell` 后：

- 更新 `resolved`
- 更新 `lastSyncedAt`
- 保留原有 `configHellPath`

当解析失败时：

- 不清空已有 `resolved`
- 保留上一次成功结果
- 向用户提示同步失败原因

这样可以避免项目配置在临时错误或文件损坏时整体失效。

---

## 迁移策略

`0.2.9` 需要对旧配置用户做一次平滑迁移提醒。

### 触发条件

当满足以下条件时触发提醒：

- 当前工作区内不存在 `lpc-support.json`
- 检测到旧配置中至少存在一项：
  - `lpc.includePath`
  - `lpc.simulatedEfunsPath`
  - `lpc.driver.command`

### 提醒文案方向

建议文案：

> 当前项目仍在使用旧版 LPC Support 配置。建议迁移到项目根目录的 `lpc-support.json`，以便扩展自动从 `config.hell` 同步关键路径信息。

### 用户操作

提供命令：

- `LPC: 迁移项目配置到 lpc-support.json`

迁移动作：

1. 创建 `lpc-support.json`
2. 默认写入 `configHellPath`
3. 若能找到 `config.hell`，立即解析并写入 `resolved`
4. 将旧配置中可映射的值作为兜底写入或用于首次初始化

### 兼容策略

- `0.2.9` 只提醒，不强制
- 旧 `lpc.*` 配置继续保留一个兼容周期
- 在兼容期内，功能读取逻辑由项目配置服务统一兜底

---

## 模块接入范围

首批只接入真正影响扩展核心体验的模块。

### 1. `MacroManager`

使用：

- `resolved.includeDirectories`

效果：

- 宏扫描与 include 解析默认走项目配置
- 降低用户手填 `lpc.includePath` 的成本

### 2. `SimulatedEfunScanner` / `EfunDocsManager`

使用：

- `resolved.simulatedEfunFile`

效果：

- 模拟函数库文档扫描默认从项目配置推导

### 3. `LPCCompiler` / 编译命令

使用：

- `configHellPath`
- `resolved.binaryDirectory`
- 保留 `lpc.driver.command` 兼容兜底

效果：

- 编译和驱动相关路径可以逐步从项目配置读取

### 4. 其他可读项

可展示：

- `resolved.name`
- `resolved.masterFile`

但首版不要求接入所有 UI。

---

## 新增组件建议

建议新增以下文件：

- `src/projectConfig/LpcProjectConfig.ts`
  - 定义 `lpc-support.json` 的类型契约
- `src/projectConfig/configHellParser.ts`
  - 负责 `config.hell` 解析
- `src/projectConfig/LpcProjectConfigService.ts`
  - 负责查找、读取、写入、同步项目配置
- `src/projectConfig/projectConfigMigration.ts`
  - 负责旧配置检测与迁移提示

### 服务注册

在 `coreModule` 中注册 `LpcProjectConfigService`，供下列模块统一使用：

- `MacroManager`
- `EfunDocsManager` / `SimulatedEfunScanner`
- `LPCCompiler`
- 未来可能的 UI / 命令入口

---

## 错误处理

### `config.hell` 不存在

- 提示用户未找到配置源文件
- 不阻断扩展启动
- 回退到旧配置/默认值

### `config.hell` 语法不符合预期

- 保留已存在的 `resolved`
- 记录错误消息并提示用户
- 不写入损坏结果

### `lpc-support.json` 损坏

- 尝试读取失败时提示用户
- 提供重新生成命令
- 不直接覆盖用户文件，除非用户明确触发迁移/重建

---

## 测试计划

至少覆盖以下测试：

### 解析测试

- `config.hell` 单值项解析
- `include directories` 多值解析
- 注释与空行跳过
- 重复 key 的处理策略

### 项目配置服务测试

- 找到项目根目录的 `lpc-support.json`
- 使用 `configHellPath` 解析并回写 `resolved`
- 解析失败时保留旧 `resolved`
- 不存在项目文件时回退旧配置

### 迁移测试

- 检测旧配置并触发迁移提醒
- 迁移后写出合法 `lpc-support.json`

### 集成测试

- `MacroManager` 能从项目配置读取 include 路径
- 模拟函数库路径可从项目配置解析
- 编译入口能读取项目配置中的路径信息

---

## 向后兼容

`0.2.9` 的兼容原则：

- 旧用户升级后不需要立即修改现有设置
- 新项目优先推荐 `lpc-support.json`
- 项目配置和旧设置的冲突时，以项目配置为准

---

## 用户文档变更

本设计落地后，需要同步更新：

- `CHANGELOG.md`
  - 从用户视角说明项目级配置引入与迁移提醒
- `README.md`
  - 增加 `lpc-support.json` 示例
- `AGENTS.md`
  - 增加项目配置服务与 `config.hell` 同步约束

---

## 实施建议

建议实施顺序：

1. 先做 `configHellParser.ts`
2. 再做 `LpcProjectConfigService.ts`
3. 再接入 `MacroManager`
4. 再接入 `SimulatedEfunScanner`
5. 最后做迁移提醒与用户提示

这样可以先把解析与读取主路径做稳定，再补迁移体验。
