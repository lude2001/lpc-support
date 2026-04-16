# 继承链静态全局对象推导 P1 设计

日期：2026-04-17

## 背景

`0.41.0` 已完成静态全局对象推导 P0：

- 当前文件内
- 文件级作用域下
- 声明点静态可证明的 `object` 变量

现在已经可以稳定参与：

- completion
- definition
- hover
- signature help

当前链路中的关键优先级已经被固定为：

- 局部绑定
- 当前文件全局对象绑定
- 宏 fallback

但在典型 mudlib 中，很多全局 daemon/object 句柄并不定义在当前文件，而是定义在被 `inherit` 的父对象中。例如：

```lpc
// /std/room.c
object COMBAT_D = load_object("/adm/daemons/combat_d");
```

```lpc
// /d/city/room.c
inherit "/std/room";

void demo() {
    COMBAT_D->start();
}
```

这类写法在当前版本中仍会失败，因为：

- `GlobalObjectBindingResolver` 只解析当前文件的 `symbolTable + syntax`
- 当前文件没有同名全局绑定时，identifier receiver 会继续回退宏
- 继承链中的静态全局对象绑定没有进入对象推导主路径

这意味着 P0 解决的是“当前文件静态全局”，而不是“继承链静态全局”。

P1 的目标，就是在不引入运行时状态猜测的前提下，把静态全局对象推导从“当前文件”扩展到“继承链”。

## 目标

- 支持从继承链中解析静态可证明的文件级全局 `object` 绑定
- 将 identifier receiver 的优先级升级为：
  - 局部绑定
  - 当前文件全局对象绑定
  - 继承链全局对象绑定
  - 宏 fallback
- 保持与 P0 相同的推导哲学：
  - 能证明才 `resolved`
  - 不能证明则 `unknown`
  - 明确超出规则集则 `unsupported`
- 让新的继承链全局对象来源自动服务于：
  - completion
  - definition
  - hover
  - signature help
- 全程复用现有 `ParsedDocument -> SyntaxDocument -> SemanticSnapshot` 主链，不引入新的结构真源

## 非目标

- 不支持 `create()` / `setup()` / `reset()` 中的运行时全局赋值
- 不支持仅凭 `object` 类型、没有具体来源的推导
- 不扩 builtin 对象来源白名单
  - 如 `previous_object()`、`environment()`、`master()` 仍不纳入
- 不处理 `include` 文件中的“全局对象绑定可见性”
- 不支持索引、mapping/array 元素、条件表达式、循环后状态等动态来源
- 不重新设计跨文件符号系统，不让 `resolveVisibleSymbol(...)` 直接跨文件工作
- 不引入文本扫描或 legacy parse cache 作为对象推导真源

## 约束

### 架构约束

必须继续遵守仓库现有主路径约束：

- `ParsedDocument`
  - parser 层统一容器
- `SyntaxDocument` / `SyntaxNode`
  - 结构层真源
- `SemanticSnapshot`
  - 语义摘要层

禁止出现以下退化：

- Provider 或业务逻辑重新全文扫描结构
- 重新让 legacy parse cache 成为生产真源
- 重新把 parser / syntax / semantic 混成泛化 “AST”

### 推导哲学

P1 继续沿用 P0 的确定性规则：

- 只在“静态可证明”的情况下返回对象候选
- 看到绑定但无法证明时，保守返回 `unknown`
- 看到绑定且表达式明确超出规则集时，返回 `unsupported`
- 不允许为了“看起来更聪明”而猜测继承链结果

## 现有能力基础

P1 并不是从零开始，仓库里已经有三块现成基础设施：

### 1. 当前文件静态全局对象解析

`src/objectInference/GlobalObjectBindingResolver.ts` 已经能完成：

- 当前文件可见全局绑定识别
- `VariableDeclarator` 回找
- initializer 解析
- 全局别名递归
- 对象方法 initializer 返回值解析

这说明“单文件静态全局对象绑定解析”已经是成熟能力。

### 2. 继承链语义真源

`SemanticSnapshot` 已包含：

- `inheritStatements`
- `symbolTable`
- `syntax`

说明继承声明、符号和语法节点都已经在共享快照中可用。

