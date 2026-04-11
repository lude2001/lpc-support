# LPC LSP Spec B: 语言能力主链迁移设计

## 1. 阶段定位

`Spec B` 承接 `Spec A` 已完成的基础设施，不再重新讨论以下前提：

- `client/server` 运行骨架已存在
- `WorkspaceSession`、`DocumentStore`、配置同步桥、运行模式切换已存在
- `classic` / `hybrid` / `lsp` 运行模式已经建立
- `ParsedDocument -> SyntaxDocument -> SemanticSnapshot` 仍然是分析真源

本阶段的目标不是继续搭底座，而是把编辑体验主链迁入 LSP 路径，并在 `hybrid` 模式下完成 classic-vs-lsp 的差异收敛。

## 2. 目标

`Spec B` 默认覆盖以下 8 项能力：

- `completion`
- `hover`
- `definition`
- `references`
- `rename`
- `documentSymbol`
- `foldingRange`
- `semanticTokens`

本阶段目标定义为：

1. 在 `hybrid` 模式下完成这 8 项能力的 LSP 路径实现
2. 为这 8 项能力建立 classic-vs-lsp 对照验证机制
3. 将差异、回退与残余风险收敛到可记录、可解释、可验收的程度
4. 让 `lsp` 模式具备接管这 8 项能力的工程条件
5. 是否将 `lsp` 模式视为默认或推荐入口，在 `Spec B` 验收末尾再决定

## 3. 非目标

`Spec B` 明确不做：

- 不迁移 `formatter`
- 不迁移 `diagnostics`
- 不重写 `ParsedDocument` / `SyntaxDocument` / `SemanticSnapshot` 主链
- 不删除 classic provider
- 不把 `lsp` 模式立即提升为默认模式
- 不引入新的配置真源

这些事项继续留给 `Spec C` 或后续单独硬化任务。

## 4. 成功标准

`Spec B` 结束时，以下结论必须成立：

1. 这 8 项能力在 `hybrid` 模式下均有对应的 LSP handler 路径
2. 每项能力均有 classic-vs-lsp 的对照测试或结果比对机制
3. 每项能力的已知差异都有明确归因，而不是“结果不一样但不知道为什么”
4. 对象推导、项目配置、syntax/semantic 主链在 LSP 路径中继续复用现有真源
5. `lsp` 模式已经具备接管条件，但是否默认接管以验收结论为准

## 5. 统一迁移原则

### 5.1 先服务，后 handler

迁移顺序必须是：

1. 提炼纯语言服务接口
2. 将现有 provider 背后的核心逻辑迁到服务实现
3. 在此基础上分别提供：
   - classic provider 适配
   - LSP handler 适配

禁止把现有 `vscode.*Provider` 类整体直接搬进 server。

### 5.2 classic 作为对照真身保留

在 `Spec B` 中，classic provider 继续保留，职责是：

- 行为对照
- 回归标尺
- 差异定位

只有在某项能力的 LSP 路径足够稳定后，才允许在 `lsp` 模式下接管该项入口。

### 5.3 继续复用既有分析真源

`Spec B` 中所有语言能力必须继续优先复用：

- `ParsedDocumentService`
- `ASTManager`
- `SyntaxDocument`
- `SemanticSnapshot`
- `ObjectInferenceService`

不得为了 LSP 迁移重新退回：

- legacy parse cache 真源
- provider 内部重复全文扫描
- 正则或文本级结构推断替代 syntax/semantic 主链

### 5.4 行为差异要显式化

当 classic 与 lsp 行为不同，必须明确归类为以下之一：

- 迁移中缺失
- 已知保守降级
- 原 classic 行为存在历史不一致
- 新路径行为更严格但正确

不允许把“结果不一致”模糊处理成测试容忍项。

## 6. 三组能力设计

### 6.1 编辑辅助组

本组只包含：

- `completion`

#### 迁移动机

补全是最依赖：

- 当前文档语义快照
- 项目符号索引
- 继承链聚合
- 对象推导结果

它也是最容易出现 classic-vs-lsp 差异的能力，因此单独成组。

