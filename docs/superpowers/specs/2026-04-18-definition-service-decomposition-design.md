# Definition Service Decomposition Design

## 1. 概述

在 `0.45.1` 之后，`lpc-support` 的导航架构减债已经完成了前两步：

- `P0`
  - 旧 `Workspace*` 导航子系统已退场
- `P1`
  - server 侧 language context / document / workspaceRoot 构造已经统一

当前减债路线中最突出的剩余热点，是 [`LanguageDefinitionService.ts`](/D:/code/lpc-support/src/language/services/navigation/LanguageDefinitionService.ts)：

- 单文件约 `859` 行
- 同时承担：
  - scoped method definition
  - object method definition
  - macro / include / variable / simul_efun 直达 definition
  - 当前文件 / include / inherit / simul_efun graph 的函数定义搜索
  - 路径解析、文件打开、location 归一化、缓存访问

这使它已经不仅是“定义跳转协调器”，而是一个把多类来源决策和大量低层支持机械揉在一起的热点类。

本 spec 定义导航减债路线中的 `P2-alpha`：

**在不改变 definition 产品语义的前提下，把 `AstBackedLanguageDefinitionService` 拆成可维护的 resolver/support 结构。**

这一步只处理 definition 主链，不顺手拆 `ASTManager`，也不顺手正名 `DocumentSemanticSnapshotService`。

## 2. 问题陈述

### 2.1 当前 definition service 同时承担四类来源决策

[`AstBackedLanguageDefinitionService`](/D:/code/lpc-support/src/language/services/navigation/LanguageDefinitionService.ts) 当前在单个 `provideDefinition(...)` 入口后，直接串起了四类 definition 来源：

1. `scoped method`
   - `::method()`
   - `room::method()`
2. `object method`
   - `receiver->method()`
3. `direct symbol`
   - include 语句路径
   - macro
   - simul_efun 文档直达
   - 局部/全局变量绑定
4. `function family`
   - 当前文件函数
   - include 原型/实现
   - inherit 链
   - simul_efun graph

这些来源本身边界不同、失败语义不同、依赖也不同，但目前都聚合在一个类里。

### 2.2 来源决策与低层支持机械纠缠在一起

当前类中除了来源判定，还直接混入了：

- 文件打开
  - `tryOpenTextDocument(...)`
  - `openWorkspaceDocument(...)`
  - `openInheritedDocument(...)`
- 路径解析
  - `resolveIncludeFilePath(...)`
  - `resolveInheritedFilePath(...)`
  - `resolveProjectPath(...)`
  - `getPrimaryIncludeDirectory(...)`
  - `getConfiguredSimulatedEfunFile(...)`
- 语义/位置转换
  - `getSemanticSnapshot(...)`
  - `toVsCodeLocation(...)`
  - `toSymbolLocation(...)`
  - `toLanguageLocations(...)`
- include/header 缓存
  - `includeFileCache`
  - `headerFunctionCache`

这导致：

- 很难只修改某一类 definition 来源而不碰到别的逻辑
- 很难给某一类来源写边界测试，而不借道整个 service
- 后续若继续增加 definition 来源，会继续把主类变得更厚

### 2.3 当前风险不在行为错误，而在结构不可维护

definition 当前主链已经是可用的：

- scoped definition 已落地
- object method definition 已落地
- include / inherit / simul_efun 相关回归已存在
- LSP handler / spawned runtime definition 也都已经有保护网

因此，这一轮最重要的目标不是“修 definition 行为”，而是：

**把已经成立的 definition 主链拆成边界清晰、可单测、可继续减债的结构。**

## 3. 目标与非目标

### 3.1 目标

- 让 `AstBackedLanguageDefinitionService` 从“大而全实现类”退回到协调器角色
- 把 definition 主链按来源拆成独立 resolver
- 把文件访问、路径解析、location 归一化等低层机械收进共享 support
- 保持 definition 外部 API 与产品语义不变
- 建立新的 resolver 级测试保护网，同时保留现有 service/LSP/runtime 集成回归

