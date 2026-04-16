# 静态全局对象推导 P0 设计

日期：2026-04-16

## 背景

当前对象推导主链已经能稳定覆盖以下来源：

- 字符串对象路径
- 宏对象路径
- 少量内建对象来源
  - `this_object()`
  - `this_player()`
  - `load_object()`
  - `find_object()`
  - `clone_object()`
- 函数内局部变量与参数的有限数据流追踪
- 已有 `returnObjects` 文档支撑的函数返回对象传播

但当前链路仍有一个明显缺口：

- 文件级全局 `object` 变量没有进入对象推导主路径

这导致如下常见写法无法获得稳定的对象方法能力：

```lpc
object COMBAT_D = load_object("/adm/daemons/combat_d");

void demo() {
    COMBAT_D->start();
}
```

当前实现中，identifier receiver 的优先级大致为：

1. 尝试函数内局部 tracing
2. tracing 未命中时直接回退 macro path 解析

因此：

- 文件级全局对象绑定不会被识别
- 全局对象与同名宏冲突时，结果可能被错误地偏向宏
- completion / definition / hover / signature help 无法共享这类全局对象来源

本设计的目标，不是让对象推导器开始“猜运行时状态”，而是补齐一条静态、确定、可测试的对象来源路径：

- 只要文件级全局 `object` 变量能在声明点被静态证明，就让它进入对象推导主链

## 目标

- 支持当前文件内文件级全局 `object` 变量的对象推导
- 只支持“声明点静态可证明”的全局对象来源
- 将 identifier receiver 的优先级调整为：
  - 局部绑定
  - 当前文件全局对象绑定
  - 宏 fallback
- 让新的全局对象来源自动服务于：
  - completion
  - definition
  - hover
  - signature help
- 全程复用现有 `ParsedDocument -> SyntaxDocument -> SemanticSnapshot` 主链

## 非目标

- 不支持 `create()` / `setup()` / `reset()` 中的运行时全局对象赋值
- 不支持仅凭 `object` 类型、但没有具体来源的推导
- 不扩 builtin 对象来源白名单
  - 如 `previous_object()`、`environment()`、`master()` 不在本次范围
- 不支持索引、条件表达式、循环后状态、mapping/array 元素等动态来源
- 不引入文本正则扫描作为对象推导真源
- 不让 `src/diagnostics/` 中的全局变量分析逻辑反向成为对象推导主路径

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

- provider 或业务逻辑重新全文扫描做结构推断
- 重新让 legacy parse cache 成为生产真源
- 重新把 parser / syntax / semantic 混成新的泛化 “AST”

### 推导哲学

P0 的对象推导规则必须坚持以下原则：

- 能证明才返回 `resolved`
- 无法证明就返回 `unknown`
- 明确超出规则集的表达式返回 `unsupported`
- 不允许用启发式或“看起来像对象”的表达式猜结果

## P0 能力边界

### 支持的全局对象绑定

P0 只支持：

- 当前文件中
- 文件级作用域下
- 声明类型为 `object`
- 且声明时带有 initializer

的变量绑定。

可接受的例子：

```lpc
object COMBAT_D = load_object("/adm/daemons/combat_d");
object SELF = this_object();
object PLAYER = this_player();
```

### 允许进入 P0 的 initializer

若全局对象变量的 initializer 已能被现有对象来源求解链静态证明，则允许进入 P0。

第一批明确支持的 initializer 类型为：

- 字符串对象路径
- 宏对象路径
- 已支持的 builtin call
  - `this_object()`
  - `this_player()`
  - `load_object()`
  - `find_object()`
  - `clone_object()`
- 已有 `returnObjects` 文档支撑的普通函数调用
- 已可静态证明的对象方法调用返回值
- 指向另一个“同样可静态证明”的全局对象变量别名

示例：

```lpc
object COMBAT_D = load_object("/adm/daemons/combat_d");
object ALIAS_D = COMBAT_D;
```

```lpc
object FACTORY = load_object("/adm/objects/factory");
object PRODUCT = FACTORY->create();
```

前提是 `FACTORY->create()` 的返回对象本身已能由现有链路静态证明。

