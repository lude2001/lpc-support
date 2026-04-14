# Callable Documentation And Signature Help Design

## 1. 背景

当前仓库中的函数文档能力已经能工作，但主路径仍然存在几个明显问题：

- 文档归属并未进入稳定主链，部分能力仍依赖全文文本扫描或正则抽取
- `hover`、函数文档面板、`@lpc-return-objects`、`simul_efun` 文档各自有不同的读取与拼装方式
- 标准 `efun` 文档仍以偏展示导向的数据形状存在，难以直接复用到 `signature help`
- 当前没有覆盖当前文件、继承、include、simul_efun / efun、对象方法五类来源的统一 `signature help`

这次设计要解决的不是“给旧 lib 继续兜底”，而是把函数文档正式纳入当前 `lpc-support` 的分析主链，使其成为未来语言能力扩展的稳定基础。

该目标与 [docs/lpc-support-development-paradigm.md](D:/code/lpc-support/docs/lpc-support-development-paradigm.md:53) 中的路线一致：

- 不把“兼容旧 lib”放成最高目标
- 不允许功能继续依赖临时扫描和偶然兼容
- 继续坚持 `ParsedDocument -> SyntaxDocument -> SemanticSnapshot` 的清晰边界
- 为未来更可靠的语言能力与协作式开发基础设施建立真源

## 2. 目标

本次任务一次性完成以下内容：

1. 建立源码函数的统一文档主链，使函数文档不再主要依赖全文正则扫描
2. 在 `syntax` 层建立函数声明与前置 Javadoc 注释的稳定绑定关系
3. 新增统一的结构化可调用文档模型，供源码函数、`simul_efun`、标准 `efun`、对象方法共同消费
4. 让以下消费方全部切换到统一文档主链：
   - `hover`
   - 函数文档面板
   - `@lpc-return-objects`
   - `signature help`
5. 一次性补齐覆盖以下五类来源的 `signature help`：
   - 当前文件函数
   - 继承函数
   - include 可见函数
   - `simul_efun` / 标准 `efun`
   - 对象推导方法
6. 停用远程 `mud.wiki` 运行时获取链路，不再把远程 HTML 解析作为产品主路径
7. 在本次任务中直接把 [`config/efun-docs.json`](D:/code/lpc-support/config/efun-docs.json:1) 升级为新的结构化格式

### 2.1 一次性交付与执行拆分的关系

本次任务对用户仍然是一次性交付，不采用多阶段产品发布，不保留“先做一半以后再补”的中间状态。

但为了让后续 subagent 执行不互相阻塞，implementation planning 必须拆成多个协调 work package 或 chunk。  
这属于执行层拆分，不属于产品层分阶段。

## 3. 非目标

本设计明确不做：

- 不为旧 `efun-docs` 格式保留兼容分支
- 不为了兼容旧注释习惯而支持非正式 Javadoc 风格
- 不把函数文档解析职责塞回 parser 真源
- 不把完整文档实体整体塞进 `SemanticSnapshot`
- 不为了 `signature help` 重新发明一套独立的定义解析或对象推导逻辑
- 不要求用户修改既有 mudlib 函数写法

## 4. 约束

### 4.1 文档语法边界

本次设计只正式支持当前项目已定义的 Javadoc 风格标签集：

- `@brief`
- `@param`
- `@return`
- `@details`
- `@note`
- `@lpc-return-objects`

没有标签、只有自然语言块注释的函数注释，不作为正式支持对象。

### 4.2 分层边界

必须继续遵守当前仓库既有架构边界：

- `ParsedDocument`
  - parser 层统一容器
- `SyntaxDocument` / `SyntaxNode`
  - 结构层真源
- `SemanticSnapshot`
  - 语义摘要层

禁止出现以下退化：

- provider 或业务逻辑重新全文扫描做结构推断
- 重新把 parser/syntax/semantic 混成新的泛化 “AST”
- 重新让 legacy parse cache 成为生产真源

### 4.3 Efun 策略

标准 `efun` 文档以后只以本仓库维护的数据为准：

- 不再从远程 `mud.wiki` 获取
- 构建时也不再从远程拉取
- 运行时不再依赖远程 HTML 解析

这意味着本次任务允许直接重构当前 `efun` 文档数据形状，而无需顾虑远程来源兼容性。

## 5. 总体方案

本设计采用如下主路径：

1. `ParsedDocumentService`
   - 继续产出 token、trivia、comment 等原始解析结果
2. `SyntaxBuilder`
   - 在函数声明节点上建立与前置 Javadoc 注释的绑定关系
3. `FunctionDocumentationService`
   - 基于 `ParsedDocument + SyntaxDocument` 解析 Javadoc 标签，产出结构化文档
4. `CallableDoc`
   - 统一承载源码函数、`simul_efun`、标准 `efun`、对象方法等可调用文档
5. 语言消费层统一读取 `CallableDoc`
   - `hover`
   - 函数文档面板
   - `@lpc-return-objects`
   - `signature help`

核心原则是：

- 文档进入主链
- 但不进入 parser 真源
- 也不让 `syntax` 层承担完整文档语义解释
- 更不允许各功能继续各自用正则重新解析一遍

## 6. 架构边界

### 6.1 Parser 层

Parser 层继续只负责：

