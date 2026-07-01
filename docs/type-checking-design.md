# LPC 类型检查首版最终方案

## 背景

当前 `lpc-support` 已经具备 parser / syntax / semantic 分层，以及诊断链路所需的跨文件可见符号解析能力。现有诊断已经覆盖未定义符号、函数参数数量、未使用变量、对象访问等问题，但还没有一个独立的类型检查系统。

参考项目 `tmp/external-lpc-language-server` 提供了一套完整 TypeScript checker 风格的 LPC 类型系统。它的价值主要在 LPC 类型规则和测试案例，而不是整体架构。该项目的 checker 依赖完整 binder、flow node、signature resolution、union / intersection、contextual typing 和 overload 选择状态机，不能直接搬入当前主路径。

本设计的目标是：第一版就覆盖足够大的真实问题面，但每一条诊断都必须满足“可证明”原则。宁可在动态、宏、依赖不完整或类型不确定时静默，也不要用猜测制造误报。

## 设计目标

- 建立独立的 LPC 类型模型和类型兼容性服务。
- 在不修改 parser 主路径、不重新扫描全文、不复活 legacy parse cache 的前提下，实现首版类型检查。
- 覆盖显式声明类型与表达式类型之间的可证明不兼容。
- 复用 `SyntaxDocument`、`SemanticSnapshot`、`DiagnosticSymbolResolver` 和 efun / simul-efun 文档类型。
- 同时支持 VS Code extension 与 LSP shared diagnostics 链路。
- 所有诊断默认是保守 warning，且带稳定 code，便于后续配置、测试和过滤。

## 非目标

- 不复制参考项目的完整 checker。
- 不实现完整控制流分析、缺失 return 分析或路径敏感类型收窄。
- 不把类型守卫 narrowing 作为首版必须交付项；首版只预留 narrowing context，不承诺完整 flow graph。
- 不实现 TypeScript 风格的 generic、conditional type、mapped type、contextual typing。
- 不在首版支持完整 union / intersection 语义。
- 不把 parser / syntax / semantic 的产物统称或改造成新的泛化 AST。
- 不让 provider 或 collector 重新扫全文推断结构。
- 不把 `src/parseCache.ts` 或 `src/core/ParseCache.ts` 重新变成生产真源。
- 不把工作区全局索引作为长期语义真源。

## 核心原则

### 可证明原则

类型检查只在以下条件同时满足时发出诊断：

1. 期望类型可证明。
2. 实际表达式类型可证明。
3. 两侧类型都不是 `mixed` / `unknown`。
4. 相关 include / inherit / efun / simul-efun 依赖状态完整。
5. 表达式不包含无法解析的宏、spread、missing、opaque 或动态调用形态。
6. 诊断规则本身来自明确的 LPC 类型兼容关系，而不是项目风格猜测。

任何一个条件不满足，都应该返回 `unknown` 或静默。

### 大范围但保守

首版范围不应小到只做函数 arity。变量初始化、普通赋值、return、函数实参、函数返回、数组 literal、mapping literal 和常见运算符都进入首版。

但每个子能力都必须有降级出口：遇到动态 LPC 写法、依赖未解析或类型不完整时，不报错。

### 分层边界

- parser 层仍只负责 token、trivia、基础 parse diagnostics。
- syntax 层仍只负责稳定结构节点和轻量 metadata。
- semantic 层仍只负责声明摘要、作用域、include / inherit / macro 等结构事实。
- type checking 层负责表达式类型推导、类型兼容性和诊断策略。
- diagnostics 层只负责把类型事实转换为 `vscode.Diagnostic`，不拥有公共类型模型。

## 架构总览

```text
Diagnostics request
        |
        v
DiagnosticContext
  - ParsedDocument
  - SyntaxDocument
  - SemanticSnapshot
  - workspace context
        |
        v
DiagnosticSymbolResolver
  - current file functions / globals / types
  - include symbols
  - inherited symbols
  - header owner context
  - efun / simul-efun callable docs
        |
        v
DiagnosticTypeFacts
  - request-scoped visible symbols
  - macro suppression facts
  - type checking options
        |
        v
TypeDiagnosticsCollector
        |
        +--> LpcTypeParser
        +--> ScopeSymbolTypeResolver
        +--> CallableTypeSignatureBuilder
        +--> optional TypeNarrowingLookup
        +--> ExpressionTypeEvaluator
        +--> LpcTypeRelation
        +--> TypeDiagnosticPolicy
        |
        v
vscode.Diagnostic[]
```