### 明确不进入 P0 的 initializer

以下 initializer 在 P0 中一律不做对象推导：

- 无 initializer
  - `object d;`
- 数值、字符串之外的非对象常量
  - `object d = 0;`
- 当前 builtin 白名单外的运行时对象来源
  - `object d = previous_object();`
  - `object d = environment(this_object());`
  - `object d = master();`
- 索引表达式
  - `object d = arr[0];`
  - `object d = map[key];`
- 需要控制流才能证明的表达式
  - 条件表达式
  - 循环后状态
  - switch 分支状态
- 依赖后续函数体赋值的全局对象
  - `object d; void create() { d = load_object(...); }`

### 本阶段不覆盖继承链全局对象

P0 仅覆盖当前文件全局对象绑定。

以下能力延后到后续阶段：

- 继承链中的全局对象绑定
- 当前文件全局对象与继承全局对象的优先级整合
- inherit graph 中的全局对象来源合并

## 总体方案

P0 采用“主链路插一层、新增一个专职 resolver”的方案，而不是继续扩大函数内 tracing 的职责。

### 新增组件

建议新增：

- `src/objectInference/GlobalObjectBindingResolver.ts`

职责只做一件事：

- 在 identifier receiver 场景下，解析当前文件中可见的文件级全局 `object` 绑定，并将其 initializer 转换为对象候选结果

该组件必须：

- 复用现有 `SemanticSnapshot`
- 复用现有 `SyntaxDocument`
- 复用现有 `ReturnObjectResolver`
- 复用现有 `resolveVisibleSymbol(...)`

该组件不得：

- 自己重新扫全文
- 自己重新实现 parser
- 自己维护一套脱离 syntax 的绑定关系

### 现有主链调整

`ObjectInferenceService` 中 identifier receiver 的处理顺序调整为：

1. 先执行现有函数内局部 tracing
2. 局部 tracing 未命中时，执行全局对象绑定解析
3. 只有在“没有可见全局对象绑定”时，才允许回退 macro path 解析

即：

- 局部绑定 > 当前文件全局对象绑定 > 宏 fallback

## 组件职责边界

### `ReceiverTraceService`

继续只负责：

- 函数内局部变量 / 参数的可见绑定解析
- 函数体内有限控制流追踪
- 对局部对象来源做合并、退化、保守 unknown

不得新增职责：

- 文件级全局对象绑定解析
- inherit 全局绑定解析

### `GlobalObjectBindingResolver`

只负责：

- 当前位置处 identifier receiver 的可见全局对象绑定解析
- 读取对应全局变量 declarator 的 initializer
- 递归解析“全局对象别名 -> 实际对象来源”
- 产出 `ObjectResolutionOutcome`

不得负责：

- completion / definition / hover / signature help 的消费逻辑
- 宏路径 fallback
- 函数内 tracing

### `ReturnObjectResolver`

继续保持为：

- 单表达式对象来源求解器

`GlobalObjectBindingResolver` 应尽量复用它，而不是另写一套 initializer 语义。

## 数据来源

P0 依赖以下现有真源：

- `SemanticSnapshot.symbolTable`
- `SemanticSnapshot.syntax`
- `VariableDeclarator` 的 initializer 子节点
- `resolveVisibleSymbol(...)`

当前仓库中，以下基础能力已经存在：

- `SemanticSnapshot` 持有 `symbolTable` 与 `syntax`
- `SymbolTable` 存在稳定的 `global` scope
- `VariableDeclarator` 保留 initializer 子节点
- `resolveVisibleSymbol(...)` 能按当前位置解析可见符号

因此 P0 不需要为“文件级全局变量”重新建设另一条结构真源。

## 解析流程

### 1. 识别可见全局符号

输入：

- 当前 `document`
- 当前 `position`
- receiver identifier 名称

流程：

1. 从当前文档的 `SemanticSnapshot` 读取 `symbolTable`
2. 通过 `resolveVisibleSymbol(symbolTable, receiverName, position)` 获取当前位置可见的符号
3. 仅接受满足以下条件的符号：
   - `type === VARIABLE`
   - `scope.name === "global"`
   - 声明类型为 `object`

