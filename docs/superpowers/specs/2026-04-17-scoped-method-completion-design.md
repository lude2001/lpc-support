# scoped method completion 设计

日期：2026-04-17

## 背景

`0.40.0` 到 `0.43.0` 期间，仓库沿着一条很清晰的语言服务主线推进：

- `0.40.0`
  - 完成单一路径 LSP 收束
- `0.40.1`
  - 统一 callable-documentation 与 signature help
- `0.41.0`
  - 支持当前文件静态全局 `object` 绑定
- `0.42.0`
  - 支持继承链静态全局 `object` 绑定
- `0.43.0`
  - 支持 `::method()` / `room::method()` scoped 方法解析
  - 支持 scoped definition / hover / signature help
  - 支持 scoped documented-return 返回对象传播

当前 `::method()` / `room::method()` 已经可以进入：

- definition
- hover
- signature help
- 返回对象继续传播

但 scoped 调用仍然缺少一个最直接的编辑器入口：

- completion

设计文档也已经明确把它列为当前未覆盖能力：

- `scoped method completion — 当前 ::method() / room::method() 还没有接入补全候选`

因此，这次设计的目标不是引入新的对象推导体系，而是把已经落地的 scoped 语义继续接入最后一个缺失的 consumer。

## 目标

- 为裸 `::method()` 提供 scoped 方法补全
- 为具名限定 `room::method()` 提供 scoped 方法补全
- 严格复用现有 `ScopedMethodResolver` 的 inherit-only 语义
- 不让 scoped completion 回退到：
  - 当前文件同名函数
  - include 文件函数
  - 普通函数
  - simul_efun
  - efun
- 保持与现有 completion 主链一致的返回形态：
  - `CompletionCandidate[]`
  - 文档能力最终仍以共享 callable docs 服务为真源，但 completion 需要单独接 declaration-based resolve 分支

## 非目标

- 不做工作区级 references / rename
- 不做 `call_other(...)` completion
- 不做运行时全局赋值建模
- 不做 `previous_object()` / `environment()` / `master()` 等运行时依赖 efun 推导
- 不做动态 inherit 支持
- 不扩展 `ObjectInferenceService` 的 `->` receiver 语义
- 不新增全文文本扫描
- 不恢复 legacy parse cache 作为生产真源

## 当前现状

### 1. completion 已有两条主路径

`LanguageCompletionService` 当前大致分成两类：

- `identifier` / `type-position`
  - 走 query engine 与 inherited fallback
- `member`
  - 先走 `ObjectInferenceService.inferObjectAccess(...)`
  - 再把对象候选收集为方法补全

也就是说，现有 `member completion` 只覆盖 `obj->method` 这类对象实例语义。

### 2. completion 上下文分析尚未识别 `::`

`CompletionContextAnalyzer` 当前只通过 `->` 正则识别 member context：

- `payload->hp`
- `this_object()->qu`
- `arr[0]->`

它不会把：

- `::cre`
- `room::in`

识别成一个 scoped completion 场景。

### 3. scoped 解析器已经存在

`0.43.0` 已新增：

- `ScopedMethodResolver`
- `ScopedMethodReturnResolver`

它们已经为：

- definition
- hover
- signature help
- documented-return

提供统一的 scoped 解析入口和失败语义。

但需要明确一点：

- 当前 `ScopedMethodResolver.resolveCallAt(document, position)`
  - 负责解析“已经写出来的具体 scoped 调用”
  - 返回的是某个具体方法名的目标实现集合
  - 不是“列出某个 scoped 前缀下全部可补全方法”的枚举接口

因此，completion 不能直接把现有 `resolveCallAt()` 当成候选枚举器使用。

### 4. 当前最明显的缺口

用户现在可以：

- 对 `::create()` 做跳转
- 对 `room::init()` 看 hover 和签名
- 对 `::factory()` 继续传播返回对象

但在实际写代码时：

- `::cr|`
- `room::in|`

仍然拿不到候选。

这让 scoped 语义在“读代码”上已经通了，在“写代码”上仍然是半盲的。

## 设计原则

### 1. scoped completion 不是普通 member completion 的变种猜测

`::` 代表显式父链 / inherit 分支调用，语义已经由 `ScopedMethodResolver` 定义。

所以 completion 不应：

- 重新按文本猜父类
- 重新枚举 include / local / efun 候选
- 在 scoped 失败时偷偷回退到普通函数补全