## 核心模块

### 模块落点

类型模型、类型关系、表达式类型推导和类型收窄接口放在可复用的类型内核中，目录为 `src/typeChecking/`。诊断 collector 只放在 `src/diagnostics/collectors/TypeDiagnosticsCollector.ts`。

这样可以避免把未来 hover、completion、definition 或 LSP typed hover 需要复用的类型事实绑死在 diagnostics 包下。首版不把公共能力做成诊断私有实现。

`src/typeChecking/` 是语言层类型内核，不应 import `vscode`。它只接收 syntax / semantic / plain data，并返回 `LpcType`、兼容性结果或可诊断的结构化问题。`TypeDiagnosticsCollector` 才负责把结构化问题转换为 `vscode.Diagnostic`；shared diagnostics adapter 继续负责 VS Code diagnostic 与 LSP diagnostic 的转换。

### `LpcType`

放在 `src/typeChecking/LpcType.ts`。

职责：把现有字符串类型规范化成可判断的数据结构。

首版字段：

- `kind`: `primitive` / `class` / `struct` / `array` / `mapping` / `function` / `unknown`
- `name`: 原始或规范化基础名，如 `int`、`string`、`object`、`Payload`
- `pointerDepth`: LPC `*` 深度
- `elementType?`: 数组元素类型
- `keyType?`: mapping key 类型
- `valueType?`: mapping value 类型
- `sourceText`: 原始类型文本
- flags: `isMixed`、`isUnknown`、`isVoid`、`isZeroLiteral`

首版类型解析优先复用 `src/ast/typeNormalization.ts` 已有能力，不在生产主路径新增 parser。

### `LpcTypeRelation`

放在 `src/typeChecking/LpcTypeRelation.ts`。

职责：回答 `isAssignable(source, target)`。

首版兼容规则：

- `unknown` 静默，不判定为错误。
- `mixed` 静默，作为 top-like 类型处理。
- 相同 normalized 类型兼容。
- `0` 可赋给任何类型。
- `int`、`float`、`status` 属于数值域，数值域内部按 LPC 习惯保守兼容。
- `string` 只兼容 `string`、`mixed`、`unknown` 和 `0` 特例。
- `bytes` 只兼容 `bytes`、`mixed`、`unknown` 和 `0` 特例。
- `object` 与 `class` / `struct` 首版不互相兼容；`class` / `struct` 只按名称相等兼容，不做结构化对象子类型。
- `T *` 与数组 literal 的 `array<T>` 做浅层元素兼容。
- `mapping` 与 mapping literal 做浅层 key / value 兼容；value 多槽位首版降级为 `unknown`。
- `closure` 可接受函数值或 closure literal。
- `void` 不可作为普通表达式值赋给非 `void` 目标。

不采用参考项目 `strictObjectTypes=false` 的宽松 object fallback，避免吞掉真实错误。

### `CallableTypeSignature`

在 `src/diagnostics/semantic/DiagnosticSymbolResolver.ts` 扩展现有 `DiagnosticCallableSignature`。不在 type checking 层另建一套长期签名结构。

首版字段：

- `name`
- `requiredParameterCount`
- `maxParameterCount?`
- `isVariadic`
- `source`
- `returnType?: string`
- `parameters: { name?: string; dataType?: string; optional?: boolean; variadic?: boolean }[]`

当前 `CallableDoc` 已保存 efun / simul-efun 的 `returnType` 和参数 `type`，但诊断签名映射时丢掉了类型信息。首版需要把这部分带入类型检查。

扩展 `DiagnosticCallableSignature` 时必须同时覆盖两条转换链：

- `FunctionSummary` / `SemanticSnapshot.exportedFunctions` 转换链，保留函数声明返回类型和参数 `dataType`。
- `CallableDoc` / efun / simul-efun 文档转换链，保留 `signature.returnType` 和 `parameter.type`。

注意：现有 LPCDoc tag parser 对复杂类型的支持不足。`@return` 的类型目前主要来自函数声明，`@param` 只适合单 token 类型。首版可以先保留声明签名和 efun/simul-efun 文档中已结构化的类型；任何依赖 `@returns {x is T}`、`mapping<K,V>` 或带空格对象类型的能力，必须先扩展 LPCDoc type parser，并增加独立测试。

