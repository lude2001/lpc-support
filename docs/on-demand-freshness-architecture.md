# 按需新鲜度架构目标

## 背景

LPC 的静态形态高度动态：路径可以来自宏、字符串、函数返回值、配置、simul-efun、继承链和项目约定。`lpc-support` 不应把全局静态语义索引作为语言能力的权威真源，否则很容易产生“索引看似完整，但真实项目里经常过期或错误”的结果。

当前更可靠的基础是现有单文件解析、include / inherit 链路递归扫描，以及对象推导服务在用户触发跳转、补全、悬停、诊断时做局部求解。因此后续架构目标是：全局只记录文件变化状态，实际语义仍在请求发生时按需解析并刷新。

## 目标

- 全局层只维护文件状态、新鲜度和轻量依赖足迹，不维护全局语义真源。
- 诊断、跳转、补全、悬停和签名帮助在请求入口确认当前文件与访问到的依赖是否新鲜。
- 已打开文档优先使用 LSP 同步文本与版本；未打开磁盘文件使用 `mtimeMs` / `size`，必要时再使用内容 hash。
- 依赖足迹只用于判断哪些打开文档可能需要刷新诊断，不作为函数、变量、宏、类型或继承关系的权威来源。
- 每个阶段以可审查的小批次提交，审查发现的问题必须先核实是否真实问题；真实问题修复，不真实问题跳过并记录原因。

## 非目标

- 不建立全项目函数、变量、宏、类型、继承链的全局权威索引。
- 不在文件变化时扫描整个工作区。
- 不让 `ProjectSymbolIndex` 成为跨全项目长期语义真源；它仍可作为本次请求链路内的临时索引和缓存。
- 不用全局静态分析去猜测 LPC 运行期动态对象关系。

## 核心模型

### WorkspaceChangeIndex

`WorkspaceChangeIndex` 是轻量文件状态索引，只回答“缓存是否可能过期”，不回答“代码语义是什么”。

当前记录字段：

- `uri`
- `openVersion`
- `workspaceConfigGeneration`
- `dirty`
- `maybeStale`
- `deleted`
- `lastChangedAt`
- `lastDiagnosticDependencyFootprint`
- `lastDependencyFootprint`
- `lastTargetDependencyFootprint`

`lastDiagnosticDependencyFootprint` 记录诊断链路实际访问过的 include / inherit 依赖；`lastTargetDependencyFootprint` 记录跳转、补全、悬停和签名帮助链路实际访问过的 object target / include / inherit 依赖。`lastDependencyFootprint` 是二者合并后的轻量足迹，用来把打开文档标记为 `maybeStale`。这些足迹不能作为语义判断依据。

未打开磁盘文档的 `mtimeMs` / `size` 当前由 LSP server 的 VS Code shim 维护，用于避免 readonly 文档长期固定在旧 `version=1`；它不是 `WorkspaceChangeIndex` 的语义字段。

### Freshness Guard

所有语言能力入口统一经过新鲜度门禁：

```text
request(document)
  -> ensureFreshDocument(document)
  -> run existing resolver / collector
  -> resolver 按 include / inherit / object target 访问依赖
  -> ensureFreshDocument(dependency)
  -> record dependency footprint
```

`ensureFreshDocument` 的职责：

- 若是打开文档，检查当前缓存版本是否等于 LSP 文档版本。
- 若是未打开磁盘文档，检查缓存记录的 `mtimeMs` / `size` 是否仍匹配。
- 若 workspace config generation 变化，清理与配置相关的缓存。
- 若不新鲜，清理该 URI 的 parsed、frontend、semantic、readonly document 与相关临时索引记录，再重新构建。

当前实现已先落地最小门面 `DocumentFreshnessService`，用于集中表达 LSP server 内的 freshness 边界：失效 runtime readonly document、调用生产缓存失效回调，并在诊断刷新完成后按 `lastChangedAt` 标记 clean。它不负责解析，也不维护语义事实。

## 请求路径

### 诊断

诊断仍从当前文档出发，复用现有 `DiagnosticSymbolResolver` 的 include / inherit 递归解析能力。变化点是：每次解析当前文件和依赖文件前都先经过 `ensureFreshDocument`。

