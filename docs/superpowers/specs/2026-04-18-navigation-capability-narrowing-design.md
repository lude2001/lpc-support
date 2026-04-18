# Navigation Capability Narrowing 设计

## 背景

`0.45.0` 引入了工作区级 `references` / 安全 `rename`，目标是把导航链从单文件能力扩展到“可证明属于同一 owner 的跨文件符号”。这条路线对传统静态语言成立，但对 LPC 的函数语义并不匹配：

- 一个大型 LPC 项目往往有上万个文件
- 函数调用经常依赖 `inherit`、`::foo()`、`room::foo()`、`call_other`、字符串函数名、mudlib/driver 约定回调等运行时关系
- 当前导航链没有一套“工作区级、可闭包、可证明”的对象/调用归属推导器

这导致当前工作区级函数 `references` 同时出现两个问题：

- **慢**：先按函数名把候选文件扩到整个工作区，再逐文件重做 owner 解析
- **不准**：真正决定 owner 的外部 usage 解析几乎不给升级路径，大量候选最后被拒绝或漏掉

现状对应实现：

- [WorkspaceSymbolRelationService.ts](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSymbolRelationService.ts) 会按函数名从工作区索引获取候选文件
- [WorkspaceReferenceCollector.ts](/D:/code/lpc-support/src/language/services/navigation/WorkspaceReferenceCollector.ts) 会逐文件枚举候选并对每个位置重新解析 owner
- [WorkspaceSymbolOwnerResolver.ts](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts) 对纯外部使用点的 `resolveExternalOwnerAsync(...)` 当前直接返回 `unsupported`

因此，这次设计不再尝试“把工作区级函数导航继续做聪明”，而是把 `references / rename` 收回到 LPC 当前静态语义下真正可信的边界。

## 目标

这次收窄的目标有三条：

1. 退出当前冗余、缓慢、且不准的工作区级函数 `references` 主链
2. 将 `rename` 的正式支持面收窄到：
   - 局部变量
   - 函数参数
   - 文件级全局变量
3. 将 `references` 收敛到：
   - 当前文件级
   - 可证明继承链级

同时保持以下约束：

- 不动 `definition`
- 不动 `hover`
- 不动 `signature help`
- 不动 scoped method 解析/补全主链
- 不动对象推导主链

## 非目标

以下内容明确不在本次范围内：

- 重新设计 `definition` / `hover` / `signature help`
- 为函数重新建立另一套工作区级调用图推导
- 为 `call_other`、运行时对象来源、动态 inherit 增加导航推导
- 恢复基于函数名的工作区级候选文件扩散
- 为 `struct/class` 定义、宏、函数重新开放 `rename`
- 物理删除现有 `WorkspaceSymbolRelationService` / `WorkspaceSemanticIndexService`

最后一条很重要：本次优先目标是**让生产主路径退出错误边界**，而不是在同一轮里完成所有旧代码清理。

## 设计原则

### 1. 只在 LPC 当前可证明边界内给结果

`references / rename` 不应承诺“工作区级完整调用/引用图”。  
它们只能在以下两层给结果：

- 当前文件级
- 静态可解析 `inherit` 图上的可证明继承链级

不能证明，就不扩散。

### 2. 函数导航与函数重构要分开看

函数 `references` 的价值，是帮助理解当前文件和继承链里**静态可见的直接关系**。  
函数 `rename` 的含义，则是“可以安全地把这批位置一起改掉”。

在 LPC 里，前者还能成立一部分，后者通常并不成立。  
因此：

- 保留函数 `references`，但仅限文件级 + 可证明继承链级
- 取消函数 `rename`

### 3. 不为了维持工作区级表象而牺牲结果诚实性

当前工作区函数 `references` 的问题不只是实现细节，而是边界本身过宽。  
本次设计宁可减少结果，也不继续保留“高成本扩散后再大量拒绝”的半成品工作区语义。

### 4. 不触碰已经成熟的导航优化链

用户已经明确认可当前 `definition` 及相关导航优化。  
本次只调整：

- `LanguageReferenceService`
- `LanguageRenameService`
- 它们依赖的 relation 主链

不调整：

- `LanguageDefinitionService`
- `LanguageHoverService`
- `LanguageSignatureHelpService`
- `ScopedMethodResolver` / `ScopedMethodDiscoveryService`
- `ObjectInferenceService`

## 新的能力矩阵

### References

- `local variable`
  - 当前文件级
- `parameter`
  - 当前文件级
- `file-scope global variable`
  - 当前文件级 + 可证明继承链级
- `function`
  - 当前文件级 + 可证明继承链级