### `DiagnosticTypeFacts`

放在 `src/diagnostics/semantic/DiagnosticTypeFacts.ts`，并从 diagnostics semantic barrel 统一导出。

职责：在一次 diagnostics request 内共享类型检查需要的诊断事实。

首版字段：

- `visibleSymbols: VisibleDiagnosticSymbols`
- `macroSuppression` 或可复用的 macro range 判断工具
- `options: TypeCheckingOptions`

`VisibleDiagnosticSymbols` 已经包含 `callableSignatures` 和 `hasUnresolvedDependencies`，`DiagnosticTypeFacts` 不应再并列复制一份 callable signature 数组或 dependency flag。类型检查应始终通过同一份 `visibleSymbols` 读取 callable、global、type 和 unresolved dependency 状态，避免 BasicSemantic 与 TypeDiagnostics 看到不同事实。

首版 options：

```ts
interface TypeCheckingOptions {
    enabled: boolean;
}
```

options 来源必须是 shared diagnostics options，不允许 collector 或 `src/typeChecking/` 直接读取 `vscode.workspace.getConfiguration()`。

当前 `LanguageDiagnosticsService` 会按 batch 并行运行 collector，因此 `TypeDiagnosticsCollector` 不能再单独调用一次 `DiagnosticSymbolResolver`。否则会和 `BasicSemanticDiagnosticsCollector` 重复 include / inherit / efun / simul-efun 解析，也会让两个 collector 对依赖状态的判断分叉。

实现方式：

1. 在 shared diagnostics 层创建 request-scoped `DiagnosticFactsProvider`。
2. 将 provider 挂到 `DiagnosticContext`，例如 `context.diagnosticFactsProvider`。
3. `BasicSemanticDiagnosticsCollector` 与 `TypeDiagnosticsCollector` 都通过 provider 获取同一份 `DiagnosticTypeFacts`。
4. provider 内部按文档版本和配置 generation 缓存 promise，保证并发 batch 下只解析一次。

facts 生命周期必须是单次 diagnostics request。cache key 至少包含 `uri + document version + workspace root/config generation`，并用 promise 去重；不能依赖 collector 执行顺序，也不能依赖 shared adapter 临时构造的 `TextDocument` 对象身份。`BasicSemanticDiagnosticsCollector` 之后接入只是诊断列表的组织顺序，不是数据依赖。

### `ScopeSymbolTypeResolver`

放在 `src/typeChecking/ScopeSymbolTypeResolver.ts`。

职责：按位置解析标识符类型。

解析顺序：

1. 声明顺序安全的局部/参数 lookup，用于局部变量和参数。
2. 当前文件 `semantic.fileGlobals`。
3. `VisibleDiagnosticSymbols.fileGlobals`，用于 include / inherit / header owner 暴露的全局变量。
4. 函数名作为 callable，不直接当普通值；只有在 closure 场景下才产生函数值类型。
5. 找不到或有歧义时返回 `unknown`。

不能直接把 `semantic.symbolTable.findSymbol(name, position)` 当作完整答案。当前 symbol table 只按作用域范围找符号，不保证声明位置早于引用位置。同一 block 中后声明的变量不能被前面的表达式当成已知类型。实现时必须额外校验 symbol declaration range / start offset，或建立 declaration-order-aware lookup。

该模块不得自己扫描源码块结构；作用域事实来自 semantic。

### `TypeNarrowingLookup`

放在 `src/typeChecking/TypeNarrowingLookup.ts`，首版只定义 evaluator 接口所需的最小查询类型，不落一个空实现类。

职责：为后续类型守卫机制预留分支内临时类型覆盖表。

参考项目支持两类类型守卫：

- LPC 内建谓词：`arrayp(x)` / `pointerp(x)` / `mapp(x)` / `stringp(x)` / `objectp(x)` / `undefinedp(x)`。
- LPCDoc 用户自定义谓词：`@returns {x is string}`、`@returns {x is "object.c"}`。

这些机制很有价值，但完整实现依赖 flow analysis：需要处理 `if` / `else`、否定条件、短路表达式、嵌套条件、循环、赋值失效和分支合并。参考项目通过完整 flow node 和 `narrowTypeByTypePredicate` / `narrowTypeByCallExpression` 完成，不适合首版直接复制。

首版只定义 evaluator 参数入口：