### 3. 现成的继承路径解析能力

仓库已有：

- `src/completion/inheritanceResolver.ts`
- `src/targetMethodLookup.ts`

它们已经能稳定完成：

- 根据 `inheritStatements` 解析目标文件路径
- 按声明顺序递归遍历继承链
- 在多级继承中做 cycle guard

因此 P1 没必要发明新的“继承解析器”，而应复用现有路径解析语义。

## 方案比较

### 方案 A：把继承链全局对象解析直接塞进 `GlobalObjectBindingResolver`

优点：

- 改动面小
- 入口集中

缺点：

- 容易把“当前文件绑定解析”和“继承链遍历”搅在一起
- 当前 resolver 的职责会从“单文件静态绑定求解”膨胀成“跨文件继承搜索器”

### 方案 B：新增继承链专职 resolver，并复用当前文件 resolver

优点：

- 职责边界清楚
- 当前文件绑定求解逻辑不需要重写
- 更容易测试“当前文件”和“继承链”两个层次的边界

缺点：

- 需要为 resolver 之间设计一个较清晰的接口

### 方案 C：把继承链全局对象索引预先写进 `ProjectSymbolIndex`

优点：

- 理论上可复用现有 project-level 索引

缺点：

- 当前对象推导主链是 request-scoped 的，不依赖项目索引真源
- 会把一个本来局部、确定的解析问题，升级成索引同步问题
- 很容易引入“文件未打开/索引未热”类时序复杂度

### 推荐方案

推荐方案 B：

- 保持 `GlobalObjectBindingResolver` 继续专注于“单文件静态绑定求解”
- 新增一个继承链级别的 resolver，专门负责：
  - 解析继承目标文件
  - 遍历继承链
  - 调用当前文件级 resolver 去判断各父文件中的同名全局对象绑定

这条路线与现有对象推导主链最同构，也最符合 P0/P1 逐层扩展的设计节奏。

## 总体方案

P1 采用“两层 resolver”方案：

- `GlobalObjectBindingResolver`
  - 继续负责单文件静态全局对象绑定求解
- `InheritedGlobalObjectBindingResolver`
  - 新增，负责跨继承链搜索同名静态全局对象绑定

`ObjectInferenceService` 的 identifier receiver 主链升级为：

1. 局部 tracing
2. 当前文件全局对象绑定
3. 继承链全局对象绑定
4. 宏 fallback

即：

- 局部绑定 > 当前文件全局对象绑定 > 继承链全局对象绑定 > 宏

## 组件职责边界

### `ReceiverTraceService`

继续只负责：

- 当前函数内的局部变量 / 参数 tracing
- 有限控制流合并

但 P1 需要补一条非常明确的接线：

- 当局部 tracing 在 RHS 标识符来源解析中，遇到“当前文件没有同名可见全局绑定”的 identifier 时
- 必须能够继续委托“继承链静态全局对象绑定解析”

也就是说：

- `ReceiverTraceService` 本身仍不负责继承链遍历
- 但它不能只会调用“当前文件级 resolver”，否则 child file alias tracing 仍然会断在继承链入口前

典型场景：

```lpc
inherit "/std/room";

void demo() {
    object ob = COMBAT_D;
    ob->start();
}
```

若 `COMBAT_D` 定义在父对象中，P1 必须让这条 alias tracing 命中继承链全局绑定，而不是只在最外层 identifier receiver 分支上补齐。

### `GlobalObjectBindingResolver`

继续负责：

- 在单个 document/snapshot 内识别全局 `object` 绑定
- 回找 declarator
- 求解 initializer

建议在 P1 中补一个更低层的内部入口，例如：

- `resolveNamedBindingInSnapshot(...)`
- 或“给定 symbol + snapshot”的解析入口

但这个入口必须满足两个额外约束：

- 不能再依赖“当前 document + position”这一组单文件上下文作为唯一真源
- 必须允许“在指定 document/snapshot 上、对指定 symbol”做求解

否则继承链 resolver 复用时会把父文件绑定重新套回子文件作用域，得到错误结果。

### `InheritedGlobalObjectBindingResolver`

新增，专门负责：