- token
- trivia
- comment 原始信息
- 基础解析与定位

不负责：

- Javadoc 标签解释
- 参数文档结构化
- `CallableDoc` 生成

### 6.2 Syntax 层

Syntax 层新增的职责只有一项：

- 在函数声明节点上绑定“哪段前置 Javadoc 注释属于它”

Syntax 层不负责：

- 把标签解释成 `summary`
- 生成参数数组
- 生成 hover / signature help 展示文本

### 6.3 Documentation 层

新增独立文档主链层，位置建议为：

- `src/language/documentation/`

职责：

- 读取 `ParsedDocument + SyntaxDocument`
- 解析正式支持的 Javadoc 标签
- 产出统一的 `CallableDoc`
- 提供按文档、按声明、按名称、按位置的读取接口

Documentation 层必须明确区分两类职责：

- `FunctionDocumentationService`
  - 只负责“单文档内源码声明 -> `CallableDoc`”
- `CallableDocResolver`
  - 负责“跨文档候选目标 -> `CallableDoc` materialization”

这两者不得混成一个“大而全”的服务。

### 6.4 Semantic 层

Semantic 层只允许保存轻量关联信息，例如：

- 某函数是否存在文档
- 某符号如何关联到文档 key

禁止把完整文档实体直接塞进 `SemanticSnapshot`，避免语义层承担展示层和文档层职责。

## 7. 核心数据模型

### 7.1 注释归属模型

函数声明节点新增轻量绑定字段：

- `attachedDocComment?: AttachedDocComment`

`AttachedDocComment` 只表达：

- 注释类型：`javadoc`
- 注释源码范围
- 注释文本或可回取的 trivia 引用

它不直接等于最终文档模型。

### 7.1.1 注释归属规则

函数声明与前置 Javadoc 的绑定规则必须固定如下：

1. 只接受 `/** ... */` 形式的 Javadoc block
2. 候选注释必须位于函数声明之前，且是离该声明最近的一个 Javadoc block
3. 在候选注释结束位置与函数声明开始位置之间，只允许出现：
   - 空白字符
   - 换行
   - 函数声明修饰词 token：`private` / `public` / `protected` / `static` / `nomask` / `varargs`
4. 以下内容一旦出现在候选注释与函数声明之间，绑定立即失效：
   - 预处理指令
   - 其他普通注释
   - 任何不属于函数声明前缀修饰词集合的 token
5. 若存在多个连续 Javadoc block，则仅离声明最近的那个可绑定；更早的 block 视为 orphan doc，不自动合并
6. 一个 Javadoc block 只绑定到它后面的第一个函数声明，不允许一段文档同时附着多个声明
 7. 若候选注释与声明之间存在空行，则允许最多 1 个空白行；超过 1 个空白行则视为不绑定
8. “空白行”的定义是：连续两个换行之间只有空白字符，没有其他 token 或 trivia
9. 允许的修饰词 token 必须视为函数声明的一部分，而不是绑定中断项

该规则必须以测试锁定，避免后续不同实现者各自理解。

#### 绑定示例 A：允许

```c
/**
 * @brief 示例
 */
public nomask int query_id()
{
}
```

原因：

- 注释与声明之间只有换行与允许的修饰词 token

#### 绑定示例 B：允许

```c
/**
 * @brief 示例
 */

private int query_value()
{
}
```

原因：

- 只有 1 个空白行
- 中间没有预处理指令、普通注释或其他 token

#### 绑定示例 C：不允许

```c
/**
 * @brief 示例
 */

#define FOO 1
int query_foo()
{
}
```

原因：

- 注释与声明之间存在预处理指令，绑定立即失效

#### 绑定示例 D：不允许

```c
/**
 * @brief 示例
 */


int query_bar()
{
}
```

原因：

- 超过 1 个空白行

### 7.1.2 `AttachedDocComment` 结构

`AttachedDocComment` 建议最小结构为：

```ts
export interface AttachedDocComment {
    kind: 'javadoc';
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    text: string;
}
```

### 7.2 可调用文档主模型

统一主模型定义为：

- `CallableDoc`

建议字段：

- `name`
- `signatures: CallableSignature[]`
- `summary?`
- `details?`
- `note?`
- `returns?`
- `returnObjects?`
- `sourceKind`
- `sourcePath?`
- `sourceRange?`

### 7.3 签名模型

`CallableSignature` 建议字段：

- `label`
- `returnType?`
- `parameters: CallableParameter[]`
- `isVariadic`
- `rawSyntax?`

### 7.4 参数模型

`CallableParameter` 建议字段：

- `name`
- `type?`
- `description?`
- `optional?`
- `variadic?`

### 7.5 返回信息模型

建议单独保留返回信息结构，而不是把 `@return` 再拼回 description：

- `CallableReturnDoc`
  - `type?`
  - `description?`

### 7.6 返回对象模型

`CallableDoc.returnObjects` 必须使用明确结构，而不是裸字符串说明。建议：

```ts
export type CallableReturnObjects = string[];
```

语义约束：

- 每个元素都是 mudlib 绝对对象路径
- 必须保留声明顺序
- 不去重
- 非法路径项整体忽略

`@lpc-return-objects` 与 `CallableDoc.returnObjects` 的映射规则必须固定为：