- `getNarrowedType(name, position)`：查询当前位置是否存在临时收窄类型。
- 默认不传入 narrowing lookup，不改变任何诊断结果。
- 不实现 `withNarrowing`、分支栈或 flow state，避免为未来能力提前引入空抽象。

首版后的第一扩展实现极小白区：

```c
if (stringp(value)) {
    string s = value;
}
```

限制条件：

- predicate 参数必须是单个 identifier。
- 只作用于 then 分支。
- 分支内一旦该 identifier 被重新赋值，收窄失效。
- 不处理循环、复杂布尔表达式、`else` 反向收窄和用户自定义 predicate。

用户自定义 `@returns {x is T}` 放在更后阶段，前提是 callable documentation/signature 已经能保存 predicate target 和 predicate type。

### `ExpressionTypeEvaluator`

放在 `src/typeChecking/ExpressionTypeEvaluator.ts`。

职责：输入 `SyntaxNode` 和可选 `TypeNarrowingLookup`，输出 `LpcType`。

现有 `semanticEvaluation` 已经负责受限静态值求值，并被 objectInference 消费。类型检查不应复制 `SemanticEvaluationService`、receiver tracing、对象路径候选解析或 runtime environment provider。首版可以提供一个可选的 `SemanticValue -> LpcType` 适配层：当现有静态值结果已经可证明时复用它，只有声明类型、callable signature、赋值目标、数组/mapping 目标约束等类型领域独有规则才在 `ExpressionTypeEvaluator` 中实现。

首版覆盖：

| 表达式 | 推导策略 |
|--------|----------|
| literal int / float / string | 直接给基础类型 |
| literal `0` | `zero-literal` |
| identifier | 优先查询 `TypeNarrowingLookup`，否则走 `ScopeSymbolTypeResolver` |
| parenthesized | 透传内部表达式 |
| cast | 返回 cast 目标类型 |
| sizeof | `int` |
| unary `!` / `!!` | `int` |
| unary `+` / `-` | 数值域，否则 `unknown` |
| array literal | 元素类型可统一时为 `array<T>`，空数组为 `array<unknown>` |
| mapping literal | key/value 可统一时为 `mapping<K,V>`，复杂多值或不一致时降级 |
| call expression | 解析 direct call 的返回类型 |
| assignment expression | 返回 RHS 类型，同时由 collector 负责检查赋值兼容 |
| binary arithmetic | 数值域推导；`+` 支持 string + string 和数值加法 |
| comparison / equality | `int` |
| logical `&&` / `||` | 参考 LPC 运行语义，结果可能是操作数值；首版仅在可证明时返回右侧或联合降级 |
| nullish | 可证明时返回左右兼容类型，否则 `unknown` |
| conditional | 两分支类型一致或兼容时返回统一类型，否则 `unknown` |
| member access | 已知 struct / class 成员时返回成员类型；动态成员返回 `unknown` |
| index access | 已知数组元素或 mapping value 时返回对应类型；range / 多参数 mapping index 降级 |
| new expression | 可证明类型时返回对象或 struct / class 类型 |

表达式中出现 `OpaqueExpression`、`Missing`、无法解析的 `SpreadElement`、动态 `call_other`、函数指针调用、动态 `->(expr)` 时返回 `unknown`。

首版实现中，narrowing lookup 默认不存在，因此不会实际改变类型推导；它只是避免后续引入类型守卫时重写 evaluator 接口。

### `TypeDiagnosticsCollector`

放在 `src/diagnostics/collectors/TypeDiagnosticsCollector.ts`。

职责：遍历 `SyntaxDocument`，调用类型推导与兼容性服务，产出诊断。

首版诊断：

| code | 场景 |
|------|------|
| `lpc.type.variableInitializerMismatch` | 显式声明变量初始化类型不兼容 |
| `lpc.type.assignmentMismatch` | 普通赋值 RHS 与 LHS 类型不兼容 |
| `lpc.type.returnMismatch` | `return expr` 与显式函数返回类型不兼容 |
| `lpc.type.argumentMismatch` | direct call 实参与参数类型不兼容 |
| `lpc.type.arrayElementMismatch` | array literal 元素与目标数组元素类型不兼容 |
| `lpc.type.mappingEntryMismatch` | mapping literal key/value 与目标 mapping 类型不兼容 |
| `lpc.type.memberNotFound` | 已知 struct / class 上访问不存在成员 |