#### 设计要求

- 抽出 `LanguageCompletionService`
- classic provider 与 LSP completion handler 共享同一补全查询主链
- 保持现有：
  - 继承符号回填
  - 对象成员补全
  - efun / simul efun / macro 补全
  - instrumentation / tracing 能力

#### 风险点

- 触发字符语义差异
- snippet / documentation / resolve 阶段差异
- 对象推导时机在 LSP 文档同步模型下是否与 classic 一致

### 6.2 导航与理解组

本组包含：

- `hover`
- `definition`
- `references`
- `rename`
- `documentSymbol`

#### 迁移动机

这组能力共用的核心是“符号、结构、目标定位”，适合一起设计。

#### 设计要求

- 抽出统一的：
  - `LanguageHoverService`
  - `LanguageDefinitionService`
  - `LanguageReferenceService`
  - `LanguageRenameService`
  - `LanguageSymbolService`
- 继续复用：
  - `ObjectInferenceService`
  - `TargetMethodLookup`
  - `symbolReferenceResolver`
  - `SemanticSnapshot`

#### 迁移重点

- `hover` 要保住对象推导与宏/efun 文档说明
- `definition` 要保住 include、macro、simul efun、对象方法链路
- `references` 与 `rename` 要保住当前作用域/声明绑定精度
- `documentSymbol` 要继续建立在 semantic/type summary 上，而不是文本扫描

### 6.3 结构展示组

本组包含：

- `foldingRange`
- `semanticTokens`

#### 迁移动机

这组更偏“结构与着色输出”，依赖：

- token / trivia
- syntax 节点
- semantic symbol 分类

#### 设计要求

- 抽出：
  - `LanguageFoldingService`
  - `LanguageSemanticTokensService`
- 保持：
  - `folding` 继续以 trivia + syntax 结构为主
  - `semanticTokens` 继续优先基于 token + snapshot symbol 分类

#### 风险点

- LSP semantic token legend 与当前 VS Code 侧 legend 的一致性
- 大文档下 token 输出性能
- folding range 在不同客户端上的容错行为

## 7. 推荐的实现分层

`Spec B` 中建议形成以下最小层次：

### 7.1 Contracts

位置建议：

- `src/language/contracts/`

职责：

- 定义文档、工作区、能力服务接口

### 7.2 Services

位置建议：

- `src/language/services/`

职责：

- 将现有 provider 背后的可复用逻辑收敛成纯语言服务

### 7.3 Classic Adapters

位置建议：

- 继续复用现有 provider，或在 provider 侧薄适配

职责：

- 将服务结果转成 `vscode.*Provider` 所需输出

### 7.4 LSP Handlers

位置建议：

- `src/lsp/server/handlers/`

职责：

- 将同一服务结果转成 LSP 请求/响应输出

## 8. 验证策略

### 8.1 `hybrid` 为主验证模式

`Spec B` 的主验证模式是 `hybrid`，不是 full `lsp`。

原因：

- classic path 仍可作为行为标尺
- 差异更容易被解释
- 在 `formatter` / `diagnostics` 尚未迁移前，不会过早给 `lsp` 模式附加“完整可替代”的暗示

### 8.2 对照验证矩阵

每项能力至少要回答：

1. classic 输出是什么
2. lsp 输出是什么
3. 是否一致
4. 如不一致，原因是什么
5. 是否允许作为当前阶段残差保留

### 8.3 推荐的测试层次

- 单元测试
  - 语言服务本身
- handler 测试
  - classic adapter
  - LSP handler
- 对照测试
  - 相同输入下 classic 与 lsp 输出对照
- 集成测试
  - `hybrid` 模式下的最小行为闭环

### 8.4 Task 10 最终对照结果

`Task 10` 已补上 `hybrid` parity harness，并在 `src/lsp/__tests__/languageParity.test.ts` 中把 8 项能力统一记录成 capability matrix。

当前矩阵如下：