### 2. completion 必须复用现有 scoped 失败语义

- `::method`
  - 只沿 inherit-only 父链查找
- `room::method`
  - qualifier 必须先唯一映射到 direct inherit 分支

当出现以下情况时，completion 必须保守降级为空 scoped 候选：

- qualifier 歧义
- direct inherit 图不完整
- 存在未解析 inherit
- scoped 形态结构不支持

### 3. 不改变现有 completion 的职责分层

本设计不应把 completion 写成一台新的解析机器，而应尽量复用现有机械：

- `CompletionContextAnalyzer`
- `LanguageCompletionService`
- `ScopedMethodResolver`
- 共享 callable docs 服务

## 支持场景

### 1. 裸 scoped completion

```lpc
void create() {
    ::cr
}
```

应补出 direct inherit 图中可见的父方法，例如：

- `create`
- `reset`
- `init`

前提是这些方法能通过现有 scoped 解析规则到达。

### 2. 具名限定 scoped completion

```lpc
void init() {
    room::in
}
```

应只补出 `room` 所唯一命中的 direct inherit 分支中的方法。

### 3. 多 direct inherit 场景

```lpc
inherit "/std/room";
inherit "/std/combat";

void init() {
    ::in
}
```

裸 `::` 可以枚举父链上可见的 scoped 方法候选，并按 scoped 语义去重。

### 4. 与 documented-return 共存

completion 本身只负责列出方法名，但它选中的 callable target 应继续沿现有文档链工作，因此：

- `::factory` 的 completion item resolve
  - 仍应展示来自父实现的文档与签名

## 明确不支持的场景

以下场景本轮不做：

- `Foo::bar`
  - 其中 `Foo` 不是 direct inherit qualifier，而是别的标识符语义
- 动态 inherit 下的 `room::`
- `call_other(obj, "foo")`
- `environment(obj)->foo()` 这类对象来源推导增强
- 将 scoped completion 扩展成工作区级 rename / references 联动

## 方案比较

### 方案 A：在 `CompletionContextAnalyzer` 中把 `::` 也归为普通 member

优点：

- 表面上改动小

缺点：

- 会把 `::` 与 `->` 混成同一类 member 语义
- `ObjectInferenceService` 并不负责 scoped 解析
- 失败时容易掉回对象推导或普通补全路径
- `room::method` 的 qualifier 唯一匹配规则会被稀释

### 方案 B：为 completion 增加独立的 scoped 上下文与 scoped 候选收集

优点：

- 语义边界清楚
- 能复用现有 scoped 语义边界，而不是重写一套父链规则
- 与 definition / hover / signature help 保持一致
- 更容易测试 “不回退” 约束

缺点：

- 需要给 completion 增加一个新的上下文分支
- 需要补一层 scoped 候选收集与 dedupe

### 结论

采用方案 B。

## 推荐方案

### 1. 为 completion 新增 scoped context

建议把 completion context 从当前的：

- `identifier`
- `member`
- `type-position`
- `include-path`
- `inherit-path`
- `preprocessor`

扩展为显式支持：

- `scoped-member`

它只覆盖两类前缀：

- `::[A-Za-z0-9_]*`
- `identifier::[A-Za-z0-9_]*`

并且只在当前光标确实位于 scoped 方法名位置时触发。

不应在这些位置触发 scoped completion：

- qualifier 上
- 参数区
- 其它普通标识符位置

### 2. 为 `LanguageCompletionService` 增加 scoped 分支

当前 `resolveCompletionCandidates(...)` 对 `member` 会走：

- `ObjectInferenceService`
- `buildObjectMemberCandidates(...)`

推荐新增并行分支：

- `scoped-member`
  - 先走一个 scoped method discovery 边界
  - 再走 `buildScopedMethodCandidates(...)`

而不是让 `scoped-member` 掉进 `member`。

### 3. 新增 scoped method discovery 边界

这里不建议直接复用当前 `ScopedMethodResolver.resolveCallAt(...)`。

更现实的方案有两种：

- 扩展 `ScopedMethodResolver`
  - 新增专门的枚举 API
  - 例如“枚举当前 scoped 上下文可见的方法集合”
- 或新增一个相邻的只读组件
  - 例如 `ScopedMethodDiscoveryService`
  - 专门负责 completion 所需的 scoped 方法枚举

