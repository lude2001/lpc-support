# 对象推导系统设计文档

## 1. 概述

对象推导（Object Inference）是 lpc-support 的核心能力之一，用于在 `obj->method()` 形式的成员访问表达式中，静态推导出 `obj` 所指向的 LPC 对象文件路径，从而为 Definition、Completion、Hover 和 Signature Help 四条 Provider 链提供精确的跳转、补全和文档查询基础。

核心设计原则是：统一的 `ObjectInferenceService` 作为唯一入口，被多个语言服务共享调用，避免各 Provider 各自实现推导逻辑。

自 `0.43.0` 起，`::method()` 与 `room::method()` 这类显式父对象 / inherit 分支调用也已经进入主语言服务链，但它们不走 `ObjectInferenceService` 的 `obj->method()` 接收者推导机械，而是由相邻的 `ScopedMethodResolver` / `ScopedMethodReturnResolver` 负责解析。自 `0.44.0` 起，这条 scoped 链又继续接入了 `ScopedMethodDiscoveryService` / `ScopedMethodCompletionSupport`，从而把 scoped 调用补全也统一收敛到同一套 callable-documentation、definition、hover、signature help 与返回对象传播主路径。`0.45.0` 曾尝试引入工作区级 `references / rename`；自 `0.45.1` 起，导航主路径重新收窄为“当前文件级 + 可证明继承链级”的保守边界，旧的 `Workspace*` relation 栈也已退场，不再属于当前生产导航架构。
自 `0.43.0` 起，`::method()` 与 `room::method()` 这类显式父对象 / inherit 分支调用也已经进入主语言服务链，但它们不走 `ObjectInferenceService` 的 `obj->method()` 接收者推导机械，而是由相邻的 `ScopedMethodResolver` / `ScopedMethodReturnResolver` 负责解析。自 `0.44.0` 起，这条 scoped 链又继续接入了 `ScopedMethodDiscoveryService` / `ScopedMethodCompletionSupport`，从而把 scoped 调用补全也统一收敛到同一套 callable-documentation、definition、hover、signature help 与返回对象传播主路径。`0.45.0` 曾引入工作区级 `references` / 安全 `rename` 尝试；自 `0.45.1` 起，导航链重新收窄为“当前文件级 + 可证明继承链级”的保守边界：函数 `references` 不再做工作区级名字扩散，`rename` 仅保留局部变量、函数参数和文件级全局变量，旧的 `Workspace*` relation 栈也已退场，不再属于当前生产导航架构。

## 2. 架构总览

```
用户输入 obj->method()
         │
    SyntaxDocument（syntax 层提供 MemberAccessExpression 节点）
         │
    ObjectInferenceService.inferObjectAccess()
         │
    ┌────┴────┐
    │ 接收者分类 │  ReceiverClassifier
    │ literal  │
    │ macro    │
    │ identifier│
    │ call     │
    │ index    │  → unsupported
    └────┬────┘
         │
    ┌────┴─────────┐
    │ 候选路径解析   │  ReturnObjectResolver / ObjectCandidateResolver
    │ this_object() │
    │ this_player() │  ← playerObjectPath from lpc-support.json
    │ load_object() │
    │ find_object() │
    │ clone_object()│
    │ 当前文件全局绑定 │  GlobalObjectBindingResolver
    │ 继承链全局绑定 │  InheritedGlobalObjectBindingResolver
    │ 变量追踪      │  ReceiverTraceService
    │ doc 返回对象   │  @lpc-return-objects
    └────┬─────────┘
         │
    ObjectCandidateResolver.resolve()
         │
    ┌────┴────┐
    │ 结果状态 │  resolved / multiple / unknown / unsupported
    └────┬────┘
         │
    ┌────┼────────────┐
    │    │             │
  Definition       Completion      Hover
  Provider         Provider        Provider
```

数据流说明：

1. 用户在编辑器中触发操作（跳转定义、补全、悬停）
2. Provider 调用 `ObjectInferenceService.inferObjectAccess(document, position)`
3. 服务从 `SyntaxDocument` 中定位最近的 `MemberAccessExpression` 节点（限定 `->` 运算符）
4. 将接收者表达式交给 `ReceiverClassifier` 分类
5. 根据分类结果，分别走字面量解析、宏展开、内建调用解析、当前文件全局绑定、继承链全局绑定、变量追踪等路径
6. 收集到的候选经 `ObjectCandidateResolver` 去重后生成最终结果
7. 各 Provider 根据结果状态（`resolved` / `multiple` / `unknown` / `unsupported`）决定后续行为

