# LPC 代码格式化设计

## 概述

本文档定义 LPC / FluffOS 文件格式化能力的首版设计。目标是在 VS Code 扩展中提供：

- 格式化整个文档
- 格式化选区
- 基于少量 `lpc.format.*` 配置项的可调默认风格
- 对高风险 LPC 结构的安全处理

首版采用 Allman 风格作为默认布局，并严格要求：只要当前文档存在语法错误，就拒绝格式化，不做局部猜测性修复。

## 设计目标

- 为 `lpc` 语言增加正式的 VS Code 格式化能力
- 复用当前重构后的解析链路，而不是引入新的解析入口
- 普通 LPC 结构做稳定、统一的布局规范化
- 高风险结构优先保证语义安全，再考虑美观
- 选区格式化只作用于完整语法节点，避免误改无关代码

## 非目标

- 首版不支持输入时格式化
- 首版不在语法错误情况下尝试“尽力格式化”
- 首版不提供大量风格开关
- 首版不重写 `@TAG` / `@@TAG` 正文内容
- 首版不深度重排复杂多行宏

## 现有实现对齐

本设计基于当前仓库已经存在的解析与扩展结构：

- [`src/extension.ts`](/D:/code/lpc-support/src/extension.ts) 继续作为 Provider 注册入口
- [`src/parser/ParsedDocumentService.ts`](/D:/code/lpc-support/src/parser/ParsedDocumentService.ts) 作为 parse tree、token stream、diagnostics、trivia 的统一来源
- [`grammar/LPCLexer.g4`](/D:/code/lpc-support/grammar/LPCLexer.g4) 与 [`grammar/LPCParser.g4`](/D:/code/lpc-support/grammar/LPCParser.g4) 定义 formatter 需要特殊对待的 LPC 结构
- [`language-configuration.json`](/D:/code/lpc-support/language-configuration.json) 继续提供基础括号和缩进规则，但不承担完整 formatter 责任

## 推荐方案

采用“语法树 + token/trivia”的混合式 formatter：

- 用 parse tree 决定语句、块、结构化字面量、匿名函数、`switch`、`foreach` 等结构边界
- 用 token stream 与 trivia 索引处理注释、空白、简单宏、heredoc / array delimiter 边界
- 用统一 printer 输出最终文本，而不是在原文本上叠加零散替换

这个方案最适合当前仓库，原因是：

- 已有 `ParsedDocumentService` 能直接提供格式化所需的解析上下文
- 纯文本规则难以安全处理 `mapping`、二维数组、函数指针、匿名函数、`@TAG` / `@@TAG`
- 纯语法树重打印很容易误伤注释和预处理区

## 架构

```text
VS Code 格式化请求
    -> LPCFormattingProvider
    -> FormattingService
    -> ParsedDocumentService.get(document)
    -> FormatModelBuilder
    -> FormatPrinter
    -> TextEdit[]
```

### 主要模块

#### `LPCFormattingProvider`

职责：

- 接入 `registerDocumentFormattingEditProvider`
- 接入 `registerDocumentRangeFormattingEditProvider`
- 调用服务层并返回 `TextEdit[]`

#### `FormattingService`

职责：

- 获取解析结果
- 读取 `lpc.format.*` 配置
- 在语法错误时直接拒绝
- 选择整文格式化或选区格式化流程
- 将选区映射为完整语法节点

#### `FormatModelBuilder`

职责：

- 从 parse tree、visible token、hidden token、trivia 构建中间模型
- 将普通语句、结构化字面量、匿名函数、函数指针、宏、定界符文本块分类处理

#### `FormatPrinter`

职责：

- 根据默认规则和配置项输出最终文本
- 统一处理缩进、空格、换行、空行、Allman 花括号布局

## 配置项

首版只提供少量高价值配置：

- `lpc.format.indentSize`
  - 默认 `4`
- `lpc.format.maxLineLength`
  - 默认 `80` 或 `100`
- `lpc.format.preserveSingleLineBlocks`
  - 默认 `false`
- `lpc.format.enableMacroFormatting`
  - 默认 `true`

这些配置项只影响低风险布局决策，不允许覆盖安全规则。例如：

- 即使用户修改行宽，也不能改变 heredoc / array delimiter 的结束边界约束
- 即使用户开启宏格式化，也不能对复杂多行宏进行高风险重排

## 核心格式规则

