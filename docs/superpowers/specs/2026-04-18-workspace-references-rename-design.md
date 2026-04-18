# 工作区级 References / Rename 设计

## 背景

当前导航链里，`definition`、`hover`、`signature help`、对象方法推导，以及 `::method()` / `room::method()` scoped 调用已经逐步进入统一的 LSP 主路径，但 `references` 与 `rename` 仍明显停留在单文件阶段：

- [README.md](/D:/code/lpc-support/README.md) 仍写着“引用查找”和“当前文件范围内的符号重命名”
- [src/language/services/navigation/LanguageReferenceService.ts](/D:/code/lpc-support/src/language/services/navigation/LanguageReferenceService.ts) 只消费单文件 `resolveReferences(...)`
- [src/language/services/navigation/LanguageRenameService.ts](/D:/code/lpc-support/src/language/services/navigation/LanguageRenameService.ts) 也明确是 current-file only
- [src/language/services/navigation/LanguageSymbolReferenceAdapter.ts](/D:/code/lpc-support/src/language/services/navigation/LanguageSymbolReferenceAdapter.ts) 当前只是对单文件 `resolveSymbolReferences(...)` 的适配

这使得导航主线出现了一个很扎眼的断层：用户已经可以跨文件跳转、看跨文件文档、做 scoped completion，但仍不能对“可证明属于同一声明源”的工作区级符号做可靠的引用查找和重命名。

## 目标

第一期为以下“文件级 / 跨文件可见符号”提供工作区级 `references` 与 `rename`：

- 函数
- 文件级全局变量
- 宏
- 类型定义

同时保持以下约束：

- 局部变量与参数继续 current-file only
- owner 无法唯一证明时，`references` 保守降级，`rename` 直接拒绝
- 不引入 provider 级全文扫描或纯名字匹配重命名

## 非目标

以下内容明确不纳入本期：

- 局部变量、参数的工作区级 references / rename
- `call_other`、运行时对象来源、动态 inherit
- 把 scoped / object method 调用直接并入工作区 rename
- 为了“尽量有结果”而做启发式、纯名字级别的跨文件拼接

## 设计原则

### 1. 先解析声明归属，再谈工作区关系

工作区级 `references` / `rename` 的核心不是“找同名词”，而是“确认当前光标下的符号到底归属于哪个声明源”。  
owner 不能唯一确认时，不允许工作区级 rename，也不允许跨文件 references 猜测扩散。

### 2. References 与 Rename 共享一条关系主链

不允许 `references` 和 `rename` 各自维护一套跨文件逻辑。  
两者都应复用同一个“owner 解析 + 工作区候选收集 + 精确匹配确认”主链，差别只在最终消费行为：

- `references` 产出 location 列表
- `rename` 在安全条件满足时产出 workspace edit

### 3. 只做可证明的工作区级能力

本期宁可少给结果，也不能错改文件。  
更具体地说：

- `references` 可以保守返回当前文件结果或空结果
- `rename` 只能“全量安全”或“直接拒绝”，不能做部分、猜测式的批量替换

### 4. 复用现有 snapshot / index 主路径

新能力必须建立在现有 parser / syntax / semantic / navigation 主路径上，不应在 provider 中重新扫描全文或用正则做工作区级分析。

## 推荐方案

采用“共享的工作区符号关系服务”方案：

- 新增 `WorkspaceSymbolRelationService`
- 由它统一编排：
  - 当前光标符号 owner 解析
  - 工作区候选文件收集
  - 候选位置的精确确认
  - `references` / `rename` 的最终结果构造

不采用以下方案：

- 不在现有 `LanguageSymbolReferenceAdapter` 上直接叠加工作区 grep / 遍历
- 不做单独的 rename 特判通道
- 不让 provider 直接按符号名扫描工作区文件

## 组件拆分

### `WorkspaceSymbolOwnerResolver`

职责：

- 输入：当前文档 + 光标位置
- 输出：
  - `workspace-visible owner`
  - `current-file only`
  - `ambiguous / unsupported`

它负责回答三个问题：

1. 当前光标命中的到底是哪一类符号
2. 这个符号是否属于第一期支持种类
3. 它的声明源是否能唯一确定

建议的 owner key 形态：

- `function:<source-uri>:<declaration-key>`
- `global:<source-uri>:<symbol-name>`
- `macro:<definition-uri>:<macro-name>`
- `type:<source-uri>:<type-name>`

这里的关键不是字符串格式，而是 owner key 必须表达**声明归属**，而不是只表达名字。

### `WorkspaceSymbolIndexView`

职责：

- 提供工作区级候选文件缩小能力
- 避免 `references` / `rename` 对整个工作区做盲扫

建议优先复用并扩展现有 [src/completion/projectSymbolIndex.ts](/D:/code/lpc-support/src/completion/projectSymbolIndex.ts)：

- 它已经能承接 semantic snapshot
- 已经持有 exported functions、type definitions、inherit / include / macro reference 等信息
- 后续只需通过更中性的 seam 暴露给 navigation 使用，而不是继续把它视作 completion 专用设施

本期需要补足的索引视图能力：

- 可查询函数 owner 的候选文件
- 可查询类型定义 owner 的候选文件
- 可查询文件级全局变量 owner 的候选文件
- 可查询宏定义 / 宏引用 owner 的候选文件

