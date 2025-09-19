# LPC 代码格式化功能

## 概述

LPC Support 扩展现在包含了完整的代码格式化功能，支持对 LPC 代码进行智能格式化，包括缩进、空格、换行等多种格式化选项。

## 主要特性

### 基础格式化
- **缩进控制**：支持空格和制表符缩进，可配置缩进大小
- **空格管理**：操作符周围、逗号后、括号内的空格处理
- **换行控制**：花括号前后、行尾的换行处理
- **行长度限制**：可配置最大行长度，自动换行

### LPC 特定功能
- **函数指针格式化**：`(: function_name :)` 语法的格式化
- **数组字面量**：`({ element1, element2 })` 格式化
- **映射字面量**：`([key: value, key2: value2])` 格式化
- **继承语句**：`inherit "/path/file"` 格式化
- **函数调用**：参数对齐和换行控制

### 性能优化
- **智能缓存**：缓存格式化结果，提高性能
- **增量格式化**：仅格式化变更的部分
- **异步处理**：不阻塞编辑器响应
- **超时保护**：避免格式化时间过长

## 使用方法

### 格式化整个文档
1. 在 LPC 文件中右键菜单选择 "格式化文档"
2. 使用快捷键 `Shift+Alt+F`
3. 使用命令面板：`LPC: 格式化LPC文档`

### 格式化选中区域
1. 选中要格式化的代码
2. 右键菜单选择 "格式化选择"
3. 使用快捷键 `Ctrl+K Ctrl+F`
4. 使用命令面板：`LPC: 格式化LPC选中区域`

### 自动格式化
可以在 VS Code 设置中启用：
- `"editor.formatOnSave": true` - 保存时自动格式化
- `"editor.formatOnType": true` - 输入时自动格式化
- `"editor.formatOnPaste": true` - 粘贴时自动格式化

## 配置选项

### 基础设置

```json
{
  "lpc.formatting.indentSize": 4,
  "lpc.formatting.useSpaces": true,
  "lpc.formatting.maxLineLength": 120,
  "lpc.formatting.insertFinalNewline": true,
  "lpc.formatting.trimTrailingWhitespace": true
}
```

### 空格设置

```json
{
  "lpc.formatting.spaceAroundOperators": true,
  "lpc.formatting.spaceAfterComma": true,
  "lpc.formatting.spaceAfterSemicolon": true,
  "lpc.formatting.spaceBeforeOpenParen": false,
  "lpc.formatting.spaceInsideParentheses": false,
  "lpc.formatting.spaceInsideBraces": true,
  "lpc.formatting.spaceInsideBrackets": false
}
```

### 换行设置

```json
{
  "lpc.formatting.alignParameters": true,
  "lpc.formatting.alignArguments": false,
  "lpc.formatting.newlineBeforeOpenBrace": false,
  "lpc.formatting.newlineAfterOpenBrace": true,
  "lpc.formatting.newlineBeforeCloseBrace": true
}
```

### LPC 特定设置

```json
{
  "lpc.formatting.formatFunctionPointers": true,
  "lpc.formatting.formatMappings": true,
  "lpc.formatting.formatArrays": true,
  "lpc.formatting.preserveComments": true,
  "lpc.formatting.functionCallStyle": "compact",
  "lpc.formatting.functionDefStyle": "expanded",
  "lpc.formatting.controlStructureStyle": "compact"
}
```

### 高级设置

```json
{
  "lpc.formatting.enableIncrementalFormatting": true,
  "lpc.formatting.enableParallelProcessing": false,
  "lpc.formatting.maxFormatTime": 5000
}
```

## 格式化样式模板

### 紧凑风格
适合喜欢紧凑代码的开发者：
```json
{
  "lpc.formatting.indentSize": 2,
  "lpc.formatting.spaceAroundOperators": false,
  "lpc.formatting.spaceInsideBraces": false,
  "lpc.formatting.newlineBeforeOpenBrace": false,
  "lpc.formatting.functionCallStyle": "compact",
  "lpc.formatting.functionDefStyle": "compact"
}
```