- `struct/class definitions`
  - 当前文件级

### Rename

- `local variable`
  - 当前文件级
- `parameter`
  - 当前文件级
- `file-scope global variable`
  - 当前文件级 + 可证明继承链级
- `function`
  - 不支持
- `struct/class definitions`
  - 不支持
- `macro`
  - 不支持

## “可证明继承链级”的定义

本次的“可证明继承链级”必须满足以下条件：

- 只沿当前文件的静态 `inherit` 图解析
- `inherit` 必须能被当前主路径唯一解析到实际目标
- 只能使用 parser / syntax / semantic 现有产物
- 不做动态 inherit 猜测
- 不做对象运行时归属猜测
- 不做基于纯名字的工作区扩散

可以纳入这层的关系包括：

- 父文件与子文件之间，静态可证明的文件级全局变量引用关系
- 父文件与子文件之间，同一 callable family 的直接声明/实现关系
- 显式 scoped 调用：
  - `::foo()`
  - `room::foo()`

不能纳入这层的关系包括：

- `call_other(ob, "foo")`
- 字符串函数名回调
- 运行时接收者决定的方法调用
- 动态 inherit
- 仅靠同名词看起来像同一函数的跨文件调用

## 主链调整

### 保留的当前文件链

继续保留现有单文件精确解析链：

- [symbolReferenceResolver.ts](/D:/code/lpc-support/src/symbolReferenceResolver.ts)

它已经能够稳定处理：

- 局部变量
- 参数
- 当前文件内的精确符号绑定

这是本次的稳定地基，不应改写。

### 新的继承链 relation 主链

新增一层更窄的 navigation relation 服务，职责是：

- 在当前文件结果之外，按静态可证明 `inherit` 图补充 `references`
- 在静态可证明 `inherit` 图内为文件级全局变量构建安全 `rename`

建议命名：

- `InheritedSymbolRelationService`

它的边界必须非常硬：

- 输入：当前文档、位置、符号种类
- 输出：
  - 当前文件之外、但仍属于同一可证明继承链的引用/编辑位置
- 不输出：
  - 任意工作区级候选文件
  - 纯名字匹配位置
  - 依赖外部 owner 猜测的结果

### 生产接线变化

- `LanguageReferenceService`
  - 不再把函数 `references` 交给工作区级 `WorkspaceSymbolRelationService`
  - 不再把 `struct/class definitions` `references` 交给工作区级 `WorkspaceSymbolRelationService`
  - 改成：
    1. 当前文件精确引用
    2. 再补充可证明继承链级结果
  - 对 `struct/class definitions`，仅保留当前文件级结果

- `LanguageRenameService`
  - 不再对函数、`struct/class definitions` 走工作区 relation path
  - `rename` 仅保留：
    - 局部变量
    - 参数
    - 文件级全局变量
  - 文件级全局变量的扩展 edits 只能来自可证明继承链

## 函数 References 的新语义

函数 `references` 现在只回答这一个问题：

**“在当前文件和静态可证明继承链中，哪些位置可以被确认与这个函数属于同一 callable family？”**

它不再回答：

- 工作区里所有看起来叫同一个名字的调用点有哪些
- 全项目静态调用图是什么
- 运行时可能落到这个函数的所有路径有哪些

### 可返回的位置

- 当前文件中的函数声明、实现与直接引用
- 同文件 prototype + implementation family
- 子类中显式 scoped 调用：
  - `::foo()`
  - `room::foo()`
- 沿静态可解析 `inherit` 图、可确认属于同一 family 的父/子文件位置

对显式 scoped 调用的纳入规则也必须保持收敛：

- `references` 侧必须复用现有 scoped resolution / inherit qualifier 证明语义
- 不允许再单独发明一套 `::foo()` / `room::foo()` 判断规则
- 若 scoped 主链当前无法证明目标，`references` 侧也必须保守失败

### 不再返回的位置

- 工作区内只因名字相同而被纳入候选的任意调用点
- 纯 usage 文件里、无法通过继承链证明归属的外部调用
- 动态调用点

## Rename 的新语义

### 局部变量 / 参数

行为保持不变：

- 当前文件级
- 复用现有单文件精确 rename 链

### 文件级全局变量

允许：

- 当前文件 rename
- 可证明继承链级 rename

禁止：

- 工作区级名字扩散 rename
- 无法唯一证明归属时的跨文件 rename

这里必须把可证明边界写得更硬：

