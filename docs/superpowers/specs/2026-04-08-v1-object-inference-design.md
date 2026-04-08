# V1 对象推导设计

## 背景

当前仓库已经完成两类与 `->` 相关的修补：

- `definition` 链路避免在对象方法解析失败时错误回退到 simul_efun / efun
- `completion` 与 `hover` 链路避免把 `->` 成员名误当成普通函数空间处理

但这些修补仍然是“防跳错”导向，不是“推导对象来源”导向。当前代码中的对象目标解析能力仍然非常有限：

- `definitionProvider.ts` 的 `resolveObjectAccessTargetPath()` 只适合可直接还原目标文件的接收者
- `completionQueryEngine.ts` 只能从简单 `receiverChain` 的静态类型推断少量类型成员，复杂来源仍回退到通用 object 方法
- `hover` 目前只会阻止 `->` 误回退到 efun 文档，没有独立的对象来源推导层

因此以下典型场景仍缺乏统一支持：

- `this_object()->method()`
- `c = load_object(path); c->method()`
- `if/else` 中给同一变量赋不同对象来源后再调用 `c->method()`
- 自定义函数返回对象，但只能通过文档注释表达返回对象集合

本次需求不是继续补局部特判，而是建立一个可供 `definition`、`completion`、`hover` 共享的 V1 对象推导能力。

## 目标

- 为 `definition`、`completion`、`hover` 提供统一的对象来源推导结果
- 支持首版明确强规则：
  - `this_object()`
  - `load_object(path)`
  - `find_object(path)`
  - `clone_object(path)`
- 支持字符串路径与宏路径对象解析
- 支持局部变量和参数在当前函数内的有限来源追踪
- 支持 `if/else` 分支产生的对象候选并集
- 支持通过函数 doc 注释中的 `@lpc-return-objects` 提供自定义函数返回对象集合
- 保持现有 parser / syntax / semantic 主路径边界，不把控制流推导塞进真源快照

## 非目标

- 不做 `arr[i]->method()` 推导
- 不做循环中的复杂数据流合并
- 不做跨函数体变量传播
- 不做复杂用户函数体的通用语义执行
- 不做 `environment()`、`present()` 这类强依赖运行时上下文的动态对象函数推导
- 不改变 parser / syntax / semantic 的职责边界

## 方案选型

### 方案 A：三条链路各自实现推导

做法：在 `definition`、`completion`、`hover` 内部分别补一套 `A 是谁` 的判断与追踪逻辑。

优点：

- 局部修改快
- 首轮落地看似直接

缺点：

- 三条链路规则容易漂移
- 宏、变量追踪、返回值推导会重复实现
- 后续维护成本高

### 方案 B：新增共享对象推导服务

做法：在消费层新增一个共享 `ObjectInferenceService`，按请求读取现有 `SyntaxDocument`、`SemanticSnapshot`、宏展开与路径解析能力，统一输出对象候选结果，三条链路只消费结果。

优点：

- 三条链路复用同一套规则
- 不破坏现有 parser / syntax / semantic 主路径
- 能自然承接变量追踪、强规则调用、doc 补充返回对象等能力

缺点：

- 需要补一组新的服务与测试
- 首轮需要明确结果状态和消费语义

### 方案 C：把对象推导做进 semantic snapshot

做法：在 `SemanticSnapshot` 构建阶段直接产出对象来源分析结果。

优点：

- 理论上可供更多能力复用

缺点：

- 会把 semantic 层从摘要层推向控制流/来源分析层
- 与当前仓库强调的 parser / syntax / semantic 边界不一致
- 首轮风险明显过大

## 采用方案

采用方案 B。

理由：

- 当前需求已经从单点 bugfix 升级为共享能力，不能再在三条消费链路中各自补洞
- 仓库已经具备 `SyntaxDocument`、`SemanticSnapshot`、宏管理、路径解析、继承链查找这些基础能力，足以支撑按请求推导
- 把控制流推导留在消费层之上的独立服务中，能满足能力扩展需求，同时避免破坏当前主路径架构

## 总体设计

### 设计原则

- 统一输出：三条链路共享同一个对象推导结果结构
- 按请求计算：不把控制流推导持久化进 `SemanticSnapshot`
- 复用现有能力：宏展开、路径解析、继承链解析、语法节点与符号表均直接复用
- 保守语义：不能可靠推导时返回 `unknown` 或 `unsupported`，不伪造单一对象结果

### 服务拆分

#### `ObjectInferenceService`

职责：统一入口，接收 `document + position + receiver syntax node`，输出标准化 `ObjectInferenceResult`。

它负责：

