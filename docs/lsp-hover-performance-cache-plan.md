# LSP 悬停与导航性能缓存改进方案

## 背景

真实项目首次打开文件后，VS Code 中的语义高亮、Hover、Definition 和 Completion 存在明显延迟。用户观察到鼠标悬浮函数时 VS Code CPU 占用升高，本文件普通函数和 `obj->method()` 都可能出现 4-10 秒延迟。

这不是单次 LPC 文件解析必然很慢。临时探针显示，一次 Hover 内会重复触发多次 parse / semantic build，且跨文件实例解析会把相同目标文件反复重建。性能问题的核心是请求链路重复工作，而不是 TypeScript 单次解析速度与 FluffOS 编译速度的简单差距。

## 探针证据

本次使用临时 trace 代码测量真实项目 `D:\code\shuiyuzhengfeng_lpc`，测试后已清理临时代码并重建干净 bundle。报告保存在 `.tmp/perf-lsp-probe/`，不提交。

关键场景：

| 场景 | Hover 耗时 | 主要证据 |
| --- | ---: | --- |
| `/adm/daemons/aoyid.c` 本文件函数调用 `get_player_all_families` | 3.5s / 2.9s | 同一 Hover 内 `aoyid.c` 语义构建 6-7 次 |
| `/adm/daemons/aoyid.c` 的 `render_msg299` | 9.3s / 8.5s | 同一 Hover 内 `aoyid.c` 语义构建 8 次，`protocol_server.c` 语义构建 36 次 |
| `/external_system_package/http/controller/player_info.c` 的 `player->query` | 1.3s / 0.88s | `/clone/user/user.c` 每次 Hover 都重新解析 / 语义构建 |

`render_msg299` 单次 Hover 的关键 trace：

```text
lsp.hover.total: 9271ms
objectInference.inferObjectAccess: 8076ms
semantic.buildAndStoreAnalysis: 47 次，总 9116ms
parser.parse: 49 次，总 8934ms

/adm/protocol/protocol_server.c semantic build 36 次，总 4916ms
/adm/daemons/aoyid.c semantic build 8 次，总 4012ms
```

结论：

- 本文件普通函数 Hover 慢，是因为普通标识符也进入了 scoped / object hover 判断，并反复重建当前文件语义。
- `obj->method()` Hover 慢，主耗时在实例解析阶段，而不是最终 `TargetMethodLookup.findMethod`。`render_msg299` 中目标方法查找只有约 90-120ms，实例解析约 8s。
- 首次打开慢，来自 semanticTokens、diagnostics、hover、definition、completion 在同一窗口期并发触发，且缺少同一 `uri + version` 的 single-flight 合并。

## 当前缓存模型问题

仓库已有多层缓存：

- `DocumentStore`：保存 LSP 打开的文本。
- `ParsedDocumentService`：缓存 parser / frontend 结果。
- `DocumentSemanticSnapshotService`：缓存 syntax / semantic snapshot。
- `ProjectSymbolIndex`：缓存文件导出函数、类型、继承关系等临时索引。
- `WorkspaceChangeIndex`：记录 dirty / maybeStale / workspace config generation 和依赖足迹。
- 文档注释索引：为 Hover / Signature Help / Completion Resolve 提供 callable doc。

但当前高频请求路径存在三个问题：

1. **缓存访问语义过粗**
   - `useCache=false` 同时表达“缓存可能过期”和“强制重建”，导致 Hover / Definition / 实例解析高频路径反复冷构建。
   - `useFreshSnapshots: true` 最终会让 `TargetMethodLookup` 对目标文件、include、inherit 链使用 fresh snapshot。

2. **失效边界过宽**
   - `openTextDocument(target)` 前会触发目标文档失效。
   - `didOpen` 会标记 dirty 并立即失效当前文档，诊断完成前后续请求仍可能继续消费 dirty 状态。

3. **缺少请求内去重**
   - 同一 Hover 内多次请求同一 `uri + version` 的 semantic snapshot，会重复 parse / semantic build。
   - 实例解析内部的自然返回求值、文档返回对象、目标方法查找缺少按表达式 / 方法的请求级缓存。

## 设计目标

- 同一 `uri + version + workspaceConfigGeneration` 的 parsed / semantic 构建最多发生一次。
- Hover、Definition、Completion 默认缓存优先，只有变更状态证明缓存不可信时才刷新。
- 本文件普通函数 Hover 走轻量快速路径，不进入实例解析。
- `obj->method()` 的实例解析可以访问跨文件目标，但同一请求内不得重复构建相同目标文件。
- 首次打开场景通过 single-flight、预热和轻量首响降低体感延迟。
- 不把全局索引变成语义真源；全局仍只记录变化状态与轻量足迹。