默认接入顺序放在 `BasicSemanticDiagnosticsCollector` 之后，因为它依赖同一套可见符号和 callable signature 信息。

该 collector 不应自行解析 include / inherit / efun / simul-efun，也不应复制 direct call callee、argument count、function-like macro suppression 等现有私有工具逻辑。实现前应先把这些可共享的小工具抽到 diagnostics semantic/shared helper 中，由 BasicSemantic 和 TypeDiagnostics 同时使用。

## 首版诊断范围

### 变量初始化

示例：

```c
string a = 123;
int b = "123";
```

只有变量声明有显式类型，且 initializer 类型可证明时检查。声明类型为 `mixed` 或 initializer 为 `unknown` 时静默。

### 普通赋值

示例：

```c
int value;
value = "abc";
```

只检查可解析到确定 LHS 类型的赋值。复杂左值、动态 index、动态 member 访问不报。

复合赋值 `+=` / `-=` / `|=` / `&=` 首版只覆盖数组浅层规则和数值域规则；无法证明时静默。

### return

示例：

```c
int query_count() {
    return "many";
}
```

只检查有显式返回类型的函数。无显式类型或返回类型为 `mixed` 时静默。不做缺失 return 的控制流分析。

### 函数调用参数

示例：

```c
int add(int a, int b) { return a + b; }
add("x", 1);
```

只检查 direct call。候选 overload 处理规则：

- 先沿用现有 arity 逻辑。
- 参数数量不匹配仍由现有 semantic diagnostics 负责。
- 参数类型检查只在所有可接受 arity 的候选对该参数位置结论一致时发出。
- 若任一候选参数类型为 `mixed` / `unknown`，该参数不报。

### 函数返回类型参与表达式

示例：

```c
string name() { return "x"; }
int value = name();
```

direct call 返回类型可证明时，参与变量初始化、赋值和 return 检查。

### array literal

示例：

```c
string *names = ({ "a", 123 });
```

首版支持浅层元素类型检查。空数组 `({ })` 作为 `array<unknown>`，赋给任意数组目标不报。

参考项目确认 `0` 可作为数组删除操作中的特殊元素；首版在数组运算中保留该宽松规则。

### mapping literal

示例：

```c
mapping m = ([ "fd": 1 ]);
```

普通 `mapping` 目标不做 key/value 精确检查。只有当目标类型来自 LPCDoc 或后续扩展能表达 `mapping<K,V>` 时，才检查 key/value。多值 mapping entry 首版降级为 `unknown`。

### member / index

已知 struct / class 类型上的静态成员访问可以检查成员是否存在。对象路径、`call_other`、动态 `->(expr)`、函数指针调用和 driver 动态语义不进入首版错误。

`lpc.type.memberNotFound` 只针对可证明的 struct / class 静态成员。首版不得对 `obj->method`、object candidate、scoped method、objectInference 的 `unknown` / `unsupported` 结果产生命中失败诊断；这些场景继续由 completion / hover / definition / signature help 的现有保守降级处理。

### 类型守卫

类型守卫属于类型检查系统的计划能力，但不属于首版诊断承诺。

首版只保留接口位置，不根据 `if (stringp(x))`、`if (arrayp(x))` 或 `if (fn(x))` 改写分支内 `x` 的类型。原因是这会引入路径敏感状态，需要定义赋值失效、分支合并、短路表达式和用户自定义 predicate 的一致规则。

后续可以按风险从低到高分三步引入：

1. 内建 predicate 的 then 分支单 identifier 收窄。
2. `!predicate(x)` 和简单 `&&` 条件组合。
3. LPCDoc `@returns {x is T}` 用户自定义 predicate。

## 抑制策略

以下情况必须静默：

- `context.syntax` 或 `context.semantic` 不存在。
- `context.semantic.degraded`。
- 可见符号 resolver 标记 `hasUnresolvedDependencies`。
- 存在未展开 function-like macro reference，且表达式范围可能受影响。
- 表达式节点是 `OpaqueExpression`、`Missing` 或包含 spread。
- 类型为 `mixed`、`unknown` 或无法解析。
- 需要类型守卫收窄才能证明的表达式，首版静默。
- direct call 找不到唯一可证明的返回类型或参数类型。
- 动态成员访问、动态函数调用、`call_other`、函数指针调用。
- driver dialect 特性尚未建模，例如 LDMud range index、多参数 mapping index 等。