我更推荐第二种：

- 保持 `ScopedMethodResolver`
  - 继续只负责“具体 scoped 调用 -> 目标实现”
- 新增 `ScopedMethodDiscoveryService`
  - 负责“scoped 上下文 -> 可补全方法集合”

但无论选哪一种，都必须复用与现有 resolver 完全一致的 seed / qualifier / inherit-only 语义，不能在 completion 层重写一份新的父链遍历规则。

### 4. 新增 `buildScopedMethodCandidates(...)`

建议新增一个 scoped 专用候选构建器，职责为：

- 将 scoped discovery 产出的可见方法结果转为 `CompletionCandidate[]`
- 按 scoped 语义做去重
- 保留现有 completion item 的 detail / snippet / documentation resolve 兼容形态

候选来源规则：

- `::method`
  - 来自 direct inherit 图中、按 scoped 发现规则可见的方法集合
- `room::method`
  - 仅来自 qualifier 唯一命中的 direct inherit 分支

### 5. completion item resolve 需要单独接线，不应假装已经“天然复用 callable-documentation”

scoped completion item 不应发明新的文档体系。

但这里要说准确一点：当前 completion item resolve 主要走的是：

- `applyEfunDocumentation(...)`
- `applyMacroDocumentation(...)`
- `applyStructuredDocumentation(...)`

它并没有像 signature help / hover 那样，天然走统一的 callable target -> callable doc 解析入口。

因此，这次设计需要显式新增一条最小的 scoped 文档 resolve 边界，而不是只写“继续复用 callable-documentation”。

推荐做法：

- 为 scoped completion candidate 携带足够的 declaration 级元数据
- 在 `resolveCompletionItem(...)` 中新增一个 scoped 分支
- 该分支通过共享文档服务按 declaration key 拉取 callable doc
- 再把 callable doc 渲染成 completion documentation / detail / snippet

候选 metadata 至少应足够表达：

- source uri
- source type = `scoped-method`
- declaration key
- documentation ref（如仍需要）

也就是说，这里不是“沿用当前 structured resolve 就够了”，而是：

- 当前 structured resolve 继续服务普通 local / inherited 候选
- scoped completion 额外新增一个最小的 declaration-based 文档 resolve 分支

### 6. 前缀过滤与排序

排序应延续当前 object member completion 的保守风格：

- 先按可见 scoped 目标收集
- 再按 label 去重
- 用当前输入前缀过滤

建议排序规则：

- 裸 `::`
  - 出现频次更高的 label 优先
  - 其次按名字排序
- `room::`
  - 单分支结果通常不需要额外频次加权
  - 直接按名字排序即可

若实现上希望简化，也可以统一复用：

- 频次优先
- 名字次级排序

## 语义细则

### 1. 裸 `::` 的 completion 语义

输入：

```lpc
::cr
```

行为：

- 只沿 inherit-only 图查找
- 跳过当前文件自身实现
- 不回退 local / include / efun / simul_efun

结果：

- 若解析到目标方法集合，则列出候选
- 若 scoped 结果为 `unknown`
  - 返回空 scoped 候选
- 若 scoped 结果为 `unsupported`
  - 返回空 scoped 候选

### 2. `room::` 的 completion 语义

输入：

```lpc
room::in
```

行为：

- 先把 `room` 映射到 direct inherit 分支
- 只有唯一命中时才继续列出该分支方法

结果：

- qualifier 歧义
  - 返回空 scoped 候选
- direct inherit 未解析
  - 返回空 scoped 候选
- 方法集合为空
  - 返回空 scoped 候选

### 3. 与普通 completion 的关系

一旦当前上下文被识别为 `scoped-member`：

- 不参与 `ObjectInferenceService` 的 `->` 推导
- 不参与 identifier fallback
- 不追加 inherited function fallback

也就是说，scoped completion 是一个独立的、保守的 completion 分支。

### 4. 与 snippet / 参数模板的关系

scoped completion item 可以继续沿用当前函数补全的插入模板：

- `method(${1:param})`

不要求为了 scoped 再单独设计插入格式。

## 组件拆分建议

### 1. `CompletionContextAnalyzer`

新增：

- `extractScopedReceiverContext(...)`
- 或在现有 `extractReceiverContext(...)` 之前增加 scoped 检测

职责：

