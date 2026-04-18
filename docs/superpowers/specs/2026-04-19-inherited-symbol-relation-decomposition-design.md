# Inherited Symbol Relation Decomposition Design

## 1. 概述

截至 `0.45.1` 之后的导航减债路线：

- `P0`
  - 旧 `Workspace*` 导航子系统已退场
- `P1`
  - server 侧 language context / document / workspaceRoot 构造已统一
- `P2-alpha`
  - `LanguageDefinitionService` 已拆成 coordinator + resolver + support
- runtime/lifecycle closeout
  - definition 依赖缓存的 `didChange` 闭环已经补齐

当前导航主链里剩下最明显的热点类，是
[`InheritedSymbolRelationService.ts`](/D:/code/lpc-support/src/language/services/navigation/InheritedSymbolRelationService.ts)：

- 单文件约 `530` 行
- 同时承担：
  - 继承链函数 family 解析
  - scoped 函数引用匹配
  - 文件级全局变量 binding 解析
  - inherited references 收集
  - rename target 分类
  - inherited rename edits 组装

它已经成为 definition 之后的下一个“高耦合导航热点”。

本 spec 定义导航减债路线中的下一步：

**在不改变 references / rename 产品语义的前提下，把 `InheritedSymbolRelationService` 拆成边界清晰的关系解析单元，并把它退化成一个薄 façade。**

## 2. 问题陈述

### 2.1 当前类同时承载两套关系解析和两类消费者语义

[`InheritedSymbolRelationService`](/D:/code/lpc-support/src/language/services/navigation/InheritedSymbolRelationService.ts) 当前对外只暴露 3 个 public API：

- `collectInheritedReferences(...)`
- `classifyRenameTarget(...)`
- `buildInheritedRenameEdits(...)`

但这 3 个 API 背后混合了两套完全不同的关系模型：

1. `function family`
   - 当前文件可见函数
   - 可证明继承链函数 family
   - `::foo()` / `room::foo()` 这种 scoped 调用匹配
2. `file-global binding`
   - 当前文件 file-global 绑定
   - 继承链 file-global owner 追溯
   - sibling branch ambiguity / unresolved inherit 降级

这些模型被揉进一个类之后，references 和 rename 看似“共享了同一套能力”，但其实共享的是一个过厚的实现，而不是清晰的关系边界。

### 2.2 references 与 rename 复用了一组过宽的内部状态

当前类的私有方法大致可分成几组：

- 函数 family 解析
  - `resolveFunctionFamilyFromVisibleSymbol(...)`
  - `resolveFunctionFamilyFromScopedCall(...)`
  - `collectInheritedFunctionFamilyDocuments(...)`
  - `findGlobalFunctionSymbol(...)`
- 函数 references 收集
  - `collectFunctionFamilyMatches(...)`
  - `collectLocalFunctionMatches(...)`
  - `collectScopedFunctionMatches(...)`
- file-global binding 判定
  - `resolveVisibleFileGlobalBinding(...)`
  - `resolveBranchGlobalOwner(...)`
  - `findFileGlobalSymbol(...)`
- file-global references / rename 支撑
  - `collectFileGlobalMatches(...)`
  - `rangesEqual(...)`
- scoped 语法 helper
  - `collectCallExpressions(...)`
  - `getScopedMethodRange(...)`
- 通用 helper
  - `getWordAtPosition(...)`
  - `pushUniqueMatch(...)`
  - `toVsCodePosition(...)`

这里真正的问题不是“方法多”，而是：

- references 和 rename 共享了太多实现细节
- scoped 语法逻辑又和 function family 逻辑纠缠在一起
- file-global binding 的 owner 解析和最终 edits 组装没有明确分层

### 2.3 当前结构已经不利于继续减债

目前消费者已经是薄的：

- [`LanguageReferenceService.ts`](/D:/code/lpc-support/src/language/services/navigation/LanguageReferenceService.ts)
- [`LanguageRenameService.ts`](/D:/code/lpc-support/src/language/services/navigation/LanguageRenameService.ts)
- 生产接线在 [`createProductionLanguageServices.ts`](/D:/code/lpc-support/src/lsp/server/runtime/createProductionLanguageServices.ts)

这意味着当前真正的维护负担已经集中进 `InheritedSymbolRelationService`。

如果继续在这个类里叠逻辑，会出现和旧 `LanguageDefinitionService` 一样的问题：

- 新边界难以单测
- 行为改动很容易影响 references 与 rename 两侧
- 后续任何关于继承链导航的改动都会再次把它推向 god object

## 3. 目标与非目标

### 3.1 目标

- 把 `InheritedSymbolRelationService` 从“大而全实现类”降级为 façade / coordinator
- 按关系职责拆出独立单元，而不是按 references / rename 机械横切
- 让函数 family、scoped references、file-global binding、rename edit 组装有独立边界
- 保持 references / rename 的产品语义和注入面不变
- 增强 `classifyRenameTarget(...)` 的直接测试保护网