### 3.2 非目标

本轮 **不** 做以下事情：

- 不修改 definition 的产品语义
- 不调整 scoped / object inference / include / inherit / simul_efun 的可见结果边界
- 不重构 [`ASTManager.ts`](/D:/code/lpc-support/src/ast/astManager.ts)
- 不迁移或正名 [`documentSemanticSnapshotService.ts`](/D:/code/lpc-support/src/completion/documentSemanticSnapshotService.ts)
- 不顺手重构 hover
- 不顺手重构 signature help
- 不新增新的 definition 来源

## 4. 方案对比

### 4.1 推荐方案：协调器 + resolver + support

做法：

- 保留 `AstBackedLanguageDefinitionService` 作为公共入口
- 把来源决策拆成多个 resolver
- 把共享低层机械收进一个 support 层

优点：

- 风险最低
- 外部 API 稳定
- 可以逐步把热点类瘦下来
- 最符合当前“行为冻结、结构减债”的目标

缺点：

- 初次落地时文件数量会增加
- 需要明确 resolver/support 的依赖边界，避免只是把一个大类拆成多个相互调用的小类

### 4.2 过窄方案：只抽 helper，不拆来源 resolver

做法：

- 只把路径/打开文件/位置转换抽成 util 或 support
- 来源决策仍留在一个 definition service 里

优点：

- 改动较小

缺点：

- 无法真正降低 `LanguageDefinitionService` 的复杂度
- 主要热点仍然存在
- 后续继续减债时还得再做第二次拆分

### 4.3 激进方案：definition / hover / signature help 一起按 callable discovery 重构

做法：

- 不只拆 definition
- 同时统一 callable target discovery / documentation / source traversal

优点：

- 长期上可能更统一

缺点：

- 改动面过大
- 会把已稳定的 hover / signature help 一并拉进风险面
- 与当前 `P2-alpha` 的减债目标不匹配

### 4.4 结论

本 spec 采用 **4.1 推荐方案**：

**只拆 definition service 内部结构，不修改 definition 产品语义，也不扩展到 hover / signature help。**

## 5. 架构设计

### 5.1 总体结构

拆分后的结构建议为：

- `AstBackedLanguageDefinitionService`
  - 协调器
- `DefinitionResolverSupport`
  - 共享低层支持层
- resolver 组：
  - `ScopedMethodDefinitionResolver`
  - `ObjectMethodDefinitionResolver`
  - `DirectSymbolDefinitionResolver`
  - `FunctionFamilyDefinitionResolver`

### 5.2 协调器职责

`AstBackedLanguageDefinitionService` 保留：

- 构造注入
- 生命周期缓存清理接线
- `provideDefinition(...)` 入口
- resolver 短路顺序编排
- `LanguageLocation[]` 最终输出归一化

它不再直接承载几十个“查这个/开那个/遍历那个”的私有方法。

### 5.3 Resolver 职责边界

#### `ScopedMethodDefinitionResolver`

负责：

- `::method()`
- `room::method()`

包含逻辑：

- 光标是否落在 scoped method identifier 上
- 消费现有 `ScopedMethodResolver` 结果
- 将 scoped targets 转为 definition locations

不负责：

- object method
- include / inherit / variable
- 普通函数家族查找

#### `ObjectMethodDefinitionResolver`

负责：

- `receiver->method()`

包含逻辑：

- 消费 `ObjectInferenceService`
- 对 receiver candidates 逐个走 `TargetMethodLookup`
- 去重并返回单个或多个 location

不负责：

- scoped
- direct symbol
- 普通函数名查找

#### `DirectSymbolDefinitionResolver`

负责“能快速短路”的 definition：

- include 语句本身
- macro 定义
- simul_efun 文档直达位置
- 当前文件可见变量绑定
- 继承链可见全局变量绑定

特点：

- 命中即返回
- 不做图搜索
- 不负责普通函数家族查找

