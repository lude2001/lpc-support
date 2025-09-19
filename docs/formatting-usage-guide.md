# LPC格式化功能使用指南

## 概述

LPC Support扩展提供了功能完整的LPC代码格式化功能，支持所有LPC语法特性，包括FluffOS的高级语法和特殊语法结构。

## 快速开始

### 启用格式化功能

格式化功能默认启用，无需额外配置。

### 基本使用方法

1. **格式化整个文档**
   - 快捷键：`Shift + Alt + F`（Windows/Linux）或 `Shift + Option + F`（Mac）
   - 命令面板：`Developer: Format Document`

2. **格式化选中范围**
   - 快捷键：`Ctrl + K, Ctrl + F`（Windows/Linux）或 `Cmd + K, Cmd + F`（Mac）
   - 右键菜单：`Format Selection`

3. **保存时自动格式化**
   ```json
   {
     "editor.formatOnSave": true
   }
   ```

## 支持的LPC语法特性

### 基础语法
- ✅ 变量声明和初始化
- ✅ 函数定义和调用
- ✅ 控制流语句（if/else, for, while等）
- ✅ 操作符和表达式
- ✅ 注释格式化

### LPC特定语法
- ✅ **函数指针**：`(: function_name :)`
- ✅ **数组字面量**：`({ "item1", "item2" })`
- ✅ **映射字面量**：`([ "key": "value" ])`
- ✅ **继承语句**：`inherit "/std/object";`

### 高级语法特性
- ✅ **Switch范围匹配**：`case x..y:`, `case ..x:`, `case x..:`
- ✅ **Foreach ref语法**：`foreach (ref var in array)`
- ✅ **匿名函数**：`function f = function(params) { body };`
- ✅ **表达式函数指针**：`(: $1 + $2 :)`, `(: $(local_var) :)`
- ✅ **Varargs函数**：`void test(mixed *x...)`
- ✅ **默认参数**：`void func(type param : (: default_value :))`
- ✅ **引用传递**：`void func(type ref param)`
- ✅ **范围操作**：`str[start..end]`, `str[<n]`, `str[n..]`
- ✅ **数组延展**：`...array`
- ✅ **类作用域**：`class::member`
- ✅ **New表达式**：`new(type, member: value)`
- ✅ **类型转换**：`(type)expression`

### 特殊语法
- ✅ **定界符语法**：`@DELIMITER...DELIMITER;`
- ✅ **预处理指令**：`#define`, `#include`, `#if/#ifdef/#ifndef`
- ✅ **复杂嵌套结构**：深层嵌套的控制流和数据结构

## 配置选项详解

### 基础格式化设置

```json
{
  // 缩进设置
  "lpc.formatting.indentSize": 4,
  "lpc.formatting.useSpaces": true,

  // 行设置
  "lpc.formatting.insertFinalNewline": true,
  "lpc.formatting.trimTrailingWhitespace": true,
  "lpc.formatting.maxLineLength": 120,

  // 空格设置
  "lpc.formatting.spaceAroundOperators": true,
  "lpc.formatting.spaceAfterComma": true,
  "lpc.formatting.spaceBeforeOpenParen": false,
  "lpc.formatting.spaceInsideParentheses": false,
  "lpc.formatting.spaceInsideBraces": true,
  "lpc.formatting.spaceInsideBrackets": false
}
```

### LPC特定设置

```json
{
  // LPC语法格式化
  "lpc.formatting.formatFunctionPointers": true,
  "lpc.formatting.formatMappings": true,
  "lpc.formatting.formatArrays": true,
  "lpc.formatting.preserveComments": true,

  // 格式化风格
  "lpc.formatting.functionCallStyle": "compact",     // "compact" | "expanded"
  "lpc.formatting.functionDefStyle": "expanded",     // "compact" | "expanded"
  "lpc.formatting.controlStructureStyle": "compact"  // "compact" | "expanded"
}
```

### 高级语法设置

```json
{
  // 高级LPC语法
  "lpc.formatting.spaceAfterKeywords": true,
  "lpc.formatting.spaceBeforeOpenBrace": true,
  "lpc.formatting.spaceAfterCast": true,
  "lpc.formatting.formatSwitchRanges": true,
  "lpc.formatting.formatForeachRef": true,
  "lpc.formatting.formatAnonymousFunctions": true,
  "lpc.formatting.formatExpressionPointers": true,
  "lpc.formatting.formatVarargs": true,
  "lpc.formatting.formatDefaultParameters": true,
  "lpc.formatting.formatRangeOperations": true,
  "lpc.formatting.formatNewExpressions": true,
  "lpc.formatting.formatCastExpressions": true
}
```

### 性能设置

```json
{
  // 性能优化
  "lpc.formatting.enableIncrementalFormatting": true,
  "lpc.formatting.maxFormatTime": 5000
}
```

## 格式化示例

### 变量声明格式化

**格式化前：**
```c
int x=5,y=10;
string   *arr=   ({"hello","world"});
mapping data=([
"key1":"value1",
"key2":"value2"
]);
```

