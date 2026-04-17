# :: 范围方法解析 P2-alpha 设计

日期：2026-04-17

## 背景

`0.40.1` 到 `0.42.0` 期间，仓库已经沿着一条非常清晰的主线推进：

- 统一 callable-documentation 与 signature help
- 统一 language service 主路径
- 将对象推导从基础 `->` 场景逐步扩展到：
  - 当前文件静态全局对象绑定
  - 继承链静态全局对象绑定
  - documented-return 返回对象传播

当前这条主线已经能稳定服务于：

- definition
- hover
- signature help
- 对象方法返回对象继续传播

但还有一类 LPC 中非常常见、而编辑器仍然半盲的调用语义没有进入主链：

```lpc
void create() {
    ::create();
}
```

```lpc
void init() {
    room::init();
}
```

当前仓库中与此相关的事实是：

- 语法层已经识别 `::`
  - `ScopeIdentifierContext` 会为裸 `::method` 生成带 `scopeQualifier: "::"` 的 `Identifier`
  - `MemberAccessExpression` 的 `metadata.operator` 已可为 `::`
- 但对象推导主链当前只处理 `->`
- `ObjectInferenceService` 的现有测试明确锁定：
  - `Foo::bar()` 不产生对象推导
- signature help 当前也只把 `->` 识别为对象方法调用

这意味着：

- `::method()` 仍会掉出对象/方法语义主链
- `room::method()` 也不会被当成“显式 inherit 范围调用”处理
- `::factory()` 这类父方法返回对象，无法继续参与后续对象方法推导

因此，P2-alpha 的目标不是扩一个新的“动态对象系统”，而是把 `::` 这类**静态可证明的范围方法调用**接入现有 callable / object inference 主路径。

## 目标

- 支持裸 `::method()` 的显式父方法解析
- 支持具名限定 `room::method()` 的 inherit 分支方法解析
- 将 `::` 调用结果接入：
  - definition
  - hover
  - signature help
  - documented-return 返回对象继续传播
- 保持与现有对象推导一致的规则哲学：
  - 能证明才返回结果
  - 不能证明就 `unknown/unsupported`
  - 绝不猜测 scope qualifier 对应的 inherit 分支
- 全程复用现有：
  - `ParsedDocument -> SyntaxDocument -> SemanticSnapshot`
  - callable-documentation 主链
  - `TargetMethodLookup`
  - `InheritanceResolver`

## 非目标

- 不支持 `call_other(...)` 的特殊语义
- 不支持 `environment(...)` / `previous_object()` / `master()` 等运行时对象来源
- 不支持 `create()` / `setup()` / `reset()` 中的运行时全局对象赋值建模
- 不支持动态 inherit
  - 即当前主链无法稳定解出唯一路径的 inherit
- 不支持跨函数数据流
- 不让 `::` 与 `->` 共享同一套“对象实例 receiver”语义
- 不重新设计 parser / syntax / semantic 边界
- 不引入新的文本扫描或 legacy parse cache 真源

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

- provider 或业务逻辑重新全文扫描结构
- 重新让 legacy parse cache 成为生产真源
- 重新把 parser / syntax / semantic 混成新的泛化 “AST”
- 为 `::` 单独发明与现有 callable 主链平行的第二套解析器

### 语义约束

P2-alpha 必须坚持以下规则：

- `::` 是“显式范围方法调用”，不是对象实例方法调用
- 一旦识别为 `::` 调用，就不再回退到普通函数 / efun / simul_efun 语义
- `room::method()` 中的 qualifier 必须先唯一映射到某条 inherit 分支
- qualifier 无法唯一映射时，统一保守失败

## 术语与支持形态

本设计只支持两种范围方法调用形态：

### 1. 裸范围调用

```lpc
::create()
```

在 syntax 层中，这类调用表现为：

- `CallExpression`
- callee 为 `Identifier`
- `Identifier.metadata.scopeQualifier === "::"`

语义为：

- 显式调用父链上的同名方法
- 不应命中当前文件自身实现

### 2. 具名限定范围调用

```lpc
room::init()
```

在 syntax 层中，这类调用表现为：

- `CallExpression`
- callee 为 `MemberAccessExpression`
- `MemberAccessExpression.metadata.operator === "::"`
- 左侧为 qualifier 标识符
- 右侧为方法名标识符

语义为：

- 显式限定到某条 inherit 分支
- 只有 qualifier 唯一命中 direct inherit 分支时才继续解析

### 明确不支持的 scope 形态

以下形态在 P2-alpha 一律视为 `unsupported`：

- 左侧不是标识符的 `::` 调用
- qualifier 对应动态 / 未解析 inherit 的 `::` 调用
- 无法唯一确定 direct inherit 分支的具名限定调用

## 动态 inherit 的定义

