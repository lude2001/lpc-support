# LPC语言语法大纲

## 第一部分：语言概览

### 1. 核心特性
- **类C语法**：基础语法与C语言一致
- **解释执行**：运行时编译，支持动态加载和热更新
- **面向对象**：每个`.c`文件即为一个类（蓝图对象）
- **自动内存管理**：垃圾回收机制，无需手动内存管理

### 2. 与C语言的关键差异
- **数据类型**：简化基本类型，新增string、mixed、mapping、object等
- **程序结构**：无main函数，文件即类，使用`create()`作为构造函数
- **函数系统**：efun（系统函数）、sefun（模拟函数）、lfun（局部函数）、apply（系统方法）
- **特殊语法**：函数指针`(: ... :)`、匿名函数、foreach循环、范围匹配等

### 3. 预处理支持
- **宏定义**：`#define`、`#include`
- **条件编译**：`#if`、`#ifdef`、`#ifndef`、`#else`、`#endif`

## 第二部分：词法结构

### 1. 基本语法元素
- **语句终结**：分号`;`必需
- **语句块**：大括号`{}`，形成作用域
- **注释**：`/* ... */`（块注释）、`//`（行注释）
- **标识符**：字母、数字、下划线，不能以数字开头，区分大小写

### 2. 关键字分类

#### 继承自C语言
```
int float void struct if else switch case default
for do while continue break return sizeof
```

#### LPC新增关键字
```
// 数据类型
string object buffer function mapping mixed class

// 函数修饰符
varargs private protected public nomask nosave

// 面向对象
inherit efun new

// 循环控制
foreach in

// 特殊用途
ref array closure __TREE__
```

#### 移除的C语言关键字
```
auto short long double char union enum typedef
const unsigned signed extern register volatile goto
```

### 3. 常量和字面量

#### 整型常量
- **十进制**：`123`、`1_000_000`
- **十六进制**：`0xFF`
- **二进制**：`0b1010`（v20230823+）
- **字符常量**：`'a'`（转换为ASCII值）

#### 浮点常量
- **十进制**：`3.14`、`3_14_15.9_2_6`
- **限制**：不支持指数形式

#### 字符串常量
- **语法**：`"string"`，支持跨行
- **定界符语法**：`@DELIMITER...DELIMITER;`（字符串定界符）
- **数组定界符语法**：`@@DELIMITER...DELIMITER;`（字符串数组定界符）
- **转义字符**：`\n`、`\t`、`\\`、`\"`、`\'`、`\nnn`（八进制）、`\xnn`（十六进制）

## 第三部分：数据类型系统

### 1. 基本数据类型

#### int（64位有符号整型）
- **取值范围**：-2^63 ~ 2^63-1
- **溢出处理**：赋值时取边界值，运算时正常溢出

#### float（双精度浮点型）
- **取值范围**：±1.7E-308 ~ ±1.7E308
- **实际精度**：等同C语言double类型

#### string（字符串类型）
- **索引操作**：`str[n]`、`str[n1..n2]`、`str[<n]`、`str[n..]`
- **边界处理**：越界自动调整范围

#### array（数组类型）
- **声明**：`dataType *arrayName`
- **初始化**：`({value1, value2, ...})`或`allocate(size, value)`
- **索引操作**：支持范围索引和右索引
- **数组运算**：
  - 合并：`array1 + array2`
  - 差集：`array1 - array2`
  - 交集：`array1 & array2`
  - 并集：`array1 | array2`

#### struct/class（结构体类型）
- **实例化**：`new(class name)`
- **成员访问**：`->`操作符（v2019.20220507+支持`.`）
- **限制**：仅支持成员变量

### 2. 高级数据类型

#### object（对象类型）
- **实例化**：`clone_object("/path/file")`或`new("/path/file")`
- **特性**：所有`.c`文件加载后都是对象

#### mapping（映射类型）
- **初始化**：`([ "key1" : value1, "key2" : value2 ])`或`([ ])`
- **操作**：`map[key] = value`、`value = map[key]`
- **特性**：键值类型为mixed，必须先初始化