#### `FunctionFamilyDefinitionResolver`

负责“函数定义家族”查找：

- 当前文件导出函数
- include 原型/实现
- inherit 链函数
- simul_efun graph

这是当前 definition service 中最重的一组来源决策，也是本轮拆分的主收益区。

### 5.4 Shared Support 职责

`DefinitionResolverSupport` 负责共享低层机械：

- 文档打开
- workspace/path/project path 解析
- include / inherit 文件路径解析
- semantic snapshot 获取
- include statements 读取
- location / symbol / range 归一化
- include/header 缓存读取与维护
- request state 创建

它不做来源判定，不直接决定“该返回哪个 definition”。

## 6. 方法归属

### 6.1 归入 `ScopedMethodDefinitionResolver`

- `isOnScopedMethodIdentifier(...)`
- `findScopedMethodIdentifierAtPosition(...)`
- `getScopedMethodIdentifier(...)`
- `getRangeSize(...)`

### 6.2 归入 `ObjectMethodDefinitionResolver`

- `handleInferredObjectMethodCall(...)`
- `findMethodInTargetChain(...)`

### 6.3 归入 `DirectSymbolDefinitionResolver`

- `resolveDirectDefinition(...)`
- `findMacroDefinition(...)`
- `findSimulatedEfunDefinition(...)`
- `toSimulatedDocLocation(...)`
- `handleIncludeDefinition(...)`
- `resolveIncludePath(...)`
- `findVariableDefinition(...)`
- `findInheritedVariableDefinition(...)`
- `isVariableLikeSymbol(...)`

### 6.4 归入 `FunctionFamilyDefinitionResolver`

- `findFunctionDefinition(...)`
- `findFunctionDefinitions(...)`
- `findInheritedFunctionDefinitions(...)`
- `findFunctionInCurrentFileIncludes(...)`
- `findInSimulatedEfuns(...)`
- `findFunctionInSimulatedEfunGraph(...)`
- `findFunctionInFileByAST(...)`
- `findFunctionInSemanticSnapshot(...)`
- `findMethodInFile(...)`
- `getIncludeFiles(...)`
- `getHeaderFunctionIndex(...)`

### 6.5 保留在共享 support

- `createRequestState(...)`
- `toLanguageLocations(...)`
- `toVsCodeLocation(...)`
- `toVsCodeRange(...)`
- `toSymbolLocation(...)`
- `getSemanticSnapshot(...)`
- `getIncludeStatements(...)`
- `resolveIncludeFilePath(...)`
- `doResolveIncludeFilePath(...)`
- `resolveInheritedFilePath(...)`
- `openInheritedDocument(...)`
- `resolveWorkspaceFilePath(...)`
- `openWorkspaceDocument(...)`
- `tryOpenTextDocument(...)`
- `getWorkspaceRoot(...)`
- `resolveProjectPath(...)`
- `isWorkspaceAbsolutePath(...)`
- `resolveWorkspacePath(...)`
- `getPrimaryIncludeDirectory(...)`
- `getConfiguredSimulatedEfunFile(...)`
- `resolveExistingCodePath(...)`
- `ensureHeaderOrSourceExtension(...)`
- `ensureExtension(...)`
- `findInherits(...)`
- `resolveExistingIncludeFiles(...)`

## 7. 调用顺序与失败语义

### 7.1 调用顺序

`provideDefinition(...)` 的短路顺序保持为：

1. `ScopedMethodDefinitionResolver`
2. `ObjectMethodDefinitionResolver`
3. `DirectSymbolDefinitionResolver`
4. `FunctionFamilyDefinitionResolver`

这个顺序必须与当前行为等价，不因“结构更优雅”而调整。

### 7.2 Scoped 失败语义

- 只有当光标落在 scoped method identifier 上时才允许返回结果
- qualifier 位置、参数位置、`unsupported`、`ambiguous`
  - 一律返回 `undefined`
- 不允许失败后回退到普通函数 definition