- 组织分类、追踪、返回值解析、路径归一化流程
- 为三条消费链路提供统一调用方式

#### `ReceiverClassifier`

职责：明确接收者的初始形态。

V1 明确支持：

- 字符串路径
- 路径宏
- 局部变量
- 参数
- 函数返回
- 内建强规则调用

V1 明确拒绝：

- 数组元素接收者
- 复杂匿名组合表达式

#### `ReceiverTraceService`

职责：当接收者是变量或参数时，在当前函数内向上追踪来源。

V1 只做有限追踪：

- 只看当前函数体
- 只看当前位置之前的赋值
- 支持直接赋值链
- 支持 `if/else` 两分支并集

不做：

- 循环固定点推导
- 跨函数传播
- 数组或映射元素传播

#### `ReturnObjectResolver`

职责：把“函数返回”进一步解析为对象候选。

V1 强规则：

- `this_object()` => 当前文件对象
- `load_object(path)` => `path`
- `find_object(path)` => `path`
- `clone_object(path)` => `path`

对自定义函数：

- 优先读取 doc 中的 `@lpc-return-objects`
- 没有该标签则返回 `unknown`

#### `ObjectCandidateResolver`

职责：把中间结果归一成最终对象候选集合。

它负责：

- 宏展开
- 路径标准化与补 `.c`
- 候选去重
- 输出状态归类

## 数据模型

```ts
interface ObjectCandidate {
    path: string;
    source: 'literal' | 'macro' | 'builtin-call' | 'assignment' | 'doc';
}

interface ObjectInferenceResult {
    status: 'resolved' | 'multiple' | 'unsupported' | 'unknown';
    candidates: ObjectCandidate[];
    reason?:
        | 'array-element'
        | 'unsupported-expression'
        | 'untracked-variable'
        | 'missing-doc-objects';
}
```

语义约定：

- `resolved`：唯一对象候选
- `multiple`：多个对象候选并集
- `unknown`：语义上属于对象推导，但当前证据不足
- `unsupported`：V1 明确不支持的形态

## 推导规则

### 场景 1：`this_object()->method()`

推导链：

1. `ReceiverClassifier` 把接收者识别为函数返回
2. `ReturnObjectResolver` 命中强规则 `this_object()`
3. 结果直接落到“当前文件对象路径”

输出：

- `status = resolved`
- `candidates = [当前文件对象]`

### 场景 2：`c = load_object(path); c->method()`

推导链：

1. `ReceiverClassifier` 把 `c` 识别为局部变量
2. `ReceiverTraceService` 在当前函数向上追踪 `c` 的可见赋值
3. 找到 `load_object(path)`
4. `ReturnObjectResolver` 命中强规则并解析 `path`

输出：

- 路径可展开时为 `resolved`
- 路径仍不可展开时为 `unknown`

### 场景 3：`if/else` 两分支并集

示例：

```lpc
if (random(2)) {
    c = load_object(path1);
} else {
    c = load_object(path2);
}

c->method();
```

推导链：

1. `ReceiverTraceService` 识别同一变量在互斥分支中的多个来源
2. 把两条来源都继续送入返回值解析
3. 最终生成对象候选并集

输出：

- `status = multiple`
- `candidates = [path1, path2]`

消费规则：

- `definition`：
  - 若所有候选最终都指向同一个定义位置，直接跳该位置
  - 否则返回多个 `Location`
- `completion`：
  - 返回方法并集
  - 公共方法前置，非公共方法后置
- `hover`：
  - 若公共实现唯一，则显示该实现
  - 否则只显示保守摘要，不伪造单一对象文档

### 场景 4：复杂自定义函数

对无法靠强规则独立推断的自定义函数，要求通过 doc 补充返回对象集合：

```lpc
/**
 * @brief 函数简要说明
 * @return object 返回对象
 * @lpc-return-objects {"/adm/daemons/combat_d", "/d/city/npc/guard"}
 */
```

规则：

- 解析 `@lpc-return-objects` 中的字符串数组
- 支持单个或多个对象路径
- 支持路径宏后续再展开
- 没有该标签时返回 `unknown`

### 场景 5：数组元素

示例：`arr[i]->method()`

规则：

- 只要根接收者是 `IndexExpression`，直接判定为 `unsupported`
- 三条链路统一不进入深推导

理由：

- 价值较低
- 成本明显偏高
- 易把 V1 扩展成不受控的数据流问题

## 三条链路接入

### `definition`

接入点：`src/definitionProvider.ts`

改动原则：

- 保留当前“当前位置是否属于 `->` 对象访问”的 AST 识别职责
- 不再让 `definitionProvider` 自己维护对象来源解析规则
- 改为把接收者节点交给 `ObjectInferenceService`

