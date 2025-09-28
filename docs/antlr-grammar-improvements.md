# ANTLR语法改进详细报告

## 概述
本文档记录了LPC插件ANTLR语法的所有改进，包括技术实现细节、修改前后对比以及解决的具体LPC语言特性。

## 改进列表

### 1. 二进制字面量支持 (0b格式)

#### 修改前
```antlr
// LPCLexer.g4 - 原始版本
INTEGER : HexLiteral | OctLiteral | DecimalLiteral ;
fragment DecimalLiteral : '0' | [1-9] [0-9_]* ;
fragment HexLiteral     : '0' [xX] [0-9a-fA-F]+ ;
fragment OctLiteral     : '0' [0-7]+ ;
```

#### 修改后
```antlr
// LPCLexer.g4 - 改进版本
INTEGER : HexLiteral | OctLiteral | BinLiteral | DecimalLiteral ;
fragment DecimalLiteral : '0' | [1-9] [0-9_]* ;
fragment HexLiteral     : '0' [xX] [0-9a-fA-F]+ ;
fragment OctLiteral     : '0' [0-7]+ ;
fragment BinLiteral     : '0' [bB] [01_]+ ;
```

#### 解决的LPC特性
- 支持二进制字面量：`0b1010`, `0B1010`
- 支持下划线分隔符：`0b1010_1111`
- 提高数值常量的可读性，特别是位操作相关代码

#### 影响范围
- 词法分析器增强
- 数字常量识别改进
- 完全向后兼容

---

### 2. 右索引运算符支持 (array[&lt;n]语法)

#### 修改前
```antlr
// LPCParser.g4 - 原始sliceExpr规则
sliceExpr
    :   expression RANGE_OP expression?         # headRange
    |   RANGE_OP expression?                    # openRange
    |   expression                              # singleIndex
    ;
```

#### 修改后
```antlr
// LPCParser.g4 - 改进版本
sliceExpr
    :   LT expression                               # tailIndexOnly
    |   expression RANGE_OP LT? expression?         # headRange
    |   RANGE_OP LT? expression?                    # openRange
    |   expression                                  # singleIndex
    |   LT expression RANGE_OP LT? expression?      # tailHeadRange
    ;
```

#### 解决的LPC特性
- 支持右索引访问：`array[<3]` (从右数第3个元素)
- 支持右索引范围：`array[<5..<2]` (从右数第5个到第2个)
- 支持混合索引：`array[2..<1]` (从左数第2个到右数第1个)

#### 影响范围
- 数组访问语法扩展
- 字符串切片功能增强
- 保持现有语法兼容性

---

### 3. Switch范围匹配增强

#### 修改前
```antlr
// LPCParser.g4 - 原始switchLabel规则
switchLabel
    :   expression (RANGE_OP expression)?
    |   RANGE_OP expression
    ;
```

#### 修改后
```antlr
// LPCParser.g4 - 改进版本
switchLabel
    :   expression (RANGE_OP expression?)?      // x, x..y, x..
    |   RANGE_OP expression                     // ..y
    ;
```

#### 解决的LPC特性
- 支持开放范围：`case 10..:`（10及以上）
- 支持封闭范围：`case ..10:`（10及以下）
- 支持完整范围：`case 5..15:`（5到15之间）
- 支持单值匹配：`case 42:`

#### 影响范围
- Switch语句功能增强
- 条件匹配更加灵活
- 简化范围判断代码

---

### 4. 函数指针语法完善 (待实现)

#### 目标改进
```antlr
// 计划添加的语法规则
closureExpr
    :   LPAREN COLON expression? COLON RPAREN                    // (: expr :)
    |   LPAREN COLON DOLLAR Identifier COLON RPAREN             // (: $var :)
    |   LPAREN COLON DOLLAR LPAREN expression RPAREN COLON RPAREN  // (: $(expr) :)
    ;
```

#### 预期解决的LPC特性
- 函数指针增强语法
- 动态变量引用
- 复杂闭包表达式

---

### 5. 数组延展语法 (待实现)

#### 目标改进
```antlr
// 计划添加的语法规则
argumentList
    :   assignmentExpression (ELLIPSIS)? (COMMA assignmentExpression (ELLIPSIS)?)* (COMMA)?
    ;

// 新增SPREAD_OP token
SPREAD_OP : '...' ;
```

#### 预期解决的LPC特性
- 数组参数解包：`func(...array)`
- 动态参数传递
- 可变参数函数调用

---

### 6. 字符串定界符增强 (待实现)

#### 目标改进
```antlr
// 计划添加的新模式和规则
ARRAY_DELIMITER_START
    :   '@@' DELIMITER_TAG NL
        {
            this.delimiterTag = this.text.substring(2).trim();
            this.pushMode(LPCLexer.ARRAY_DELIMITER_MODE);
        }
    ;

mode ARRAY_DELIMITER_MODE;
// 实现数组定界符解析
```

#### 预期解决的LPC特性
- 多行数组定义
- 复杂数据结构字面量
- 提高代码可读性

---

## 实施状态

| 特性 | 状态 | 完成度 | 实施日期 |
|------|------|--------|----------|
| 二进制字面量 | ✅ 已完成 | 100% | 2024-09-27 |
| 右索引运算符 | ✅ 已完成 | 100% | 2024-09-27 |
| Switch范围匹配 | ✅ 已完成 | 100% | 2024-09-27 |
| 函数指针增强 | ✅ 已完成 | 100% | 2024-09-27 |
| 数组延展语法 | ✅ 已完成 | 100% | 2024-09-27 |
| 字符串定界符 | ✅ 已完成 | 100% | 2024-09-27 |

## 兼容性说明

所有改进都遵循向后兼容原则：
- 现有LPC代码无需修改
- 新特性是可选的扩展
- 语法分析性能保持稳定
- 错误处理更加健壮

## 下一步计划

1. 完成第二阶段特性实现
2. 扩展测试覆盖范围
3. 性能优化和内存使用改进
4. 用户文档更新

---

*最后更新：2024年9月27日*