后续扩展可增加 `@lpc-nocheck`、`@lpc-ignore`、`@lpc-expect-error` 支持，但必须先建立统一注释抑制基础。没有基础时不要临时在 collector 中手扫全文注释。

## 与现有诊断关系

`BasicSemanticDiagnosticsCollector` 当前负责：

- direct call 参数数量。
- 未定义函数。
- 未定义符号。

`TypeDiagnosticsCollector` 不应重复这些诊断。它只消费 callable signature 的类型信息，并在 arity 已可接受时做参数类型检查。

共享 callable signature 时扩展 `DiagnosticCallableSignature`，避免两个 collector 各自构造签名视图。更重要的是，可见符号解析本身也必须共享：BasicSemantic 与 TypeDiagnostics 消费同一份 request-scoped `DiagnosticTypeFacts`，而不是各自调用 resolver。

## 与现有语言功能关系

首版类型检查只进入 diagnostics，不改变 completion、hover、definition、signature help、formatter 的请求路径和优先级。

- completion 已经有 type-position、struct/class 成员候选和项目符号索引。`ScopeSymbolTypeResolver` 是类型诊断专用的 declaration-order-aware 解析，不应顺手改变 completion 行为；但类型定义查找、成员解析和类型字符串规范化应抽共享 helper 或复用同一规范化函数，避免 completion 显示可用而 type checker 报错。
- hover 的现有优先级是 macro / header owner / object hover / efun hover。typed hover 若后续要接入，必须作为独立 feature-service 扩展，不在 hover 请求中触发 diagnostics collector，也不改变现有优先级。
- definition 的现有优先级是 scoped method / object method / direct symbol / function family。类型系统不得在首版插入 definition 决策链。
- objectInference 已经负责 `->` receiver 解析、对象路径候选、scoped method return 和静态值辅助判断。类型检查只能消费可复用的 plain data 结果，不能复制 object receiver tracing。
- semanticEvaluation 是值域静态求值，不是类型真源。类型检查可以做 `SemanticValue -> LpcType` 适配，但不能把 value domain 的未知值当成类型错误。
- formatter 只依赖 parser / syntax / format model，不消费 diagnostics。类型 warning 不得让 formatting 返回空编辑，也不得改变 formatter 的 blocking diagnostic 规则。

## 配置与 LSP 路径

首版新增 `lpc.enableTypeChecking`，默认开启 warning，允许用户关闭。

配置不能只在 VS Code extension 层读取。当前 extension 与 LSP production runtime 都会创建 diagnostics stack，因此配置应通过共享 diagnostics 入口进入：

- extension 路径：从 VS Code workspace 配置读取后，传给 diagnostics stack / shared diagnostics service。
- LSP 路径：从 initialize/workspace configuration 或 server runtime 的 workspace context 传入同一 options 结构。
- 测试路径：通过 `createDiagnosticsStack` / shared diagnostics factory 的显式 option 注入，不 mock VS Code API。

开关主来源为 VS Code setting，并通过 configuration bridge payload 同步给 spawned LSP。项目配置仍优先负责 include / inherit / simul-efun 等 LPC 工程语义，不承担这个编辑器功能开关。extension 侧和 LSP 侧都消费同一份 shared diagnostics options，不能各自读取默认值。

实现阶段必须同步完成 LSP 配置桥接后再发布该开关；桥接未完成时不得在 extension 侧单独生效，必须保持默认开启。

## 测试计划

### 单元测试

新增或扩展：

- `src/typeChecking/__tests__/LpcTypeParser.test.ts`
- `src/typeChecking/__tests__/LpcTypeRelation.test.ts`
- `src/typeChecking/__tests__/ScopeSymbolTypeResolver.test.ts`
- `src/typeChecking/__tests__/ExpressionTypeEvaluator.test.ts`

覆盖：

- 基础类型解析。
- 指针 / 数组深度。
- `mixed`、`unknown`、`0`、数值域兼容。
- array / mapping 浅层兼容。
- call return type 推导。
- 同一作用域中“后声明变量”不会被前面的表达式解析为已知类型。

### collector 测试

新增：

- `src/diagnostics/collectors/__tests__/TypeDiagnosticsCollector.test.ts`

或先放入现有 `src/__tests__/diagnosticCollectors.test.ts`，再视规模拆分。

覆盖：