### `WorkspaceReferenceCollector`

职责：

- 输入：owner key + 候选文件集合
- 输出：精确确认过的引用列表

它不负责“猜 owner”，只负责：

1. 在候选文件中定位同类候选位置
2. 对每个候选位置重新做 owner 确认
3. 仅保留 owner 完全相同的匹配

硬约束：

- 不允许纯文本 grep 直接产出引用结果
- 不允许只按名字相等就判定为同一符号

### `WorkspaceSymbolRelationService`

职责：

- 统一编排 owner 解析、候选收集、精确确认
- 为 `references` 与 `rename` 提供统一入口

建议暴露两条主方法：

- `collectReferences(document, position, options)`
- `buildRenameEdit(document, position, newName)`

## 主链路

### References

1. `LanguageReferenceService` 调用 `WorkspaceSymbolRelationService.collectReferences(...)`
2. `WorkspaceSymbolOwnerResolver` 先解析当前光标的符号归属
3. 若为 `current-file only`
   - 回退到现有单文件引用链路
4. 若为 `workspace-visible owner`
   - 通过 `WorkspaceSymbolIndexView` 收集候选文件
   - 交给 `WorkspaceReferenceCollector` 做精确确认
5. 返回工作区级 locations

### Rename

1. `LanguageRenameService.prepareRename(...)` 先解析 owner
2. 若为 `current-file only`
   - 保持现有单文件 rename 行为
3. 若为 `workspace-visible owner`
   - 尝试构建工作区级 rename edit
4. 若 owner 不唯一、关系不完整或存在不安全候选
   - 直接拒绝 rename
5. `provideRenameEdits(...)` 只在安全条件满足时返回多 URI workspace edit

## 符号种类边界

### 函数

工作区级函数 references / rename 只建立在**唯一声明源**上。  
同名但不同文件、不同 owner 的函数不得串联。

### 文件级全局变量

只有在当前引用能确认绑定到某个唯一文件级声明时，才允许工作区级处理。  
不能做“全工作区按变量名替换”。

### 宏

必须能确认宏定义源，或能建立等价唯一 owner。  
不同 include 上下文下的同名宏不得硬合并。

### 类型定义

必须能确认类型定义 owner。  
同名类型不得直接视为一个全局唯一类型。

### 局部变量与参数

本期保持 current-file only，不升级到工作区级。

## 失败语义

### References

- owner 唯一：返回工作区级结果
- `current-file only`：继续单文件链路
- owner 歧义 / 索引不足 / 候选无法确认：保守返回当前文件结果或空结果

### Rename

仅当以下条件同时满足时才允许：

- 属于本期支持的符号种类
- owner 唯一
- 候选引用文件都能二次确认到同一个 owner
- 不存在声明归属歧义

只要任一条件不满足：

- 直接拒绝 rename
- 不做“尽量改一部分”的部分成功策略

## 测试策略

### 1. Owner Resolver 单测

覆盖：

- 唯一函数 owner 解析
- 同名不同函数 owner 不串联
- 文件级全局变量 owner 唯一解析
- 宏 owner 唯一解析
- 类型定义 owner 唯一解析
- 局部变量 / 参数明确落回 current-file only
- owner 歧义时返回 `ambiguous / unsupported`

### 2. Workspace Reference Collector 单测

覆盖：

- 同一 owner 的跨文件引用被全部收集
- 同名不同 owner 的候选被过滤
- `includeDeclaration=false` 正确过滤跨文件声明位置
- 索引不完整或候选无法确认时保守退化

### 3. Navigation Service 集成测试

覆盖：

- `LanguageReferenceService` 返回多 URI 结果
- `LanguageRenameService` 生成多 URI workspace edit
- 局部变量 / 参数保持单文件行为
- owner 不唯一时 rename 拒绝
- 不安全情况下 references 不扩散到错误文件

### 4. LSP / Provider 端到端回归

覆盖：

- 多文件函数引用查找
- 文件级全局变量的工作区 rename
- 同名不同源函数不会被一起 rename
- 同名宏在不同上下文下不会被误串联

## 风险与缓解

### 风险 1：索引边界不够中性

现有 `ProjectSymbolIndex` 位于 `completion/` 下，直接让 navigation 深度依赖它会让职责命名继续失真。

缓解：

- 引入中性 seam，例如 `WorkspaceSymbolIndexView`
- navigation 依赖 seam，而不是 completion 私有细节

### 风险 2：同名符号误串联

这是本期最大风险，尤其体现在 rename。

缓解：

- owner key 必须表达声明归属
- 候选文件必须逐个二次确认
- rename 只允许“全量安全”或“直接拒绝”

### 风险 3：把本期做成“半个工作区 grep”

短期看快，长期一定变成技术债。

缓解：

- 禁止 provider 级全文扫描
- 禁止纯名字匹配产出工作区 rename
- 所有跨文件结果都必须经过 owner 确认

## 本期完成标准

满足以下条件即可视为本期完成：

- 对函数、文件级全局变量、宏、类型定义提供工作区级 `references`
- 对同一批可唯一证明 owner 的符号提供工作区级 `rename`
- 局部变量、参数继续 current-file only
- owner 不唯一时 `references` 保守降级、`rename` 直接拒绝
- 相关 unit / integration / LSP 回归测试齐备

