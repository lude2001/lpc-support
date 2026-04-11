# 对象方法返回传播设计

## 1. 目标

在现有对象推导器基础上，新增“对象方法调用返回对象传播”能力，支持如下链路：

```lpc
object B;
object c;

B = load_object("/obj/a");
c = B->method(arg);
c->query_xxx();
```

当 `B->method(...)` 的实际实现方法带有 `@lpc-return-objects` 注解时，系统应将这些返回对象候选继续传播给 `c`，从而让后续 `c->...` 的定义跳转、补全和悬停继续命中真实对象方法。

本阶段要求支持：

- 跨文件、非继承 helper 调用的返回对象传播
- `B` 本身为多个候选对象时的集合传播
- `B` 的方法定义位于对象本体或其继承链中的场景
- 多个候选对象命中同一父类实现时的定义去重
- 多个候选对象各自 override 同名方法时的多实现合并

本阶段不做：

- 目标方法函数体内 `return` 表达式分析
- 普通函数调用 `foo()` 的跨文件返回传播
- `arr[i]->method()`、动态路径、动态方法名等当前已保守降级的场景

## 2. 典型场景

### 2.1 单候选对象

```lpc
object B = load_object("/obj/a");
object c = B->method();
c->query_xxx();
```

若 `/obj/a` 实际命中的 `method` 上存在：

```lpc
/**
 * @lpc-return-objects {"/obj/x", "/obj/y"}
 */
object method();
```

则 `c` 的候选对象为 `/obj/x`、`/obj/y`。

### 2.2 多候选对象

```lpc
object B;
object c;

if (flag) {
    B = load_object("/obj/a");
} else {
    B = load_object("/obj/b");
}

c = B->method();
c->query_xxx();
```

系统需要：

1. 先推导 `B` 的候选对象集合 `/obj/a`、`/obj/b`
2. 分别定位这两个对象实际命中的 `method` 实现
3. 读取这些实现上的 `@lpc-return-objects`
4. 将所有返回对象并集后传播给 `c`

### 2.3 共同父类实现

若 `/obj/a` 与 `/obj/b` 都继承 `/std/base`，且 `method` 仅定义在 `/std/base` 中，则：

- `/obj/a` 命中 `/std/base::method`
- `/obj/b` 也命中 `/std/base::method`

最终只读取一次 `/std/base::method` 的注解，不重复累计。

### 2.4 子类 override

若 `/obj/a`、`/obj/b` 继承同一父类，但：

- `/obj/a` 自己 override 了 `method`
- `/obj/b` 也自己 override 了 `method`
- `/obj/c` 没 override，落到共同父类 `base::method`

则最终需要收集 3 个“实际命中的实现定义”：

- `/obj/a::method`
- `/obj/b::method`
- `/std/base::method`

并合并这 3 个方法注解中的返回对象候选。

## 3. 总体策略

第一阶段仅依赖目标方法文档中的 `@lpc-return-objects` 作为返回对象真源，不做函数体级静态 return 分析。

传播链路：

1. 识别赋值右值中的对象成员调用：`receiver->method(...)`
2. 先推导 `receiver` 的对象候选集合
3. 对每个 receiver 候选，沿其继承链定位该候选运行时实际会命中的方法实现
4. 将所有命中的方法定义按定义位置去重
5. 从这些定义中读取 `@lpc-return-objects`
6. 解析所有返回对象路径并合并为新的候选集合
7. 将该候选集作为赋值目标变量的新来源，供后续对象推导继续使用

核心原则：

- 推导的是“每个候选对象实际会 dispatch 到哪个实现”，而不是“整条继承链所有同名方法”
- 相同方法定义位置只读取一次
- 只要链路上存在任一不可证明分支，整体保守降级为 `unknown`

## 4. 状态与降级规则

继续复用现有主状态：

- `resolved`
- `multiple`
- `unknown`
- `unsupported`

不新增新的主状态枚举。

### 4.1 可成功解析的情况

满足以下条件时可继续传播：

- `receiver` 可推导出一个或多个对象候选
- 对每个候选对象，都能定位到该对象实际命中的 `method` 实现
- 每个实际命中的方法实现都存在可用的 `@lpc-return-objects`
- 注解中的每个对象路径都能解析成真实文件路径

最终：

- 去重后 1 个候选对象 → `resolved`
- 去重后多个候选对象 → `multiple`

### 4.2 保守降级为 unknown 的情况

以下任一情况都整体降级为 `unknown`：

- `receiver` 本身无法推导
- 某个 receiver 候选对象上找不到目标方法实现
- 找到了方法实现，但没有文档注释
- 有文档注释，但没有 `@lpc-return-objects`
- `@lpc-return-objects` 中任一路径无法解析为真实对象文件
- 单个 receiver 候选对象对应的方法实现存在无法消解的歧义

该规则是“全链条可证明”策略：

- 不允许在“已知分支 + 未知分支”混合时只保留已知分支
- 只要某个实际命中的实现无法继续推导，整个传播结果必须保守降级

### 4.3 unsupported 的边界

下列情况继续保持 `unsupported` 或现有保守行为：

- 根 receiver 本身属于当前已标记 `unsupported` 的结构，如 `arr[i]->method()`
- 动态方法名、动态字符串拼接、非 `->` 成员访问等当前未纳入对象推导主路径的表达式

## 5. 结果模型扩展

现有 `ObjectInferenceResult` 保持不变的主状态模型，但新增可选诊断元数据，用于告诉消费方“已经追到哪一步、为什么无法继续推导”。

建议新增：