- 变量初始化 mismatch。
- 普通赋值 mismatch。
- return mismatch。
- direct call argument mismatch。
- direct call return type 参与赋值。
- array element mismatch。
- mapping entry mismatch。
- `mixed` / `unknown` 静默。
- unresolved dependencies 静默。
- macro / opaque 静默。

### resolver 测试

扩展：

- `src/diagnostics/semantic/__tests__/DiagnosticSymbolResolver.test.ts`

覆盖：

- local / include / inherited 函数签名保留 return type 和参数类型。
- efun / simul-efun `CallableDoc` 类型不再被扁平化丢失。
- variadic / optional 参数仍保持现有 arity 行为。
- request-scoped facts 被 BasicSemantic 与 TypeDiagnostics 共享，不重复触发 resolver。
- BasicSemantic 与 TypeDiagnostics 同时存在时，resolver 在同一 request 内只被触发一次。

### 栈接入测试

扩展：

- `src/diagnostics/__tests__/createDiagnosticsStack.test.ts`
- LSP shared diagnostics parity 相关测试。

验证：

- 新 collector 已接入默认诊断栈。
- VS Code extension 与 LSP 生产路径使用同一诊断行为。
- `lpc.enableTypeChecking` 关闭后，extension 与 LSP 路径都不产生类型诊断。
- `batchSize: 1` 与并发 batch 都不依赖 collector 顺序。
- shared diagnostics request 中 facts cache 不依赖 `TextDocument` 对象身份。

### 现有功能回归测试

扩展或运行：

- `src/__tests__/providerIntegration.test.ts`
- formatter 回归集：`src/__tests__/formatPrinter.test.ts`、`src/__tests__/formatterIntegration.test.ts`、`src/__tests__/rangeFormatting.test.ts`
- LSP language parity / diagnostics parity 相关测试

验证：

- completion / hover / definition / signature help 不因类型检查接入改变优先级或触发额外解析主路径。
- objectInference / semanticEvaluation 链路仍按现有 unknown / unsupported 语义保守降级。
- type warning 不影响 formatter，formatter 仍只因 parser blocking diagnostics 停止。

## 阶段计划

### 阶段一：类型模型与签名保真

- 新增 `src/typeChecking/` 下的 `LpcType`、类型解析、类型兼容性测试。
- 扩展 callable signature，保留 return type / parameter type。
- 实现 request-scoped `DiagnosticTypeFacts` 或等价 provider 的最小骨架，先让 BasicSemantic 消费它，证明共享 facts 的位置和生命周期可行。
- 明确 LPCDoc 类型解析边界：声明签名和已结构化 doc 类型先接入，复杂 `{type}` / predicate doc 类型先不承诺。
- 更新 resolver 测试。

### 阶段二：共享诊断事实与表达式类型推导

- 把 TypeDiagnostics 接入同一份 request-scoped facts，保证 BasicSemantic 与 TypeDiagnostics 共享 visible symbols。
- 实现 `ScopeSymbolTypeResolver`。
- 实现声明顺序安全的 local / parameter lookup。
- 只在 evaluator 参数中预留 optional narrowing lookup，不新增空的 flow state 类。
- 实现 `ExpressionTypeEvaluator` 的基础表达式、direct call、array / mapping literal、常见运算符。
- 增加 evaluator 单元测试。

### 阶段三：TypeDiagnosticsCollector

- 实现变量初始化、赋值、return、direct call 参数类型、array / mapping 基础诊断。
- 接入默认 diagnostics stack。
- 接入 `lpc.enableTypeChecking` 的共享 options 和 configuration bridge；配置桥接完成前不发布用户可见开关。
- 增加 collector 测试和 LSP parity 测试。

### 阶段四：真实项目探针验证

- 使用 `npm run probe:lsp -- --project <真实LPC项目根目录> --file <LPC路径>` 对真实项目跑静态诊断探针。
- 只引用报告阶段、数量、超时和诊断消息，不摘真实项目源码。
- 对误报进行规则收窄，不通过扩大 `unknown` 以外的方式掩盖真实错误。

### 后续扩展：类型守卫收窄

- 先实现内建 predicate 的单 identifier then 分支收窄。
- 复用 `semanticEvaluation/static/LpcTypePredicateEvaluator.ts` 中已有 predicate 名称和静态值判断，但类型检查侧只消费类型事实，不把 value domain 当作类型真源。
- 增加独立测试覆盖 `stringp`、`objectp`、`mapp`、`pointerp` 的分支内赋值检查。
- 用户自定义 `@returns {x is T}` 需要先扩展 callable doc/signature，再进入实现。