- 读取当前文档的 `inheritStatements`
- 解析每个 inherit 的目标文件
- 按既有继承顺序递归遍历
- 在父文件 snapshot 上查询同名全局 `object` 绑定
- 返回第一个符合优先级规则的继承链绑定结果

不得负责：

- 局部 tracing
- 宏 fallback
- provider 业务逻辑

### `ReturnObjectResolver` / `ObjectMethodReturnResolver`

继续维持现有职责不变：

- `ReturnObjectResolver`
  - 单表达式对象来源求解
- `ObjectMethodReturnResolver`
  - 已知 receiver 候选 + 方法名的返回对象求解

P1 只是在“父文件 declarator initializer”场景下复用它们。

## 数据来源

P1 依赖以下共享真源：

- 当前文档与父文档的 `SemanticSnapshot`
- `SemanticSnapshot.inheritStatements`
- 父文档 `symbolTable`
- 父文档 `syntax`

快照入口必须继续统一为：

- `ASTManager.getSemanticSnapshot(document, false)`

继承目标路径解析必须固定复用一套现有语义，推荐唯一来源为：

- `InheritanceResolver`

原因是当前仓库里：

- `InheritanceResolver.resolveDirectivePath()` 会显式尊重
  - `expressionKind`
  - workspace roots
  - `includePath`
- `TargetMethodLookup.resolveInheritedFilePath()` 的路径规则并不完全等价

因此 P1 规范必须写死：

- 继承链全局对象解析使用 `InheritanceResolver` 语义
- 不允许把 `TargetMethodLookup` 的 inherit 路径语义当作等价替代
- 更不允许在对象推导里复制第三套 inherit 路径猜测规则

## 继承遍历顺序

P1 需要钉死继承链搜索顺序，否则同名绑定结果会摇摆。

推荐顺序：

- 直接继承优先于更远祖先
- 同级直接继承按声明顺序优先
- 整体采用“按声明顺序的深度优先遍历”

这与仓库现有 `TargetMethodLookup` 和 `InheritanceResolver` 的行为方向一致。

因此：

- 如果第一个 direct inherit 已经提供可见绑定
  - 不继续向后搜索同级其他 direct inherit
- 如果 direct inherit 自己没有绑定
  - 再递归查它的父级
- 当前 direct inherit 分支彻底未命中后
  - 才继续下一个同级 direct inherit

这相当于把继承链全局对象可见性定义为：

- 跟随现有继承遍历顺序，而不是做“全图收集后再猜”

## 绑定可见性与优先级规则

### 总优先级

P1 固定以下优先级：

1. 局部绑定
2. 当前文件全局对象绑定
3. 继承链全局对象绑定
4. 宏 fallback

### 当前文件优先于继承链

如果当前文件存在同名全局绑定：

- 无论是 `object` 还是非 `object`
- 无论结果是 `resolved` / `unknown` / `unsupported`

都不应继续去继承链找同名绑定。

这条规则的意义是：

- 继承链只补“当前文件没有绑定”的空白
- 不能让父类绑定绕过子类的同名声明

这里必须额外钉死一个语义：

- 这条“当前文件存在同名全局绑定”的判断，必须是 file-scope/global-scope 规则
- 不能直接沿用 `resolveVisibleSymbol(symbolTable, name, position)` 的“当前位置可见性”语义

换句话说：

- 对局部变量 / 参数，继续使用 position-sensitive 的可见性规则
- 对文件级全局绑定与继承链绑定之间的优先级判断，使用“全局作用域下是否存在同名绑定”规则

原因是：

- 文件级全局绑定的遮蔽关系，应由 file scope 决定
- 不能因为同名全局声明出现在访问点后面，就让继承链绑定或宏错误获胜

示例：

```lpc
inherit "/std/room";

void demo() {
    COMBAT_D->start();
}

object COMBAT_D = load_object("/adm/daemons/local_d");
```

在 P1 中，这里必须视为“当前文件已定义同名全局绑定”，因此：

- 不允许继续命中父类 `COMBAT_D`
- 更不允许继续回退宏

### 继承链绑定阻断宏 fallback

一旦继承链上找到了“可见同名绑定”，即使该绑定：