- 只有当前引用位置的 visible binding 能唯一证明它绑定到同一个文件级声明 owner 时，才允许进入继承链级 rename
- 如果子类声明了同名文件级全局变量并遮蔽父类声明：
  - 父类 owner 的跨文件 rename 必须在该子类位置停止
  - 子类位置只能参与子类 owner 的当前文件或其自身可证明链路 rename
- 如果兄弟 inherit 分支存在同名文件级全局变量，且某个引用点无法唯一证明落到哪一条分支：
  - 直接退回当前文件 rename
  - 不允许把该位置纳入任何跨文件 edits
- 一旦继承链中出现 branch ambiguity、shadowing ambiguity 或 unresolved inherit，而当前跨文件 rename 依赖这段链路：
  - 统一保守降级为当前文件 rename

### 函数

正式不支持 `rename`：

- `prepareRename(...)` 返回 `undefined`
- `provideRenameEdits(...)` 返回空 edits

### Struct/Class Definitions

同样正式不支持 `rename`：

- `prepareRename(...)` 返回 `undefined`
- `provideRenameEdits(...)` 返回空 edits

## 失败语义

### Function References

- 当前文件可解析：返回当前文件结果
- 继承链可证明：在当前文件结果基础上补充继承链级结果
- inherit unresolved / qualifier 不唯一 / family 无法证明：
  - 保守退化为仅当前文件结果
- 不允许回退到工作区名字扩散

### Global Variable Rename

- 当前文件可解析：至少返回当前文件 edits
- 继承链可证明：补充继承链级 edits
- 继承链不可证明：
  - 保持当前文件 rename
  - 不扩展到更多文件
- 子类同名遮蔽、兄弟分支同名歧义、visible binding 不能唯一归属：
  - 统一保守降级为当前文件 rename

### Function / Struct/Class Rename

- 始终拒绝
- 不允许回退到任何工作区 relation path

## 现有工作区 relation 组件的处理策略

本次不要求立即删除以下组件：

- `WorkspaceSymbolRelationService`
- `WorkspaceSemanticIndexService`
- `WorkspaceReferenceCollector`
- `WorkspaceSymbolOwnerResolver`

但必须把它们从 `references / rename` 的生产主链中退出，至少满足：

- 函数 `references` 不再依赖工作区级候选文件扩散
- `struct/class definitions` `references` 不再依赖工作区级 relation path
- `rename` 不再向函数与 `struct/class definitions` 暴露工作区级入口

后续如果确认这些组件已无主路径价值，再单独做清理 spec/plan。

## 测试策略

### 1. Reference Service / Rename Service 服务级测试

需要证明：

- 函数 `references` 不再走工作区级名字扩散结果
- `struct/class definitions` `references` 保持当前文件级，不再走工作区 relation path
- 函数 `rename` 被明确拒绝
- `struct/class definitions` `rename` 被明确拒绝
- 局部变量 / 参数 rename 行为不变
- 文件级全局变量仍支持当前文件 rename
- 文件级全局变量可在可证明继承链里扩展 `references / rename`

### 2. 继承链 relation 测试

需要证明：

- 父文件声明、子文件继承使用的文件级全局变量可一起 rename
- `::foo()` 与 `room::foo()` 可进入函数 `references`
- qualifier 不唯一时保守失败
- unresolved inherit 存在时不扩散到链外

### 3. Provider / LSP 集成测试

需要证明：

- `textDocument/references` 不再返回工作区级函数名字扩散结果
- `prepareRename` 在函数上返回 `null/undefined`
- 文件级全局变量在可证明继承链下仍能返回多文件 edits
- `definition` / `hover` / `signature help` 现有语义不被影响

### 4. 负向回归

以下场景不得被重新吸进 `references / rename`：

- `call_other`
- 动态 inherit
- 运行时对象来源
- 仅靠同名的外部 usage

## 风险与取舍

### 风险

- 用户会明显感知到“工作区级函数 references 变少”
- 之前为工作区 relation 建的部分测试和文档需要收口或重写

### 取舍

这是一次有意为之的收窄，不是功能倒退。  
它换来的是：

- 更可控的性能
- 更诚实的语义边界
- 更符合 LPC 的静态分析现实
- 更少的“看起来支持，实际并不可靠”的导航能力

## 结论

这次设计的核心不是“再做一套更强的工作区符号系统”，而是：

**把 `references / rename` 收回到 LPC 当前静态语义下真正可信、真正可解释、真正可维护的范围。**

落地后的正式边界应是：

- 函数 `references`：文件级 + 可证明继承链级
- 函数 `rename`：不支持
- `rename` 仅支持：
  - 局部变量
  - 参数
  - 文件级全局变量
- `definition / hover / signature help / scoped / object inference`：保持现状，不受本次收窄影响