本设计中的“动态 inherit”并不是语言学意义上的“必须运行时求值”，而是：

- 当前 `parser / syntax / semantic / macro` 主链
- 无法把 inherit 表达式稳定收敛为唯一父文件路径

典型例子包括：

- 条件分支决定 inherit 目标
- 表达式拼接得到 inherit 路径
- 外部环境差异导致 macro inherit 无法唯一解析

静态可支持的 inherit 世界是：

```lpc
inherit "/std/room";
inherit ROOM_BASE;
```

前提是：

- `ROOM_BASE` 能在当前上下文中稳定解析到唯一路径

## 现有能力基础

P2-alpha 并不是从零开始，仓库里已经有 4 块现成基础设施：

### 1. `::` 的 syntax 表达已存在

`src/syntax/builders/expressionBuilders.ts` 已经同时支持：

- `ScopeIdentifierContext`
- `MemberAccessExpression.metadata.operator === "::"`

说明这次不需要修改 grammar，也不需要改 parser 层。

### 2. 继承链路径解析能力已存在

仓库已有：

- `src/completion/inheritanceResolver.ts`
- `src/targetMethodLookup.ts`

它们已经掌握：

- direct inherit 解析
- 递归父链遍历
- cycle guard
- 声明顺序语义

P2-alpha 不应发明第三套 inherit 解析逻辑。

### 3. callable-documentation 主链已存在

definition / hover / signature help 当前已经共享一条 callable-documentation 主链，因此：

- `::` 进入 callable target 解析后
- 可以自然受益于现有文档渲染、签名合并和 consumer 分发逻辑

### 4. documented-return 传播设施已存在

仓库已有：

- `ReturnObjectResolver`
- `ObjectMethodReturnResolver`

这说明：

- “方法声明 -> documented return objects -> 对象候选”
- 已经是一条成熟能力

P2-alpha 的 `::factory()` 返回传播，应复用这条模式，而不是硬塞进 `->` receiver 语义。

## 方案比较

### 方案 A：把 `::` 强行塞进现有对象 receiver 分类

优点：

- 看起来复用率高

缺点：

- `::` 不是对象实例方法调用
- 会把 scope 语义污染到 `ReceiverClassifier / ObjectInferenceService` 的 `->` 机械里
- `room::method()` 的 qualifier 解析和 `::factory()` 的返回传播都很容易变脏

### 方案 B：新增共享的 `ScopedMethodResolver`

优点：

- 语义边界清楚
- `definition / hover / signature help / 返回传播` 可共用一个解析入口
- 仍能最大化复用现有 inherit 路径解析与 callable 主链

缺点：

- 需要新增一层 shared resolver 与 target type

### 方案 C：每个 consumer 各自单独识别 `::`

优点：

- 单次改动看起来分散、直接

缺点：

- 很快会出现 definition / hover / signature help 语义不一致
- `::factory()` 的返回对象传播会无处落脚
- 明显违背最近版本统一主链的方向

### 推荐方案

推荐方案 B：

- 新增共享 `ScopedMethodResolver`
- 将 `::` 调用视为独立的“范围方法调用”语义
- 统一供 definition / hover / signature help / 返回对象传播使用

## 总体方案

P2-alpha 采用“两类 resolver + 一个新 callable target 种类”的设计：

- `ScopedMethodResolver`
  - 负责解析 `::method()` 与 `room::method()`
- `ScopedMethodReturnResolver`
  - 负责把 scope 方法声明的 documented return objects 转为对象候选
- `scopedMethod` callable target
  - 接入 callable-documentation / signature help 主链

### 为什么不让 `ScopedMethodResolver` 直接替代 `TargetMethodLookup`

因为二者职责不同：

- `TargetMethodLookup`
  - 解决“给定目标文件路径，沿实现链查方法”
- `ScopedMethodResolver`
  - 解决“当前调用是否是 `::`，它应命中哪条 inherit 分支 / 哪组父实现”

P2-alpha 应让二者形成组合，而不是互相覆盖。

## 组件设计

### `ScopedMethodResolver`

建议新增：

- `src/objectInference/ScopedMethodResolver.ts`

职责：

- 识别当前 call expression 是否为支持的 `::` 调用
- 解析 scope 调用目标
- 产出可供 consumer 使用的“已解析方法实现集合”

建议核心输出：

- `status`
  - `resolved`
  - `multiple`
  - `unknown`
  - `unsupported`
- `methodName`
- `qualifier`
  - 裸 `::` 时为空
- `targets`
  - 每个 target 至少包含：
    - target 文件路径
    - method 声明 range
    - source label

### `ScopedMethodReturnResolver`

建议新增：

- `src/objectInference/ScopedMethodReturnResolver.ts`

职责：