### 宽松风格
更易读的格式化风格：
```json
{
  "lpc.formatting.indentSize": 4,
  "lpc.formatting.spaceAroundOperators": true,
  "lpc.formatting.spaceInsideBraces": true,
  "lpc.formatting.newlineBeforeOpenBrace": true,
  "lpc.formatting.functionCallStyle": "expanded",
  "lpc.formatting.functionDefStyle": "expanded"
}
```

### 经典 LPC 风格
传统 LPC 代码风格：
```json
{
  "lpc.formatting.indentSize": 4,
  "lpc.formatting.useSpaces": false,
  "lpc.formatting.spaceAroundOperators": true,
  "lpc.formatting.newlineBeforeOpenBrace": false,
  "lpc.formatting.functionCallStyle": "compact",
  "lpc.formatting.functionDefStyle": "expanded"
}
```

## 管理和调试

### 查看格式化统计
使用命令 `LPC: 显示格式化统计` 查看：
- 缓存命中率
- 平均格式化时间
- 内存使用情况
- 成功率统计

### 清理缓存
使用命令 `LPC: 清理格式化缓存` 清理格式化缓存。

### 性能报告
使用命令 `LPC: 生成格式化报告` 生成详细的性能报告。

### 重置统计
使用命令 `LPC: 重置格式化统计` 重置性能统计数据。

## 格式化示例

### 格式化前
```lpc
inherit   "/lib/base";

int    global_var=  5;
string  *array_var;

void create(){
if(true){
printf("Hello World");
}
}

void test_function_pointer(){
function fp=(:function_name:);
call_out(fp,5);
}

void test_collections(){
array_var=({"item1","item2","item3"});
test_mapping=(["key1":"value1","key2":"value2"]);
}
```

### 格式化后
```lpc
inherit "/lib/base";

int global_var = 5;
string *array_var;

void create() {
    if (true) {
        printf("Hello World");
    }
}

void test_function_pointer() {
    function fp = (: function_name :);
    call_out(fp, 5);
}

void test_collections() {
    array_var = ({ "item1", "item2", "item3" });
    test_mapping = ([ "key1": "value1", "key2": "value2" ]);
}
```

## 常见问题

### Q: 格式化速度慢怎么办？
A: 
1. 检查 `lpc.formatting.maxFormatTime` 设置
2. 启用增量格式化 `lpc.formatting.enableIncrementalFormatting`
3. 使用 `LPC: 清理格式化缓存` 清理缓存

### Q: 格式化结果不符合预期？
A:
1. 检查相关配置项是否正确
2. 确保代码语法正确（语法错误可能影响格式化）
3. 查看输出面板中的错误信息

### Q: 某些 LPC 语法不被支持？
A:
1. 确保使用的是标准 LPC 语法
2. 检查是否是特定方言的语法
3. 可以在 GitHub 提交问题反馈

### Q: 格式化后代码逻辑发生变化？
A:
格式化器只改变代码的格式，不应该影响逻辑。如果发现此问题，请立即报告。

## 技术细节

### 架构概述
- **FormattingController**: 协调整个格式化流程
- **FormattingEngine**: 核心格式化逻辑
- **RuleEngine**: 管理格式化规则
- **FormattingVisitor**: 遍历语法树并应用规则
- **FormattingCache**: 缓存格式化结果

### 扩展性
格式化系统采用插件化设计，可以轻松添加新的格式化规则：
1. 继承 `BaseFormattingRule` 类
2. 实现 `canApply` 和 `apply` 方法
3. 通过 `RuleEngine.addRule()` 注册规则

### 性能优化
1. **智能缓存**: 缓存解析结果和格式化结果
2. **增量处理**: 只处理变更的代码段
3. **异步操作**: 避免阻塞 UI 线程
4. **内存管理**: 自动清理过期缓存

## 更新日志

### v0.1.7
- 添加完整的 LPC 代码格式化功能
- 支持多种格式化选项和样式
- 实现智能缓存和性能优化
- 添加 LPC 特定语法支持

---

有关更多信息，请参考 [VS Code 扩展文档](https://code.visualstudio.com/api) 和 [LPC 语言参考](https://fluffos.info/)。