## 3. 核心模块

### 3.1 类型定义 — `src/objectInference/types.ts`

定义推导系统所有核心数据结构：

- **`ObjectCandidate`**：候选对象，包含 `path`（解析后的绝对路径）和 `source`（来源标记：`literal` / `macro` / `builtin-call` / `assignment` / `doc`）
- **`ObjectInferenceResult`**：推导结果，包含 `status`（`resolved` / `multiple` / `unknown` / `unsupported`）、`candidates` 列表和可选 `reason`
- **`ClassifiedReceiver`**：分类后的接收者，联合类型，区分 `literal`、`macro`、`identifier`、`call`、`index`、`unsupported` 六种形态
- **`InferredObjectAccess`**：完整的推导上下文，包含 `receiver`（原始文本）、`memberName`（成员名）和 `inference`（推导结果）

### 3.2 接收者分类 — `src/objectInference/ReceiverClassifier.ts`

职责：将 `MemberAccessExpression` 的接收者节点分类为 `ClassifiedReceiver` 的某个变体。

关键逻辑：

- `ParenthesizedExpression`：透传，分类内部表达式
- `Literal`：若为字符串字面量则标记为 `literal`，否则为 `unsupported`
- `Identifier`：标记为 `identifier`（可能是变量名或宏名）
- `CallExpression`：标记为 `call`，提取 callee 名称、参数数量和首个参数文本，同时校验内建函数的参数数量
- `IndexExpression`：直接标记为 `index`（不支持）
- 其余：标记为 `unsupported`

内建调用校验表：

| 函数 | 期望参数数量 |
|------|-------------|
| `this_object` | 0 |
| `this_player` | 0 |
| `load_object` | 1 |
| `find_object` | 1 |
| `clone_object` | 1 |

### 3.3 返回对象解析 — `src/objectInference/ReturnObjectResolver.ts`

职责：解析调用表达式、标识符（宏）为对象候选路径。

核心方法：

- **`resolveExpressionOutcome(document, expression)`**：统一入口，分类表达式后分派到具体解析路径
- **`resolveCall(document, receiver)`**：处理内建函数调用
  - `this_object()` → 当前文档路径
  - `this_player()` → 配置的 `playerObjectPath`
  - `load_object(path)` / `find_object(path)` / `clone_object(path)` → 通过 `PathResolver.resolveObjectPath` 解析参数路径
- **`resolveDocumentedReturnObjects(document, functionName)`**：从当前文件的 `@lpc-return-objects` 注释中提取返回对象路径

### 3.4 变量追踪 — `src/objectInference/ReceiverTraceService.ts`

职责：在当前函数作用域内追踪变量赋值，推导标识符接收者的来源。

核心方法：

- **`traceIdentifier(document, syntax, identifierNode)`**：入口方法，定位包含函数后执行追踪
- **`traceIdentifierInFunction(...)`**：递归追踪，支持标识符传递（`a = b`，追踪 `b`），通过 `visited` 集合防止循环

流分析策略：

- **直线赋值**：最后一次赋值胜出
- **块作用域**：内部声明的 `VariableDeclarator` 会遮蔽外层同名绑定
- **if/else 合并**：对两条分支分别收集，若结果一致则合并候选，否则保守降级为 `unknown`
- **不支持的控制流**：`while`、`do-while`、`for`、`foreach`、`switch` 中若存在对追踪变量的写入，整体降级为 `unknown`

绑定解析：

- 首先检查函数参数绑定
- 然后按位置顺序扫描 `VariableDeclarator`，找到最近的同名声明
- 赋值追踪时校验绑定一致性（同一声明节点的赋值才视为对同一变量的写入）

### 3.5 候选去重与结果生成 — `src/objectInference/ObjectCandidateResolver.ts`

职责：接收候选列表和可选的失败原因，生成最终的 `ObjectInferenceResult`。

规则：