- 标签内容必须是严格的字符串数组字面量
- 成功时映射为 `string[]`
- 失败时映射为 `undefined`
- 失败不会影响其他合法标签解析

## 8. 文档解析规则

### 8.0 Javadoc 标签语法

支持的标签语法必须固定如下：

- `@brief <text>`
- `@param <type> <name> <text>`
- `@return <text>`
- `@details <text>`
- `@note <text>`
- `@lpc-return-objects { "<path>", "<path2>" }`

其中：

- `<text>` 可跨多行，直到下一个合法标签开始或注释结束
- `@param` 中 `<type>` 与 `<name>` 都是必填
- `@return` 只承载说明文本；返回类型仍然来自代码声明或结构化 `efun` 签名
- `@lpc-return-objects` 只接受严格的 JSON-like 字符串数组字面量，不接受表达式

### 8.0.1 Summary / Details 映射规则

文档正文的结构化映射必须固定如下：

1. `@brief`
   - 映射到 `CallableDoc.summary`
2. `@details`
   - 映射到 `CallableDoc.details`
3. `@note`
   - 映射到 `CallableDoc.note`
4. `@return`
   - 映射到 `CallableDoc.returns.description`
5. `@param`
   - 每个标签映射到一个 `CallableParameter.description`

不允许再把参数说明或返回说明重新拼回 summary。

### 8.0.2 多行规则

- 标签第一行后的缩进行继续归属于该标签
- 多行内容按去掉注释前缀后的原始顺序拼接
- 连续空行保留为单个空行

### 8.0.3 重复标签与未知标签

- `@brief`
  - 只允许一个；若重复，取第一个并记录测试中的无效输入行为
- `@details`
  - 只允许一个；若重复，按双换行拼接
- `@note`
  - 只允许一个；若重复，按双换行拼接
- `@return`
  - 只允许一个；若重复，取第一个
- `@param`
  - 可重复；按出现顺序收集
- 未知标签
  - 不进入正式模型
  - 不得导致整个文档失效

### 8.0.4 非法输入行为

若出现以下情况：

- `@param` 缺少 `<type>` 或 `<name>`
- `@lpc-return-objects` 不是严格字符串数组
- 标签名拼写错误

则：

- 非法标签本身忽略
- 同一注释中其他合法标签继续生效
- 不能因为局部非法输入让整个 `CallableDoc` 丢失

### 8.1 源码函数

源码函数文档生成规则：

1. 函数声明签名来自代码声明本身
2. 文档归属来自 `attachedDocComment`
3. 标签语义由 `FunctionDocumentationService` 解释
4. 非正式注释不进入正式主链

### 8.2 标准 Efun

标准 `efun` 不再走 `syntax + description + returnType` 的旧展示模型，而是直接由新的结构化 `efun-docs.json` 生成 `CallableDoc`。

这意味着：

- 新 `efun-docs.json` 应尽量接近 `CallableDoc` 结构
- 运行时无需再从 `syntax` 字符串反推大部分参数信息

### 8.3 Simul Efun

`simul_efun` 来自本地源码扫描，应与普通源码函数统一走 `FunctionDocumentationService` 主链，而不是维持单独的旁路文档解析。

### 8.4 对象方法

对象方法的文档不需要新的专用文档模型。  
对象推导负责定位目标声明，文档服务负责为该声明生成 `CallableDoc`。

## 9. Efun 文档改造

### 9.1 新格式要求

[`config/efun-docs.json`](D:/code/lpc-support/config/efun-docs.json:1) 本次任务内直接升级为结构化格式。建议最少包含：

- `summary`
- `signatures[]`
- `details`
- `note`
- `reference`
- `category`

其中 `signatures[]` 每条至少包含：

- `label`
- `returnType`
- `parameters[]`
- `isVariadic`

### 9.2 不保留旧格式

本次改造后：

- loader 不再保留旧 `efun-docs` 兼容代码
- 旧 `lpc-config.json` fallback 不再作为新文档主链的维护对象

### 9.3 远程获取退场

`RemoteEfunFetcher` 不再进入生产主路径。

可接受的结果是：

- 直接删除远程获取逻辑
- 或保留文件但完全不接入产品运行链路

但最终产品行为必须满足：

- 标准 `efun` 文档只来自本地仓库数据

## 10. 文档服务设计

### 10.1 新增服务

建议新增：

- `src/language/documentation/FunctionDocumentationService.ts`

职责：

- 按文档懒构建结构化函数文档
- 提供缓存
- 文档变更时失效
- 支持按声明与按名称双索引

该服务的边界必须明确为：

- 只处理“已经位于某个具体 `vscode.TextDocument` 中的源码函数声明”
- 不负责：
  - inherit/include 的跨文档目标发现
  - 对象方法目标发现
  - 标准 `efun` 的加载
  - `simul_efun` 入口递归遍历

### 10.1.1 服务接口

`FunctionDocumentationService` 必须提供明确、可测试的接口。建议最小接口为：

```ts
export interface FunctionDocumentationService {
    getDocumentDocs(document: vscode.TextDocument): DocumentCallableDocs;
    getDocForDeclaration(document: vscode.TextDocument, declarationKey: string): CallableDoc | undefined;
    getDocsByName(document: vscode.TextDocument, name: string): CallableDoc[];
    invalidate(uri: string): void;
    clear(): void;
}
```