#### mixed（混合类型）
- **特性**：运行时类型检查，可存储任意类型
- **限制**：`mixed *`只能赋值数组类型

#### function（函数类型）
- **用途**：存储函数指针和匿名函数
- **调用**：`(*f)(args)`或`evaluate(f, args)`

#### buffer（缓冲类型）
- **特性**：二进制数据处理，非零值终止

### 3. 变量和作用域

#### 变量声明
```
dataType varName1[, varName2 = value2, ...];
```

#### 作用域规则
- **文件作用域**：全局变量，整个文件可访问
- **块作用域**：局部变量，仅在`{}`内有效
- **函数作用域**：参数和局部变量
- **重要差异**：同一作用域内不可重复声明（与C语言不同）

## 第四部分：运算符和表达式

### 1. 算术运算符
- **一元**：`+`、`-`（注意：不支持`+variable`语法）
- **二元**：`+`、`-`、`*`、`/`、`%`
- **自增自减**：`++`、`--`（前缀和后缀）
- **复合赋值**：`+=`、`-=`、`*=`、`/=`、`%=`

### 2. 关系和逻辑运算符
- **关系**：`>`、`<`、`>=`、`<=`、`==`、`!=`
- **逻辑**：`!`、`&&`、`||`
- **真假判断**：假值（0、0.0、'\0'），真值（包括空字符串、空数组）
- **返回值特性**：`&&`返回最后非零值，`||`返回第一个非零值（与C语言不同）

### 3. 位运算符
- **基本**：`~`、`&`、`|`、`^`
- **移位**：`<<`、`>>`
- **复合赋值**：`&=`、`|=`、`^=`、`<<=`、`>>=`

### 4. LPC特殊运算符
- **子字符串**：`string[start..end]`、`string[<n]`
- **数组延展**：`...array`（展开数组元素，支持参数解包）
- **类作用域**：`class::member`（访问指定继承类的成员）
- **扩展运算**：数组和字符串的`+`、`-`运算

### 5. 三元运算符和逗号运算符
- **三元**：`condition ? value1 : value2`
- **逗号**：`expr1, expr2, expr3`（返回最后一个表达式的值）

### 6. 类型转换
- **自动转换**：赋值运算、混合类型运算、对象转字符串
- **强制转换**：推荐使用efun函数（`to_int()`、`to_float()`）
- **重要提醒**：避免C语言风格强制转换

### 7. 运算符优先级（从高到低）
1. `()`
2. `[]`、`()`、`->`、后缀`++`/`--`
3. 前缀`++`/`--`、`+`、`-`、`!`、`~`
4. `*`、`/`、`%`
5. `+`、`-`
6. `<<`、`>>`
7. `<`、`<=`、`>`、`>=`
8. `==`、`!=`
9. `&`、`^`、`|`
10. `&&`、`||`
11. `? :`
12. 赋值运算符
13. `,`

## 第五部分：控制流语句

### 1. 选择结构

#### if语句
```
if (expression) statement
if (expression) statement else statement
```
- **条件表达式**：必须用圆括号包围
- **else匹配**：就近匹配原则

#### switch语句
```
switch (expression) {
    case value1: statement; break;
    case value2: statement; break;
    default: statement;
}
```

#### LPC扩展特性
- **字符串匹配**：`case "string":`
- **范围匹配**：`case x..y:`、`case ..x:`、`case x..:`
- **混合使用**：可在同一switch中混合不同类型case

### 2. 循环结构

#### while和do-while
```
while (expression) statement
do statement while (expression);
```

#### for循环
```
for (initialization; continuation; action) statement
```
- **表达式可选**：三个表达式都可省略
- **变量声明**：可在初始化表达式中声明变量

#### foreach循环（LPC扩展）
```
foreach (var in expr) statement
foreach (var1, var2 in expr) statement
foreach (ref var in array) statement  // 引用传递
```
- **适用类型**：数组、映射、字符串
- **ref关键字**：直接修改原数据

### 3. 循环控制
- **break**：跳出当前循环或switch
- **continue**：跳过当前轮次，进入下一轮循环

## 第六部分：函数和方法