```ts
interface ObjectInferenceDiagnostic {
    code:
        | 'missing-return-annotation'
        | 'missing-method-doc'
        | 'unresolved-method-definition';
    message: string;
    targetObjectPath?: string;
    methodName?: string;
    definitionPath?: string;
}
```

并在 `ObjectInferenceResult` 上增加：

```ts
diagnostics?: ObjectInferenceDiagnostic[];
```

用途：

- 不改变现有 Provider 的主控制流
- 区分“完全未知”和“已经定位到方法，但因缺少注解而无法继续传播”
- 为后续 hover、日志、诊断或状态提示提供结构化依据

## 6. 模块拆分

### 6.1 保持现有职责不变的模块

#### `ReturnObjectResolver`

继续负责：

- `this_object()`
- `this_player()`
- `load_object()` / `find_object()` / `clone_object()`
- 当前文件普通函数调用的 `@lpc-return-objects` 解析

不把“对象成员调用返回传播”硬塞进该模块，避免和现有 builtin/doc 逻辑耦合。

#### `ObjectInferenceService`

继续作为统一入口，不改变其“主编排层”定位。

### 6.2 新增模块：`ObjectMethodReturnResolver`

新增一个只做单一职责的小模块，负责：

- 输入一个 `receiver->method(...)` 成员调用表达式
- 推导 receiver 候选对象
- 对每个候选对象定位实际命中的方法实现
- 读取这些实现上的 `@lpc-return-objects`
- 将结果转为 `ObjectResolutionOutcome`

建议接口：

```ts
resolveMemberCallReturnOutcome(
    document: vscode.TextDocument,
    memberAccessNode: SyntaxNode
): Promise<ObjectResolutionOutcome>
```

### 6.3 `ReceiverTraceService` 的最小接入点

在 `ReceiverTraceService.resolveSourceExpression(...)` 中新增一个分支：

1. 若表达式是 `Identifier`，继续现有标识符追踪
2. 若表达式是 `MemberAccessExpression` 且操作符为 `->`，优先走 `ObjectMethodReturnResolver`
3. 其余表达式继续走 `ReturnObjectResolver.resolveExpressionOutcome(...)`

这样只是在“赋值右值为对象方法调用”的情况下新增传播能力，不会扰动其它已有推导路径。

## 7. 继承链查找复用原则

第一阶段不重写方法定位逻辑，必须复用现有“沿对象继承链查找方法定义”的能力。

规则：

1. 对每个 receiver 候选对象分别执行“实际 dispatch 视角”的方法定位
2. 对该候选对象，只取其运行时实际命中的那个实现
3. 命中的方法定义位置按 `(file, range)` 或等价定义键去重
4. 再基于这些去重后的方法定义读取 `@lpc-return-objects`

这保证：

- 共同父类实现只会被读取一次
- 子类 override 会正确覆盖父类实现
- 多候选对象各自命中不同 override 时，所有真实实现都能参与返回对象合并

## 8. Hover 展示规则

### 8.1 悬停在 `B->method` 上

这里展示的是“当前对象方法调用的实现文档”，不是返回对象传播信息本身。

规则：

- 对 `B` 的每个候选对象，定位其实际命中的 `method` 实现
- 按定义位置去重
- 单候选实现：保持现有单文档展示
- 多候选实现：在同一次 hover 中分块完整展示多个实现文档
- 不因签名或文档相似而合并不同文件的实现文档

若部分候选无法继续推导：

- 不将残缺信息伪装成正常文档
- 可在 hover 末尾附加一条说明，指出“另有 N 个候选实现无法继续推导”

### 8.2 悬停在 `c->xxx` 上，其中 `c` 来自 `B->method()`

此时：

1. 先通过新增的返回传播能力推导 `c` 的对象候选集合
2. 再按现有对象方法 hover 逻辑展示这些候选对象中 `xxx` 的方法文档

核心原则：

- hover 永远展示“当前这次成员访问实际候选实现”的文档
- `@lpc-return-objects` 只负责传播候选集合，不直接作为 hover 主体内容展示

## 9. 用户提示策略

当系统已经定位到某个实际命中的方法定义，但因缺少文档或缺少 `@lpc-return-objects` 无法继续传播时，需要明确提示用户。

第一阶段不要求直接做成编辑器诊断红线，但推导结果中必须保留结构化诊断信息，供 hover、日志或后续 UI 使用。

示例文案：

- `已定位 /obj/a->method() 的实际定义，但该方法未标注 @lpc-return-objects，无法继续推导返回对象`
- `已定位 3 个可能实现，其中 1 个缺少 @lpc-return-objects，返回对象推导已保守降级为 unknown`

## 10. 测试范围

第一阶段至少补这些回归：

1. 单候选 receiver + 单返回对象
2. 单候选 receiver + 多返回对象
3. 多候选 receiver + 多实现返回对象合并
4. 多候选 receiver 收敛到同一父类实现时只读取一次
5. 不同候选对象分别命中各自 override 与共同父类实现时全部纳入
6. 某个实际命中实现缺少文档或缺少 `@lpc-return-objects` 时整体 `unknown`
7. 注解中的路径无法解析时整体 `unknown`
8. 变量链传播：`c = B->method(); d = c; d->foo()`
9. 悬停在多候选 `B->method` 上时，按实现分块展示多个文档

## 11. 非目标

以下内容明确不属于本阶段：

- 解析目标方法函数体中的 `return` 路径
- 针对普通 `foo()` 调用做跨文件返回对象传播
- 覆盖数组、mapping、动态路径拼接、动态索引等当前已保守降级的结构
- 引入新的对象推导主状态类型
- 在第一阶段强绑定新的 UI 展示面板或复杂诊断系统