### 3.2 非目标

本轮 **不** 做以下事情：

- 不恢复工作区级函数 references / rename
- 不修改 `LanguageReferenceService` / `LanguageRenameService` 对外 API
- 不改变当前 “文件级 + 可证明继承链级” 的导航边界
- 不拆 `ASTManager`
- 不重构 `ScopedMethodResolver`
- 不重写 `vscodeShim`
- 不把 scoped method 的通用语法支持扩展成更大范围的 object inference 重构

## 4. 方案对比

### 4.1 横切方案：按 references / rename 拆成两个 service

做法：

- 把当前类拆成：
  - `InheritedReferenceService`
  - `InheritedRenameService`

优点：

- 从名字上最直观

缺点：

- function family 解析会被 references / rename 两侧重复持有
- file-global binding owner 解析也会复制
- 最终只是把一个大类拆成两个中等大小的类

### 4.2 推荐方案：按关系职责纵向拆，但控制单元数量

做法：

- 保留 `InheritedSymbolRelationService` 作为 façade
- 按关系职责拆成两块业务单元：
  - `InheritedFunctionRelationService`
  - `InheritedFileGlobalRelationService`
- rename edit 组装继续由 façade 编排，不额外再拆一个 builder 类

优点：

- references / rename 共享的是同一份关系真源，而不是共享一个大实现类
- 单元数量足够少，不会把减债做成“类爆炸”
- 单元边界清晰，更适合补直接测试
- 后续若要继续减债，可以在这两块业务单元上逐步深化，而不是反复回到一个热点类

缺点：

- 需要非常明确方法归属，避免“只是把一个文件拆成多个文件”

### 4.3 过度抽象方案：构造泛化的 `SymbolRelationGraph`

做法：

- 把函数 / file-global / scoped / rename / references 全部抽象成一个更大的 graph 层

优点：

- 长期看可能更统一

缺点：

- 明显超出当前边界
- 会重新放大导航主链的抽象复杂度
- 与当前“只做减债、不做能力扩张”的目标冲突

### 4.4 结论

本 spec 采用 **4.2 推荐方案**：

**按关系职责纵向拆分，保留 `InheritedSymbolRelationService` 为薄 façade。**

## 5. 架构设计

### 5.1 总体结构

拆分后的结构建议为：

- `InheritedSymbolRelationService`
  - façade / 协调器
- 关系单元：
  - `InheritedFunctionRelationService`
  - `InheritedFileGlobalRelationService`

本轮不新增一个宽泛的 `Support` / `Utils` 类来承接杂项职责。

### 5.2 façade 职责

`InheritedSymbolRelationService` 保留：

- 构造注入
- 3 个现有 public API
- references / rename 的短路顺序编排
- 最终 match / edit 结果归一化

它不再直接承载完整关系解析逻辑。

### 5.3 关系单元边界

#### `InheritedFunctionRelationService`

负责：

- 从当前可见函数符号出发解析 function family
- 处理可证明继承链遍历与 unresolved inherit 降级
- 收集当前文件普通函数引用
- 收集 `::foo()` / `room::foo()` 这类 scoped 函数引用
- 统一产出 inherited function references

收纳的方法：

- `resolveFunctionFamilyFromVisibleSymbol(...)`
- `resolveFunctionFamilyFromScopedCall(...)`
- `collectInheritedFunctionFamilyDocuments(...)`
- `collectFunctionFamilyMatches(...)`
- `collectLocalFunctionMatches(...)`
- `collectScopedFunctionMatches(...)`
- `findGlobalFunctionSymbol(...)`
- `collectCallExpressions(...)`
- `getScopedMethodRange(...)`

不负责：

- file-global binding
- rename

#### `InheritedFileGlobalRelationService`

负责：

- 解析一个标识符在当前位置是否能唯一归属到 file-global binding
- 保持当前状态机语义：
  - `resolved`
  - `ambiguous`
  - `unresolved`
  - `none`
- 基于已解析 binding 收集 inherited file-global 引用点
- 为 rename 提供已证明的 file-global 扩展结果

收纳的方法：

- `resolveVisibleFileGlobalBinding(...)`
- `resolveBranchGlobalOwner(...)`
- `collectFileGlobalMatches(...)`
- `findFileGlobalSymbol(...)`
- `rangesEqual(...)`

这是 rename 与 file-global references 的共享真源。

### 5.4 helper 边界

以下 helper 可以继续保持为轻量文件级 helper 或复用现有 util，不要额外抽成一个新的宽泛 support 类：

- `getWordAtPosition(...)`
- `pushUniqueMatch(...)`
- `toVsCodePosition(...)`
- `normalizeWorkspaceUri(...)`
- 共享 host 打开文档与 ASTManager snapshot 入口

此外，`InheritedFunctionRelationService` 当前内部需要的 scoped 语法识别逻辑，应和既有
[`ScopedMethodIdentifierSupport.ts`](/D:/code/lpc-support/src/language/services/navigation/ScopedMethodIdentifierSupport.ts)
保持同域，不得重新发明第二套 scoped 命中语义。