- 识别 `::` / `identifier::`
- 产出 `kind: 'scoped-member'`
- 提供：
  - `receiverExpression`
  - qualifier 信息
  - current word

### 2. `completion/types.ts`

扩展：

- `CompletionContextKind`
  - 新增 `scoped-member`

若 metadata 需要更强区分，也可新增：

- `CompletionCandidateSourceType`
  - `scoped-method`

### 3. `LanguageCompletionService`

新增：

- `ScopedMethodDiscoveryService`（或等价枚举边界）依赖注入
- `buildScopedMethodCandidates(...)`

调整：

- `resolveCompletionCandidates(...)`
  - 先分派 `scoped-member`
  - 再处理 `member`
  - 最后处理普通标识符路径

### 4. 文档 resolve

这里不应简单写成“复用现有 completion item resolve 逻辑”。

推荐边界是：

- 普通 completion item
  - 继续走现有 `applyStructuredDocumentation(...)`
- scoped completion item
  - 新增 scoped 专用 resolve 分支
  - 通过 declaration key 从 `FunctionDocumentationService` 取 callable doc
  - 再复用现有 renderer / markdown 组装模式

这样可以避免两类错误：

- 误把 scoped 候选降级成普通 inherited/local 候选
- 指望 `ProjectSymbolIndex` 的 exported function 信息自动覆盖 scoped 文档需求

## 测试矩阵

### 1. `completionContextAnalyzer.test.ts`

新增：

- `::cr` 被识别为 `scoped-member`
- `room::in` 被识别为 `scoped-member`
- qualifier 位置不误判为 scoped completion
- 参数位置不误判为 scoped completion
- 普通 `payload->hp` 行为不回归

### 2. `LanguageCompletionService` 单测

新增：

- `::cr` 走 scoped method discovery，不走 `ObjectInferenceService`
- `room::in` 在 qualifier 唯一命中时返回分支方法候选
- `room::in` 歧义时返回空 scoped 候选
- scoped `unknown` / `unsupported` 时不回退普通函数补全
- scoped completion item 的 detail / insertText 与现有函数补全一致
- scoped completion item resolve 能按 declaration key 拉到父实现 / 限定分支实现文档
- scoped completion resolve 失败时不会掉回普通 local / inherited structured resolve

### 3. `providerIntegration.test.ts`

新增真实链路回归：

- `::create` completion 能列出父实现方法
- `room::init` completion 只列出 direct inherit 分支方法
- 多 direct inherit 下裸 `::` 去重后返回候选
- 动态 / 未解析 inherit 下 scoped completion 保守为空

### 4. completion handler / LSP 集成

必要时补：

- trigger character 为 `:` 后的 scoped completion 行为
- 多行 scoped 调用前缀场景

## 风险与缓解

### 风险 1：把 `::` 错识别成普通 member

缓解：

- 显式新增 `scoped-member` context
- 不复用 `member` 的 `->` 分支正则

### 风险 2：scoped 失败时错误回退

缓解：

- `scoped-member` 一旦命中，直接走 scoped 分支
- `unknown` / `unsupported` 均返回空 scoped 候选

### 风险 3：重复实现一套 scoped inherit 解析

缓解：

- completion 只消费共享的 scoped discovery / resolver 语义边界
- 不在 completion 层重新发明一套 inherit 图遍历

### 风险 4：文档 resolve 与 completion source type 不一致

缓解：

- 明确 `sourceType` 使用 `scoped-method`
- 为 scoped completion 单独接 declaration-based doc resolve
- 不让 scoped 候选误掉回普通 structured resolve

## 实施顺序建议

1. completion context 扩展
2. completion types / metadata 最小扩展
3. scoped method discovery 边界落位
4. `LanguageCompletionService` scoped 分支接线
5. scoped 候选构建与 dedupe
6. completion item resolve 接 declaration-based scoped doc 分支
6. provider integration / handler 回归

## 结论

`scoped method completion` 是当前阶段最自然、最便宜、也最符合主线的一步。

它不是新的对象推导题目，而是把已经落地的 scoped 语义补齐到最后一个关键 consumer 上：

- 从“能跳、能看、能签名”
- 变成“写的时候也能补”

只要坚持两条原则，这个功能就会保持干净：

- scoped completion 只复用现有 scoped 解析语义
- scoped 失败时宁可不给，也绝不回退乱猜