## 验证门槛

首版合入前至少运行：

```powershell
npx tsc --noEmit
npx jest --runInBand src/typeChecking/__tests__/LpcTypeParser.test.ts src/typeChecking/__tests__/LpcTypeRelation.test.ts src/typeChecking/__tests__/ScopeSymbolTypeResolver.test.ts src/typeChecking/__tests__/ExpressionTypeEvaluator.test.ts src/diagnostics/semantic/__tests__/DiagnosticSymbolResolver.test.ts src/diagnostics/__tests__/createDiagnosticsStack.test.ts src/__tests__/diagnosticCollectors.test.ts
npx jest --runInBand src/__tests__/providerIntegration.test.ts src/__tests__/formatPrinter.test.ts src/__tests__/formatterIntegration.test.ts src/__tests__/rangeFormatting.test.ts
npm run check
git diff --check
```

新增独立测试文件时，应把它们加入 focused jest 命令。

涉及 LSP 行为后，再运行相关 LSP diagnostics parity 测试。发布或打包前再运行：

```powershell
npm run probe:lsp -- --project <真实LPC项目根目录> --file <LPC路径>
npm run package
```

## 风险与对策

| 风险 | 对策 |
|------|------|
| 类型检查误报动态 LPC 写法 | 所有动态成员、动态调用、宏不确定、依赖不完整都静默 |
| 覆盖度被保守策略削弱 | 首版覆盖变量、赋值、return、调用、array、mapping、运算符；只在局部规则内保守 |
| callable 类型和 arity 逻辑分叉 | 扩展现有 `DiagnosticCallableSignature`，两个 collector 共享 |
| BasicSemantic 与 TypeDiagnostics 重复解析跨文件符号 | 引入 request-scoped `DiagnosticTypeFacts` 或等价 provider |
| 局部类型解析误用后声明变量 | `ScopeSymbolTypeResolver` 必须做 declaration-order-aware lookup |
| VS Code 与 LSP 配置不一致 | 配置通过 shared diagnostics options 注入，不在 collector 内直接读 VS Code API |
| LPCDoc 类型字符串被过度信任 | 复杂 `{type}`、predicate return 和带空格类型必须先扩展 doc type parser |
| collector 变成结构推断器 | 只消费 `SyntaxDocument` 和 `SemanticSnapshot`，不重新扫描全文 |
| 类型检查重复 semanticEvaluation / objectInference | 通过 `SemanticValue -> LpcType` 适配复用值域结果，不复制 receiver tracing 或对象路径推断 |
| 类型诊断影响 completion / hover / definition / formatter | 首版只接入 diagnostics，并通过 providerIntegration / formatter 回归锁定现有优先级 |
| 类型模型膨胀成完整 checker | 明确不支持 flow、generic、union/intersection 完整语义 |
| 真实项目诊断噪音 | 通过 LSP probe 在真实项目上验证诊断数量和消息，再收窄规则 |

## 已收敛决定与后续扩展

已收敛决定：

- 类型守卫的第一阶段只做内建 predicate，不同步支持 LPCDoc `@returns {x is T}`；后者依赖 doc type parser。
- mapping 精确类型的输入来源首版只接受已结构化签名或后续 doc type parser 输出，不从普通 `mapping` 猜测 key/value。
- `lpc.enableTypeChecking` 的主来源是 VS Code setting，并通过 configuration bridge 同步到 LSP；桥接未完成前不发布该开关。
- `@lpc-ignore` / `@lpc-expect-error` 不属于首版必要能力。后续只有在仓库已有统一注释抑制基础或单独设计该基础后才引入。
- `int` / `float` / `status` 首版按数值域互通处理，避免对 LPC 常见数值写法产生风格化误报。
- `class` / `struct` 只按名称相等兼容；`object` 不与 `class` / `struct` 互相兼容，不做浅层成员结构兼容。

后续扩展：

- 统一注释抑制基础与 `@lpc-ignore` / `@lpc-expect-error`。
- LPCDoc complex type parser，包括 `{type}`、`mapping<K,V>`、`@returns {x is T}`。
- typed hover / completion / definition 的独立 feature-service 接入。
