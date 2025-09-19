// LPC 格式化测试文件
// 测试各种LPC语法的格式化效果

inherit "/std/room";

// 测试变量声明
int x=5,y=10;
string   *arr=   ({"hello","world"});
mapping data=([
"key1":"value1",
"key2":"value2"
]);

// 测试函数定义
void create(){
this_object()->set_properties(([
"short":"测试房间",
"long":"这是一个用于测试格式化功能的房间。"
]));
}

// 测试复杂控制结构
void test_control_structures(){
// 测试if语句
if(x>5){
write("x大于5");
}else{
write("x不大于5");
}

// 测试for循环
for(int i=0;i<10;i++){
if(i%2==0)continue;
write(sprintf("奇数: %d",i));
}

// 测试foreach循环
foreach(string item in arr){
write("项目: "+item);
}

// 测试foreach ref语法
foreach(ref string item in arr){
item=upper_case(item);
}

// 测试switch语句和范围匹配
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
default:
write("其他情况");
break;
}
}

// 测试函数指针
void test_function_pointers(){
function fp=(:write:);
fp("使用函数指针调用");

// 测试表达式函数指针
function calc=(:$1+$2:);
int result=evaluate(calc,3,4);

// 测试匿名函数
function f=function(int a,int b){return a*b;};
}

// 测试varargs函数
void test_varargs(mixed *args...){
foreach(mixed arg in args){
write("参数: "+sprintf("%O",arg));
}
}

// 测试默认参数
void test_default_params(string msg:(:"默认消息":),int count:(: 1 :)){
for(int i=0;i<count;i++){
write(msg);
}
}

// 测试new表达式
void test_new_expressions(){
object room=new("/std/room",
member1:"value1",
member2:"value2"
);
}

// 测试类型转换
void test_casting(){
mixed value="123";
int num=(int)value;
string str=(string)num;
}

// 测试复杂数组和映射操作
void test_complex_structures(){
// 数组操作
int *nums=({1,2,3,4,5});
int *evens=filter(nums,(:$1%2==0:));
int *doubled=map(nums,(:$1*2:));

// 数组范围操作
int *slice=nums[1..3];
int *tail=nums[<3];
int *head=nums[..2];

// 映射操作
mapping complex_map=([
"users":({
(["name":"张三","age":25]),
(["name":"李四","age":30])
}),
"config":(["debug":1,"verbose":0])
]);
}

// 测试定界符语法（如果支持）
@TEST_DELIMITER
这里是定界符内容
可以包含任何文本
TEST_DELIMITER;

// 测试预处理指令
#define MAX_VALUE 100
#include "/include/lib.h"
#if DEBUG
void debug_function(){
write("调试模式");
}
#endif

// 测试深度嵌套结构
void test_deep_nesting(){
if(x>0){
for(int i=0;i<10;i++){
if(i%2==0){
foreach(string item in arr){
if(strlen(item)>3){
switch(item[0]){
case 'a'..'z':
write("小写字母开头");
break;
case 'A'..'Z':
write("大写字母开头");
break;
default:
write("其他字符开头");
break;
}
}
}
}
}
}
}

// 测试复杂的函数调用
void test_complex_calls(){
this_object()->call_other("some_function",
arg1,
arg2,
arg3,
...additional_args
);

// 链式调用
environment(this_object())->query_property("name")->lower_case();
}