在第二章数据类型中我们简单的介绍了LPC语言的结构体，这种数据类型可以像C++一样使用class关键字代替struct，而且也使用new关键字初始化变量，但是不能和C++的类一样定义成员函数，本质只是struct数据类型，而不像C++是名副其实的类(class)，但类本来也是一自定义数据类型，所以本教程把class一样翻译为「类」。

因为 mixed 类型数组和映射的存在，让LPC语言中对数据处理上很少使用结构体，但不代表结构体没什么用，和C语言一样，结构体最大的作用是封装一系列有内在联系的不同数据类型的变量成为一个整体。

// 结构体class
class example {
    string name;
    int age;
    string *lover;
}

#define Example class example

Example test(string name, int age, string *lover)
{
    Example test = new (Example, name:name, age:age, lover:lover);

    return test;
}

int main(object me, string arg)
{
    // 变量
    Example instance;

    instance = test("mudren", 24, ({"a", "b", "c", "d", "e"}));
    // 取值
    printf("name : %s，age : %d, lover : %@-7s\n", instance->name, instance->age, instance->lover);
    return 1;
}
而且在LPC语言中，存在大量结构体相关的efun。

名称

classp() - 检测指定变量是否是 class/struct 类型
语法

int classp( mixed arg );
描述

如果变量 `arg` 是 class/struct 类型返回 1。
名称

assemble_class
语法

mixed assemble_class( mixed *elements );
描述

用数组 `elements` 的元素实例化一个结构体。
名称

disassemble_class
语法

mixed *disassemble_class( mixed instantiated_class );
描述

返回一个包含已实例化的结构体 `instantiated_class` 所有成员的值的 mixed 类型的数组。
名称

fetch_class_member
语法

mixed fetch_class_member( mixed instantiated_class, int index );
描述

返回实例化的类 `instantiated_class` 的索引为 `index` 的成员的值，这对数据成员没有标签（变量名）的匿名类非常有用。
名称

store_class_member
语法

mixed store_class_member(mixed instantiated_class, int class_element, mixed value);
描述

保存结构体 `instantiated_class` 的第 `class_element` 个成员的值为 `value`，返回更新后的结构体。
名称

classes() - 返回指定对象中的 class 变量信息
语法

mixed *classes( object ob );
mixed *classes( object ob, int flag );
描述

返回对象 `ob` 中的所有 class 类型变量数组，如果指定参数 `flag` 值为 1，还会返回成员变量名和变量类型。
名称
num_classes() - 返回指定对象中的 class 变量数量
语法
int num_classes(object ob);
描述
此外部函数返回对象 `ob` 中定义的 class 类型变量的数量。
通过这些 efun 我们可以很方便的使用结构体来开发游戏功能…………

class 和 struct 本质上是相同的概念
在 FluffOS 的 LPC 语境中，class 和 struct 本质上是相同的概念，两者在语法和功能上没有区别，只是名称不同，可视为同义词。以下是具体说明：

1. 文档与语法中的一致性
官方文档中，class 和 struct 常被并列提及（如 classp 函数的描述明确提到“检测变量是否是 class/struct 类型”），且示例中两者可互换使用。例如：

// 用 class 定义
class Person { string name; int age; }

// 用 struct 定义（功能完全相同）
struct Person { string name; int age; }
实例化、成员访问的语法对两者完全一致：

class Person p = new(class Person, name: "Alice");
struct Person s = new(struct Person, age: 30);

p->name = "Bob";  // 点运算符 (.) 也可使用
s.age = 25;
2. 实现层面的统一性
从代码实现来看（如 src/vm/internal/base/class.h 和 class.cc），LPC 对 class 和 struct 的处理逻辑完全一致：
两者均通过 class_def_t 结构体存储定义信息（类名、成员数量等）。
实例均以 array_t 形式存储，成员通过固定偏移量访问，内存管理（引用计数、分配/释放）机制相同。
编译器层面（src/compiler/internal/compiler.cc），class 和 struct 的解析、成员校验、代码生成流程完全共享同一套逻辑，无特殊区分。
3. 历史与命名习惯
这种“同义性”可能源于 LPC 对 C 语言的借鉴（C 中 struct 是原生结构，C++ 引入 class 并增加访问控制），但 LPC 简化了这一设计，未区分两者的语义或功能。
实际使用中，class 和 struct 的选择仅取决于代码风格，例如：
用 struct 表示简单数据聚合（如坐标 struct Point { int x; int y; }）。
用 class 表示更复杂的对象（如角色属性 class Character { ... }）。
总结
在 FluffOS 的 LPC 中，class 和 struct 是完全等价的，没有功能、语法或实现上的区别，仅名称不同，可根据代码风格自由选择使用。