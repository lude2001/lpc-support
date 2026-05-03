# FluffOS LPC 方言 Profile

日期：2026-05-03

本文档说明 `lpc-support` 当前静态前端默认支持的 LPC / FluffOS 语言边界。它不是 TextMate 高亮规则，而是 parser、syntax、semantic 和语言服务共同消费的方言契约。

## 支持范围

当前默认 profile 名称为 `FluffOS`。

已支持的关键字、类型和结构包括：

- 控制流：`if`、`else`、`for`、`while`、`do`、`switch`、`case`、`default`、`break`、`continue`、`return`、`foreach`
- 声明与类型：`int`、`float`、`string`、`object`、`mixed`、`mapping`、`function`、`buffer`、`void`、`struct`、`class`
- LPC 结构：`inherit`、statement 风格 `include`、`catch`、`ref`、`new`
- 表达式：函数调用、成员访问、索引、三元表达式、赋值、逻辑/位运算、range/slice、mapping、array、closure、匿名函数

已支持的预处理能力包括：

- `#include`、`#define`、`#undef`
- `#if`、`#ifdef`、`#ifndef`、`#elif`、`#else`、`#endif`
- inactive range 计算
- include reference / include graph facts
- 当前文件宏定义和宏引用 facts
- 对整行函数式宏调用做保守展开，用于消除 `RequestType(...) public ...` 这类合法 Mudlib 代码的误报

## 识别但未完整支持

下列关键字和操作符已被记录为方言缺口。前端会把它们视为已知 LPC 方言面，但 parser/semantic checker 不承诺完整语义：

- 关键字：`any`、`bytes`、`closure`、`deprecated`、`false`、`functions`、`intrinsic`、`is`、`lwobject`、`null`、`status`、`symbol`、`true`、`undefined`、`unknown`、`virtual`、`async`
- 操作符：`**`、`**=`、`===`、`!==`、`=>`、`??`、`??=`、`?.`、`||=`、`&&=`、`>>>`、`>>>=`、`<..`、`@`、`@@`、`#`、`(*`、反引号

遇到这些形态时，后续版本应优先做保守降级，避免制造噪声诊断。

## 当前非目标

- 不声明完整 C 预处理器兼容性。
- 不把 include 文件文本直接拼接进当前文件 parse view。
- 不把 TextMate grammar 作为语言事实来源。
- 不用大写命名约定判断宏。

## 后续扩展原则

新增语法或预处理能力时，应先进入 `src/frontend/dialect.ts` 和对应 parser/syntax/semantic 测试，再让 completion、hover、definition、diagnostics、formatter 等消费事实。不要在 Provider 或业务逻辑里重新扫描全文推断语言结构。