- 是非 `object`
- 或 initializer 无法静态证明
- 或 initializer 属于 `unsupported`

也必须阻断宏 fallback。

即：

- 有继承链绑定但结果为 `unknown` / `unsupported`
  - 不允许继续回退宏

### 同名非对象绑定的阻断规则

如果更近的父文件中存在同名非对象全局，例如：

```lpc
// /std/base.c
int COMBAT_D = 1;
```

而更远祖先或宏中存在同名对象来源：

- 结果也必须保守停在 `unknown`
- 不允许跨过这个更近的非对象绑定继续找更远对象绑定或宏

这条规则保证“名字解析优先级”先于“我们更想找到对象”的愿望。

## 支持范围

P1 只支持：

- 来自继承文件的
- 文件级作用域下的
- 声明点静态可证明的
- `object` 全局绑定

其 initializer 规则与 P0 保持一致：

- 字符串对象路径
- 宏对象路径
- 已支持 builtin call
- documented-return 普通函数调用
- 已可静态证明的对象方法调用返回值
- 指向另一个静态可证明全局对象的别名

## 明确不支持的场景

P1 仍然不支持：

- 继承文件中的运行时赋值
  - `object d; void create() { d = load_object(...); }`
- 仅凭 `object` 类型推导
- `include` 文件中的“全局对象变量可见性”
- 动态 inherit 路径
- 索引/容器元素/条件表达式初始化
- 新 builtin 对象来源

## 解析流程

### 1. 当前文件主链先跑完

`ObjectInferenceService` 在 identifier receiver 分支中：

1. 先执行 `ReceiverTraceService`
2. 再执行当前文件 `GlobalObjectBindingResolver`

只有当前两层都没有可见绑定时，才进入继承链搜索。

但这还不够。

### 1.5 递归 alias tracing 也必须接入继承链解析

除了最外层 identifier receiver 分支外，以下内部路径也必须共享同一优先级：

- `ReceiverTraceService.resolveIdentifierSourceOutcome(...)`
- 全局对象 initializer 中的 identifier alias 解析
- 全局对象方法 initializer receiver 的 identifier 解析

这些路径都必须遵守：

1. 局部绑定
2. 当前文件全局对象绑定
3. 继承链全局对象绑定
4. 宏 fallback

不能只在 `ObjectInferenceService` 顶层入口补继承链查找，否则：

- `object ob = COMBAT_D; ob->start();`
- `object PRODUCT = FACTORY; PRODUCT->query();`

这类通过局部 alias 或全局 alias 间接引用父对象绑定的场景仍然会失败。

### 2. 读取当前文件 `inheritStatements`

新增继承链 resolver 从当前文档 snapshot 读取：

- `inheritStatements`

并按现有 inherit 解析规则拿到目标文件路径。

### 3. 打开父文档并获取 snapshot

对每个 resolved inherit target：

- 打开父文件 `TextDocument`
- 获取其 `SemanticSnapshot`

### 4. 查询父文件中的同名全局绑定

在父文件上执行“单文件静态全局绑定解析”：

- 若存在同名可见全局绑定
  - 直接返回该结果
- 若不存在
  - 递归进入该父文件的继承链

这里的“存在同名全局绑定”，同样必须是：

- 父文件 global scope 下的同名绑定判断
- 而不是“把子文件访问位置直接带入父文件后，再做 position-sensitive 可见性判断”

也就是说：

- 继承链解析中的全局绑定判断必须以“目标文件自身的 global scope” 为准
- 不能把 child access position 误当作 parent binding visibility 的一部分

### 5. 递归与环路保护

继承链搜索必须维护：

- `visitedUris`

避免：

- inherit cycle
- 同一祖先多次遍历

若遇到 cycle：

- 直接跳过该分支，不报 resolved

### 6. 跨文件别名环路保护

除继承文件遍历本身外，静态全局别名解析也必须升级环路保护键。

P0 中单文件别名使用的 visit key 只需要区分：

- 标识符名
- symbol range

P1 跨文件后，这已经不够，因为不同文件中完全可能出现：

- 同名全局变量
- 相同起止 range 的 declarator

因此 P1 必须把 visit key 升级为至少包含：