`DocumentCallableDocs` 最少包含：

```ts
export interface DocumentCallableDocs {
    uri: string;
    declarationOrder: string[];
    byDeclaration: Map<string, CallableDoc>;
    byName: Map<string, string[]>;
}
```

其中 `declarationKey` 必须是稳定且可复现的声明身份键。推荐构成为：

- `${uri}#${startLine}:${startCharacter}-${endLine}:${endCharacter}`

### 10.1.1a 非本地文档解析管线

跨文件与跨来源解析必须经过统一的候选解析管线，不允许各消费方自行拼装。

建议新增：

```ts
export interface ResolvedCallableTarget {
    kind: 'local' | 'inherit' | 'include' | 'simulEfun' | 'efun' | 'objectMethod';
    name: string;
    targetKey: string;
    documentUri?: string;
    declarationKey?: string;
    sourceLabel: string;
    priority: number;
}
```

以及：

```ts
export interface CallableDocResolver {
    resolveFromTarget(target: ResolvedCallableTarget): Promise<CallableDoc | undefined>;
    resolveMany(targets: ResolvedCallableTarget[]): Promise<CallableDoc[]>;
}
```

`CallableDiscoveryRequest` 建议最小结构为：

```ts
export interface CallableDiscoveryRequest {
    document: vscode.TextDocument;
    position: vscode.Position;
    callExpressionRange: vscode.Range;
    calleeName: string;
}
```

职责划分必须固定如下：

- 导航 / 对象推导 / include / inherit 相关能力
  - 负责发现 `ResolvedCallableTarget`
- `CallableDocResolver`
  - 负责把目标转成 `CallableDoc`
- `FunctionDocumentationService`
  - 仅在目标已经指向具体源码文档与声明时参与
- 标准 `efun` loader
  - 直接为 `CallableDocResolver` 提供标准 `efun` 文档

禁止消费方直接跳过 `ResolvedCallableTarget` 管线读取跨文件文档。

### 10.1.1b 目标身份规则

`ResolvedCallableTarget.targetKey` 必须始终存在，并作为跨来源统一身份键。

规则如下：

- 源码声明
  - `targetKey = declarationKey`
- 标准 `efun`
  - `targetKey = efun:<name>`
- 结构化 `efun` 多签名内部若需要子级定位
  - 使用 `efun:<name>#<signatureIndex>`
- `simul_efun`
  - 使用其源码声明 `declarationKey`

对于 `local` / `inherit` / `include` / `objectMethod` / `simulEfun`：

- `documentUri` 必填
- `declarationKey` 必填

对于 `efun`：

- `documentUri` 不存在
- `declarationKey` 不存在
- 仅依赖 `targetKey`

### 10.1.1c 候选发现接口

为了让 subagent 可执行性清晰，候选发现接口建议最小化为：

```ts
export interface CallableTargetDiscoveryService {
    discoverLocalOrInheritedTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
    discoverIncludeTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
    discoverObjectMethodTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
    discoverEfunTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
}
```

其中：

- `discoverLocalOrInheritedTargets`
  - 复用导航/符号解析
- `discoverIncludeTargets`
  - 复用 include 解析链
- `discoverObjectMethodTargets`
  - 复用 `ObjectInferenceService` 与 `TargetMethodLookup`
- `discoverEfunTargets`
  - 复用 `EfunDocsManager`

`LanguageSignatureHelpService` 只编排这些接口，不直接写发现逻辑。

### 10.1.1d 候选排序、去重与合并的唯一规则

候选的 authoritative 处理规则必须只定义一次，并由 `LanguageSignatureHelpService` 负责执行。

处理顺序固定为：

1. 收集原始 `ResolvedCallableTarget[]`
2. 先按 `targetKey` 去重
3. 再按 `priority` 升序排序
4. 若 `priority` 相同，则按 `targetKey` 字典序排序
5. 将排序后的候选 materialize 为 `CallableDoc`
6. 仅对 materialized 结果做“同签名合并”

“同签名合并”的判断条件固定为：

- `CallableDoc.name` 相同
- `signatures.length` 相同
- 每个 `signatures[i].label` 完全相同

合并后：

- 排序最靠前的候选成为主候选
- 其余候选来源进入 `additionalSourceLabels`

除 `LanguageSignatureHelpService` 外，其他组件不得自行做 dedupe / merge / 排序。

### 10.1.1e 唯一 ownership chain

为了避免中间抽象重叠，ownership chain 必须固定为：

1. `CallableTargetDiscoveryService`
   - 发现原始 `ResolvedCallableTarget[]`
2. `LanguageSignatureHelpService`
   - 执行唯一的 dedupe / 排序 / merge / active-signature 选择
3. `CallableDocResolver`
   - 把排序后的候选 materialize 为 `CallableDoc`
4. `CallableDocRenderer`
   - 把 `CallableDoc` 与来源信息转成 hover / panel / signature help 文档块
5. classic adapter / LSP handler
   - 只做 host surface 转换

明确禁止：

- `hover` 自己做 dedupe
- panel 自己做来源排序
- classic adapter 重新选 activeSignature
- LSP handler 重新决定来源 precedence

### 10.1.2 构建与失效契约

服务行为必须满足：