消费规则：

- `resolved`：沿现有目标文件、include、inherit 链查找方法定义
- `multiple`：
  - 若所有候选收敛到同一实现点，直接返回该定义
  - 否则返回多个 `Location`
- `unknown` / `unsupported`：直接返回 `undefined`
- 一旦命中 `->` 语义，不再回退到普通函数 / simul_efun / efun

### `completion`

接入点：`src/completion/completionQueryEngine.ts`

改动原则：

- 现有 `queryMemberCandidates()` 不再只依赖 `receiverChain` 的静态类型
- 改为优先调用 `ObjectInferenceService`

消费规则：

- `resolved`：读取目标对象文件及继承链方法，返回真实对象方法集合
- `multiple`：返回方法并集，公共方法排序更靠前
- `unknown`：保守退回现有通用 object 方法集合
- `unsupported`：保持当前保守行为，不引入错误对象推导结果

### `hover`

接入方式：

- `EfunHoverProvider` 继续只负责 efun / simul_efun 文档
- 新增对象方法 hover 分支或独立 provider
- 不把对象语义继续塞进 `EfunHoverProvider`

消费规则：

- `resolved`：显示目标对象方法的签名和注释
- `multiple`：
  - 公共实现唯一时显示唯一结果
  - 否则显示“可能来自多个对象”的保守摘要
- `unknown` / `unsupported`：不显示对象推导 hover，也不回退 efun 文档

## 与现有架构的关系

V1 对象推导只读取现有能力：

- `SyntaxDocument`
- `SemanticSnapshot`
- `MacroManager`
- 现有路径解析工具
- 现有继承链查找能力

V1 不新增：

- 新 parser 真源
- 基于全文正则的结构扫描
- 持久化的对象来源缓存真源

## 建议文件边界

新增：

- `src/objectInference/types.ts`
- `src/objectInference/ObjectInferenceService.ts`
- `src/objectInference/ReceiverClassifier.ts`
- `src/objectInference/ReceiverTraceService.ts`
- `src/objectInference/ReturnObjectResolver.ts`
- `src/objectInference/ObjectCandidateResolver.ts`

修改：

- `src/definitionProvider.ts`
- `src/completion/completionQueryEngine.ts`
- `src/efun/EfunHoverProvider.ts` 或主 hover 装配入口

测试：

- `src/__tests__/providerIntegration.test.ts`
- `src/__tests__/completionProvider.test.ts`
- 新增对象推导服务测试文件
- 新增 hover 集成或 provider 级测试文件

## 错误处理

统一按 `ObjectInferenceResult` 驱动：

- `resolved`：正常消费
- `multiple`：保留多候选，不强行压成单候选
- `unknown`：证据不足，保守失败，不回退到错误命名空间
- `unsupported`：明确拒绝，不进入深推导

链路行为：

- `definition`：`unknown` / `unsupported` 返回空结果
- `completion`：`unknown` 退回通用 object 方法；`unsupported` 保持当前保守行为
- `hover`：`unknown` / `unsupported` 不显示对象推导结果，且不回退 efun 文档

## 测试策略

### 1. 对象推导服务单测

覆盖：

- `this_object()` => 当前文件
- `load_object(path)` / `find_object(path)` / `clone_object(path)` => 路径
- 宏路径展开
- 局部变量直接赋值链
- `if/else` 并集
- `@lpc-return-objects`
- `arr[i]` => `unsupported`

### 2. `definition` 集成回归

覆盖：

- 单对象正确跳转
- 多对象公共父类方法跳转
- 多对象不同实现返回多位置
- `unknown` / `unsupported` 不回退 simul_efun / efun

### 3. `completion` 集成回归

覆盖：

- `this_object()->`
- `load_object(path)->`
- 宏对象路径 `OBJ_D->`
- `if/else` 并集方法
- 公共方法前置
- `arr[i]->` 不引入错误对象推导结果

### 4. `hover` 集成回归

覆盖：

- 已解析对象方法显示对象文档
- 多候选公共实现唯一时显示唯一结果
- 不可解析时不回退 efun 文档

## 验收标准

- `definition`、`completion`、`hover` 三条链路共享同一套对象推导结果
- `this_object()`、`load_object(path)`、`find_object(path)`、`clone_object(path)` 在 V1 中可用
- 宏路径对象可参与推导
- `if/else` 场景返回并集而不是伪造单结果
- 自定义函数可通过 `@lpc-return-objects` 提供对象集合
- `arr[i]->method()` 明确保持不支持
- 不能可靠推导时，行为是“保守失败”，而不是跳到错误目标