- document URI
- 标识符名
- symbol/declarator range

即：

- 递归 alias 环路保护必须是 URI-aware 的
- 不能沿用单文件 visit key 直接跨文件复用

## 结果状态语义

P1 继续沿用 P0 结果语义：

### `resolved`

- 继承链上找到了唯一静态可证明对象来源

### `multiple`

- 单个绑定 initializer 本身返回多个对象候选
- 例如 documented-return 或对象方法返回传播给出多个对象

P1 不建议通过“多父类同名绑定并集”制造新的 `multiple`。
多父类同名绑定的可见性应由继承顺序决定，而不是做全图并集。

### `unknown`

- 继承链上看到了同名绑定，但无法证明对象来源
- 或更近绑定是非对象 / 无 initializer / 缺少返回对象文档

### `unsupported`

- 继承链上看到了同名绑定，且其 initializer 明确超出规则集

### `undefined`

- 整个继承链都不存在同名绑定

只有在这种情况下，identifier receiver 才允许继续走宏 fallback。

## 消费侧影响

P1 不要求修改 consumer 业务逻辑。

只要以下入口继续消费 `ObjectInferenceService` 结果，就能自动得到收益：

- completion
- definition
- hover
- signature help

用户体感上会表现为：

- 子类中直接使用父类定义的 daemon/object 句柄，也能补全对象方法
- `->method()` 跳转能落到真实对象方法
- 对象方法悬停与签名帮助能命中真实对象文档

## 测试方案

### 单元测试

主要保护网放在：

- `src/objectInference/__tests__/ObjectInferenceService.test.ts`

必须覆盖：

- direct inherit 中的静态全局 `object` 可解析
- 多级继承祖先中的静态全局 `object` 可解析
- 当前文件全局对象优先于继承链同名全局对象
- 当前文件非对象全局优先于继承链同名对象绑定
- direct inherit 声明顺序决定同名父级绑定优先级
- 继承链中的非对象同名全局阻断更远对象绑定与宏 fallback
- 继承链中的无 initializer / unsupported initializer 阻断宏 fallback
- 继承链中的全局对象别名可递归解析
- 跨文件别名环路保守降级为 `unknown`

### 集成测试

保护网补在：

- `src/__tests__/providerIntegration.test.ts`
- `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`

至少覆盖：

- 基于继承链全局对象的 definition 回归
- 基于继承链全局对象的 completion 回归
- hover 或 signature help 至少一条继承链回归

## 风险与取舍

### 优点

- 和 P0 完全同构，学习成本低
- 收益直接落到用户高频 mudlib 写法
- 仍属于静态、确定、可测试的问题
- 不会把对象推导带进运行时状态模拟

### 缺点

- 继承遍历顺序必须明确，否则结果会摇摆
- 多父类同名绑定的语义需要与现有仓库继承顺序保持一致
- 需要跨文件打开与快照获取，性能成本高于 P0

### 主要实现风险

- 如果继承路径解析与现有 `TargetMethodLookup` 不一致，可能出现“方法能跳、全局绑定却推不出”的分裂
- 如果当前文件绑定没有优先阻断，父类绑定会错误越级生效
- 如果 unknown/unsupported 没有阻断宏 fallback，结果会重新被同名宏污染

## 后续阶段

### P2

在 P1 之后，才值得考虑：

- 运行时全局赋值近似模型
- `previous_object()` / `environment()` / `master()` 等 builtin 来源
- 更细粒度的失败原因暴露给 consumer

P1 的意义就在于：

- 先把仍然“静态可证明”的对象来源吃干抹净
- 再考虑更高复杂度的运行时近似

## 结论

P0 解决的是“当前文件静态全局对象绑定”，P1 解决的应该是“继承链静态全局对象绑定”。

这一步最合适的原因不是它“容易”，而是它正好延续了当前仓库最成功的主线：

- 单一路径 LSP
- 统一 callable-documentation
- 静态对象推导逐层扩展

只要 P1 严格坚持：

- 当前文件优先
- 继承顺序固定
- unknown/unsupported 阻断宏 fallback

它就能在不破坏现有推导哲学的前提下，显著扩大对象方法能力的真实命中面。