## 缓存访问语义

建议替换布尔 `useCache`，引入显式访问策略：

```ts
type SnapshotAccessMode =
    | 'cacheFirst'
    | 'refreshIfStale'
    | 'forceRefresh';
```

语义：

| 模式 | 含义 | 使用场景 |
| --- | --- | --- |
| `cacheFirst` | `uri + version + generation` 匹配时直接复用 | Hover、Definition、Completion、Signature Help 默认路径 |
| `refreshIfStale` | dirty / maybeStale / config generation 变化才重建 | 请求入口 freshness guard、依赖变更后的第一次请求 |
| `forceRefresh` | 无条件重建 | 测试、用户显式重建索引、少量维护命令 |

高频语言能力不得直接使用 `forceRefresh`。

## 缓存 Key

推荐统一缓存 key：

```text
documentSnapshotKey = uri + documentVersionOrMtime + workspaceConfigGeneration
targetMethodKey = targetUri + targetVersionOrMtime + methodName + workspaceConfigGeneration
objectInferenceKey = documentUri + documentVersion + memberAccessRange + workspaceConfigGeneration
calleeReturnKey = calleeUri + calleeVersionOrMtime + methodName + argumentShape + workspaceConfigGeneration
callableDocKey = documentUri + documentVersionOrMtime + declarationRange
```

打开文档使用 LSP document version；未打开磁盘文件使用 readonly document 的 `mtimeMs` / `size` 版本。

## 请求分流

Hover 应先做语法形态分流，避免普通函数进入重链路：

```text
hover(position)
  -> classify hover target shape
  -> if target is object member after ->:
       object method hover
  -> else if target is scoped method after :::
       scoped method hover
  -> else if target is ordinary identifier:
       local callable / efun / macro hover
  -> else:
       return undefined
```

预期收益：

- 本文件函数 Hover 不再触发 `ObjectInferenceService.inferObjectAccess`。
- 普通 identifier 不再为“是否可能是 object method”重复构建 syntax / semantic。
- scoped hover 只在 `::` 形态下触发，不抢普通函数路径。

## Single-flight

`DocumentSemanticSnapshotService` 需要对同步构建增加 single-flight：

```text
getSemanticSnapshot(document, mode)
  -> key = uri + version + generation
  -> if cached fresh: return cached
  -> if build in flight: wait / share same build
  -> build once
  -> store cache
  -> return
```

首开时 semanticTokens、diagnostics、hover、definition 可能同时请求同一文档。single-flight 的目标是把这些并发请求合并成一次 parse / semantic build。

注意：当前接口多为同步返回。落地时可以先为 LSP 高频路径新增 async snapshot API，或在服务内部使用“同步构建锁 + 构建结果回填”的小步方案，避免一次性大改所有调用点。

## 实例解析请求级缓存

`render_msg299` 的大头在实例解析，不在最终目标方法查找。因此需要给实例解析内部加请求级缓存。

建议在一次 language request 内创建 `LanguageRequestCache`：

```ts
interface LanguageRequestCache {
    objectInference: Map<string, ObjectInferenceResult>;
    semanticEvaluation: Map<string, SemanticValue>;
    targetMethod: Map<string, ResolvedTargetMethod | undefined>;
    callableDoc: Map<string, CallableDoc | undefined>;
}
```

生命周期：

- 每个 LSP 请求创建一次。
- 通过 `LanguageCapabilityContext` 或 resolver options 传递。
- 请求结束后丢弃。
- 后续可把安全的 `targetMethod` / `callableDoc` 提升为跨请求缓存。

这样即使同一 Hover 内多次求 `PROTOCOL_D->model_get("popup")`，也只会分析一次 `protocol_server.c`。

## 失效规则

只允许这些事件使缓存失效：

- `didChange`：清当前打开文件的 parsed / semantic / docs / local symbol 记录。
- `sourceFileChange`：标记磁盘文件 dirty，并把依赖足迹命中的打开文档标记为 maybeStale。
- `workspaceConfigSync`：增加 workspace config generation，配置相关缓存自然失效。
- 用户手动重建全局索引：清 index 类缓存。
- 缓存容量 / TTL：兜底淘汰。

不应在这些路径无条件失效：

- 普通 Hover。
- 普通 Definition。
- 普通 Completion。
- `openTextDocument(target)`。

跨文件读取目标文档时，应检查 freshness 状态；状态未变时直接复用已有 readonly document 和 snapshot。

## 首次打开优化

缓存复用只能解决重复慢，首次打开需要单独处理：

1. `didOpen` 后启动低优先级预热：
   - parsed document
   - semantic snapshot
   - 当前文件函数表