| 条件 | 状态 |
|------|------|
| 去重后无候选 + 有 `unsupported-expression` 原因 | `unsupported` |
| 去重后无候选 + 无原因 | `unknown` |
| 去重后恰好一个候选 | `resolved` |
| 去重后多个候选 | `multiple` |

### 3.6 推导服务入口 — `src/objectInference/ObjectInferenceService.ts`

职责：统一编排推导流程，是所有 Provider 调用的唯一入口。

构造参数：

- `macroManager?: MacroManager` — 宏管理器，用于宏展开
- `playerObjectPath?: string` — `this_player()` 对应的玩家对象路径

核心方法：

- **`inferObjectAccess(document, position)`**：完整推导流程
  1. 获取 `SyntaxDocument`（优先缓存，必要时重建）
  2. 调用 `findMemberAccess` 定位 `->` 运算符的 `MemberAccessExpression` 节点（选择范围最小的，即最内层的）
  3. 分类接收者 → 解析候选 → 生成结果

分派逻辑（`resolveCandidates`）：

| 分类 | 解析路径 |
|------|---------|
| `literal` | `PathResolver.resolveObjectPath` → 单候选 |
| `macro` | `PathResolver.resolveObjectPath` → 单候选 |
| `call` | `ReturnObjectResolver.resolveExpressionOutcome` |
| `identifier` | 先尝试 `ReceiverTraceService.traceIdentifier`，无结果时尝试宏解析 |
| `unsupported` / `index` | 返回空候选 |

## 4. 推导规则详解

### 4.1 强规则（确定性推导）

以下场景可以确定性地解析出对象路径：

**字符串字面量**

```
"/adm/daemons/combat_d"->start()
```

直接提取路径字符串，通过 `PathResolver.resolveObjectPath` 解析为绝对路径。

**this_object()**

```
this_object()->query()
```

返回当前文档的文件路径。

**this_player()**

```
this_player()->query_name()
```

返回 `lpc-support.json` 中配置的 `playerObjectPath`。若未配置则无候选。

**load_object / find_object / clone_object**

```
load_object("/adm/daemons/combat_d")->start()
find_object(COMBAT_D)->query()
clone_object("/obj/weapon")->wield()
```

解析第一个参数（支持字符串字面量和宏），通过 `PathResolver.resolveObjectPath` 解析路径。

**宏标识符**

```
COMBAT_D->start()
```

通过 `MacroManager` 展开宏值为路径字符串，再通过 `PathResolver` 解析。

### 4.2 变量追踪

追踪在当前函数作用域内的变量赋值链：

**直线追踪**

```c
void test() {
    object ob = load_object("/adm/daemons/combat_d");
    ob->start();          // 推导为 /adm/daemons/combat_d
}
```

**标识符传递**

```c
void test() {
    object ob = load_object("/adm/daemons/combat_d");
    object ob2 = ob;
    ob2->start();         // 追踪 ob → load_object → /adm/daemons/combat_d
}
```

**多次赋值覆盖**

```c
void test() {
    object ob = load_object("/adm/daemons/combat_d");
    ob = find_object("/adm/daemons/health_d");
    ob->start();          // 推导为 /adm/daemons/health_d
}
```

**块作用域遮蔽**

```c
void test() {
    object ob = load_object("/adm/daemons/combat_d");
    {
        object ob = load_object("/adm/daemons/health_d");
        ob->query();      // 内层 ob → /adm/daemons/health_d
    }
    ob->start();          // 外层 ob → /adm/daemons/combat_d
}
```

**if/else 合并**

```c
void test() {
    object ob;
    if (condition) {
        ob = load_object("/adm/daemons/combat_d");
    } else {
        ob = load_object("/adm/daemons/combat_d");
    }
    ob->start();          // 两个分支结果相同 → resolved
}
```

若两个分支解析结果不同，保守降级为 `unknown`。

**不支持的控制流**

在 `while`、`for`、`foreach`、`do-while`、`switch` 语句中，若存在对追踪变量的写入，整体降级为 `unknown`，因为静态分析无法确定循环执行次数和分支选择。

### 4.3 文档注释推导

当调用表达式不是内建函数时，`ReturnObjectResolver` 会尝试从当前文件的 Javadoc 注释中提取 `@lpc-return-objects` 标注：

```c
/**
 * @lpc-return-objects /adm/daemons/combat_d /adm/daemons/health_d
 */
object get_helper() {
    ...
}

get_helper()->query();   // 候选：combat_d 和 health_d → status: multiple
```