若当前位置可见符号不是以上形态，则视为：

- 没有可见全局对象绑定

### 2. 回找 declarator syntax node

拿到全局变量符号后，需要找到与之对应的 `VariableDeclarator` 节点。

推荐做法：

- 以 symbol 的 `selectionRange` 或 `range` 为锚点
- 在当前 `SyntaxDocument` 中定位对应的 `VariableDeclarator`
- 要求其名称与 symbol.name 一致

若回找失败：

- 返回“有可见全局绑定，但无法证明其初始化来源”的保守结果
- 不允许直接转去宏 fallback

### 3. 读取 initializer

若 `VariableDeclarator` 没有 initializer：

- 返回 `unknown`

若存在 initializer：

- 将 initializer 交给全局对象 initializer 解析逻辑

### 4. 解析 initializer

initializer 求解规则：

- 优先复用现有 `ReturnObjectResolver.resolveExpressionOutcome(...)`
- 若 initializer 是 identifier，并且指向另一个文件级全局 `object` 变量：
  - 递归回到 `GlobalObjectBindingResolver`
- 若 initializer 是当前规则集外的表达式：
  - 返回 `unsupported`

### 5. 环路保护

以下情况必须防止无限递归：

```lpc
object A = B;
object B = A;
```

```lpc
object A = A;
```

处理方式：

- 在全局对象别名解析过程中维护 `visited` 集合
- 一旦发现环路，直接退化为 `unknown`

## 结果状态与退化语义

P0 必须严格区分三类失败状态。

### `unknown`

含义：

- 看到了一个合法的可见全局对象绑定
- 但无法证明它最终指向哪个对象

典型场景：

- `object d;`
- `object d = some_factory();`
  - 但 `some_factory` 没有 `returnObjects`
- declarator 成功定位，但 initializer 求解为空候选且不属于 unsupported

### `unsupported`

含义：

- 看到了一个可见全局对象绑定
- 且其 initializer 明确超出 P0 规则集

典型场景：

- `object d = arr[0];`
- `object d = environment(this_object());`

### `no visible binding`

含义：

- 当前 receiver 名称在当前位置没有匹配到可见的全局对象绑定

只有在这一种情况下，identifier receiver 才允许继续回退到宏解析。

### 关键规则

以下规则必须写死并由测试保护：

- 若存在可见全局对象绑定，但结果为 `unknown`
  - 不允许回退到宏
- 若存在可见全局对象绑定，但结果为 `unsupported`
  - 不允许回退到宏
- 只有“确实不存在可见全局对象绑定”时
  - 才允许回退到宏

这条规则是 P0 的核心确定性约束。

## 优先级规则

P0 必须固定以下优先级：

1. 函数内局部绑定
2. 当前文件全局对象绑定
3. 宏 fallback

表现为：

- 若局部 tracing 已命中
  - 直接返回局部 tracing 结果
- 若局部 tracing 未命中，但全局对象绑定命中
  - 直接返回全局对象绑定结果
- 仅当以上两者都未命中
  - 才执行宏 fallback

### 局部遮蔽全局

下例中必须优先使用局部变量：

```lpc
object COMBAT_D = load_object("/adm/daemons/combat_d");

void demo() {
    object COMBAT_D = load_object("/adm/objects/sword");
    COMBAT_D->query();
}
```

### 全局遮蔽同名宏

下例中必须优先使用全局对象绑定：

```lpc
object COMBAT_D = load_object("/adm/daemons/combat_d");

void demo() {
    COMBAT_D->start();
}
```

即使存在同名宏：

```c
#define COMBAT_D "/adm/objects/shield"
```

也不得让宏盖过当前文件的可见全局对象绑定。

## 消费侧影响

P0 不要求修改 completion / definition / hover / signature help 的业务逻辑。

它们只要继续消费 `ObjectInferenceService` 的结果，即可自动获得以下收益：

- `GLOBAL_D->` completion 能列出目标对象方法
- `GLOBAL_D->method()` definition 能跳到目标对象方法
- `GLOBAL_D->method` hover 能展示目标对象方法文档
- `GLOBAL_D->method(...)` signature help 能展示对象方法签名