- 对已解析 scope 方法目标逐个读取 documented return objects
- 复用 `ReturnObjectResolver.resolveDocumentedReturnOutcome(...)`
- 对多个实现执行与现有对象方法返回传播一致的合并/阻断规则

这层不应重新实现：

- 路径解析
- callable 文档读取
- `@lpc-return-objects` 解释

### callable target 扩展

在 callable-documentation 主链中新增：

- `ResolvedCallableTarget.kind = "scopedMethod"`

作用：

- 让 `::` 方法与 `objectMethod`、`local`、`inherit`、`include`、`efun` 一样进入共享 discovery / doc resolve / signature render 机械

## 解析规则

### 1. 裸 `::method()`

语义规则：

- 从当前文件的 direct inherits 开始
- 按现有 inherit 声明顺序遍历
- 跳过当前文件自身实现
- 在父链中查找同名方法

结果规则：

- 命中 1 个实现：
  - `resolved`
- 命中多个实现：
  - `multiple`
- 未命中：
  - `unknown`

### 2. `room::method()`

语义规则分两步：

#### 第一步：qualifier -> direct inherit 分支

qualifier 只允许映射到 **当前文件 direct inherit**。

本阶段推荐使用以下映射规则：

- 对每个已解析 direct inherit target
- 取其目标文件 basename 去掉 `.c`
- 与 qualifier 做大小写敏感精确匹配

例如：

- `inherit "/std/room";`
  - qualifier key 为 `room`
- `inherit "/std/battle_room";`
  - qualifier key 为 `battle_room`

这一步的关键是：

- qualifier 命中的必须是 direct inherit 分支
- 不是深层父类 basename

#### 第二步：仅在该分支内查找方法

qualifier 唯一命中后：

- 只在该 direct inherit 分支及其继续向上的实现链中查方法
- 不扩大到其他 direct inherit sibling

### 3. qualifier 失败规则

若 `room::method()` 的 qualifier 不能唯一命中 direct inherit 分支，则：

- definition / hover / signature help / 返回传播统一失败
- 返回 `unknown` 或 `unsupported`
- 不猜最近的 direct inherit
- 不回退到“任意父链同名方法”
- 不扩成多候选

推荐分类：

- qualifier 有语义形态但无法唯一解析分支
  - `unknown`
- 调用形态本身超出支持范围
  - `unsupported`

## 返回对象继续传播

P2-alpha 必须让以下链路变得可用：

```lpc
object ob = ::create_weapon();
ob->query_damage();
```

```lpc
object ob = room::factory();
ob->query_name();
```

传播规则：

- 命中单一 scope 方法实现时
  - 直接读取该实现的 documented return objects
- 命中多个 scope 方法实现时
  - 合并多个实现的 return objects
  - 但只要任一实现缺少可证明返回对象
    - 整体保守降级为 `unknown`

这条规则必须与现有 `ObjectMethodReturnResolver` 的 blocker 语义保持一致。

## 主链路接线

### `LanguageDefinitionService`

在普通函数 / 对象方法 fallback 之前：

- 先识别当前光标是否位于支持的 `::` 调用成员名上
- 若是，则调用 `ScopedMethodResolver`
- 依据 resolver 结果返回：
  - 单 location
  - 多 location
  - 空结果

一旦识别为 `::` 调用：

- 不允许再回退到普通函数 / efun / simul_efun 定义查找

### `LanguageHoverService`

新增 `::` callable target 入口：

- 先解析 scoped method targets
- 再沿现有 callable-documentation 渲染流程输出 hover

### `LanguageSignatureHelpService`

当前 `getCalleeInfo(...)` 需要从两类调用拓展到三类：

- `function`
- `objectMethod`
- `scopedMethod`

其中：

- 裸 `::method()`：
  - `Identifier.metadata.scopeQualifier === "::"`
  - 识别为 `scopedMethod`
- `room::method()`：
  - `MemberAccessExpression.metadata.operator === "::"`
  - 识别为 `scopedMethod`

之后新增：

- `discoverScopedMethodTargets(...)`

并将其并入现有 callable target 合并链。

### 返回对象传播入口

P2-alpha 不建议把 `::` 塞进 `ReceiverClassifier` 的实例 receiver 分类中。

推荐做法：

- 在 `ReturnObjectResolver` 中识别支持的 scoped call expression
- 命中后委托 `ScopedMethodReturnResolver`

原因：

- 裸 `::method()` 是 call expression whose callee is scope-qualified identifier
- `room::method()` 是 call expression whose callee is `MemberAccessExpression(::)`
- 二者都属于“方法声明解析后再读 documented return”，而不是“对象 receiver 先求值”

## 与现有继承解析的一致性

P2-alpha 必须避免出现第四套 inherit 解析逻辑。

最低要求：