### 块与控制流

- 函数、`if`、`else if`、`else`、`for`、`while`、`do while`、`foreach`、`switch`、匿名函数统一采用 Allman 风格
- 花括号换行
- 缩进使用空格
- 运算符两侧空格标准化
- 关键字后空格标准化

### 结构化数据

以下结构统一采用强制多行块状布局：

- `mapping`
- 二维数组
- 嵌套 `mapping`
- `mapping` 类型数组
- `struct` 初始化
- `class` 初始化
- `new(..., field : value)` 初始化

规则：

- 每一项单独占行
- 嵌套结构递归块状展开
- 最后一项不加尾随逗号

### `struct` / `class`

- `struct` 与 `class` 定义体采用同一套格式规则
- 成员一行一个
- 花括号采用 Allman

### 匿名函数与函数指针

- `function(...) { ... }` 匿名函数按完整 Allman 小函数处理
- `(: ... :)` 与 `(:: ... :)` 只做安全规范化：
  - 外围按普通表达式规则布局
  - 内部只修正明显安全的空格
  - 不主动深度重排复杂闭包体

### `switch` 范围语法

- `case 1..5`
- `case ..10`
- `case 15..`

这些 `RANGE_OP` 写法保持紧凑，不写成 `1 .. 5`

### 文件头指令与宏

- `#include`、`inherit` 按文件头区域整理空行与分组
- 简单对象式宏和简单函数式宏可以格式化
- 复杂多行宏只做保守处理
- 一旦无法证明重排安全，保留原有 token 顺序和结构

## Heredoc 与数组定界符

当前 grammar 已明确支持：

- `@TAG ... TAG`
- `@@TAG ... TAG;`

相关规则在 [`grammar/LPCLexer.g4`](/D:/code/lpc-support/grammar/LPCLexer.g4) 中已经定义，formatter 必须遵守以下额外约束：

- 正文内容完全原样保留
- 开始行可以跟随外围代码缩进
- 结束行必须保持在列 0
- 结束定界符前不能插入任何空格或制表符
- formatter 不得平移正文
- 如果某次局部格式化无法保证结束行列 0 约束，则直接拒绝该节点格式化

## 选区格式化规则

- 选区格式化只允许作用于完整语法节点
- 若选区只命中节点的一部分，直接拒绝
- 遇到下列高风险结构时，如果选区不覆盖完整节点，则直接拒绝：
  - heredoc
  - array delimiter
  - 匿名函数
  - `mapping`
  - `struct` / `class` 初始化
  - 宏块

## 拒绝格式化条件

出现以下情况时，返回空 edit，并向用户提示无法安全格式化：

- 文档存在语法错误
- 选区不是完整语法节点
- heredoc / array delimiter 结束边界无法保持在列 0
- 宏重排存在语义风险
- 注释归属或 trivia 恢复不确定，可能影响语义

## 测试策略

### 单元测试

- Allman printer 输出
- 结构化数据块布局
- `struct` / `class` 定义和初始化布局
- 匿名函数布局
- 函数指针安全规范化
- 宏安全分类
- heredoc / array delimiter 保守处理

### 集成测试

- 整文格式化
- 选区格式化
- 语法错误拒绝
- 高风险节点半选区拒绝
- `switch case` 范围语法
- `foreach ref` 变量格式

### 回归样例

应补充真实 LPC 样例，至少覆盖：

- 复杂 `mapping`
- 二维数组
- 嵌套 `mapping` 与 `mapping` 数组
- `struct` / `class`
- `new(..., field : value)`
- 匿名函数
- `(: :)` / `(:: :)`
- heredoc 与 `@@TAG`
- 简单宏与复杂宏

## 风险与缓解措施

### 风险：高风险 LPC 特性被普通表达式规则误伤

缓解：

- 在 builder 层先分类，再决定是否使用专门 printer
- 对 heredoc、array delimiter、复杂宏、函数指针采用保守策略

### 风险：选区格式化改动超出用户预期

缓解：

- 只格式化完整节点
- 不自动扩展模糊选区

### 风险：配置项过多导致规则矩阵膨胀

缓解：

- 首版只开放少量配置项
- 安全规则不可被配置覆盖

## 后续可扩展项

- 输入时格式化
- 更多风格配置项
- 对更多 LPC 方言差异的兼容验证
- 更精细的注释归属策略