1. 第一次读取某文档时懒构建
2. 同一文档在未失效前重复读取必须返回同一缓存结果语义
3. 文档内容变更后，必须通过现有文档生命周期事件使该文档缓存失效
4. `invalidate(uri)` 只影响单文档缓存，不连带清空其他文档
5. `clear()` 只用于全局重置或测试

### 10.1.3 Renderer 接口

`CallableDocRenderer` 必须以结构化文档为输入，而不是接收零散字符串。建议最小接口为：

```ts
export interface CallableDocRenderer {
    renderHover(doc: CallableDoc, options?: { sourceLabel?: string }): string;
    renderPanel(doc: CallableDoc): string;
    renderSignatureSummary(doc: CallableDoc, signatureIndex: number, activeParameter: number): {
        label: string;
        documentation?: string;
        parameterDocs: string[];
    };
}
```

### 10.2 缓存策略

缓存粒度建议按文档：

- `uri -> DocumentCallableDocs`

每个文档缓存中建议包含：

- 声明索引
- 名称索引
- 每个声明对应的 `CallableDoc`

优先按“声明身份”或“源码范围”查，不应只以名称作为唯一键，避免：

- 同名函数冲突
- 多文件候选混淆

## 11. Hover 迁移要求

`hover` 必须全面改走统一文档主链。

### 11.1 要求

- 不再自己解释 Javadoc
- 不再自行拼接来源特化 description 字符串
- 对象方法、源码函数、`efun` / `simul_efun` 最终都由统一 renderer 输出

### 11.2 格式目标

Hover 展示目标应保留稳定层次：

- 函数签名
- 简介
- 参数说明
- 返回说明
- `details`
- `note`

展示可以有来源差异，但信息结构不允许分裂成多套逻辑。

## 12. 函数文档面板迁移要求

函数文档面板只保留 UI 职责。

必须改成：

- 数据全部来自统一文档服务
- 当前文件、继承、include、`simul_efun` 文档读取都不再走独立抽取逻辑

禁止继续维护“面板专用文档解析器”。

## 13. `@lpc-return-objects` 迁移要求

`@lpc-return-objects` 的读取必须改走统一文档主链。

这意味着：

- 返回对象传播不再自行重新调用全文注释解析
- `ReturnObjectResolver` 只消费结构化文档字段 `returnObjects`

## 14. Signature Help 设计

### 14.1 新增服务

建议新增：

- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`

职责只做两件事：

1. 识别当前调用表达式与当前参数索引
2. 把调用目标解析到一个或多个可调用候选，再结合 `CallableDoc` 产出 `SignatureHelp`

### 14.2 必须覆盖的五类来源

首版必须同时覆盖：

- 当前文件函数
- 继承函数
- include 可见函数
- `simul_efun` / 标准 `efun`
- 对象推导方法

### 14.3 解析原则

`signature help` 禁止：

- 重新实现一套定义跳转逻辑
- 重新实现一套对象推导逻辑
- 重新全文搜索函数名

必须优先复用：

- 现有导航能力
- `ObjectInferenceService`
- `TargetMethodLookup`
- 项目配置与 `simul_efun` 文档主链
- 标准 `efun` 文档主链

具体 ownership 必须固定为：

- 当前文件 / inherit / include 的候选发现
  - 由导航相关解析层负责
- 对象方法候选发现
  - 由对象推导相关解析层负责
- `simul_efun` / 标准 `efun` 候选发现
  - 由 `EfunDocsManager` / `CallableDocResolver` 负责
- `signature help` 服务
  - 只编排候选发现、排序、去重、参数索引与结果组装

### 14.4 候选中间模型

建议 `signature help` 先统一转换到：

- `ResolvedSignatureHelpCandidate`

字段至少包含：

- `kind`
- `name`
- `sourceLabel`
- `declarationLocation?`
- `documentation: CallableDoc`

然后再把该候选转换成 LSP 或 classic surface 所需结果。

建议最小结构为：

```ts
export interface ResolvedSignatureHelpCandidate {
    kind: 'local' | 'inherit' | 'include' | 'simulEfun' | 'efun' | 'objectMethod';
    name: string;
    sourceLabel: string;
    declarationLocation?: vscode.Location;
    documentation: CallableDoc;
    priority: number;
}
```

### 14.5 当前参数索引

当前参数索引计算必须基于 token/syntax 主链或等价结构能力完成。

禁止用简单字符串拆逗号方式实现，否则会在以下情况下失真：

- 嵌套函数调用
- 字符串
- 数组
- `mapping`
- 复杂字面量

### 14.6 多候选行为

当出现多个候选时：

- 若签名一致，可合并展示并保留来源提示
- 若签名不同，允许展示多个候选签名
- 不得因为候选数大于 1 就整体放弃结果

### 14.7 候选排序、去重与触发条件

`signature help` 行为必须固定如下：

#### 候选排序

默认优先级从高到低：

1. 当前文件函数
2. 继承 / include 解析到的源码函数
3. 对象方法解析结果
4. `simul_efun`
5. 标准 `efun`

若同一优先级内出现多个候选，则按：

1. 精确声明位置稳定排序
2. 再按 `sourceLabel` 字典序排序

#### 候选去重

若多个候选满足以下条件，则视为同一签名候选组：

- `name` 相同
- `signatures.length` 相同
- 每条签名的 `label` 完全相同

合并后保留：

- 最高优先级候选作为主候选
- 其他来源以来源提示形式附加

#### 触发条件

首版必须在以下条件触发 `signature help`：

- 输入 `(`
- 输入 `,`
- 光标在调用参数列表内部移动时重新请求

若当前光标不在函数调用或方法调用参数列表中，必须返回 `undefined`，而不是猜测最近调用。

### 14.7.1 来源 precedence 总表

| Order | Source Kind | 用途 |
|---|---|---|
| 1 | `local` | 当前文件解析到的直接声明 |
| 2 | `inherit` | 继承链解析到的声明 |
| 3 | `include` | include 可见声明 |
| 4 | `objectMethod` | 对象推导解析到的方法声明 |
| 5 | `simulEfun` | 本地 `simul_efun` |
| 6 | `efun` | 标准 `efun` |

这张表同时适用于：

- hover 多来源顺序
- panel 多来源顺序
- signature help 候选排序

### 14.8 Classic / LSP 共享结果契约

Classic 与 LSP 不应各自产生不同中间结果。两者都必须消费同一 shared 结果：

```ts
export interface LanguageSignatureHelpResult {
    signatures: Array<{
        label: string;
        documentation?: string;
        sourceLabel: string;
        additionalSourceLabels?: string[];
        parameters: Array<{
            label: string;
            documentation?: string;
        }>;
    }>;
    activeSignature: number;
    activeParameter: number;
}
```

Classic adapter 与 LSP handler 只负责 surface 转换，不允许重新拼接候选文档。

### 14.9 Surface 展示契约

#### Hover

Hover renderer 的来源标签展示必须固定为单独一行：

- `Source: current-file`
- `Source: inherited`
- `Source: include`
- `Source: simul_efun`
- `Source: efun`
- `Source: object-method`

当候选合并时，可展示为：

- `Source: efun`
- `Also from: inherit-a, inherit-b`

不得把来源信息混进 summary 或 details 正文。

#### Signature Help

`signature help` 的最终 UI 文档块中：

- 主签名 label 不包含来源标签
- 来源标签进入 `documentation` 顶部一行
- 参数文档只显示参数本身说明，不夹杂来源说明

这样 classic 与 LSP surface 更容易保持一致。

### 14.10 `activeSignature` 选择规则

`activeSignature` 必须由 `LanguageSignatureHelpService` 唯一决定，规则如下：

1. 在主候选组中，优先选择“参数数量可精确匹配当前已输入参数索引”的签名
2. 若有多个精确匹配，选择该组中排序最靠前的签名
3. 若无精确匹配，则选择第一个可接纳当前参数索引的变参签名
4. 若仍无匹配，则回退到签名索引 `0`

classic adapter 与 LSP handler 不得再次改写 `activeSignature`。

### 14.11 跨 surface 缺失/冲突行为

当同名 callable 解析出多个来源时，行为必须固定如下：

- 若主候选组有完整文档，次候选组仅补来源提示，不覆盖主候选 summary/details
- 若主候选组只有签名没有文档，且次候选组有完整文档，但 precedence 更低：
  - 仍保持主候选为主
  - 允许在文档块中追加 `Also documented by: ...`
- 若多个候选组签名不同：
  - hover 与 panel 展示多个分组，按 precedence 顺序
  - signature help 只以主候选组确定 `activeSignature`
- 若所有候选都无文档：
  - 至少显示签名

## 15. Host Surface 接入要求

## 15. Host Surface 接入要求

### 15.1 Classic

Classic host 侧若仍保留 provider/adapter，必须作为薄适配层调用 shared service。

Classic provider 注册归 classic host 模块所有，建议继续由现有 classic host 装配层负责。

### 15.2 LSP

LSP 侧必须新增对应 `signature help` handler，并保持和 classic 共享同一服务结果。

LSP handler 注册归 `src/lsp/server/bootstrap/registerCapabilities.ts` 与对应 handler 文件所有。

禁止形成：

- classic 一套文档解释
- lsp 一套文档解释

## 16. 仓库改动面

### 16.1 新增

- `src/language/documentation/types.ts`
- `src/language/documentation/FunctionDocumentationService.ts`
- `src/language/documentation/CallableDocRenderer.ts`
- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`

### 16.2 重点修改

- `src/syntax/types.ts`
- `src/syntax/SyntaxBuilder.ts`
- `src/efun/types.ts`
- `src/efun/BundledEfunLoader.ts`
- `src/efun/EfunDocsManager.ts`
- `src/language/services/navigation/LanguageHoverService.ts`
- `src/functionDocPanel.ts`
- `src/objectInference/ReturnObjectResolver.ts`
- `src/lsp/server/bootstrap/registerCapabilities.ts`
- `src/lsp/server/handlers/` 下新增 `signature help` handler
- `config/efun-docs.json`

### 16.3 需要收口或删除的旧路径

- `src/efun/docParser.ts` 中仅为临时全文文档解析服务的主路径职责
- `src/efun/FileFunctionDocTracker.ts` 中与统一主链重复的文档抽取逻辑
- `src/efun/RemoteEfunFetcher.ts` 的生产主路径接入

## 17. 错误处理与容错

### 17.1 文档缺失

若函数存在但没有正式支持的 Javadoc：

- `hover`
  - 至少仍可显示签名
- `signature help`
  - 至少仍可显示签名与参数列表

不能因为文档缺失而让整个能力不可用。

### 17.2 Efun 数据缺字段

标准 `efun` 文档若个别条目缺少参数说明：

- 可以显示参数名与类型
- 参数说明留空

但不得让条目整体失效。

### 17.3 多签名与变参

必须正确支持：

- 多签名
- `...` 变参
- 缺失参数名的旧数据迁移后补齐稳定占位名

## 18. Subagent 执行约束

本 spec 必须按 subagent 友好方式执行，后续 implementation plan 也必须延续这一风格。

### 18.1 任务切片原则

建议拆成以下工作包：

- 包 A：文档绑定与统一模型
- 包 B：标准 `efun` 文档格式升级
- 包 C：文档消费链切换
- 包 D：`signature help` 主链
- 包 E：测试与总收口

虽然是一次性交付，但 implementation planning 不得把以上 5 包压成一个不可拆的大任务。  
每个工作包必须能被独立派发、独立 review、独立验证，然后再统一收口。

### 18.2 每个工作包必须显式包含

- `Write Scope`
- `Reads From`
- `Must Not Change`
- `Blocks / Unblocks`
- `Verification`
- `Hand-off Output`

### 18.4 工作包矩阵

| Work Package | Writes | Reads | Must Not Change | Verification | Hand-off Output |
|---|---|---|---|---|---|
| 包 A：文档绑定与统一模型 | `src/syntax/types.ts`, `src/syntax/SyntaxBuilder.ts`, `src/language/documentation/types.ts`, `src/language/documentation/FunctionDocumentationService.ts` | `ParsedDocumentService`, `SyntaxDocument` 现状, parser trivia 能力 | 不改 hover/panel/signature help surface；不改 efun loader | 文档绑定测试、文档服务单测 | `AttachedDocComment`, `CallableDoc`, `DocumentCallableDocs`, `FunctionDocumentationService` |
| 包 B：标准 `efun` 文档格式升级 | `config/efun-docs.json`, `src/efun/types.ts`, `src/efun/BundledEfunLoader.ts`, `src/efun/EfunDocsManager.ts` | 包 A 的 `CallableDoc` 结构 | 不改源码函数文档绑定；不改 signature help 调用点分析 | efun schema/load 测试 | 新结构化 `efun-docs.json` 与 `efun -> CallableDoc` 适配结果 |
| 包 C：文档消费链切换 | `src/language/services/navigation/LanguageHoverService.ts`, `src/functionDocPanel.ts`, `src/objectInference/ReturnObjectResolver.ts`, 必要时 `src/efun/EfunHoverContent.ts` | 包 A 文档服务；包 B efun 文档 | 不改 signature help 主链；不改 parser/syntax 基础结构 | hover/panel/returnObjects 回归 | 所有现有文档消费者切到统一主链 |
| 包 D：`signature help` 主链 | `src/language/services/signatureHelp/*`, classic adapter 入口, LSP signature help handler 与 bootstrap | 包 A 的模型与文档服务；包 B 的 efun 文档；既有导航与对象推导服务 | 不改 `CallableDoc` schema；不改 efun JSON schema | 五类来源 signature help 测试 | `LanguageSignatureHelpService`, shared result, classic/LSP surface wiring |
| 包 E：测试与总收口 | 各相关测试文件、必要的 fixture | A/B/C/D 所有稳定接口 | 不再新增新模型；不扩 scope | 全量目标测试、必要的回归矩阵 | 统一通过的测试与最终收口说明 |

### 18.3 Subagent 红线

后续执行时的 implementer subagent 不得：

- 自行扩大任务范围
- 顺手重构无关 parser / semantic 区域
- 为了省事重新引入全文文本扫描
- 为了临时通过测试保留平行文档路径

## 19. 测试要求

### 19.1 必须新增或更新的测试类别

- 文档绑定测试
- Javadoc 解析测试
- 统一文档服务测试
- 标准 `efun-docs` 加载测试
- `hover` 文档来源一致性测试
- `signature help` 五类来源测试
- `@lpc-return-objects` 主链回归测试

### 19.2 必须覆盖的 `signature help` 场景

- 当前文件普通函数调用
- 继承函数调用
- include 可见函数调用
- 标准 `efun`
- `simul_efun`
- 对象方法调用
- 多签名函数
- 变参函数
- 嵌套调用中的参数索引

### 19.3 验证原则

验证必须关注：

- 行为是否统一
- 文档归属是否稳定
- 参数索引是否正确
- 数据是否继续复用主链

不接受只验证“结果大概能显示”的宽松口径。

## 20. `efun-docs.json` 结构定义

新的 `efun-docs.json` 必须以结构化 schema 为准，推荐最小形状如下：

```json
{
  "generatedAt": "2026-04-14T00:00:00.000Z",
  "categories": {
    "调用相关函数（Calls）": ["call_out"]
  },
  "docs": {
    "call_out": {
      "name": "call_out",
      "summary": "设置延迟调用。",
      "details": "delay 支持 int 或 float。",
      "note": "返回句柄可用于 remove_call_out。",
      "reference": ["remove_call_out", "find_call_out"],
      "category": "调用相关函数（Calls）",
      "signatures": [
        {
          "label": "int call_out(string | function fun, int | float delay, mixed ...args)",
          "returnType": "int",
          "isVariadic": true,
          "parameters": [
            {
              "name": "fun",
              "type": "string | function",
              "description": "要调用的函数或函数指针"
            },
            {
              "name": "delay",
              "type": "int | float",
              "description": "延迟秒数"
            },
            {
              "name": "args",
              "type": "mixed",
              "description": "传递给 fun 的附加参数",
              "variadic": true
            }
          ]
        }
      ]
    }
  }
}
```

### 20.1 字段约束

新格式的顶层 canonical keys 只允许：

- `generatedAt`
- `categories`
- `docs`

其中：

- `generatedAt`
  - 可选
- `categories`
  - 必填
- `docs`
  - 必填

仓库内提交的新 `config/efun-docs.json` 必须移除 legacy 顶层字段 `source`。  
本次任务的迁移结果不允许继续保留它。

- `generatedAt`
  - 仅用于元数据记录
- `StructuredEfunDoc.summary`
  - 可选
  - 字符串
- `StructuredEfunDoc.signatures`
  - 必填
  - 非空数组
- `StructuredEfunDoc.reference`
  - 可选
  - 字符串数组
- `StructuredEfunDoc.category`
  - 必填
  - 字符串
- `StructuredEfunDoc.details`
  - 可选
- `StructuredEfunDoc.note`
  - 可选

每个 `signatures[]` 项：

- `label`
  - 必填
- `returnType`
  - 可选但推荐必填
- `isVariadic`
  - 必填
- `parameters`
  - 必填，可为空数组

每个 `parameters[]` 项：

- `name`
  - 必填
- `type`
  - 可选
- `description`
  - 可选
- `optional`
  - 可选
- `variadic`
  - 可选

### 20.2 重载表示

多签名函数必须用多个 `signatures[]` 项表示，而不是把多条签名拼在一个字符串里。

### 20.3 变参表示

变参函数必须满足：

- 签名级 `isVariadic: true`
- 最后一个变参参数项 `variadic: true`

### 20.4 校验要求

本次任务必须增加针对新 `efun-docs.json` 格式的校验测试，至少验证：

- 简单单签名函数
- 多签名函数
- 变参函数
- 缺少可选字段时仍可加载

### 20.5 TypeScript 结构定义

实现中必须有与 JSON schema 对应的 TypeScript 结构定义。建议最小类型为：

```ts
export interface StructuredEfunDocBundle {
    generatedAt?: string;
    categories: Record<string, string[]>;
    docs: Record<string, StructuredEfunDoc>;
}

export interface StructuredEfunDoc {
    name: string;
    summary?: string;
    details?: string;
    note?: string;
    reference?: string[];
    category: string;
    signatures: StructuredEfunSignature[];
}

export interface StructuredEfunSignature {
    label: string;
    returnType?: string;
    isVariadic: boolean;
    parameters: StructuredEfunParameter[];
}

export interface StructuredEfunParameter {
    name: string;
    type?: string;
    description?: string;
    optional?: boolean;
    variadic?: boolean;
}
```

### 20.6 Loader 失败行为

标准 `efun` loader 的失败行为必须固定如下：

- 文件不存在
  - 记录错误
  - 返回空 docs map
  - 扩展继续运行
- JSON 解析失败
  - 记录错误
  - 返回空 docs map
  - 扩展继续运行
- `docs` 缺失或不是对象
  - 记录错误
  - 返回空 docs map
- `categories` 缺失或不是对象
  - 记录错误
  - 返回空 categories map，但 docs 仍可加载
- `categories` 中引用不存在的 doc key
  - 忽略无效引用
  - 记录调试告警
- `docs` 中存在未被任何 category 引用的条目
  - 仍然加载
  - 不视为错误

### 20.7 Loader 负向测试

必须增加以下负向测试：

- malformed JSON
- 缺少 `docs`
- 缺少 `categories`
- `categories` 引用不存在条目
- 单个 `signatures[]` 项缺少 `label`
- 单个参数项缺少 `name`

## 21. 成功标准

本次任务完成时，以下结论必须同时成立：

1. 源码函数文档已经进入统一主链，不再主要依赖全文正则解析
2. `syntax` 层已建立函数声明与前置 Javadoc 的稳定绑定关系
3. `CallableDoc` 已成为源码函数、`simul_efun`、标准 `efun`、对象方法的统一消费模型
4. `hover`、函数文档面板、`@lpc-return-objects` 已切到统一文档主链
5. `signature help` 已覆盖五类来源
6. 标准 `efun` 文档已迁移到新的结构化本地格式
7. 远程 `mud.wiki` 获取链不再是产品主路径
8. 相关测试已建立并通过

## 22. 推荐结论

这是一次“文档主链 + `signature help` + 标准 `efun` 文档模型”的统一收口任务，而不是单一小特性。

它的工程价值不在于多了一个提示框，而在于：

- 函数文档首次成为稳定的结构化主链能力
- 多个语言能力首次共享同一文档真源
- 标准 `efun` 与源码函数第一次进入统一可调用文档模型
- 后续任何与函数说明相关的语言能力都能建立在同一底座上

这正是当前 `lpc-support` 架构继续向前扩展所需要的基础。