每条路径通过 `PathResolver.resolveObjectPath` 解析，来源标记为 `doc`。

### 4.4 保守降级语义

| 状态 | 含义 |
|------|------|
| `resolved` | 恰好解析到一个候选对象 |
| `multiple` | 解析到多个候选对象（如 if/else 分支不同、文档注释列出多个） |
| `unknown` | 无法确定路径（如未识别的宏、动态路径、未配置 playerObjectPath） |
| `unsupported` | 结构上不可推导（如数组索引访问、数字字面量、动态字符串拼接） |

## 5. Provider 消费方式

### 5.1 Definition Provider

文件：`src/definitionProvider.ts`

调用方式：

1. 在 `provideDefinition` 中调用 `inferObjectAccess(document, position)`
2. 若推导结果的 `memberName` 与光标所在单词一致，进入 `handleInferredObjectMethodCall`
3. 对每个候选路径调用 `findMethodInTargetChain`
4. `findMethodInTargetChain` 递归遍历目标文件的 `inherit` 语句链，在整条继承链中查找方法定义
5. 按 `(file, line, character)` 三元组去重，返回所有匹配的 `vscode.Location`

对 `multiple` 状态，Provider 返回所有候选的查找结果，让 VS Code 展示多定义列表。

对 `unknown` / `unsupported` 状态，Provider 回退到其他定义查找策略（函数定义、宏定义等）。

### 5.2 Completion Provider

文件：`src/completionProvider.ts`

调用方式：

1. 在 `resolveCompletionCandidates` 中异步调用 `inferObjectAccess(document, position)`
2. 仅对 `member` 上下文触发推导
3. `unknown` 和 `unsupported` 状态时回退到继承回退候选
4. `resolved` 和 `multiple` 状态时，调用 `buildObjectMemberCandidates` 从候选对象文件中提取真实方法列表
5. 方法候选按名称分组，共享方法优先排列
6. 若有输入前缀，仅返回推导结果；否则合并推导结果与回退候选

### 5.3 Hover Provider

文件：`src/objectInference/ObjectHoverProvider.ts`

调用方式：

1. 在 `provideHover` 中调用 `inferObjectAccess(document, position)`
2. `unknown` 和 `unsupported` 状态直接返回 `undefined`
3. 校验光标是否在成员名位置（`isHoveringMemberName`）
4. 调用 `loadMethodDocsFromCandidates` 从候选文件中加载方法文档
5. 内部通过 `findMethodDocsInChain` 沿 `inherit` 链递归查找方法文档
6. 单一文档来源时：显示方法签名 + 描述
7. 多候选或多文档来源时：显示候选对象路径汇总提示

### 5.4 Scoped 方法解析（0.43.0-0.44.0）

`::method()` 与 `room::method()` 不属于 `obj->method()` 的对象接收者推导，但它们现在与对象推导共享同一套 syntax / semantic / callable-documentation 主路径。

当前实现：

- `src/objectInference/ScopedMethodResolver.ts`
  - 负责解析裸 `::method()` 与具名 `room::method()`
  - 只沿 inherit 图做查找，不回退到当前文件、include、普通函数、模拟函数或 efun
  - qualifier 歧义、direct inherit 未解析或父链不完整时，保守降级为 `unknown`
- `src/objectInference/ScopedMethodDiscoveryService.ts`
  - 负责枚举裸 `::` 与具名 `room::` 前缀下可补全的方法候选
  - 复用同一套 scoped inherit 遍历规则，不把“已写出的具体调用解析”与“前缀候选发现”混成一台装置
- `src/objectInference/ScopedMethodReturnResolver.ts`
  - 负责把 scoped 方法命中的实现继续接入 `@lpc-return-objects` 返回对象传播
  - `::factory()` / `room::factory()` 的返回对象可以继续流向后续 `ob->method()` 对象方法解析
- `src/language/services/completion/ScopedMethodCompletionSupport.ts`
  - 负责把 scoped discovery 结果转换为补全候选，并为 completion item resolve 提供 declaration-based 文档装配

消费侧：