| Capability | Classic Surface | LSP Surface | Fixture | Result |
|-----------|-----------------|-------------|---------|--------|
| `completion` | `LPCCompletionItemProvider` | `registerCompletionHandler` | local function completion | `exact` |
| `hover` | `ObjectHoverProvider` 共享 hover seam | `registerHoverHandler` | shared object/navigation hover seam | `exact` |
| `definition` | `LPCDefinitionProvider` | `registerDefinitionHandler` | definition lookup | `exact` |
| `references` | `LPCReferenceProvider` | `registerReferencesHandler` | current-file references | `exact` |
| `rename` | `LPCRenameProvider` | `registerRenameHandler` | prepareRename + rename edits | `exact` |
| `documentSymbol` | classic navigation symbol seam | `registerDocumentSymbolHandler` | nested type/function symbols | `exact` |
| `foldingRange` | classic structure folding seam | `registerFoldingRangeHandler` | syntax/trivia folding ranges | `exact` |
| `semanticTokens` | `LPCSemanticTokensProvider` | `registerSemanticTokensHandler` | legend-stable semantic tokens | `exact` |

这张矩阵的口径不是“两个完全独立实现偶然一致”，而是：

- classic path 通过 classic adapter / provider seam 调用 shared language services
- lsp path 通过 handler seam 调用同一批 shared language services
- parity harness 负责比较两条 host surface 的归一化结果

因此它锁定的是 “共享服务结果经 classic 与 lsp 两种 host 适配后仍保持一致”。

## 9. 验收口径

`Spec B` 完成，不等于：

- `formatter` / `diagnostics` 已迁移
- `lsp` 模式已成为默认
- 所有 transport 级客户端差异都被完全吃平

`Spec B` 完成，只表示：

- 8 项主语言能力已具备 LSP 路径实现
- `hybrid` 对照验证成熟
- classic-vs-lsp 差异已经被系统化管理
- 是否让 `lsp` 模式正式接管，已具备决策依据

### 9.1 当前接受的残余差异

截至 Task 10，以下差异被明确记录并接受，而不是隐藏在“测试先放过”里：

1. `hybrid` 仍保留 classic provider 作为实际编辑器入口
   - 这是当前阶段的刻意设计，不是迁移未完成的偶然状态
   - 目的仍是保留 classic baseline，便于继续做 parity 与回归定位
2. `hover` 的 classic macro 补充 provider 仍未迁入 LSP path
   - parity harness 已覆盖共享的对象/导航 hover seam
   - 但 classic 侧额外注册的 macro-only hover provider 仍属于 classic-only 补充链路
3. `formatter` 与 `diagnostics` 继续明确排除在 Spec B 范围外
   - 它们不属于这张 capability matrix
   - 也不应被误解为已经具备 LSP parity

### 9.2 当前阶段结论

基于这次 capability matrix，`lsp` 模式已经具备接管这 8 项能力的工程条件，但本阶段仍不建议把它直接提升为默认模式。

更准确的结论是：

- `classic`
  - 继续作为默认稳定入口
- `hybrid`
  - 作为 Spec B 的主验证模式继续保留
- `lsp`
  - 已具备 8 项能力的 server path 与 parity evidence
  - 但在 classic supplemental behavior、客户端 transport 级差异与后续 Phase 边界没有继续收口前，不直接宣告完全替代 classic

## 10. 进入 `Spec C` 的条件

只有当以下条件满足时，才开始设计 `Spec C`：

1. 这 8 项能力在 `hybrid` 下稳定
2. `lsp` 模式下已具备接管条件
3. 差异矩阵已经收敛
4. formatter / diagnostics 的迁移边界已经能够在现有结构上明确切开
5. 团队不需要再次争论 `Spec A/B` 的基础结构是否成立

## 11. 推荐结论

`Spec B` 应采用“分组迁移式”设计，而不是逐能力流水账式设计。

原因：

- 能统一架构原则
- 能保留跨能力共性
- 不会把 spec 写成 8 份重复说明
- 又能保留每组能力不同的风险点与验证方式

在此基础上，下一步应进入：

- `Spec B` 正式文档评审
- 用户确认后，再写 `Spec B` implementation plan