- `ScopedMethodResolver` 使用与现有 `InheritanceResolver` 一致的 direct inherit 路径解析语义
- `ScopedMethodResolver` 使用与现有 `TargetMethodLookup` 一致的父链遍历顺序
- 如果现有 `TargetMethodLookup` 的内部路径解析逻辑与 `InheritanceResolver` 不完全一致
  - 实现阶段应优先抽共享 helper 或显式复用 `InheritanceResolver`
  - 不允许 scoped 方法解析再复制一份私有路径规则

## 优先级与互斥规则

### `::method()`

- 优先于普通函数 fallback
- 不与 `->` 对象实例方法语义混用
- 命中多个父实现时可以保留多候选结果

### `room::method()`

- qualifier 解析优先于任何同名局部变量、宏或普通标识符语义
- qualifier 失败时直接终止，不向普通函数 / 任意父链回退

### 与普通函数查找的关系

一旦调用被识别为支持的 `::` 语义：

- definition / hover / signature help / 返回传播
- 全部以 scoped method 结果为准

## 失败语义

### 裸 `::method()`

- 命中 1 个实现
  - `resolved`
- 命中多个实现
  - `multiple`
- 父链下一个也找不到
  - `unknown`
- 调用结构超出支持范围
  - `unsupported`

### `room::method()`

- qualifier 唯一命中，方法找到
  - `resolved`
- qualifier 唯一命中，但方法不存在
  - `unknown`
- qualifier 无法唯一命中
  - `unknown`
- 调用形态不受支持
  - `unsupported`

## 测试矩阵

至少需要覆盖以下 4 组测试：

### 1. resolver / service 单测

- 裸 `::create()` 命中直接父实现
- 多 direct inherit 下 `::init()` 按既有继承顺序产生单结果或多结果
- `room::init()` 命中唯一 direct inherit 分支
- `room::init()` qualifier 歧义时保守失败
- `room::init()` qualifier 唯一命中但方法不存在时失败
- `::create_weapon()` 返回对象继续传播
- `room::factory()` 返回对象继续传播
- 多实现返回对象合并
- 任一实现缺失 annotation 时传播 blocker 降级

### 2. consumer 集成回归

- definition
  - `::method()` 不回退到普通函数 / simul_efun
- hover
  - 展示父实现文档
- signature help
  - `::method(...)` 命中父实现签名
- named scope
  - `room::method(...)` 走同一条主链

### 3. 负向回归

- 非支持形态的 `Foo::bar()` 不误入对象实例方法推导
- 动态 inherit 保持 `unsupported/unknown`
- `call_other`
- `environment(ob)`
- 运行时全局赋值
  - 都不因本次改动被误吸进 scoped method 机械

### 4. 端到端体感回归

- 子类 override 后的 `::create()` / `::init()`：
  - definition / hover / signature help 行为一致
- `object ob = ::factory(); ob->query_name();`
  - 真实走通返回对象继续传播

## 实现风险

### 1. qualifier 映射规则过宽

如果 qualifier 映射不限制在 direct inherit basename：

- 很容易把 `room::method()` 错配到深层父类
- 或错误落到同名 sibling 分支

### 2. `::` 识别后仍然掉回普通函数主链

如果 definition / hover / signature help 只“尝试一下” scoped 解析，失败后又回退普通函数：

- 会重新引入 simul_efun / efun 误命中
- 与 scope 语义直接冲突

### 3. 返回传播挂错层

如果把 `::` 返回传播强行塞进 `->` receiver 语义：

- 裸 `::method()` 和 named scope `room::method()` 都会变成别扭特判
- 后续 `call_other`、动态对象来源更容易把 object inference 搅脏

## 后续阶段

P2-alpha 完成后，后续才值得考虑：

- 运行时全局对象赋值近似模型
- `call_other(...)` 的保守语义化处理
- 更复杂的 qualifier 解析规则
  - 如未来如果语法/语义层引入显式 named inherit 元数据，可替换 basename 映射
- 更细粒度的 failure diagnostics 暴露给 consumer

## 结论

P2-alpha 最合适的下一步，不是直接冲向运行时对象状态建模，而是先把 `::` 这类**静态可证明的范围方法调用**接入现有主链。

这一步的价值在于：

- 直接补齐 LPC 中高频、但当前编辑器仍半盲的父方法调用场景
- 同时服务于 definition / hover / signature help / 返回对象继续传播
- 最大化复用当前版本已经跑通的 callable / inherit / documented-return 机械
- 不把对象推导带进运行时状态猜测

只要严格坚持：

- `::` 独立于 `->` 语义
- `room::method()` qualifier 必须唯一命中
- 失败时不回退普通函数 / efun / simul_efun

这就会是一条小而硬、确定、可测试、且高度贴合现有主线的演进路径。