- Completion：支持 `::method()` / `room::method()` scoped 调用补全，且 discovery 仍严格保持 inherit-only 与 qualifier 唯一匹配语义
- Definition：支持 `::method()` / `room::method()` 直接跳转到父实现或指定 inherit 分支实现
- Hover：支持 scoped 方法文档悬停，且只在 callee 方法标识符位置触发
- References / Rename：导航侧当前刻意保持“当前文件级 + 可证明继承链级”的保守边界，不再尝试为函数提供工作区级静态调用图或函数级重命名
- Signature Help：支持 scoped 调用进入统一 callable-documentation 签名帮助链

当前这条链仍然是“保守可证明优先”：

- 结构不支持的 `Foo::bar()` 继续返回 `unsupported`
- qualifier 歧义、未解析 direct inherit、动态 inherit 或不完整父链返回 `unknown`
- scoped completion 在上述失败场景下保守返回空候选，不回退到当前文件普通函数、模拟函数或 efun 候选

## 6. 配置

推导系统依赖以下外部配置：

**`lpc-support.json` — `playerObjectPath`**

用于 `this_player()` 的推导。当 `this_player()->method()` 出现时，系统将 `playerObjectPath` 指定的文件路径作为候选。

**宏解析依赖**

`MacroManager` 使用 `lpc-support.json` 中的 `includeDirectories` 配置来扫描和解析宏定义。宏标识符（如 `COMBAT_D`）能否正确展开，取决于 `#define` 所在文件是否在 `includeDirectories` 范围内。

## 7. 测试覆盖

| 测试文件 | 覆盖范围 |
|---------|---------|
| `src/objectInference/__tests__/ObjectInferenceService.test.ts` | 推导服务完整流程：字面量、宏、内建调用、变量追踪、块作用域、if/else 合并、控制流降级、传递追踪、文档注释返回对象 — 38 个用例 |
| `src/objectInference/__tests__/ScopedMethodResolver.test.ts` | scoped 方法解析：裸 `::method()`、`room::method()`、inherit-only 约束、多 direct inherit、未解析 inherit 保守降级 |
| `src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts` | scoped 方法候选发现：裸 `::` / `room::` 前缀、多 direct inherit、qualifier 唯一匹配、未解析 inherit / 歧义保守失败 |
| `src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts` | scoped 方法返回对象传播：multi-target merge、missing-annotation blocker、空候选保守语义 |
| `src/objectInference/__tests__/ObjectHoverProvider.test.ts` | Hover Provider：单一候选文档展示、多候选提示、无匹配方法回退 — 5 个用例 |
| `src/__tests__/providerIntegration.test.ts` | Definition Provider 集成：对象推导与 scoped 返回传播到真实跨文件定义的完整链路验证 |
| `src/__tests__/completionProvider.test.ts` | Completion Provider 集成：推导结果到补全候选的完整链路验证 |
| `src/__tests__/completionContextAnalyzer.test.ts` / `src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts` / `src/language/services/completion/__tests__/LanguageCompletionService.test.ts` | scoped completion 上下文识别、候选构建、declaration-based 文档 resolve 与 service 级保守降级 |
| `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts` | scoped method / object method / ordinary callable 的统一签名帮助行为 |
| `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts` / `navigationServices.test.ts` | scoped definition / hover 的 consumer 边界、多行 `::` 与 qualifier / argument 防误触回归 |

## 8. 已知限制与后续方向

**当前仍不支持的场景**

- `arr[i]->method()` — 数组索引访问无法静态确定具体对象
- 跨函数变量追踪 — 当前仅追踪同一函数内的赋值链，不跨函数边界
- 动态路径拼接 — 如 `"/adm/" + name + "_d"` 形式的路径无法静态解析
- 动态 inherit 路径或运行时才能确定的 inherit 目标
- `previous_object()` 等运行时依赖的 efun — 需要调用栈信息，不适合静态推导

**代码重复**

`ObjectHoverProvider.ts` 中的 `resolveInheritedFilePath` 与 `definitionProvider.ts` 中的同名方法存在逻辑重复。后续可提取为共享工具函数，统一 inherit 路径解析逻辑。

**后续增强方向**

- 支持跨函数的变量类型传播（通过函数参数类型标注或全局变量追踪）
- 利用 `SemanticSnapshot` 的函数签名信息增强参数对象推导
- 对 `call_other` 等 efun 的特殊处理