## 6. 方法归属表

| 新单元 | 归属方法 |
| --- | --- |
| `InheritedFunctionRelationService` | `resolveFunctionFamilyFromVisibleSymbol`, `resolveFunctionFamilyFromScopedCall`, `collectInheritedFunctionFamilyDocuments`, `collectFunctionFamilyMatches`, `collectLocalFunctionMatches`, `collectScopedFunctionMatches`, `findGlobalFunctionSymbol`, `collectCallExpressions`, `getScopedMethodRange` |
| `InheritedFileGlobalRelationService` | `resolveVisibleFileGlobalBinding`, `resolveBranchGlobalOwner`, `collectFileGlobalMatches`, `findFileGlobalSymbol`, `rangesEqual` |
| `InheritedSymbolRelationService` façade | `collectInheritedReferences`, `classifyRenameTarget`, `buildInheritedRenameEdits`, 以及最薄的分流 / edit 组装逻辑 |
| 文件级 helper / 现有 util | `getWordAtPosition`, `pushUniqueMatch`, `toVsCodePosition`, `normalizeWorkspaceUri` |

## 7. 调用顺序与失败语义

### 7.1 references 调用顺序

`collectInheritedReferences(...)` 的内部顺序必须保持为：

1. 读取 `word + position`
2. 尝试函数 visible-symbol family
3. 尝试 scoped family
4. 尝试 file-global binding
5. 返回合并后的 inherited references

不能把 file-global 判定提前到函数 / scoped 前面。

### 7.2 references 失败语义

- 函数 family 解析若出现 unresolved inherit
  - 保守返回空 inherited references
- scoped 调用若 `qualifier` 不唯一或 resolver 返回非 `resolved`
  - 保守忽略 scoped matches
- file-global binding 若进入 `ambiguous` / `unresolved` / `none`
  - 保守不扩 inherited references
- 绝不回退到工作区按名字扩散

### 7.3 rename 失败语义

- `PARAMETER`、非 global `VARIABLE`
  - 保持 `current-file-only`
- `FUNCTION`、`STRUCT`、`CLASS`
  - 保持 `unsupported`
- `file-global`
  - 必须由 `InheritedFileGlobalRelationService` 证明后才允许
- sibling branch ambiguity / unresolved inherit / owner 非唯一
  - `buildInheritedRenameEdits(...)` 返回空 edits

### 7.4 不允许引入的新行为

- 不新增新的 rename 目标类型
- 不放宽函数 rename
- 不恢复工作区级函数 references
- 不扩大 file-global rename 的覆盖面

## 8. 测试设计

### 8.1 保留现有 façade 行为测试

现有
[`InheritedSymbolRelationService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts)
必须继续覆盖：

- provable inherit-family function references
- scoped qualifier ambiguity
- unresolved inherit 收敛
- four-slash Windows URI canonicalization
- ambiguous file-global rename edits 为空

### 8.2 新增单元测试

新增测试建议：

- `InheritedFunctionRelationService.test.ts`
- `InheritedFileGlobalRelationService.test.ts`

这些测试只锁各自边界，不复制整套 façade 集成逻辑。

### 8.3 关键缺失保护网

当前最关键的缺口是：

**`classifyRenameTarget(...)` 缺少直接单测。**

本轮必须新增直接测试，至少覆盖：

- local variable / parameter -> `current-file-only`
- function -> `unsupported`
- struct/class -> `unsupported`
- provable inherited file-global -> `file-global`

同时，新的 `InheritedFileGlobalRelationService` 也必须拥有直接单测，至少锁住：

- resolved binding
- ambiguous sibling branches
- unresolved inherit
- `collectFileGlobalMatches(...)` 对 owner 的二次验证不过度放宽

### 8.4 Consumer / runtime 回归保持不变

以下测试必须继续全绿：

- [`navigationServices.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/navigationServices.test.ts)
- [`languageParity.test.ts`](/D:/code/lpc-support/src/lsp/__tests__/languageParity.test.ts)
- [`createProductionLanguageServices.test.ts`](/D:/code/lpc-support/src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts)

这轮不应改变它们的用户可见断言。

## 9. 验收标准

- `InheritedSymbolRelationService` 退化成 façade / coordinator
- 函数关系与 file-global 关系都有独立业务单元
- references / rename 对外 API 不变
- references / rename 产品行为不变
- `classifyRenameTarget(...)` 拥有直接测试保护网
- 不留下新的 god object

## 10. 结论

当前 `InheritedSymbolRelationService` 的问题不是“功能不对”，而是**结构上已经承担了过多不同层次的关系职责**。

这轮减债的正确方向不是再造一个更大的导航抽象层，也不是把 references / rename 简单横切，而是：

**把底层关系真源拆清楚，让 façade 只负责编排。**

这是在不改变当前导航边界的前提下，把这块主债真正清掉的最小风险路径。