文件变化后，只立即刷新当前打开文件诊断；对依赖足迹命中的其它打开文件标记 `maybeStale`，通过 debounce 或下一次请求刷新。

### 跳转定义

跳转定义必须优先保证当前表达式链路的新鲜度。对象方法跳转、scoped method、include / inherit 函数查找访问目标文件时，应确保目标文件快照与磁盘或打开文档版本一致。

`TargetMethodLookup` 这类跨文件查找默认不能长期复用未打开磁盘文件的旧 `version=1` 快照。

### 补全、悬停与签名帮助

补全、悬停和签名帮助可以继续使用现有对象推导、继承扫描、callable doc 链路，但访问当前文件和目标文件时必须走统一新鲜度判断。

补全可以保留性能友好的 best-available 行为，但如果候选依赖当前文件最新文本，当前文件必须强一致；跨文件候选可以按访问到的依赖逐个刷新。

## 阶段计划

### 阶段一：单 URI 新鲜度闭环

- 新增 `WorkspaceChangeIndex`，记录 LSP 打开、变更、关闭和配置 generation。
- 为 LSP server 增加统一失效入口，清理当前 URI 的 frontend、parsed、semantic、readonly document 和临时项目索引记录。
- 修复未打开磁盘文档在 server shim 中固定 `version=1` 后长期复用的问题。
- 让定义跳转和对象方法 hover 在跨文件查找时使用 fresh snapshot。
- 增加回归测试：同一 LSP 会话内修改目标文件后，跳转/诊断不再读取旧快照。

状态：已落地。生产 LSP server 使用 `DocumentFreshnessService` 统一触发 parsed / frontend / semantic / readonly document / 临时 project symbol 失效；未打开磁盘文档按 `mtimeMs` / `size` 维护 readonly document 版本；object method definition / hover / signature-help target lookup 已使用 fresh snapshots。

### 阶段二：磁盘文件变化桥接

- client 侧 watch `**/*.{c,h}`，向 server 发送轻量文件变化通知。
- server 收到通知后只标记 URI dirty 并清理该文件缓存，不扫描工作区。
- 删除文件时清空对应诊断、readonly document 和临时索引记录。

状态：已落地。client 侧发送 `lpc/sourceFileChange`，server 侧只标记变更 URI、失效该 URI 缓存并在删除时清理诊断。

### 阶段三：依赖足迹与打开文件刷新

- 在诊断、跳转、补全、悬停请求中记录实际访问过的 include / inherit / object target。
- 当某个依赖文件变化时，只把上次足迹命中的打开文件标记为 `maybeStale`。
- 对 `maybeStale` 的打开文件做 debounce 诊断刷新，或者在下一次用户请求时强制新鲜度检查。

状态：已落地。诊断链路记录 include / inherit 足迹；`TargetMethodLookup` 和对象推导链路记录 object target、target include 和 target inherit 足迹；依赖变化只标记足迹命中的打开文件为 `maybeStale`，并以 debounce 方式刷新这些打开文件的诊断。刷新成功后会按状态版本清理 `maybeStale`，避免旧刷新覆盖新变化；关闭文档会丢弃已排队的 `maybeStale` 刷新。

## 当前剩余边界

- 已引入最小 `DocumentFreshnessService` 门面，但尚未把所有语言能力访问依赖前的动作升级为显式 `ensureFreshDocument(dependency)` 调用。
- `maybeStale` 当前只触发诊断刷新；跳转、补全、悬停和签名帮助依赖 fresh snapshot 与访问时缓存失效，不直接消费 `maybeStale`。
- `WorkspaceChangeIndex` 仍只维护轻量状态和足迹，不应扩展成全项目语义索引。

## 验证门槛

每个阶段至少满足：

- 有聚焦 Jest 覆盖核心刷新场景。
- `npx tsc --noEmit` 通过。
- 涉及 LSP 行为时优先补 `src/lsp/server/__tests__` 或 `src/lsp/__tests__`。
- 审查意见必须逐条核实：真实问题修复，不真实问题跳过并保留判断依据。

发布或打包阶段再运行：

- `npm run check`
- `npm run package`