consumer 侧允许继续保持当前退化行为：

- `unknown` / `unsupported` 时，回退自身默认能力

但 object inference 内部必须先把：

- 没绑定
- 有绑定但 unknown
- 有绑定但 unsupported

这三者严格区分。

## 实现建议

### 新增文件

- `src/objectInference/GlobalObjectBindingResolver.ts`

### 重点修改文件

- `src/objectInference/ObjectInferenceService.ts`

### 可选的小型类型增强

若当前 `ObjectResolutionOutcome` 无法表达“是否存在可见绑定”，可以为全局对象解析增加局部内部结果类型，但不建议扩大公共类型面。

推荐策略：

- `GlobalObjectBindingResolver` 内部返回：
  - `hasVisibleBinding`
  - `ObjectResolutionOutcome`
- `ObjectInferenceService` 依据 `hasVisibleBinding` 决定是否继续走宏 fallback

这样可以最小化对现有公共类型的冲击。

## 测试方案

### 单元测试

主要保护网放在：

- `src/objectInference/__tests__/ObjectInferenceService.test.ts`

必须覆盖：

- 当前文件文件级全局 `object` + builtin initializer 可解析
- 当前文件文件级全局 `object` + documented-return initializer 可解析
- 当前文件全局对象别名到另一个全局对象可解析
- 局部变量遮蔽全局对象时优先取局部
- 当前文件全局对象遮蔽同名宏时优先取全局对象
- 存在可见全局对象，但 initializer 为 `unknown` 时不允许回退宏
- 存在可见全局对象，但 initializer 为 `unsupported` 时不允许回退宏
- 全局对象别名环路退化为 `unknown`
- 不带 initializer 的全局 `object` 退化为 `unknown`

### 集成测试

保护网补在：

- `src/__tests__/providerIntegration.test.ts`

至少覆盖：

- `GLOBAL_D->method()` definition 能跳到目标对象方法
- `GLOBAL_D->` completion 能列出目标对象方法
- hover 或 signature help 至少补一条主链回归

### P0 暂不覆盖的测试

以下场景不属于 P0 范围，不在首批测试中引入：

- 继承链全局对象绑定
- 运行时全局对象赋值
- 新 builtin 对象来源

## 风险与取舍

### 优点

- 规则确定
- 与现有 parser / syntax / semantic 分层完全同构
- 性能成本可控
- 回归面小
- 对常见 mudlib 全局 daemon/object 句柄写法收益明显

### 缺点

- 覆盖面刻意受限
- 无法解决 `create()` / `setup()` / `reset()` 中的运行时全局对象赋值
- 无法仅凭 `object` 类型做推导
- 对复杂动态表达式一律保守退化

### 主要实现风险

- declarator syntax node 回找不稳会让结果漂移
- “有可见全局绑定但不允许回退宏”的规则若未写死，结果会被同名宏污染
- 全局对象别名递归若无环路保护，会造成无限递归

## 后续阶段

### P1

后续可在同一设计方向上扩展：

- 继承链中的静态全局对象绑定
- 优先级调整为：
  - 局部绑定
  - 当前文件全局对象绑定
  - 继承全局对象绑定
  - 宏 fallback

### P2

更后续阶段再考虑：

- 运行时全局对象赋值近似模型
- 新 builtin 对象来源
- 更细粒度的失败原因暴露给 consumer

## 推荐实施顺序

1. 新增 `GlobalObjectBindingResolver`
2. 先补其配套单元测试
3. 将其插入 `ObjectInferenceService` 的 identifier receiver 主链
4. 跑 object inference 回归
5. 补 provider integration 测试
6. 确认 completion / definition 至少两条主链回归成立

## 结论

P0 的正确方向，不是让对象推导器开始模拟运行时状态，而是先让“声明即真相”的文件级全局对象进入稳定主链。

只要这一步做得足够严格：

- 全局 daemon/object 句柄写法会立刻变得可用
- completion / definition / hover / signature help 会共享同一新增能力
- 后续 P1 / P2 也能在同一架构方向上自然扩展

这是一条确定、克制、与当前仓库架构相容的改进路径。