### 7.3 Object Method 失败语义

- 只有 `ObjectInferenceService` 返回有效 receiver candidates 且成员名匹配当前单词时才介入
- `unknown / unsupported`
  - 返回 `undefined`
- 多目标保留多 location，但继续维持当前去重语义

### 7.4 Direct Symbol 失败语义

- include / macro / simul_efun doc / variable binding 命中则短路
- 未命中时返回 `undefined`
- 不引入任何新的猜测型 fallback

### 7.5 Function Family 失败语义

- 只沿当前已有的函数定义搜索链查找
- 找不到就返回 `undefined`
- 不引入新的工作区扫描
- 不扩大当前 include / inherit / simul_efun graph 之外的范围

## 8. 测试策略

### 8.1 保留现有 service 级主保护网

必须继续保持全绿：

- [`LanguageDefinitionService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts)
- [`navigationServices.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/navigationServices.test.ts)
- [`navigationHandlers.test.ts`](/D:/code/lpc-support/src/lsp/server/__tests__/navigationHandlers.test.ts)
- [`spawnedRuntime.integration.test.ts`](/D:/code/lpc-support/src/lsp/__tests__/spawnedRuntime.integration.test.ts)

### 8.2 新增 resolver 级测试

每个新 resolver 只需要最小边界保护网，不复制整套 service 行为测试。

重点覆盖：

- 返回 `undefined` 的条件
- 短路顺序是否被尊重
- 多目标去重是否保持
- direct symbol 与 function family 是否没有串线

### 8.3 新增顺序回归

需要至少新增以下顺序测试：

- scoped 命中时，不会继续掉入 direct symbol / function family
- object method 命中时，不会继续掉入 direct symbol / function family
- direct symbol 命中时，不会继续掉入 function family
- function family 仍能处理 prototype / include / inherit / simul_efun 老路径

## 9. 实施边界

### 9.1 本轮做什么

- 新增 resolver/support 文件
- 把 `LanguageDefinitionService` 内部逻辑迁移过去
- 更新现有测试并补 resolver 级测试
- 保持外部 API 和 definition 语义不变

### 9.2 本轮不做什么

- 不动 hover
- 不动 signature help
- 不动 `ASTManager`
- 不动 `DocumentSemanticSnapshotService`
- 不借这次拆分去统一 callable discovery 主链

## 10. 风险与缓解

### 风险 1：结构拆开后行为顺序漂移

缓解：

- 把 resolver 调用顺序写死
- 增加顺序短路回归
- 保持现有 service / handler / runtime definition 回归全绿

### 风险 2：support 变成新的 god object

缓解：

- support 只保留低层共享机械
- 不允许 support 直接做来源判定
- 若后续 support 再次膨胀，应单独立项减债，而不是在本轮扩范围

### 风险 3：resolver 拆分后互相串调，边界名义存在但实际仍纠缠

缓解：

- resolver 只通过协调器和 support 共享能力
- 不让 resolver 直接互相调用
- 依赖通过 `DefinitionResolverContext` 收敛，而不是各自再拼一套 host/config 访问

## 11. 设计结论

本轮 `P2-alpha` 的最佳切口不是动 `ASTManager`，也不是先正名 `DocumentSemanticSnapshotService`，而是：

**先把当前最厚、最集中、最容易继续膨胀的 `AstBackedLanguageDefinitionService` 拆成“协调器 + resolver + support”。**

这样做的价值在于：

- 不改 definition 产品语义
- 先降低导航热点服务的维护风险
- 为后续更大的 `P2` 减债提供清晰边界

因此，下一步 implementation plan 应围绕：

- `ScopedMethodDefinitionResolver`
- `ObjectMethodDefinitionResolver`
- `DirectSymbolDefinitionResolver`
- `FunctionFamilyDefinitionResolver`
- `DefinitionResolverSupport`

这 5 个构件来展开，而不是继续在单个 `LanguageDefinitionService` 里追加更多私有方法。