### 1. 函数分类
- **efun**：外部函数，系统提供，约300个，执行最快
- **sefun**：模拟外部函数，用户定义的全局库函数
- **lfun**：局部函数，对象内的自定义函数（方法）
- **apply**：系统方法，特定条件下自动调用（如`create()`支持可变参数）

### 2. 函数声明和定义
```
return_type function_name(parameter_list) {
    statement_block
}
```

#### 函数修饰符
- **访问控制**：`public`（默认）、`protected`、`private`
- **特殊修饰符**：`nomask`、`varargs`、`nosave`

#### 参数特性
- **可变参数**：`void test(mixed *x...)`（不定参数，无数量限制）
- **默认参数**：`void func(type param : (: default_value :))`（FluffOS 2023+）
- **引用传递**：`void func(type ref param)`（传递变量引用，可修改原值）

### 3. 函数原型
```
return_type function_name(parameter_types);
```
- **作用**：允许函数先使用后定义
- **参数名可选**：原型中参数名可省略

### 4. 匿名函数和函数指针

#### 匿名函数
```
function f = function(parameter_list) {
    statement_block
};
```

#### 函数指针（闭包语法）
```
function f = (: function_name :);
function f = (: function_name, args... :);
function f = (: expression :);
```

#### 表达式函数指针
```
function f = (: $1 + $2 :);  // $1、$2为参数占位符
function f = (: $(local_var) :);  // $()保存局部变量值
```

#### 函数调用
```
(*f)(arguments)        // 指针调用语法
evaluate(f, arguments) // evaluate函数调用
```

### 5. function类型判断
```
int functionp(mixed arg);
```
- **返回值常量**：FP_LOCAL、FP_EFUN、FP_SIMUL、FP_FUNCTIONAL、FP_ANONYMOUS
- **标志位**：FP_HAS_ARGUMENTS、FP_OWNER_DESTED、FP_NOT_BINDABLE

## 第七部分：语法差异总结

### 1. 与C语言相同的特性
- 基本语法结构、控制流语句、运算符优先级
- 函数声明定义、参数传递、递归支持

### 2. LPC独有的语法特性
- **数据类型**：string、mixed、mapping、object、function、buffer
- **函数系统**：efun/sefun/lfun/apply分类体系
- **循环扩展**：foreach循环、ref引用传递
- **选择扩展**：switch支持字符串和范围匹配
- **函数扩展**：匿名函数、闭包语法、表达式指针
- **运算符扩展**：数组字符串运算、子字符串操作、范围索引
- **特殊语法**：定界符、数组延展、类作用域符

### 3. 移除的C语言特性
- **关键字**：goto、const、指针相关类型
- **运算符**：取址`&`、点`.`、sizeof
- **语法**：传统指针运算、C标准库

### 4. 重要语义差异
- **真假判断**：空字符串和空数组为真值
- **逻辑运算返回值**：返回实际值而非0/1
- **作用域规则**：同一作用域不可重复声明变量
- **类型转换**：C风格强制转换无效
- **数组声明**：使用`*`而非`[]`

## 第八部分：最佳实践

### 1. 代码组织
- **函数原型**：文件头部声明所有函数原型
- **逻辑分组**：相关函数放在一起
- **访问控制**：合理使用public/protected/private
- **继承管理**：使用`class::method()`明确指定继承来源

### 2. 性能优化
- **函数选择**：efun > sefun > lfun
- **循环优化**：数组映射处理优先使用foreach
- **函数指针**：合理使用预设参数和$()语法
- **数组运算**：利用位运算符进行集合操作

### 3. 错误预防
- **类型检查**：使用相应的类型判断函数
- **边界检查**：注意数组越界和映射键值
- **作用域管理**：避免变量名冲突和重复声明
- **引用传递**：谨慎使用ref参数，避免意外修改

### 4. 代码风格
- **使用大括号**：即使单语句也建议使用
- **合理命名**：使用描述性的标识符
- **适当注释**：为复杂逻辑添加注释
- **一致性**：保持代码风格一致
- **定界符使用**：长文本使用定界符提高可读性