# 表达式接收者 `->` 定义跳转不回退到 simul_efun/efun 设计

## 背景

当前 `definition` 链路已经修复了部分 `receiver->method()` 被错误回退到 simul_efun 的问题，但只覆盖了少数可识别的接收者形态，例如简单标识符或字符串字面量。

这导致如下场景仍会误跳转：

- `environment(ob)->query()`
- `foo()->bar()`
- 其他左侧是表达式而不是简单标识符的 `receiver->method()`

根因不是“对象访问命中后仍继续回退”，而是这些场景没有被现有对象访问识别逻辑命中。`definitionProvider.ts` 中的 `extractObjectReceiver()` 目前只支持：

1. 标识符接收者
2. 字符串字面量接收者
3. 一层括号包裹后的上述两类

因此，像 `environment(ob)` 这样的调用表达式不会被识别为对象访问，后续仍会落回普通函数查找，再错误进入 simul_efun 查找。

## 目标

本次只修一个规则：

- 只要语法上是 `任意表达式->method(...)`，definition 就应把它视为对象访问语义。
- 如果目标对象文件无法解析，则直接返回“找不到定义”。
- 不允许回退到 simul_efun / efun / 普通函数定义查找。

## 非目标

本次不包含：

- 推断 `environment(ob)` 最终对应哪个 LPC 文件。
- 建立变量、函数返回值、内建对象函数的完整对象来源解析能力。
- 改善 `hover` 或 `completion` 的对象来源识别能力。
- 为 `变量->方法名` 增加正确跨文件跳转。

也就是说，这次修的是“不要跳错”，不是“保证能跳对”。

## 现状与架构判断

结合当前项目结构，可以明确得出：

1. 当前 `definition` 的对象方法跳转主路径依赖 `resolveObjectAccessTargetPath()`。
2. 这条路径本质上只支持“可直接还原目标文件”的接收者，例如字符串路径或宏路径。
3. 当前架构没有变量级、返回值级、内建对象函数级的稳定对象来源解析层。
4. 因此，像 `environment(ob)`、普通变量、函数返回值这类接收者，当前架构下无法可靠得到目标文件。

所以用户的判断是正确的：目前项目结构确实还不足以支持通用 `变量->方法名` 定义跳转，也不足以识别 `environment(ob)` 到底是哪个文件。

## 方案选型

### 方案 A：只扩展 `CallExpression->member()`

做法：

- 把 `environment(ob)->query()`、`foo()->bar()` 这类调用表达式接收者纳入对象访问识别。
- 其他表达式形态继续保持旧行为。

优点：

- 改动最小。

缺点：

- 仍会漏掉 `arr[i]->foo()`、条件表达式接收者、更多复合表达式。
- 规则不一致，还要继续补洞。

### 方案 B：只要是 `MemberAccessExpression` 就统一视为对象访问

做法：

- `tryBuildObjectAccessInfo()` 只验证：
  - 当前节点是 `MemberAccessExpression`
  - 右侧成员名命中目标单词
- 不再要求左侧必须能被 `extractObjectReceiver()` 还原为标识符或字符串。
- 如果左侧接收者无法解析到目标文件，则返回一个“无法解析对象来源”的对象访问信息，并在 `handleObjectMethodCall()` 中直接返回 `undefined`。

优点：

- 规则最一致。
- 能一次性覆盖 `environment(ob)->query()` 这类当前已知 bug。
- 不依赖提前解决复杂对象来源推断。

缺点：

- 会把更多表达式接收者统一纳入“对象访问但暂不支持解析”的集合。
- 从用户视角看，更多场景会从“跳错”变成“跳不到”。但这正是本次想要的保守语义。

### 方案 C：开始做对象来源推断

做法：

- 为变量、返回值、内建对象函数建立类型与目标文件推断，再决定定义跳转目标。

优点：

- 长期能力更完整。

缺点：

- 明显超出当前 bugfix 范围。
- 与现有架构不匹配，风险高。

## 采用方案

采用方案 B。

理由：

- 这次需求的关键不是“正确解析 `environment(ob)`”，而是“不要错误跳到 simul_efun”。
- 只要用户写的是 `X->foo()`，语义上就已经进入对象命名空间，不应再掉回全局函数空间。
- 统一按 `MemberAccessExpression` 判定，比继续枚举接收者形态更稳，也更符合之后可能的对象解析扩展方向。

## 设计

### definition 语义调整

- `analyzeObjectAccessWithAST()` 继续负责识别当前位置是否处于对象成员调用。
- 识别条件调整为：
  - 命中 `MemberAccessExpression`
  - 右侧成员名与当前目标单词一致
- 左侧接收者不再必须能立即还原为标识符或字符串。

### 对象访问信息结构调整

当前 `ObjectAccessInfo` 假设所有命中的对象访问都可以提取出：

- `objectExpression`
- `objectIsString`
- `objectIsMacro`

这与现实不符，因为表达式接收者往往无法还原成现有目标解析逻辑可消费的形式。

因此本次需要把对象访问识别和对象目标解析拆开：

1. 第一层：识别“这是对象访问”
2. 第二层：判断“当前架构能否解析目标文件”

如果只能完成第一层，也必须阻止后续 simul_efun 回退。

### handleObjectMethodCall 失败语义

- 如果对象来源可解析，继续沿当前目标文件链查找方法定义。
- 如果对象来源不可解析，例如 `environment(ob)`、普通变量、函数返回值：
  - 直接返回 `undefined`
  - 不再进入 `resolveDirectDefinition()` 或 `findFunctionDefinition()`

## 影响文件

### `src/definitionProvider.ts`

- 调整 `tryBuildObjectAccessInfo()`，允许表达式接收者命中对象访问。
- 调整 `ObjectAccessInfo` 结构，允许“已识别对象访问但没有可解析目标路径”的状态。
- 调整 `handleObjectMethodCall()` / `resolveObjectAccessTargetPath()` 的输入约束，让无法解析来源时直接返回空结果。

### `src/__tests__/providerIntegration.test.ts`

- 增加 `environment(ob)->query()` 回归测试。
- 测试应模拟同名 simul_efun 存在，并断言 definition 返回 `undefined`。
- 明确断言不会触发 simul_efun 文件扫描。

## 数据流

1. 用户在 `environment(ob)->query()` 上执行“转到定义”。
2. `provideDefinition()` 先用 AST 判断当前位置属于 `MemberAccessExpression`。
3. 一旦命中对象访问：
   - 进入对象方法分支
   - 不再允许普通函数 / simul_efun 回退
4. 如果目标来源无法解析：
   - 返回 `undefined`
5. 只有完全不属于对象访问语义时，才继续普通函数定义查找链路。

## 错误处理

- 对象访问命中但来源未知：返回空结果。
- 对象访问命中且目标文件存在但方法不存在：返回空结果。
- 普通函数调用链路保持不变。

## 测试

需要新增或更新以下回归：

1. `ghost->write()` 继续不回退到 simul_efun。
2. `environment(ob)->query()` 在同名 simul_efun 存在时，也不回退到 simul_efun。
3. 普通 `query()` 调用仍保持原有普通函数 / simul_efun 定义查找行为。

## 验收标准

- `environment(ob)->query()` 不再跳到 simul_efun / efun。
- 其他表达式接收者的 `->` 调用也不再掉回全局函数空间。
- 普通函数调用行为不受影响。
- 不承诺新增变量或内建对象函数的正确目标跳转能力。