2. diagnostic 延迟或降级：
   - 避免首开立即与 semanticTokens / hover 抢 CPU。
   - 可用 100-300ms debounce，用户先交互时优先响应交互。

3. semanticTokens 首响分层：
   - 小文件直接完整语义 token。
   - 大文件先返回 lexical token 或 best-available token，再后台刷新语义 token。

4. 请求优先级：
   - hover / definition 优先级高于后台 diagnostics。
   - completion 在 member context 下才进入实例解析。

## 分阶段落地计划

### 阶段一：Hover 快速路径与缓存优先

- 为 Hover 增加 target shape classifier。
- 普通 identifier 只查当前文件 callable / efun / macro。
- scoped hover 只在 `::` 形态触发。
- object hover 只在 `->` 成员名位置触发。
- 移除 Hover 路径默认 `useCache=false`。

验收：

- `aoyid.c` 本文件函数 Hover 不再调用 `ObjectInferenceService.inferObjectAccess`。
- 本文件函数冷 Hover 目标小于 800ms，热 Hover 小于 150ms。

### 阶段二：Snapshot 访问策略与 single-flight

- 引入 `SnapshotAccessMode`。
- 将高频路径从布尔 `useCache` 迁移到 `cacheFirst` / `refreshIfStale`。
- 为 `DocumentSemanticSnapshotService` 增加 `uri + version + generation` single-flight。
- 保留兼容入口，逐步替换旧布尔参数。

验收：

- 同一 Hover 内，同一 `uri + version` 的 `semantic.buildAndStoreAnalysis` 最多 1 次。
- 首开 semanticTokens + hover 并发时，当前文件 semantic build 不重复。

### 阶段三：实例解析请求级缓存

- 新增 `LanguageRequestCache`。
- 缓存 object inference、semantic evaluation、callee return、target method lookup。
- `ObjectInferenceService`、`SemanticEvaluationService`、`TargetMethodLookup` 消费同一个请求缓存。

验收：

- `render_msg299` 单次 Hover 内 `protocol_server.c` semantic build 从 36 次降到 1 次。
- `render_msg299` 冷 Hover 小于 2s，热 Hover 小于 500ms。

### 阶段四：跨请求安全缓存

- `TargetMethodLookup` 增加跨请求结果缓存。
- callable doc 按 declaration key 缓存。
- 缓存 key 带 target version / mtime 和 workspace config generation。
- `openTextDocument(target)` 不再无条件 invalidate。

验收：

- `player->query` 热 Hover 小于 300ms。
- 修改目标文件后，下一次 Hover / Definition 能刷新到新结果。

### 阶段五：首开预热与性能探针常态化

- `didOpen` 后后台预热当前文档。
- diagnostics 延迟，避免抢占首个交互请求。
- `probe:lsp` 增加 perf 模式，输出阶段耗时和构建次数。

验收：

- 探针报告包含 parse / semantic build 次数、目标文件列表和请求阶段耗时。
- 性能回归可以在不暴露真实项目源码的前提下复现。

## 测试策略

优先补这些测试：

- Hover shape classifier：普通函数、`->` 方法、`::` 方法、宏、efun。
- Snapshot single-flight：并发请求同一 document 只构建一次。
- Freshness：文件未变时跨文件 hover 不刷新；文件变更后下一次请求刷新。
- Request cache：同一请求内重复实例解析只调用一次目标语义分析。
- LSP 探针：真实项目脱敏报告只输出数量、阶段耗时、超时和诊断消息，不输出源码正文。

验证命令：

```powershell
npx tsc --noEmit
npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/runtime/__tests__/DocumentFreshnessService.test.ts src/semantic/__tests__/documentSemanticSnapshotService.test.ts
npm run probe:lsp -- --project D:\code\shuiyuzhengfeng_lpc --file /adm/daemons/aoyid.c --position 463:52
```

## 风险与边界

- 缓存必须以版本和 generation 为边界，不能用裸 URI 长期复用。
- 未打开磁盘文件不能固定 `version=1`，必须使用 mtime / size 或等价 generation。
- `WorkspaceChangeIndex` 继续只维护变化状态和依赖足迹，不承担语义真源。
- 请求级缓存可以先落地，因为生命周期短、风险低；跨请求缓存必须严格绑定 freshness。
- 不为了性能把动态 LPC 语义推成错误的全局静态真相。

## 推荐优先级

优先顺序：

1. Hover 快速路径。
2. Snapshot single-flight。
3. 高频路径 cache-first。
4. 实例解析请求级缓存。
5. 跨请求 target method / callable doc 缓存。
6. 首开预热与 perf probe 常态化。

这套顺序先压掉“一个 Hover 内重复构建几十次”的确定性问题，再处理首开体感和跨请求热缓存。