**格式化后：**
```c
int x = 5, y = 10;
string *arr = ({ "hello", "world" });
mapping data = ([
    "key1": "value1",
    "key2": "value2"
]);
```

### 函数定义格式化

**格式化前：**
```c
void create(){
this_object()->set_properties(([
"short":"测试房间",
"long":"这是一个测试房间。"
]));
}
```

**格式化后：**
```c
void create() {
    this_object()->set_properties(([
        "short": "测试房间",
        "long": "这是一个测试房间。"
    ]));
}
```

### 控制结构格式化

**格式化前：**
```c
if(x>5){
write("x大于5");
}else{
write("x不大于5");
}

for(int i=0;i<10;i++){
if(i%2==0)continue;
write(sprintf("奇数: %d",i));
}
```

**格式化后：**
```c
if (x > 5) {
    write("x大于5");
} else {
    write("x不大于5");
}

for (int i = 0; i < 10; i++) {
    if (i % 2 == 0) continue;
    write(sprintf("奇数: %d", i));
}
```

### Switch范围匹配格式化

**格式化前：**
```c
switch(x){
case 1..5:
write("x在1到5之间");
break;
case ..10:
write("x小于等于10");
break;
case 15..:
write("x大于等于15");
break;
}
```

**格式化后：**
```c
switch (x) {
    case 1 .. 5:
        write("x在1到5之间");
        break;
    case .. 10:
        write("x小于等于10");
        break;
    case 15 .. :
        write("x大于等于15");
        break;
}
```

### Foreach ref语法格式化

**格式化前：**
```c
foreach(ref string item in arr){
item=upper_case(item);
}
```

**格式化后：**
```c
foreach (ref string item in arr) {
    item = upper_case(item);
}
```

### 函数指针格式化

**格式化前：**
```c
function fp=(:write:);
function calc=(:$1+$2:);
```

**格式化后：**
```c
function fp = (: write :);
function calc = (: $1 + $2 :);
```

## 高级功能

### 增量格式化

增量格式化功能会自动检测文档变更，仅格式化修改的部分，显著提高大文件的格式化性能。

**启用条件：**
- 文档大小超过1000字符
- 变更数量不超过10个
- 变更行数不超过总行数的30%

**配置：**
```json
{
  "lpc.formatting.enableIncrementalFormatting": true
}
```

### 错误恢复

当代码存在语法错误时，格式化器会尝试：
1. 跳过错误的行，格式化正常的代码
2. 基于语法树进行部分格式化
3. 在完全失败时保持原始代码不变

### 性能监控

可以通过命令面板查看格式化性能统计：
- 命令：`LPC: 显示性能统计`
- 快捷键：无（可自定义）

## 最佳实践

### 1. 团队协作

在团队项目中，建议创建统一的配置文件：

**.vscode/settings.json**
```json
{
  "lpc.formatting.indentSize": 4,
  "lpc.formatting.useSpaces": true,
  "lpc.formatting.maxLineLength": 100,
  "lpc.formatting.functionCallStyle": "compact",
  "lpc.formatting.functionDefStyle": "expanded",
  "editor.formatOnSave": true
}
```

### 2. 大文件优化

对于大型LPC文件：
- 启用增量格式化
- 适当增加格式化超时时间
- 考虑分批格式化

```json
{
  "lpc.formatting.enableIncrementalFormatting": true,
  "lpc.formatting.maxFormatTime": 10000
}
```

### 3. 代码风格统一

根据项目需求选择合适的格式化风格：

**紧凑风格（适合屏幕空间有限）：**
```json
{
  "lpc.formatting.functionCallStyle": "compact",
  "lpc.formatting.controlStructureStyle": "compact",
  "lpc.formatting.spaceInsideBraces": false
}
```

**展开风格（适合可读性优先）：**
```json
{
  "lpc.formatting.functionCallStyle": "expanded",
  "lpc.formatting.controlStructureStyle": "expanded",
  "lpc.formatting.spaceInsideBraces": true
}
```

## 故障排除

### 常见问题

1. **格式化无效果**
   - 检查文件语言是否设置为`lpc`
   - 确认没有语法错误阻止格式化
   - 检查配置是否正确

2. **格式化速度慢**
   - 启用增量格式化
   - 检查文件大小和复杂度
   - 考虑分段格式化

3. **格式化结果不符合预期**
   - 检查相关配置选项
   - 查看错误和警告信息
   - 尝试重置配置为默认值

### 调试信息

获取详细的调试信息：
```
命令面板 > LPC: 调试：解析错误详情
命令面板 > LPC: 显示性能统计
```

### 报告问题

如果遇到格式化问题，请提供：
1. 原始代码示例
2. 期望的格式化结果
3. 当前配置设置
4. 错误信息（如有）

## 更新日志

### v0.1.7
- ✅ 完整的LPC语法支持
- ✅ 高级语法特性格式化
- ✅ 增量格式化功能
- ✅ 错误恢复机制
- ✅ 性能优化
- ✅ 38个配置选项

## 支持

如需帮助或报告问题，请访问：
- GitHub Issues: [项目地址](https://github.com/lude2001/lpc-support/issues)
- 文档: [完整文档](https://github.com/lude2001/lpc-support#readme)